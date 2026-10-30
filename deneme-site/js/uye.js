// Forest Club Urla · üye paneli (deneme sitesi): üyenin kendi verisini Supabase'den yükler; "Geliyorum / Gelemeyeceğim /
// bekleme listesi" ve profil kaydı sunucudaki kurallarla (etkinlik_kaydi, profil_kaydet) yazılır. Giriş e-postaya gelen
// tek kullanımlık bağlantıyla da olur; ilk girişte başvuru hesaba bağlanır (uye_bagla). Dondurma, anket ve KVKK
// talepleri sunucu işlevleriyle; kartla ödeme iyzico ile (odeme-baslat), kapalıysa havale + dekont sayfası. Bilet sepeti
// henüz yok.
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
    const [ods, kys, etks, dol, ank, don, ayr] = await Promise.all([
      sb.from('odemeler').select('*').eq('uye_id', u.id).order('tarih', { ascending: false }),
      sb.from('etkinlik_kayitlari').select('*').eq('uye_id', u.id),
      sb.from('etkinlikler').select('*').order('tarih'),
      doluluk(),
      sb.from('anket_yanitlari').select('etkinlik_id, puan, yorum').eq('uye_id', u.id),
      sb.from('uyelik_dondurmalari').select('bas, gun').eq('uye_id', u.id).is('bitti', null).order('id', { ascending: false }).limit(1),
      sb.from('ayarlar').select('anahtar, deger'),
    ]);
    // Açık formlar (RLS yalnız açık, özel olmayanları gösterir; yönetici hepsini görür, süzülür) ve üyenin doldurdukları
    const [frm, fyn] = await Promise.all([
      sb.from('formlar').select('*').order('created_at', { ascending: false }),
      sb.from('form_yanitlari').select('form_id').eq('uye_id', u.id),
    ]);
    const doldurulan = new Set((fyn.data || []).map((y) => y.form_id));
    // Yönetici mi (herkes yoneticiler'de yalnız kendi satırını görür): üst menüde "Yönetim paneli" geçişi
    const { data: yon } = await sb.from('yoneticiler').select('ad').eq('user_id', user.id).maybeSingle();
    // Yüklediği dekont incelemede mi (göç uygulanmadıysa yok sayılır)
    const dekontBekliyor = await sb.rpc('dekont_bekliyor').then((r) => r.data === true, () => false);
    // Randevularım: üyenin bilet kodları (onaylı) ve incelemedeki istekleri; göç yoksa boş
    const biletlerim = await sb.rpc('uye_biletlerim').then((r) => r.data || [], () => []);
    const formlar = (frm.data || []).filter((f) => f.acik && !f.ozel).map((f) => ({ id: f.id, baslik: f.baslik, doldu: doldurulan.has(f.id) }));
    [ods, kys, etks, ank, don, ayr].forEach((r) => { if (r.error) throw r.error; });
    const ayar = Object.fromEntries(ayr.data.map((a) => [a.anahtar, a.deger]));
    const yanit = new Map(ank.data.map((a) => [a.etkinlik_id, a]));
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
        ben: k ? k.durum : 'yok', sira: k && k.sira ? k.sira : 0, geldi: !!(k && k.geldi),
        biletler: biletlerim.filter((b) => Number(b.etkinlik_id) === Number(e.id) && b.kod).map((b) => b.kod),
        biletInceleniyor: biletlerim.some((b) => Number(b.etkinlik_id) === Number(e.id) && b.durum === 'inceleniyor'),
        fiyat: Number(e.bilet_fiyati || 0), uye: e.bilet_fiyati ? e.uyelere || 'tam' : 'ucretsiz',
        aciklama: e.aciklama || '', kim: e.kim || '', afis: e.afis || '',
        satilan: e.satilan_bilet,
      };
    });
    const gecmisEtk = etks.data.filter((e) => e.tarih < B && benim.get(e.id) && benim.get(e.id).geldi).reverse();
    const gecmis = {};
    const anket = {};
    gecmisEtk.forEach((e) => {
      gecmis[String(e.id)] = { ad: e.ad, tarih: trTarih(e.tarih) };
      const a = yanit.get(e.id);
      anket[String(e.id)] = a ? { puan: a.puan, yorum: a.yorum || '', bitti: true } : { puan: 0, yorum: '', bitti: false };
    });
    return {
      bugun: B, eposta: u.eposta, uyeId: u.id, kayit, gecmis, anket, formlar, yonetici: !!yon,
      kartOdeme: ayar.kart_odeme === true, aidat: Number(ayar.aidat) || 3000, dondurmaKurali: ayar.dondurma || { gunler: [7, 14], yillik: 2 },
      hesap: {
        ad: u.ad, kod: u.kod, bitis: u.bitis || '', muaf: !!u.aidat_muaf, dekontBekliyor,
        odemeler: ods.data.map((o) => ({ tarih: o.tarih, yol: ({ kart: 'Kart', havale: 'Havale · dekont', elden: 'Elden' })[o.yol] || o.yol, tutar: Number(o.tutar) })),
        profil: { telefon: u.tel || '', dogum: u.dogum_gunu || '', kutlama: u.kutlama_izni, foto: u.foto_izni,
          ilgi: u.ilgi_alanlari || [], ozel: u.ozel_gunler || [] },
        katildi: gecmisEtk.map((e) => String(e.id)),
        dondurma: don.data.length ? { bas: don.data[0].bas, gun: don.data[0].gun } : null,
      },
    };
  }

  // Sunucu işlevi: hata mesajı kullanıcıya gider
  async function islev(ad, parametre) {
    const { data, error } = await sb.rpc(ad, parametre);
    if (error) throw new Error(error.message);
    return data;
  }
  window.FCUDondur = (gun) => islev('uyelik_dondur', { p_gun: gun });
  window.FCUDondurmaBitir = () => islev('dondurma_bitir', {});
  window.FCUAnket = (etkinlik, puan, yorum) => islev('anket_gonder', { p_etkinlik: Number(etkinlik), p_puan: puan, p_yorum: yorum || null });
  window.FCUSilmeTalebi = () => islev('veri_talebi_ac', { p_tur: 'silme' });
  // KVKK: verilerin kopyası hemen indirilir (JSON)
  window.FCUVeriKopyasi = async () => {
    const veri = await islev('veri_kopyasi', {});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' }));
    a.download = `forest-club-verilerim-${window.FC_ORTAK.bugun()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  // Kartla ödeme (iyzico): ödeme sayfasına gider; dönüşte panel #odeme-tamam / #odeme-hata ile açılır
  window.FCOdemeBaslat = async () => {
    const { data: { session } } = await sb.auth.getSession();
    const yanit = await fetch(`${A.supabaseUrl}/functions/v1/odeme-baslat`, {
      method: 'POST', headers: { apikey: A.supabaseAnahtar, Authorization: `Bearer ${session ? session.access_token : ''}` },
    }).catch(() => null);
    const govde = yanit ? await yanit.json().catch(() => ({})) : {};
    if (!yanit || !yanit.ok || !govde.sayfa) throw new Error(govde.hata || 'Ödeme sayfası açılamadı; biraz sonra tekrar dene.');
    location.assign(govde.sayfa);
  };
  // Giriş karekodu (qrcode-generator): {n, hucreler[]} — kütüphane yüklenmediyse null
  window.FCKarekod = (metin) => {
    if (!window.qrcode) return null;
    const qr = window.qrcode(0, 'M');
    qr.addData(metin);
    qr.make();
    const n = qr.getModuleCount();
    const hucreler = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) hucreler.push(qr.isDark(r, c));
    return { n, hucreler };
  };

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
        if (!window.FCU) {
          const { data: yon } = await sb.from('yoneticiler').select('ad').eq('user_id', session.user.id).maybeSingle();
          hata = yon ? `Yönetici hesabın (${session.user.email}) bir üyelik kaydına bağlı değil. Yönetim › Üyeler'de kendi profilini aç ve “Bu üyelik benim”e bas; sonra “Üye paneli” ile doğrudan geçersin.`
            : `${session.user.email} ile bir üyelik başvurusu bulamadık. Başvuruda yazdığın e-postayla gir.`;
        }
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
