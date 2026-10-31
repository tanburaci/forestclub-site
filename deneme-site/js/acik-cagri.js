// Forest Club Urla · Açık Çağrı sayfası (/acik-cagri/): form sayfada (sayfalar/acik-cagri.dc.html); gönderim form-gonder
// (Turnstile + IP başına sınır) üzerinden cagri_gonder'e gider.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { formGonder } = window.FC_ORTAK;
  window.FCSCagri = (alanlar) => formGonder('cagri', alanlar);
  window.DC.bagla('/sayfalar/acik-cagri.dc.html', document.getElementById('kok'), { varliklar: A.varliklar })
    .catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
