// Forest Club Urla · dekont sayfası (deneme sitesi): yükleme ortak.js'teki FCSDekont ile.
window.DC.bagla('/sayfalar/dekont.dc.html', document.getElementById('kok'), { varliklar: window.FC_AYAR.varliklar })
  .catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; });
