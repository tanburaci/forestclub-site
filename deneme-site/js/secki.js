// Forest Club Urla · Seçki (/secki): etkinlikten bağımsız satılan ürünler. Şimdilik gizli test sürümü: hiçbir menüde
// bağlantısı yok, arama motorlarına kapalı (noindex; _headers). Liste sunucudan (secki_listesi: Seçki'de satışta olan
// aktif ürünler + kalan stok); sipariş form-gonder "urun_siparis" (secki: true) ile, tutar sunucuda. Teslim bir sonraki
// buluşmada Pinya'da elden; ödeme kart (Shopier, ayarlar.kart_odeme açıkken) ya da havale.
(async () => {
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;
  const [liste, ayr, oturum] = await Promise.all([
    sb.rpc('secki_listesi').then((r) => (r.error ? Promise.reject(r.error) : r.data || [])),
    sb.from('ayarlar').select('anahtar, deger').then((r) => r.data || [], () => []),
    sb.auth.getSession(),
  ]);
  const ayar = Object.fromEntries(ayr.map((a) => [a.anahtar, a.deger]));
  // Giriş yapmış üye: ad / e-posta / telefon kendi kaydından gelir
  const kullanici = oturum.data && oturum.data.session && oturum.data.session.user;
  const uye = kullanici && liste.length
    ? await sb.from('uyeler').select('ad, eposta, tel').eq('user_id', kullanici.id).maybeSingle().then((r) => r.data || null, () => null) : null;
  window.FCSecki = { urunler: liste, kartAcik: ayar.kart_odeme === true, uye };
  await window.DC.bagla('/sayfalar/secki.dc.html', document.getElementById('kok'), { varliklar: A.varliklar });
})().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; });
