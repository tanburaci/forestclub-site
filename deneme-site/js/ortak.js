// Forest Club Urla · deneme sitesi: panellerin ortak Supabase bağlantısı, giriş / çıkış, küçük bildirim ve anonim
// formların spam korumalı gönderimi (Turnstile + form-gonder).
// Kelimenin diline göre büyük harf (09.11.2026): sayfalar lang="tr"; büyük harfe çevrilen ya da el yazısı (Amatic SC)
// başlıklarda İngilizce kelimedeki i Türkçe kurala göre "İ" olur (MORNİNG). data-dil-oto taşıyan öğelerde metin
// İngilizceyse öğeye lang="en" yazılır ve büyük harfe çevrilir (i→I); Türkçe metin lang="tr" kalır (i→İ).
(function () {
  'use strict';
  const EN = new Set(('morning good listen gatherings nature carefully trees music each other breakfast club sunset table ' +
    'common gathering vinyasa yin yoga hatha tai chi rhythm lab body sculpt clay create sound healing live set forest pizza ' +
    'scratch workshop with and of for kids mindfulness picnic cinema film night dinner wine edition coffee break brunch ' +
    'around under see you at people food brighter weekly event open call hello welcome jungle slow walk talk circle drum ' +
    'session meditation retreat market vintage art mini home sweet sunrise silent disco dance flow restorative ashtanga ' +
    'kundalini pilates fitness hiking ride cooking class tasting gin tonic party festival the to in on we is it').split(' '));
  const TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;
  const enKelime = (w) => {
    const k = w.toLocaleLowerCase('en').replace(/['’].*$/, '');
    if (!k || TR_HARF.test(k)) return false;
    return EN.has(k) || /(th|sh|ee|oo|ght|ing$|tion$|ness$|w|x|q)/.test(k);
  };
  // Metnin dili: harf içeren kelimelerin çoğu İngilizceyse 'en', yoksa 'tr'
  window.FCDil = (metin) => {
    const kel = String(metin || '').match(/[A-Za-zÇĞİÖŞÜçğıöşü'’]+/g) || [];
    if (!kel.length || kel.some((w) => TR_HARF.test(w))) return 'tr';
    return kel.filter(enKelime).length * 2 >= kel.length ? 'en' : 'tr';
  };
  const st = document.createElement('style');
  st.textContent = '.fc-en,[data-dil-oto][lang="en"]{text-transform:uppercase}';
  (document.head || document.documentElement).appendChild(st);
  let bekliyor = false;
  const uygula = () => {
    bekliyor = false;
    document.querySelectorAll('[data-dil-oto]').forEach((el) => {
      const dil = window.FCDil(el.textContent);
      if (el.getAttribute('lang') !== dil) el.setAttribute('lang', dil);
    });
  };
  const izle = () => {
    uygula();
    new MutationObserver(() => { if (!bekliyor) { bekliyor = true; requestAnimationFrame(uygula); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) izle(); else document.addEventListener('DOMContentLoaded', izle);
})();

(function () {
  'use strict';
  const A = window.FC_AYAR;
  const HATIRLA = 'fc_hatirla';
  const depo = { // "Beni hatırla" kapalıysa oturum tarayıcı kapanınca biter
    getItem: (k) => (localStorage.getItem(HATIRLA) === '0' ? sessionStorage : localStorage).getItem(k),
    setItem: (k, v) => (localStorage.getItem(HATIRLA) === '0' ? sessionStorage : localStorage).setItem(k, v),
    removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
  };
  const sb = window.supabase.createClient(A.supabaseUrl, A.supabaseAnahtar, { auth: { storage: depo, persistSession: true } });
  const sayfa = location.pathname.replace(/\/$/, '') || '/';

  // Bugün İstanbul saatiyle (sunucudaki istanbul_bugun ile aynı; tarayıcının saat dilimi ne olursa olsun)
  const IST_TARIH = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const bugun = () => IST_TARIH.format(new Date());

  let bildirimZaman;
  function bildir(metin, hata, sure) {
    let el = document.getElementById('fc-kayit');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fc-kayit';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99;font:600 14px Figtree,sans-serif;border:2px solid #111;border-radius:10px;padding:10px 14px;box-shadow:3px 3px 0 #111;max-width:calc(100vw - 32px)';
      document.body.appendChild(el);
    }
    el.textContent = metin;
    el.style.background = hata ? '#F3DCD5' : '#FFFFFF';
    el.style.color = hata ? '#82301F' : '#111111';
    el.style.display = 'block';
    clearTimeout(bildirimZaman);
    bildirimZaman = setTimeout(() => { el.style.display = 'none'; }, sure || (hata ? 8000 : 1800));
  }

  // Paneller bu işlevleri çağırır
  window.FCGiris = async (eposta, sifre, hatirla) => {
    localStorage.setItem(HATIRLA, hatirla ? '1' : '0');
    const { error } = await sb.auth.signInWithPassword({ email: eposta, password: sifre });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'E-posta ya da şifre hatalı.' : error.message);
    location.reload();
  };
  // Demo verisindeki uydurma adreslere (ornek.com) mail gönderilmez: geri dönen mailler (bounce) Supabase'in mail
  // gönderimini kısıtlatıyor (Supabase uyarısı 27.10.2026). Gerçek adres deneyin.
  const uydurmaAdres = (e) => /@(ornek\.com|example\.(com|org|net))$/i.test(String(e || '').trim());
  const uydurmaHata = () => new Error('Bu bir demo adresi; mail gönderilmez. Şifreyle gir ya da kendi e-postanla dene.');

  // Şifresiz giriş: e-postaya tek kullanımlık bağlantı gider; bağlantı bu sayfaya oturumla geri döner
  window.FCGirisBaglantisi = async (eposta, hatirla) => {
    if (uydurmaAdres(eposta)) throw uydurmaHata();
    localStorage.setItem(HATIRLA, hatirla ? '1' : '0');
    const { error } = await sb.auth.signInWithOtp({ email: eposta, options: { emailRedirectTo: `${location.origin}${sayfa}` } });
    if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Az önce bir bağlantı gönderildi; biraz bekleyip tekrar dene.' : error.message);
  };
  window.FCCikis = async () => { await sb.auth.signOut(); location.replace(sayfa); };
  window.FCSifreBaglantisi = async (eposta) => {
    if (uydurmaAdres(eposta)) throw uydurmaHata();
    const { error } = await sb.auth.resetPasswordForEmail(eposta, { redirectTo: `${location.origin}${sayfa}` });
    if (error) throw new Error(error.message);
  };
  // Oturum açıkken şifre belirleme (sayfa yenilenmez)
  window.FCSifreGuncelle = async (sifre) => {
    const { error } = await sb.auth.updateUser({ password: sifre });
    if (error) throw new Error(/different|same/i.test(error.message) ? 'Yeni şifre eskisinden farklı olmalı.' : error.message);
  };
  window.FCSifreKaydet = async (sifre) => {
    const { error } = await sb.auth.updateUser({ password: sifre });
    if (error) throw new Error(error.message);
    location.replace(sayfa);
  };

  // Spam koruması (Cloudflare Turnstile): her gönderimde yeni bir jeton alınır. Kutu çoğunlukla görünmez; Cloudflare
  // emin olamazsa sayfanın altında küçük bir doğrulama kutusu çıkar.
  let turnstileYukleniyor = null;
  let turnstileKutu = null;
  let turnstileNo = null;
  function turnstileYukle() {
    if (!turnstileYukleniyor) {
      turnstileYukleniyor = new Promise((tamam, red) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => tamam();
        s.onerror = () => { turnstileYukleniyor = null; red(new Error('Form koruması yüklenemedi; bağlantını kontrol edip tekrar dene.')); };
        document.head.appendChild(s);
      });
    }
    return turnstileYukleniyor;
  }
  async function insanJetonu() {
    await turnstileYukle();
    return new Promise((tamam, red) => {
      if (!turnstileKutu) {
        turnstileKutu = document.createElement('div');
        turnstileKutu.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:100';
        document.body.appendChild(turnstileKutu);
      }
      // Doğrulama bitince kutu kaldırılır: ekranda kalıp altındaki düğmelere tıklanmasını engellemesin
      const kaldir = () => {
        if (turnstileNo !== null) { try { window.turnstile.remove(turnstileNo); } catch (h) { /* zaten kalkmış */ } }
        turnstileNo = null;
        turnstileKutu.style.display = 'none';
      };
      const sure = setTimeout(() => { kaldir(); red(new Error('Doğrulama zaman aşımına uğradı; tekrar dene.')); }, 90000);
      const bitir = (f) => (x) => { clearTimeout(sure); setTimeout(kaldir, 0); f(x); };
      if (turnstileNo !== null) window.turnstile.remove(turnstileNo);
      turnstileKutu.style.display = '';
      turnstileNo = window.turnstile.render(turnstileKutu, {
        sitekey: A.turnstile, appearance: 'interaction-only', language: 'tr',
        callback: bitir(tamam),
        'error-callback': bitir(() => red(new Error('Doğrulama yapılamadı; sayfayı yenileyip tekrar dene.'))),
        'expired-callback': bitir(() => red(new Error('Doğrulamanın süresi doldu; tekrar dene.'))),
      });
    });
  }

  // Anonim formlar "form-gonder" Edge Function'a gider (Turnstile + IP başına saatlik sınır). Dönüş: sunucunun sonucu
  async function formGonder(tur, veri) {
    const jeton = tur === 'dekont_kaydet' || tur === 'bilet_kaydet' || tur === 'urun_kaydet' ? null : await insanJetonu();
    let yanit;
    try {
      yanit = await fetch(`${A.supabaseUrl}/functions/v1/form-gonder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: A.supabaseAnahtar, Authorization: `Bearer ${A.supabaseAnahtar}` },
        body: JSON.stringify({ tur, jeton, veri }),
      });
    } catch (h) {
      throw new Error('Bağlantı kurulamadı; internetini kontrol edip tekrar dene.');
    }
    const govde = await yanit.json().catch(() => ({}));
    if (!yanit.ok) throw new Error(govde.hata || 'Gönderilemedi; biraz sonra tekrar dene.');
    return govde.sonuc;
  }

  // Dekont: sunucu yükleme hakkı ve tek kullanımlık imzalı adres verir (yalnız başvurusu olan e-posta), dosya gizli
  // depoya bu adresle yüklenir, sonra kayıt sunucuda açılır
  const DEKONT_TURLERI = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
  function dekontDosyasi(dosya) {
    if (!dosya) throw new Error('Dekont dosyasını seç.');
    const uzanti0 = (dosya.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
    const tur = dosya.type || ({ '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf' })[uzanti0] || '';
    if (!DEKONT_TURLERI.includes(tur)) throw new Error('Dekont yalnız PDF ya da fotoğraf (JPG, PNG, HEIC) olabilir.');
    if (dosya.size > 10 * 1024 * 1024) throw new Error('Dosya 10 MB\'tan büyük.');
    const uzanti = uzanti0 || { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/heic': '.heic', 'image/heif': '.heif', 'image/webp': '.webp' }[tur];
    return { tur, uzanti };
  }
  window.FCSDekont = async (eposta, dosya) => {
    const ep = String(eposta || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep)) throw new Error('Başvuruda yazdığın e-postayı yaz.');
    const { tur, uzanti } = dekontDosyasi(dosya);
    const hak = await formGonder('dekont_adres', { eposta: ep, uzanti });
    const { error: yHata } = await sb.storage.from('dekontlar').uploadToSignedUrl(hak.yol, hak.jeton, dosya, { contentType: tur });
    if (yHata) throw new Error(`Dosya yüklenemedi: ${yHata.message}`);
    await formGonder('dekont_kaydet', { eposta: ep, yol: hak.yol });
    sb.rpc('sayac_artir', { p_adim: 'dekont' }).then(() => {}, () => {});
  };

  // Etkinlik bileti (havale + dekont): 1) istek açılır, sunucu tutarı söyler ve yerleri dekont gelene dek ayırmaz;
  // 2) dekont imzalı adrese yüklenir, istek yöneticinin onayına düşer. kalemler: [{etkinlik: id, adet}]
  // yol: kart (Shopier ödeme sayfası adresi döner) | havale (dekont yükleme hakkı) | nakit (yer ayrılır)
  window.FCSBiletAc = async ({ kalemler, ad, eposta, tel, yol, kod, kvkk }) => {
    const { data: { session } } = await sb.auth.getSession();
    return formGonder('bilet_adres', { kalemler, ad, eposta: String(eposta || '').trim().toLowerCase(), tel, yol: yol || 'havale', kod: kod || null, kvkk: kvkk === true,
      oturum: session ? session.access_token : null });
  };
  // Yeni başvuranın kartla aidatı (Shopier): {id, tutar, sayfa}; durum: 'basladi' | 'odendi' | 'basarisiz'
  window.FCSUyelikKart = async (eposta) => formGonder('uyelik_kart', { eposta: String(eposta || '').trim().toLowerCase() });
  window.FCSUyelikDurum = async (id, eposta) => {
    const { data, error } = await sb.rpc('uyelik_odeme_durum', { p_id: id, p_eposta: String(eposta || '').trim().toLowerCase() });
    if (error) throw new Error(error.message);
    return data;
  };
  // Kartla ödeme Shopier penceresindeyken: 'bekliyor' | 'onaylandi' | 'reddedildi' (istek numarası + e-posta)
  window.FCSBiletDurum = async (id, eposta) => {
    const { data, error } = await sb.rpc('bilet_istek_durum', { p_id: Number(id) || 0, p_eposta: String(eposta || '').trim().toLowerCase() });
    if (error) throw new Error(error.message);
    return data;
  };
  // İndirim kodu: geçerliyse {kod, tur: 'yuzde' | 'tl', deger}; tutar sunucuda yeniden hesaplanır
  window.FCSIndirimBak = async (kod) => {
    const { data, error } = await sb.rpc('indirim_kodu_bak', { p_kod: String(kod || '').trim() });
    if (error) throw new Error(/geçerli değil|Çok fazla/.test(error.message) ? error.message : 'Kod şu an denetlenemedi; biraz sonra tekrar dene.');
    if (!data || data.gecerli === false) throw new Error('Bu indirim kodu geçerli değil.');
    return data;
  };
  window.FCSBiletDekont = async (hak, eposta, dosya) => {
    const { tur } = dekontDosyasi(dosya);
    const { error: yHata } = await sb.storage.from('dekontlar').uploadToSignedUrl(hak.yol, hak.jeton, dosya, { contentType: tur });
    if (yHata) throw new Error(`Dosya yüklenemedi: ${yHata.message}`);
    await formGonder('bilet_kaydet', { id: hak.id, eposta: String(eposta || '').trim().toLowerCase() });
  };

  // Etkinliğe özel ürün siparişi: {id, kod, tutar, yol} + kartta Shopier sayfası, havalede dekont yükleme adresi
  window.FCSUrunSiparis = async ({ etkinlik, kalemler, ad, eposta, tel, yol, kvkk }) => formGonder('urun_siparis',
    { etkinlik, kalemler, ad, eposta: String(eposta || '').trim().toLowerCase(), tel, yol, kvkk: kvkk === true });
  window.FCSUrunDekont = async (s, eposta, dosya) => {
    const { tur } = dekontDosyasi(dosya);
    const { error: yHata } = await sb.storage.from('dekontlar').uploadToSignedUrl(s.dosya, s.jeton, dosya, { contentType: tur });
    if (yHata) throw new Error(`Dosya yüklenemedi: ${yHata.message}`);
    await formGonder('urun_kaydet', { id: s.id, eposta: String(eposta || '').trim().toLowerCase() });
  };
  // Kartla ödeme Shopier penceresindeyken: 'bekliyor' | 'onaylandi' | 'reddedildi'
  window.FCSUrunDurum = async (id, eposta) => {
    const { data, error } = await sb.rpc('urun_siparis_durum', { p_id: Number(id) || 0, p_eposta: String(eposta || '').trim().toLowerCase() });
    if (error) throw new Error(error.message);
    return data;
  };

  window.FC_ORTAK = { sb, bugun, bildir, formGonder, kurtarma: /type=(recovery|invite)/.test(location.hash) };
})();
