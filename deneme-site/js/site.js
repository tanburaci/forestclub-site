// Forest Club Urla · ana site (deneme sitesi): etkinlikler ve kalan yerler Supabase'den; üyelik başvurusu ve tanışma
// bileti sunucudaki işlevlerle (basvuru_yap, tanisma_bileti_al) yazılır. Ziyaretçi tablolara doğrudan yazamaz.
// Sepet / kartla ödeme ve Açık Çağrı şimdilik yalnız ekranda (iyzico sonra).
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;
  const AYLAR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  async function veriYukle() {
    const B = window.FC_ORTAK.bugun();
    const [etk, dol, oturum] = await Promise.all([
      sb.from('etkinlikler').select('*').eq('durum', 'yayinda').order('tarih').order('saat'),
      sb.rpc('etkinlik_doluluk'),
      sb.auth.getSession(),
    ]);
    if (etk.error) throw etk.error;
    const d = new Map((dol.data || []).map((x) => [x.etkinlik_id, x]));
    const anahtar = {};
    const etkinlikler = etk.data.map((e) => {
      const [, m, g] = e.tarih.split('-');
      anahtar[`${e.tarih}|${e.ad}`] = e.id;
      const satis = e.bilet_fiyati && e.tarih >= B ? {
        fiyat: Number(e.bilet_fiyati), uye: e.uyelere || 'tam', kontenjan: e.kontenjan,
        kayitli: ((d.get(e.id) || {}).kayitli || 0) + e.satilan_bilet,
      } : null;
      return {
        tarih: e.tarih, gun: g, ay: AYLAR[Number(m) - 1], haftaGunu: GUNLER[new Date(`${e.tarih}T12:00:00`).getDay()],
        ad: e.ad, saat: e.saat || '', tur: e.tur, metin: e.aciklama || e.kim || '', link: e.link || '#',
        ...(satis ? { satis } : {}),
      };
    });
    return { bugun: B, etkinlikler, anahtar, oturum: !!(oturum.data && oturum.data.session) };
  }

  const sayac = (adim) => { sb.rpc('sayac_artir', { p_adim: adim }).then(() => {}, () => {}); };  // kişisel veri yok, yalnız günlük toplam
  window.FCSBasvuru = async (ad, eposta, tel, kosul, dogal, kvkk, foto) => {
    const { data, error } = await sb.rpc('basvuru_yap', { p_ad: ad, p_eposta: eposta, p_tel: tel, p_kosul: kosul, p_dogal: dogal, p_kvkk: kvkk, p_foto: !!foto });
    if (error) throw new Error(error.message);
    if (data === 'tamam') sayac('gonderildi');
    return data;
  };
  window.FCSCagri = async (alanlar) => {
    const { error } = await sb.rpc('cagri_gonder', { p: alanlar });
    if (error) throw new Error(error.message);
  };
  window.FCSTanisma = async (ad, eposta, etkAnahtar) => {
    const id = window.FCS && window.FCS.anahtar[etkAnahtar];
    if (!id) throw new Error('Geleceğin buluşmayı seç.');
    const { data, error } = await sb.rpc('tanisma_bileti_al', { p_ad: ad, p_eposta: eposta, p_etkinlik: id });
    if (error) throw new Error(error.message);
    return data;
  };

  async function basla() {
    const kok = document.getElementById('kok');
    try {
      window.FCS = await veriYukle();
    } catch (h) {
      console.error(h); // veri gelmezse site tasarımdaki örnek listeyle açılır
      window.FCSBasvuru = null;
      window.FCSTanisma = null;
      window.FCSCagri = null;
    }
    kok.textContent = '';
    const site = await window.DC.bagla('/sayfalar/site.dc.html', kok, { varliklar: A.varliklar });
    if (!window.FCS) return;
    // Başvuru adım sayaçları (Sheets'teki "Sayılar"): sayfa açıldı, bilgiler dolduruldu, onaylar işaretlendi
    sayac('acildi');
    const sayildi = new Set();
    window.DC.durumDegisti = (b, once, s) => {
      if (b !== site) return;
      if (!sayildi.has('bilgiler') && s.bAd && s.bEposta && s.bTel) { sayildi.add('bilgiler'); sayac('bilgiler'); }
      if (!sayildi.has('onaylar') && s.bKosul && s.bDogal && s.bKvkk) { sayildi.add('onaylar'); sayac('onaylar'); }
    };
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
