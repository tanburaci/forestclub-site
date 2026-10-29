// Forest Club Urla · dekont sayfası (deneme sitesi): yükleme ortak.js'teki FCSDekont ile.
// Aidat tutarı yönetimdeki ayardan (ayarlar.aidat) gelir; okunamazsa ayar.js'teki tutar kalır.
(async () => {
  const A = window.FC_AYAR;
  try {
    const { data } = await window.FC_ORTAK.sb.from('ayarlar').select('deger').eq('anahtar', 'aidat').maybeSingle();
    const aidat = Number(data && data.deger);
    if (aidat > 0) A.odeme = { ...A.odeme, tutar: `${aidat.toLocaleString('tr-TR')} TL` };
  } catch (h) { /* ayar okunamadı: varsayılan tutar */ }
  await window.DC.bagla('/sayfalar/dekont.dc.html', document.getElementById('kok'), { varliklar: A.varliklar });
})().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; });
