// Forest Club Urla · anonim formların tek kapısı: üyelik başvurusu, tanışma bileti, Açık Çağrı ve dekont.
// Sıra: IP başına saatlik sınır → Cloudflare Turnstile doğrulaması → SQL işlevi (service_role).
// Dekont iki adımda gelir: "dekont_adres" yükleme hakkı ve tek kullanımlık imzalı yükleme adresi verir (Turnstile'lı),
// dosya tarayıcıdan doğrudan depoya yüklenir, "dekont_kaydet" kaydı açar (yalnız bu e-postaya verilmiş yol).
//
// "Yakında" modunda (ayarlar.yakinda) üyelik başvurusu ve tanışma bileti alınmaz; Açık Çağrı ve dekont açık.
//
// Secrets: TURNSTILE_SECRET (zorunlu), IP_TUZU (isteğe bağlı; IP özetine katılır)
import { CORS, json, servisIstemcisi } from '../_ortak/ortak.ts';

// Saatlik sınırlar (IP başına); "hepsi" bütün türlerin toplamı
const SINIR: Record<string, number> = { basvuru: 5, tanisma: 5, cagri: 5, dekont_adres: 10, dekont_kaydet: 10, hepsi: 30 };
const TURNSTILE_GEREKMEZ = new Set(['dekont_kaydet']);  // yol zaten Turnstile'lı "dekont_adres" adımında verildi
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

async function acildiMi(): Promise<void> {
  const { data, error } = await servisIstemcisi().from('ayarlar').select('deger').eq('anahtar', 'yakinda').maybeSingle();
  if (error) throw error;
  if (data && data.deger === true) {
    throw new KullaniciHatasi('Üyelik başvuruları ve tanışma biletleri açılışla birlikte başlıyor. Instagram\'dan takipte kal!', 403);
  }
}

async function isle(tur: string, v: Record<string, unknown>): Promise<unknown> {
  if (tur === 'basvuru' || tur === 'tanisma') await acildiMi();
  switch (tur) {
    case 'basvuru':
      return rpc('basvuru_yap', {
        p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_tel: metin(v.tel, 60),
        p_kosul: v.kosul === true, p_dogal: v.dogal === true, p_kvkk: v.kvkk === true, p_foto: v.foto === true,
      });
    case 'tanisma':
      return rpc('tanisma_bileti_al', { p_ad: metin(v.ad, 200), p_eposta: metin(v.eposta, 200), p_etkinlik: Number(v.etkinlik) || 0 });
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
    return json(200, { sonuc: await isle(tur, veri) });
  } catch (h) {
    if (h instanceof KullaniciHatasi) return json(h.durum, { hata: h.message });
    if (h instanceof SyntaxError) return json(400, { hata: 'Geçersiz istek.' });
    console.error('form-gonder', h);
    return json(500, { hata: 'Beklenmeyen bir hata oldu; biraz sonra tekrar dene.' });
  }
});
