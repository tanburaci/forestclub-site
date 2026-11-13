// Forest Club Urla · anonim formların tek kapısı: üyelik başvurusu, tanışma bileti, Açık Çağrı, dekont ve etkinlik bileti.
// Sıra: IP başına saatlik sınır → Cloudflare Turnstile doğrulaması → SQL işlevi (service_role).
// Dekont iki adımda gelir: "dekont_adres" yükleme hakkı ve tek kullanımlık imzalı yükleme adresi verir (Turnstile'lı),
// dosya tarayıcıdan doğrudan depoya yüklenir, "dekont_kaydet" kaydı açar (yalnız bu e-postaya verilmiş yol).
//
// "Yakında" modunda (ayarlar.yakinda) üyelik başvurusu ve tanışma bileti alınmaz; Açık Çağrı ve dekont açık.
// "destek": kartla destek; Shopier ödeme sayfası ayrı pencerede açılır, ödeme shopier-bildirim'e gelir (ayarlar.kart_odeme açıkken).
// Etkinlik bileti: "bilet_adres" ödeme yolunu da alır (v.yol: havale | nakit | kart). Havale + dekontla: isteği açar (tutar sunucuda; giriş yapmış aktif üyeye üye fiyatı) ve
// imzalı yükleme adresi verir, dekont yüklenince "bilet_kaydet" isteği yöneticinin onayına düşürür.
// Etkinliğe özel ürün: "urun_siparis" (v.yol: kart | havale | nakit | pos; yalnız etkinlik saatinin çevresinde, kural sunucuda).
// Kart Shopier penceresi açar; havale imzalı dekont adresi verir, dekont yüklenince "urun_kaydet"; nakit standda ödenir (standda kart / POS yok).
// "ozel_form": gizli bağlantılı özel form; girişsiz, ad + e-postayla (anahtar sunucuda denetlenir).
// "dugun": /dugun/ sayfasındaki düğün tasarım talebi (seçimler kimlikle gelir, sunucuda adlarına çevrilir); özel davet
// bağlantısından gelirse "davet" anahtarı talebi davete bağlar.
//
// Ad alanlarında bağlantı / e-posta kabul edilmez: kulübün otomatik e-postalarında başkasına bağlantı gönderilemesin.
// Tanışma, bilet ve özel formda KVKK onayı zorunlu; onay riza_kayitlari'na yazılır.
//
// Secrets: TURNSTILE_SECRET (zorunlu), IP_TUZU (isteğe bağlı; IP özetine katılır), SHOPIER_PAT (kart ödemeleri)
import { CORS, json, servisIstemcisi } from '../_ortak/ortak.ts';
import { odemeUrunuAc, shopierHazir } from '../_ortak/shopier.ts';

// Saatlik sınırlar (IP başına); "hepsi" bütün türlerin toplamı
const SINIR: Record<string, number> = {
  basvuru: 5, tanisma: 5, cagri: 5, gonullu: 5, dekont_adres: 10, dekont_kaydet: 10, destek: 10, bilet_adres: 10, bilet_kaydet: 10, uyelik_kart: 10, urun_siparis: 10, urun_kaydet: 10, ozel_form: 40, dugun: 5, hepsi: 60,
};
// yol zaten Turnstile'lı "dekont_adres" / "bilet_adres" adımında verildi
const TURNSTILE_GEREKMEZ = new Set(['dekont_kaydet', 'bilet_kaydet', 'urun_kaydet']);
const UZANTI: Record<string, string> = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.heic': 'image/heic', '.heif': 'image/heif', '.webp': 'image/webp',
};

class KullaniciHatasi extends Error {
  constructor(mesaj: string, public durum = 400) { super(mesaj); }
}

