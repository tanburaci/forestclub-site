// Şablon dosyası (*.dc.html) tarayıcıda doğrudan açılırsa ham {{ }} görünmesin: asıl sayfaya yönlendirir.
// Panellerin motoru (js/dc.js) şablonu metin olarak okur; o zaman bu betik hiç çalışmaz.
(function () {
  var hedef = { 'site.dc.html': '/', 'uye.dc.html': '/uye', 'yonetim.dc.html': '/yonetim', 'dekont.dc.html': '/dekont' };
  var dosya = location.pathname.split('/').pop().toLowerCase().replace(/(\.html)?$/, '.html');  // Netlify .html'i düşürebilir
  location.replace((hedef[dosya] || '/') + location.hash);
})();
