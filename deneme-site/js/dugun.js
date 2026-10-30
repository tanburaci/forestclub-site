// Forest Club Urla · düğün sayfası (/dugun/): açık katalog kalemleri (fiyatsız) okunur, sihirbazın talebi form-gonder
// (Turnstile + IP sınırı) üzerinden dugun_talep_ac'a gider.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, bugun, formGonder } = window.FC_ORTAK;

  async function basla() {
    const kok = document.getElementById('kok');
    const { data, error } = await sb.from('dugun_katalog').select('id, tur, ad, aciklama, resim, grup, mekan_id, yemek_mekandan, sira')
      .order('sira').order('id');
    if (error) console.error(error);
    window.FCD = { bugun: bugun(), katalog: data || [] };
    window.FCDGonder = (veri) => formGonder('dugun', veri);
    await window.DC.bagla('/sayfalar/dugun.dc.html', kok, { varliklar: A.varliklar });
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