function istemciIp(istek: Request): string {
  return istek.headers.get('cf-connecting-ip')
    || (istek.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'bilinmiyor';
}

async function ipOzeti(ip: string): Promise<string> {
  const veri = new TextEncoder().encode(`${Deno.env.get('IP_TUZU') || ''}|${ip}`);
  const ozet = new Uint8Array(await crypto.subtle.digest('SHA-256', veri));
  return Array.from(ozet.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function turnstileDogrula(jeton: unknown, ip: string): Promise<void> {
  const gizli = Deno.env.get('TURNSTILE_SECRET');
  if (!gizli) throw new KullaniciHatasi('Form koruması henüz ayarlanmadı; biraz sonra tekrar dene.', 503);
  if (typeof jeton !== 'string' || !jeton || jeton.length > 2048) throw new KullaniciHatasi('Doğrulama yapılamadı; sayfayı yenileyip tekrar dene.');
  const form = new FormData();
  form.append('secret', gizli);
  form.append('response', jeton);
  if (ip !== 'bilinmiyor') form.append('remoteip', ip);
  const yanit = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const sonuc = await yanit.json().catch(() => ({ success: false }));
  if (!sonuc.success) throw new KullaniciHatasi('Doğrulama yapılamadı; sayfayı yenileyip tekrar dene.');
}

const metin = (x: unknown, enCok = 500): string => String(x ?? '').slice(0, enCok);

// SQL işlevinin "raise exception" mesajı kullanıcıya gider; başka hatalar gitmez
async function rpc(islev: string, parametre: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await servisIstemcisi().rpc(islev, parametre);
  if (error) {
    if (error.code === 'P0001') throw new KullaniciHatasi(error.message);
    throw error;
  }
  return data;
}

// Kartla ödeme yönetimde açık mı (ayarlar.kart_odeme); kapalıyken kart seçeneği reddedilir
async function kartAcikMi(): Promise<boolean> {
  const { data } = await servisIstemcisi().from('ayarlar').select('deger').eq('anahtar', 'kart_odeme').maybeSingle();
  return !!data && data.deger === true;
}

async function acildiMi(): Promise<void> {
  const { data, error } = await servisIstemcisi().from('ayarlar').select('deger').eq('anahtar', 'yakinda').maybeSingle();
  if (error) throw error;
  if (data && data.deger === true) {
    throw new KullaniciHatasi('Üyelik başvuruları, biletler ve tanışma biletleri açılışla birlikte başlıyor. Instagram\'dan takipte kal!', 403);
  }
}

// Kartla destek: Shopier ödeme sayfası (ayrı pencerede); ödeme gelince shopier-bildirim → destek_tamamla
async function destekBaslat(tutarHam: unknown): Promise<{ sayfa: string; id: string }> {
  if (!(shopierHazir() && await kartAcikMi())) throw new KullaniciHatasi('Kartla ödeme şu an kapalı; IBAN ile gönderebilirsin.', 400);
  const o = await rpc('destek_istegi_ac', { p_tutar: Number(tutarHam) }) as { id: string; tutar: number };
  const site = (Deno.env.get('SITE_ADRESI') || 'https://www.forestcluburla.com').replace(/\/$/, '');
  const { urun, sayfa } = await odemeUrunuAc({ baslik: 'Forest Club Urla topluluk desteği', tutar: Number(o.tutar), ref: `FC-DESTEK-${o.id.slice(0, 8)}`,
    aciklama: 'Forest Club Urla topluluğuna destek. Teşekkürler!', gorsel: `${site}/_blob/shopier/destek.jpg` });  // maskot (Be happy bro)
  await rpc('destek_istegi_token', { p_id: o.id, p_token: urun });
  return { sayfa, id: o.id };
}

// Etkinliğe özel ürün siparişi: tutar ve satış saati sunucuda (urun_siparisi_ac). Dönüş: {id, kod, tutar, yol} +
// kartta Shopier sayfası, havalede imzalı dekont yükleme adresi (dosya, jeton)
async function urunSiparis(v: Record<string, unknown>): Promise<unknown> {
  const yol = ['kart', 'havale', 'nakit'].includes(String(v.yol)) ? String(v.yol) : '';
  if (!yol) throw new KullaniciHatasi('Ödeme yöntemini seç.');
  if (yol === 'kart' && !(shopierHazir() && await kartAcikMi())) throw new KullaniciHatasi('Kartla ödeme şu an kapalı; başka bir yöntem seç.');
  const kalemler = (Array.isArray(v.kalemler) ? v.kalemler : []).slice(0, 10)
    .map((k: Record<string, unknown>) => ({ urun: Math.trunc(Number(k?.urun)) || 0, adet: Math.trunc(Number(k?.adet)) || 0 }));
  const rastgele = crypto.getRandomValues(new Uint8Array(8));
  const dosya = yol === 'havale' ? `yeni/${Date.now()}-${Array.from(rastgele, (b) => b.toString(16).padStart(2, '0')).join('')}` : null;
  const s = await rpc('urun_siparisi_ac', {
    p_etkinlik: Math.trunc(Number(v.etkinlik)) || 0, p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60),
    p_kalemler: kalemler, p_yol: yol, p_dosya: dosya,
  }) as { id: number; kod: string; tutar: number; etkinlik: string; foto: string | null; kalemler: { ad: string; adet: number }[] };
  const sonuc = { id: s.id, kod: s.kod, tutar: s.tutar, yol };
  if (yol === 'kart') {
    const site = (Deno.env.get('SITE_ADRESI') || 'https://www.forestcluburla.com').replace(/\/$/, '');
    const { urun, sayfa } = await odemeUrunuAc({ baslik: `Forest Club Urla · ${s.etkinlik} · ürünler`, tutar: Number(s.tutar), ref: `FC-URUN-${s.id}`,
      aciklama: s.kalemler.map((k) => `• ${k.adet} × ${k.ad}`).join('\n'), donus: `${site}/e/${Math.trunc(Number(v.etkinlik))}`, gorsel: s.foto });
    await rpc('urun_shopier_urun', { p_id: s.id, p_urun: urun });
    return { ...sonuc, sayfa };
  }
  if (dosya) {
    const { data, error } = await servisIstemcisi().storage.from('dekontlar').createSignedUploadUrl(dosya);
    if (error || !data) throw error || new Error('İmzalı adres alınamadı');
    return { ...sonuc, dosya, jeton: data.token };
  }
  return sonuc;
}

// Ad alanı: harf, boşluk ve noktalama; bağlantı ya da e-posta değil (aynı süzgeç tanışmadaki "referans" alanında da var)
const BAGLANTI = /(https?:|www\.|:\/\/|[@\/\\<>]|[\p{L}\p{N}-]+\.[\p{L}]{2,})/iu;
function adDenetle(v: Record<string, unknown>): void {
  for (const alan of ['ad', 'referans']) {
    if (typeof v[alan] === 'string' && BAGLANTI.test(v[alan] as string)) {
      throw new KullaniciHatasi(alan === 'ad' ? 'Ad alanına yalnız adını ve soyadını yaz.' : 'Bileti veren kişinin yalnız adını ve soyadını yaz.');
    }
  }
}

// KVKK onayı (tanışma, bilet, ürün siparişi, özel form): kutu işaretli olmalı; kayıt açılınca onay yazılır
const KVKK_GEREKEN = new Set(['tanisma', 'bilet_adres', 'urun_siparis', 'ozel_form']);
async function rizaYaz(tur: string, eposta: unknown): Promise<void> {
  const ep = metin(eposta, 200).trim().toLowerCase();
  if (!ep) return;
  const surum = await rpc('riza_metin_surumu', {}).catch(() => 'bilinmiyor');
  const { error } = await servisIstemcisi().from('riza_kayitlari').insert({ eposta: ep, tur: 'kvkk', metin_surumu: String(surum), kaynak: tur });
  if (error) console.error('riza_kayitlari', tur, error);
}

async function isle(tur: string, v: Record<string, unknown>): Promise<unknown> {
  adDenetle(v);
  // Giriş yapmış üye (bilet) KVKK'yı üyelikte onayladı; ziyaretçi kutuyu işaretlemeli
  const uyeOturumu = tur === 'bilet_adres' && typeof v.oturum === 'string' && v.oturum.length > 0;
  if (KVKK_GEREKEN.has(tur) && v.kvkk !== true && !uyeOturumu) throw new KullaniciHatasi('Devam etmek için KVKK aydınlatma metnini onayla.');
  if (tur === 'basvuru' || tur === 'tanisma' || tur === 'bilet_adres' || tur === 'urun_siparis' || tur === 'gonullu') await acildiMi();
  switch (tur) {
    case 'basvuru':
      return rpc('basvuru_yap', {
        p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60),
        p_kosul: v.kosul === true, p_dogal: v.dogal === true, p_kvkk: v.kvkk === true, p_foto: v.foto === true,
      });
    case 'tanisma':
      // Tanışma biletiyle rezervasyon: referans, bilet numarası, telefon (kural sunucuda: 24 saat kala, katılım düşükse)
      return rpc('tanisma_rezervasyon', {
        p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60),
        p_referans: metin(v.referans, 200), p_bilet_no: metin(v.biletNo, 60), p_etkinlik: Number(v.etkinlik) || 0,
      });
    case 'cagri': {
      // cagri_gonder alanları kendisi kırpar; burada yalnız bilinen anahtarlar geçer
      const ANAHTAR = ['ad', 'iletisim', 'uye', 'alan', 'baslik', 'anlat', 'deneyim', 'sure', 'kisi', 'ihtiyac', 'gunler', 'uyeEposta', 'uyeTelefon'];
      const p: Record<string, unknown> = Object.fromEntries(ANAHTAR.map((k) => [k, metin(v[k], 4000)]));
      p.uyeOl = v.uyeOl === true;
      p.uyeFoto = v.uyeFoto === true;
      return rpc('cagri_gonder', { p });
    }
    case 'dekont_adres': {
      const uzanti = metin(v.uzanti, 10).toLowerCase();
      if (!UZANTI[uzanti]) throw new KullaniciHatasi('Dekont yalnız PDF ya da fotoğraf (JPG, PNG, HEIC) olabilir.');
      const rastgele = crypto.getRandomValues(new Uint8Array(8));
      const yol = `yeni/${Date.now()}-${Array.from(rastgele, (b) => b.toString(16).padStart(2, '0')).join('')}${uzanti}`;
      await rpc('dekont_yukleme_ac', { p_eposta: metin(v.eposta, 200), p_dosya: yol });
      const { data, error } = await servisIstemcisi().storage.from('dekontlar').createSignedUploadUrl(yol);
      if (error || !data) throw error || new Error('İmzalı adres alınamadı');
      return { yol, jeton: data.token, tur: UZANTI[uzanti] };
    }
    case 'dekont_kaydet':
      return rpc('dekont_kaydet', { p_eposta: metin(v.eposta, 200), p_dosya: metin(v.yol, 300) });
    case 'bilet_adres': {
      // Oturum anahtarı geldiyse doğrulanır (üye fiyatı yalnız gerçek oturuma)
      let kullanici: string | null = null;
      if (typeof v.oturum === 'string' && v.oturum.length < 4000) {
        const { data } = await servisIstemcisi().auth.getUser(v.oturum);
        kullanici = data?.user?.id ?? null;
      }
      const kalemler = (Array.isArray(v.kalemler) ? v.kalemler : []).slice(0, 5)
        .map((k: Record<string, unknown>) => ({ etkinlik: Number(k?.etkinlik) || 0, adet: Number(k?.adet) || 0 }));
      const rastgele = crypto.getRandomValues(new Uint8Array(8));
      const yol = `yeni/${Date.now()}-${Array.from(rastgele, (b) => b.toString(16).padStart(2, '0')).join('')}`;
      // Ödeme yolu: havale (dekont, varsayılan) ya da kart (Shopier; yönetimde açıksa). Nakit (girişte ödeme) ziyaretçiye
      // kapalı: istekle yer bloke edilemesin
      if (String(v.yol) === 'nakit') throw new KullaniciHatasi('Bu ödeme yolu kapalı; havale ya da kartla ödeyebilirsin.', 400);
      const odemeYolu = String(v.yol) === 'kart' ? 'kart' : 'havale';
      if (odemeYolu === 'kart' && !(shopierHazir() && await kartAcikMi())) {
        throw new KullaniciHatasi('Kartla ödeme çok yakında açılıyor; şimdilik havale ile ödeyebilirsin.', 400);
      }
      const istek = await rpc('bilet_istegi_ac_yol', {
        p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60), p_kalemler: kalemler, p_user: kullanici, p_dosya: yol,
        p_yol: odemeYolu, p_kod: metin(v.kod, 40).trim() || null,
      }) as { id: number; tutar: number };
      if (odemeYolu === 'kart') {
        const site = (Deno.env.get('SITE_ADRESI') || 'https://www.forestcluburla.com').replace(/\/$/, '');
        // Ürün adı sepetteki bütün etkinlikleri sayar (kişi kaç etkinliğe bilet aldığını Shopier'de de görsün);
        // görsel ilk etkinliğin afişi
        const ids = kalemler.map((k: { etkinlik: number }) => k.etkinlik);
        const { data: etkler } = await servisIstemcisi().from('etkinlikler').select('id, ad, tarih, saat, afis').in('id', ids);
        const sirali = ids.map((id: number) => (etkler || []).find((e: { id: number }) => e.id === id)).filter(Boolean) as { id: number; ad: string; tarih: string; saat: string | null; afis: string | null }[];
        const adet = (id: number) => kalemler.find((k: { etkinlik: number }) => k.etkinlik === id)?.adet || 0;
        const trTarih = (t: string) => t.split('-').reverse().join('.');
        const baslik = sirali.length > 1
          ? `${sirali.length} etkinlik bileti: ${sirali.map((e) => e.ad).join(' + ')}`
          : `${sirali[0]?.ad || 'Etkinlik'} bileti · ${adet(sirali[0]?.id)} kişi`;
        const aciklama = sirali.map((e) => `• ${e.ad} · ${trTarih(e.tarih)}${e.saat ? ` · ${e.saat}` : ''} · ${adet(e.id)} kişi`).join('\n');
        const ilk = sirali[0];
        // Paylaşım için üretilen JPG kopyası (afisler/paylas/<ad>.jpg; WhatsApp önizlemesindeki) her zaman Shopier'e uygun;
        // yoksa afişin kendisi (jpg / png ise), o da yoksa logo
        const m = /^(https:\/\/[^/]+\/storage\/v1\/object\/public\/afisler\/)([^/?#]+?)\.[a-z]+$/i.exec(ilk?.afis || '');
        const kucuk = m ? `${m[1]}paylas/${m[2]}.jpg` : null;
        const kucukVar = kucuk ? await fetch(kucuk, { method: 'HEAD' }).then((r) => r.ok, () => false) : false;
        const { urun, sayfa } = await odemeUrunuAc({ baslik: `Forest Club Urla · ${baslik}`, aciklama, tutar: Number(istek.tutar), ref: `FC-BILET-${istek.id}`,
          donus: `${site}/#bilet-kart-tamam`, gorsel: kucukVar ? kucuk : (ilk?.afis || null) });
        await rpc('bilet_shopier_urun', { p_id: istek.id, p_urun: urun });
        return { id: istek.id, tutar: istek.tutar, yol: 'kart', sayfa };
      }
      const { data, error } = await servisIstemcisi().storage.from('dekontlar').createSignedUploadUrl(yol);
      if (error || !data) throw error || new Error('İmzalı adres alınamadı');
      return { id: istek.id, tutar: istek.tutar, yol, jeton: data.token };
    }
    case 'uyelik_kart': {
      // Yeni başvuranın kartla aidatı (girişsiz, Turnstile'lı): Shopier ödeme ürünü; ödeme gelince üyelik başlar
      if (!(shopierHazir() && await kartAcikMi())) throw new KullaniciHatasi('Kartla ödeme şu an kapalı; havale / EFT ile ödeyebilirsin.', 400);
      const o = await rpc('uyelik_kart_ac', { p_eposta: metin(v.eposta, 200) }) as { id: string; tutar: number; kod: string; eposta?: boolean };
      // Başvuru yok ya da üyelik aktif: ekranda herkese aynı "e-postana bilgi gönderdik", neden e-postada
      if (o.eposta) return { eposta: true };
      const site = (Deno.env.get('SITE_ADRESI') || 'https://www.forestcluburla.com').replace(/\/$/, '');
      const { urun, sayfa } = await odemeUrunuAc({ baslik: 'Forest Club Urla üyelik · 30 gün', tutar: Number(o.tutar), ref: `FC-UYELIK-${o.kod}`,
        donus: `${site}/#basvuru`, aciklama: 'Forest Club Urla üyeliği · 30 gün. Ödemen gelince üyeliğin başlar, e-postana haber gelir.',
        gorsel: `${site}/_blob/shopier/uyelik.jpg` });  // maskot (Hello humans)
      await rpc('odeme_istegi_token', { p_id: o.id, p_token: urun });
      return { id: o.id, tutar: o.tutar, sayfa };
    }
    case 'bilet_kaydet':
      return rpc('bilet_kaydet', { p_id: Number(v.id) || 0, p_eposta: metin(v.eposta, 200) });
    case 'urun_siparis':
      return urunSiparis(v);
    case 'urun_kaydet':
      return rpc('urun_kaydet', { p_id: Number(v.id) || 0, p_eposta: metin(v.eposta, 200) });
    case 'destek':
      return destekBaslat(v.tutar);
    case 'gonullu':
      return rpc('gonullu_kaydet', {
        p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60),
        p_alanlar: (Array.isArray(v.alanlar) ? v.alanlar : []).slice(0, 10).map((x: unknown) => metin(x, 60)),
        p_not: metin(v.not, 1000), p_kvkk: v.kvkk === true,
      });
    case 'dugun': {
      const tarih = typeof v.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.tarih) ? v.tarih : null;
      const s = v.secimler && typeof v.secimler === 'object' && !Array.isArray(v.secimler) ? v.secimler : {};
      return rpc('dugun_talep_ac', {
        p_ad: metin(v.ad, 120), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 30), p_tarih: tarih,
        p_tarih_esnek: v.tarih_esnek === true, p_kisi: metin(v.kisi, 20), p_secimler: s, p_not: metin(v.not, 2000), p_kvkk: v.kvkk === true,
        p_davet: v.davet ? metin(v.davet, 64) : null,
      });
    }
    case 'ozel_form':
      return rpc('ozel_form_yanitla', {
        p_anahtar: metin(v.anahtar, 64), p_ad: metin(v.ad, 120), p_eposta: metin(v.eposta, 200),
        p_cevaplar: v.cevaplar && typeof v.cevaplar === 'object' && !Array.isArray(v.cevaplar) ? v.cevaplar : {},
      });
    default:
      throw new KullaniciHatasi('Bilinmeyen form.');
  }
}

