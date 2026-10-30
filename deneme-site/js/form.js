// Forest Club Urla · üye formu sayfası (/form/?id=N, özel form /form/?k=<anahtar>): oturumlu üye açık formu doldurur;
// cevap form_yanitla ile sunucuda doğrulanıp yazılır, tekrar gönderilirse güncellenir. Özel form yalnız anahtarla açılır.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;

  async function basla() {
    const kok = document.getElementById('kok');
    const q = new URLSearchParams(location.search);
    const anahtar = (q.get('k') || '').trim();
    let id = Number(q.get('id')) || 0;
    const { data: { session } } = await sb.auth.getSession();
    let F = { durum: 'giris' };
    if (session) {
      const form = anahtar
        ? await sb.rpc('ozel_form', { p_anahtar: anahtar }).then((r) => (r.data && r.data[0]) || null, () => null)
        : (await sb.from('formlar').select('id, baslik, aciklama, sorular').eq('id', id).maybeSingle()).data;
      if (form) id = form.id;
      if (!form) F = { durum: 'kapali' };
      else {
        const { data: yanit } = await sb.from('form_yanitlari').select('cevaplar').eq('form_id', id).maybeSingle();
        F = { durum: 'form', form, cevaplar: (yanit && yanit.cevaplar) || {}, dahaOnce: !!yanit };
        window.FCFGonder = async (cevaplar) => {
          const { error } = await sb.rpc('form_yanitla', { p_form: id, p_cevaplar: cevaplar, ...(anahtar ? { p_anahtar: anahtar } : {}) });
          if (error) throw new Error(error.message);
        };
      }
    }
    window.FCF = F;
    kok.textContent = '';
    await window.DC.bagla('/sayfalar/form.dc.html', kok, { varliklar: A.varliklar });
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
