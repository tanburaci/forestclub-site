// Forest Club Urla · üye paneli (deneme sitesi): üyenin kendi verisini Supabase'den yükler; "Geliyorum / Gelemeyeceğim /
// bekleme listesi" ve profil kaydı sunucudaki kurallarla (etkinlik_kaydi, profil_kaydet) yazılır. Giriş e-postaya gelen
// tek kullanımlık bağlantıyla da olur; ilk girişte başvuru hesaba bağlanır (uye_bagla). Kartla ödeme, sepet, dondurma
// ve anket henüz yok: panel bunlara "yakında" der (iyzico ve ilgili tablolar sonra).
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, bildir } = window.FC_ORTAK;
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const trTarih = (t) => t.split('-').reverse().join('.');
  const saatler = (s) => {
    const [bas, son] = String(s || '10.00').split(/[–-]/).map((x) => x.trim());
    if (son && /^\d{1,2}\.\d{2}$/.test(son)) return [bas, son];
    const [h, m] = (bas.match(/^(\d{1,2})\.(\d{2})/) || [null, '10', '00']).slice(1);
    return [`${h}.${m}`, `${String(Math.min(23, Number(h) + 2)).padStart(2, '0')}.${m}`];
  };

  async function doluluk() {
    const { data, error } = await sb.rpc('etkinlik_doluluk');
    if (error) throw error;
    return new Map(data.map((d) => [d.etkinlik_id, d]));
  }

  async function uyeKaydi(user) {
    const { data, error } = await sb.from('uyeler').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function veriYukle(user) {
    let u = await uyeKaydi(user);
    if (!u) {
      // İlk giriş: bu e-postayla açılmış başvuru hesaba bağlanır (yalnız kendi, doğrulanmış e-postası)
      const { data: kod, error } = await sb.rpc('uye_bagla');
      if (error) throw error;
      if (kod) u = await uyeKaydi(user);
    }
    if (!u) return null;
    const B = window.FC_ORTAK.bugun();
    const [ods, kys, etks, dol] = await Promise.all([
      sb.from('odemeler').select('*').eq('uye_id', u.id).order('tarih', { ascending: false }),
      sb.from('etkinlik_kayitlari').select('*').eq('uye_id', u.id),
      sb.from('etkinlikler').select('*').order('tarih'),
      doluluk(),
    ]);
    [ods, kys, etks].forEach((r) => { if (r.error) throw r.error; });
    const benim = new Map(kys.data.map((k) => [k.etkinlik_id, k]));
    const kayit = {};
    etks.data.filter((e) => e.tarih >= B && e.durum === 'yayinda').forEach((e) => {
      const [bas, son] = saatler(e.saat);
      const d = dol.get(e.id) || { kayitli: 0 };
      const k = benim.get(e.id);
      kayit[String(e.id)] = {
        ad: e.ad, tarih: e.tarih, saat: bas, bitisSaat: son,
        bilgi: `${GUNLER[new Date(`${e.tarih}T12:00:00`).getDay()]} ${bas}`,
        kontenjan: e.kontenjan, kayitli: d.kayitli + e.satilan_bilet,
        ben: k ? k.durum : 'yok', sira: k && k.sira ? k.sira : 0,
        fiyat: Number(e.bilet_fiyati || 0), uye: e.bilet_fiyati ? e.uyelere || 'tam' : 'ucretsiz',
        satilan: e.satilan_bilet,
      };
    });
    const gecmisEtk = etks.data.filter((e) => e.tarih < B && benim.get(e.id) && benim.get(e.id).geldi).reverse();
    const gecmis = {};
    const anket = {};
    gecmisEtk.forEach((e) => {
      gecmis[String(e.id)] = { ad: e.ad, tarih: trTarih(e.tarih) };
      anket[String(e.id)] = { puan: 0, yorum: '', bitti: false };
    });
    return {
      bugun: B, eposta: u.eposta, uyeId: u.id, kayit, gecmis, anket,
      hesap: {
        ad: u.ad, kod: u.kod, bitis: u.bitis || '',
        odemeler: ods.data.map((o) => ({ tarih: o.tarih, yol: o.yol === 'kart' ? 'Kart · iyzico' : 'Elden' })),
        profil: { telefon: u.tel || '', dogum: u.dogum_gunu || '', kutlama: u.kutlama_izni, foto: u.foto_izni,
          ilgi: u.ilgi_alanlari || [], ozel: u.ozel_gunler || [] },
        katildi: gecmisEtk.map((e) => String(e.id)),
      },
    };
  }

  function senkronKur(panel) {
    window.FCUProfil = async (p) => {
      const { error } = await sb.rpc('profil_kaydet', {
        p_tel: p.telefon || '', p_dogum: p.dogum || null, p_kutlama: !!p.kutlama, p_foto: !!p.foto,
        p_ilgi: p.ilgi || [], p_ozel: p.ozel || [],
      });
      if (error) throw new Error(error.message);
    };
    const yazilan = new Set();
    window.DC.durumDegisti = (bilesen, once, simdi) => {
      if (bilesen !== panel || !once.girildi || once.kayit === simdi.kayit) return;
      Object.keys(simdi.kayit).forEach((id) => {
        const o = once.kayit[id];
        const n = simdi.kayit[id];
        if (!o || o.ben === n.ben || yazilan.has(id)) return;
        yazilan.add(id);
        const istek = n.ben === 'yok' ? 'vazgec' : 'katil';
        sb.rpc('etkinlik_kaydi', { p_etkinlik: Number(id), p_istek: istek }).then(async ({ data, error }) => {
          let d = null;
          try { d = (await doluluk()).get(Number(id)); } catch (h) { /* sayı güncellenemezse eski kalır */ }
          // Ekranı sunucunun dediğiyle eşitle (dolu → bekleme listesi, sıra numarası, güncel kişi sayısı)
          panel.setState((s) => {
            const e = s.kayit[id];
            const duzelt = error ? { ben: o.ben, sira: o.sira } : { ben: data.durum, sira: data.sira || 0 };
            return { kayit: { ...s.kayit, [id]: { ...e, ...duzelt, ...(d ? { kayitli: d.kayitli + (e.satilan || 0) } : {}) } } };
          }, () => yazilan.delete(id));
          if (error) bildir(error.message, true);
          else bildir(data.durum === 'kayitli' ? 'Yerin ayrıldı ✓' : data.durum === 'bekleme' ? `Bekleme listesinde ${data.sira}. sıradasın` : 'Kaydın silindi ✓');
        });
      });
    };
  }

  async function basla() {
    const kok = document.getElementById('kok');
    let hata = '';
    const { data: { session } } = await sb.auth.getSession();
    if (session && window.FC_ORTAK.kurtarma) window.FCU_SIFRE_YENILE = true;
    else if (session) {
      try {
        window.FCU = await veriYukle(session.user);
        if (!window.FCU) hata = `${session.user.email} ile bir üyelik başvurusu bulamadık. Başvuruda yazdığın e-postayla gir.`;
      } catch (h) {
        hata = `Bilgilerin yüklenemedi: ${h.message}`;
      }
    }
    kok.textContent = '';
    const panel = await window.DC.bagla('/sayfalar/uye.dc.html', kok, { varliklar: A.varliklar });
    if (hata) panel.setState({ girisHata: hata });
    if (window.FCU) senkronKur(panel);
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
