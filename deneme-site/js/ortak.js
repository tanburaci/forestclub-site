// Forest Club Urla · deneme sitesi: panellerin ortak Supabase bağlantısı, giriş / çıkış ve küçük bildirim.
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

  const bugun = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

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
  window.FCSifreKaydet = async (sifre) => {
    const { error } = await sb.auth.updateUser({ password: sifre });
    if (error) throw new Error(error.message);
    location.replace(sayfa);
  };

  // Dekont: dosya gizli depoya "yeni/" altına yüklenir, sonra kayıt sunucuda açılır (yalnız başvurusu olan e-posta)
  const DEKONT_TURLERI = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
  window.FCSDekont = async (eposta, dosya) => {
    const ep = String(eposta || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep)) throw new Error('Başvuruda yazdığın e-postayı yaz.');
    if (!dosya) throw new Error('Dekont dosyasını seç.');
    const uzanti0 = (dosya.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
    const tur = dosya.type || ({ '.heic': 'image/heic', '.heif': 'image/heif', '.pdf': 'application/pdf' })[uzanti0] || '';
    if (!DEKONT_TURLERI.includes(tur)) throw new Error('Dekont yalnız PDF ya da fotoğraf (JPG, PNG, HEIC) olabilir.');
    if (dosya.size > 10 * 1024 * 1024) throw new Error('Dosya 10 MB\'tan büyük.');
    const uzanti = (dosya.name.match(/\.[a-z0-9]{2,5}$/i) || [''])[0].toLowerCase();
    const yol = `yeni/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${uzanti}`;
    const { error: yHata } = await sb.storage.from('dekontlar').upload(yol, dosya, { contentType: tur, upsert: false });
    if (yHata) throw new Error(`Dosya yüklenemedi: ${yHata.message}`);
    const { error } = await sb.rpc('dekont_kaydet', { p_eposta: ep, p_dosya: yol });
    if (error) throw new Error(error.message);
    sb.rpc('sayac_artir', { p_adim: 'dekont' }).then(() => {}, () => {});
  };

  window.FC_ORTAK = { sb, bugun, bildir, kurtarma: /type=recovery/.test(location.hash) };
})();
