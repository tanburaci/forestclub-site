// Forest Club Urla · sözleşme sayfalarında kulübün iletişim telefonu. Yönetim › Ayarlar › Kulüp bilgileri › Telefon
// (ayarlar.iletisim.tel) girilince <span data-fc-tel> öğeleri " · Telefon: …" ile dolar; boşken hiçbir şey görünmez.
(() => {
  const A = window.FC_AYAR;
  const yerler = document.querySelectorAll('[data-fc-tel]');
  if (!A || !A.supabaseUrl || !yerler.length) return;
  fetch(`${A.supabaseUrl}/rest/v1/ayarlar?anahtar=eq.iletisim&select=deger`, { headers: { apikey: A.supabaseAnahtar, Authorization: `Bearer ${A.supabaseAnahtar}` } })
    .then((r) => (r.ok ? r.json() : []))
    .then((satir) => {
      const tel = String((satir[0] && satir[0].deger && satir[0].deger.tel) || '').trim();
      if (!/^[+0-9 ()-]{10,20}$/.test(tel)) return;
      yerler.forEach((y) => {
        y.textContent = `${y.dataset.fcTel || ' · Telefon: '}${tel}`;
        y.hidden = false;
        const satir = y.closest('[data-fc-tel-satir]');
        if (satir) satir.hidden = false;
      });
    })
    .catch(() => {});
})();
