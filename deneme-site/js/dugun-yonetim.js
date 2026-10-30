// Forest Club Urla · Yönetim › Düğün: talepler (durum, yönetici notu) ve katalog (mekan, bölüm, menü, masa konsepti,
// ürün, ekstra). Sayfa (sayfalar/dugun-yonetim.dc.html) sekme ilk açıldığında yönetim panelindeki #fc-dugun kutusuna
// bağlanır; veriyi kendisi okur ve yazar (RLS: yalnız yönetici).
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;
  const KATALOG_SUTUN = 'id, tur, ad, aciklama, resim, grup, mekan_id, yemek_mekandan, renkler, sira, acik';

  const hata = ({ error }) => { if (error) throw new Error(error.message); };

  window.FCDY = {
    durum: async (id, durum) => hata(await sb.from('dugun_talepleri').update({ durum, updated_at: new Date().toISOString() }).eq('id', id).select('id').single()),
    not: async (id, metin) => hata(await sb.from('dugun_talepleri').update({ yonetici_notu: metin || null, updated_at: new Date().toISOString() }).eq('id', id).select('id').single()),
    // Yeni (id yok) → insert, var → update. Dönüş: kaydedilen satır
    katalogKaydet: async (k) => {
      const satir = { tur: k.tur, ad: k.ad, aciklama: k.aciklama || null, resim: k.resim || null, grup: k.grup || null,
        mekan_id: k.mekan_id || null, yemek_mekandan: k.yemek_mekandan !== false, sira: Number(k.sira) || 0, acik: k.acik !== false,
        renkler: k.tur === 'palet' && Array.isArray(k.renkler) && k.renkler.length ? k.renkler.map((r) => String(r).toLowerCase()) : null };
      const is = k.id ? sb.from('dugun_katalog').update(satir).eq('id', k.id) : sb.from('dugun_katalog').insert(satir);
      const { data, error } = await is.select(KATALOG_SUTUN).single();
      if (error) throw new Error(error.message);
      return data;
    },
    // Özel davet bağlantısı: çifte gönderilir, yalnız tasarım formu açılır. Dönüş: {id, anahtar, ad, notlar, talep_id, created_at}
    davetOlustur: async (ad, notlar) => {
      const { data, error } = await sb.from('dugun_davetleri').insert({ ad: ad || null, notlar: notlar || null }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    davetSil: async (id) => hata(await sb.from('dugun_davetleri').delete().eq('id', id).select('id').single()),
    // Envanter: gider (muhasebe + istenirse envanter + düğün gideri) tek işlemde; ödemesiz giriş ve düşüm hareketle
    giderEkle: async (p) => {
      const { data, error } = await sb.rpc('dugun_gider_ekle', { p });
      if (error) throw new Error(error.message);
      return data;
    },
    kalemEkle: async (k) => {
      const { data, error } = await sb.from('dugun_envanter').insert(k).select('id').single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    kalemDuzenle: async (id, k) => hata(await sb.from('dugun_envanter').update(k).eq('id', id).select('id').single()),
    kalemSil: async (id) => hata(await sb.from('dugun_envanter').delete().eq('id', id).select('id').single()),
    hareketEkle: async (h) => hata(await sb.from('dugun_envanter_hareketleri').insert(h).select('id').single()),
    hareketSil: async (id) => hata(await sb.from('dugun_envanter_hareketleri').delete().eq('id', id).select('id').single()),
    // Yazmadan sonra envanter yeniden okunur (adet tetikleyicide hesaplanır)
    envanterOku: async () => {
      const [e, h] = await Promise.all([
        sb.from('dugun_envanter').select('*').order('grup').order('ad'),
        sb.from('dugun_envanter_hareketleri').select('*').order('created_at', { ascending: false }).limit(500),
      ]);
      if (e.error) throw new Error(e.error.message);
      return { envanter: e.data, hareketler: h.error ? [] : h.data };
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
      const [t, k, d] = await Promise.all([
        sb.from('dugun_talepleri').select('*').order('created_at', { ascending: false }).limit(1000),
        sb.from('dugun_katalog').select(KATALOG_SUTUN).order('tur').order('sira').order('id'),
        sb.from('dugun_davetleri').select('*').order('created_at', { ascending: false }).limit(500),
      ]);
      [t, k].forEach((r) => { if (r.error) throw r.error; });
      const env = await window.FCDY.envanterOku().catch(() => ({ envanter: [], hareketler: [] }));  // göç yoksa boş
      window.FCDYV = { talepler: t.data, katalog: k.data, davetler: d.error ? [] : d.data, ...env };  // davet tablosu yoksa (göç) boş
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
