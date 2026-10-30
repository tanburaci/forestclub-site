// Forest Club Urla · form sayfası. Üye formu (/form/?id=N): oturumlu üye açık formu doldurur; cevap form_yanitla ile
// sunucuda doğrulanıp yazılır, tekrar gönderilirse güncellenir. Özel form (/form/?k=<anahtar>): bağlantıyı bilen kişi
// giriş yapmadan adı ve e-postasıyla doldurur; cevap form-gonder'den (Turnstile + IP sınırı) gider.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, formGonder } = window.FC_ORTAK;

  async function basla() {
    const kok = document.getElementById('kok');
    const q = new URLSearchParams(location.search);
    const anahtar = (q.get('k') || '').trim();
    const id = Number(q.get('id')) || 0;
    let F = { durum: 'giris' };
    if (anahtar) {
      const { data } = await sb.rpc('ozel_form', { p_anahtar: anahtar });
      const form = (data && data[0]) || null;
      F = form ? { durum: 'form', ozel: true, form, cevaplar: {} } : { durum: 'kapali', ozel: true };
      window.FCFGonder = (cevaplar, kimlik) => formGonder('ozel_form', { anahtar, ad: kimlik.ad, eposta: kimlik.eposta, cevaplar });
    } else {
      const { data: { session } } = await sb.auth.getSession();
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
    }
    window.FCF = F;
    kok.textContent = '';
    await window.DC.bagla('/sayfalar/form.dc.html', kok, { varliklar: A.varliklar });
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
