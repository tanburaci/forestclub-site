// Forest Club Urla · Yönetim › Düğün: talepler (durum, yönetici notu) ve katalog (mekan, bölüm, menü, masa konsepti,
// ürün, ekstra). Sayfa (sayfalar/dugun-yonetim.dc.html) sekme ilk açıldığında yönetim panelindeki #fc-dugun kutusuna
// bağlanır; veriyi kendisi okur ve yazar (RLS: yalnız yönetici).
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;
  const KATALOG_SUTUN = 'id, tur, ad, aciklama, resim, grup, mekan_id, yemek_mekandan, sira, acik';

  const hata = ({ error }) => { if (error) throw new Error(error.message); };

  window.FCDY = {
    durum: async (id, durum) => hata(await sb.from('dugun_talepleri').update({ durum, updated_at: new Date().toISOString() }).eq('id', id).select('id').single()),
    not: async (id, metin) => hata(await sb.from('dugun_talepleri').update({ yonetici_notu: metin || null, updated_at: new Date().toISOString() }).eq('id', id).select('id').single()),
    // Yeni (id yok) → insert, var → update. Dönüş: kaydedilen satır
    katalogKaydet: async (k) => {
      const satir = { tur: k.tur, ad: k.ad, aciklama: k.aciklama || null, resim: k.resim || null, grup: k.grup || null,
        mekan_id: k.mekan_id || null, yemek_mekandan: k.yemek_mekandan !== false, sira: Number(k.sira) || 0, acik: k.acik !== false };
      const is = k.id ? sb.from('dugun_katalog').update(satir).eq('id', k.id) : sb.from('dugun_katalog').insert(satir);
      const { data, error } = await is.select(KATALOG_SUTUN).single();
      if (error) throw new Error(error.message);
      return data;
    },
    katalogSil: async (id) => hata(await sb.from('dugun_katalog').delete().eq('id', id).select('id').single()),
    resimYukle: (dosya) => window.FCAfisYukle(dosya),
  };

  window.FCDugunAc = async () => {
    const el = document.getElementById('fc-dugun');
    if (!el || el.__dugun) return;
    el.__dugun = true;
    el.textContent = 'Yükleniyor…';
    try {
      const [t, k] = await Promise.all([
        sb.from('dugun_talepleri').select('*').order('created_at', { ascending: false }).limit(1000),
        sb.from('dugun_katalog').select(KATALOG_SUTUN).order('tur').order('sira').order('id'),
      ]);
      [t, k].forEach((r) => { if (r.error) throw r.error; });
      window.FCDYV = { talepler: t.data, katalog: k.data };
      const style = el.getAttribute('style');
      await window.DC.bagla('/sayfalar/dugun-yonetim.dc.html', el, { varliklar: A.varliklar });
      if (style) el.setAttribute('style', style);  // bagla kutunun stilini siler; sekme gizliyse gizli kalsın
    } catch (h) {
      el.__dugun = false;
      el.textContent = `Düğün bölümü açılamadı: ${h.message}. Göç uygulandı mı? Sayfayı yenileyip tekrar deneyin.`;
      console.error(h);
    }
  };
})();
