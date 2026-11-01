// Forest Club Urla · düğün sayfası (/dugun/): açık katalog kalemleri ve müşteri fiyatları (dugun_fiyatlari) okunur, sihirbazın talebi form-gonder
// (Turnstile + IP sınırı) üzerinden dugun_talep_ac'a gider. Özel davet bağlantısında (/dugun/?k=<anahtar>) yalnız
// tasarım formu görünür, çift adıyla selamlanır ve talep davete bağlanır.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, bugun, formGonder } = window.FC_ORTAK;

  async function basla() {
    const kok = document.getElementById('kok');
    const { data, error } = await sb.from('dugun_katalog').select('id, tur, ad, aciklama, resim, grup, mekan_id, yemek_mekandan, renkler, sira')
      .order('sira').order('id');
    if (error) console.error(error);
    // Müşteri fiyatları (yönetimde kâr girilen ürünler); maliyet ve kâr buraya gelmez
    const fiy = await sb.rpc('dugun_fiyatlari').then((x) => x, () => ({ data: null }));
    const anahtar = (new URLSearchParams(location.search).get('k') || '').trim();
    let davet = null;
    if (anahtar) {
      const r = await sb.rpc('dugun_davet_bilgi', { p_anahtar: anahtar }).then((x) => x, () => ({ data: null }));
      davet = r.data && r.data[0] ? { anahtar, ad: r.data[0].ad || '' } : { gecersiz: true };
    }
    window.FCD = { bugun: bugun(), katalog: data || [], davet, fiyatlar: (fiy && fiy.data) || [] };
    window.FCDGonder = (veri) => formGonder('dugun', davet && davet.anahtar ? { ...veri, davet: davet.anahtar } : veri);
    await window.DC.bagla('/sayfalar/dugun.dc.html', kok, { varliklar: A.varliklar });
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