Deno.serve(async (istek) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (istek.method !== 'POST') return json(405, { hata: 'Yalnız POST.' });
  try {
    const ham = await istek.text();
    if (ham.length > 32_000) throw new KullaniciHatasi('Form çok uzun.', 413);
    const govde = JSON.parse(ham || '{}');
    const tur = String(govde.tur || '');
    if (!SINIR[tur] || tur === 'hepsi') throw new KullaniciHatasi('Bilinmeyen form.');
    const veri = govde.veri && typeof govde.veri === 'object' ? govde.veri : {};

    const ip = istemciIp(istek);
    const anahtar = await ipOzeti(ip);
    const tumu = await rpc('istek_sinir', { p_anahtar: anahtar, p_tur: 'hepsi', p_sinir: SINIR.hepsi });
    const bu = await rpc('istek_sinir', { p_anahtar: anahtar, p_tur: tur, p_sinir: SINIR[tur] });
    if (!tumu || !bu) throw new KullaniciHatasi('Çok fazla deneme yapıldı; bir saat sonra tekrar dene.', 429);

    if (!TURNSTILE_GEREKMEZ.has(tur)) await turnstileDogrula(govde.jeton, ip);
    try {
      const sonuc = await isle(tur, veri);
      if (KVKK_GEREKEN.has(tur) && veri.kvkk === true) await rizaYaz(tur, veri.eposta);
      return json(200, { sonuc });
    } catch (h) {
      // Doğrulamayı geçmiş ama formda eksik / hatalı alan olan deneme sayaçtan düşer: düzeltip yeniden gönderen kişi
      // (ya da aynı Wi-Fi'daki başkası) bir saat kilitlenmesin. Turnstile'ı geçemeyen istekler sayılmaya devam eder.
      if (h instanceof KullaniciHatasi) {
        await Promise.all([rpc('istek_iade', { p_anahtar: anahtar, p_tur: 'hepsi' }), rpc('istek_iade', { p_anahtar: anahtar, p_tur: tur })]).catch(() => {});
      }
      throw h;
    }
  } catch (h) {
    if (h instanceof KullaniciHatasi) return json(h.durum, { hata: h.message });
    if (h instanceof SyntaxError) return json(400, { hata: 'Geçersiz istek.' });
    console.error('form-gonder', h);
    return json(500, { hata: 'Beklenmeyen bir hata oldu; biraz sonra tekrar dene.' });
  }
});
