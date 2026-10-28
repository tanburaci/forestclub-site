// Forest Club Urla · üye formu sayfası (/form/?id=N): oturumlu üye açık formu doldurur; cevap form_yanitla ile
// sunucuda doğrulanıp yazılır, tekrar gönderilirse güncellenir.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;

  async function basla() {
    const kok = document.getElementById('kok');
    const id = Number(new URLSearchParams(location.search).get('id')) || 0;
    const { data: { session } } = await sb.auth.getSession();
    let F = { durum: 'giris' };
    if (session) {
      const { data: form } = await sb.from('formlar').select('id, baslik, aciklama, sorular').eq('id', id).maybeSingle();
      if (!form) F = { durum: 'kapali' };
      else {
        const { data: yanit } = await sb.from('form_yanitlari').select('cevaplar').eq('form_id', id).maybeSingle();
        F = { durum: 'form', form, cevaplar: (yanit && yanit.cevaplar) || {}, dahaOnce: !!yanit };
        window.FCFGonder = async (cevaplar) => {
          const { error } = await sb.rpc('form_yanitla', { p_form: id, p_cevaplar: cevaplar });
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
