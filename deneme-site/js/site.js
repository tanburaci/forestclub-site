// Forest Club Urla · ana site (deneme sitesi): etkinlikler ve kalan yerler Supabase'den; üyelik başvurusu, tanışma
// bileti ve Açık Çağrı spam korumalı form-gonder Edge Function'dan sunucudaki işlevlere gider. Ziyaretçi tablolara
// doğrudan yazamaz.
// Etkinlik bileti: sepet → sunucuda istek (form-gonder bilet_adres) → havale + dekont → yönetici onayı.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb } = window.FC_ORTAK;
  const AYLAR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
  const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  async function veriYukle() {
    const B = window.FC_ORTAK.bugun();
    const [etk, dol, oturum, ayr] = await Promise.all([
      sb.from('etkinlikler').select('*').eq('durum', 'yayinda').order('tarih').order('saat'),
      sb.rpc('etkinlik_doluluk'),
      sb.auth.getSession(),
      sb.from('ayarlar').select('anahtar, deger'),  // yalnız herkese açık ayarlar gelir
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
        ad: e.ad, saat: e.saat || '', tur: e.tur, metin: e.aciklama || e.kim || '', link: e.link || '#', afis: e.afis || '',
        ...(satis ? { satis } : {}),
      };
    });
    const ayar = Object.fromEntries((ayr.data || []).map((a) => [a.anahtar, a.deger]));
    return { bugun: B, etkinlikler, anahtar, ayar, oturum: !!(oturum.data && oturum.data.session) };
  }

  const sayac = (adim) => { sb.rpc('sayac_artir', { p_adim: adim }).then(() => {}, () => {}); };  // kişisel veri yok, yalnız günlük toplam
  // Anonim formlar spam korumalı Edge Function'dan geçer (Turnstile + IP başına saatlik sınır)
  const { formGonder } = window.FC_ORTAK;
  window.FCSBasvuru = async (ad, eposta, tel, kosul, dogal, kvkk, foto) => {
    const sonuc = await formGonder('basvuru', { ad, eposta, tel, kosul: !!kosul, dogal: !!dogal, kvkk: !!kvkk, foto: !!foto });
    if (sonuc === 'tamam') sayac('gonderildi');
    return sonuc;
  };
  window.FCSCagri = (alanlar) => formGonder('cagri', alanlar);
  // Destek ol (kartla): sunucu iyzico ödeme sayfasının adresini döndürür
  window.FCSDestek = async (tutar) => (await formGonder('destek', { tutar })).sayfa;
  window.FCSTanisma = async (ad, eposta, etkAnahtar) => {
    const id = window.FCS && window.FCS.anahtar[etkAnahtar];
    if (!id) throw new Error('Geleceğin buluşmayı seç.');
    return formGonder('tanisma', { ad, eposta, etkinlik: id });
  };

  // "Yakında yayındayız" kapağı (index.html) yalnız yönetimde "Yakında" modu kapatılınca kalkar; ayar okunamazsa kapak
  // kalır (açılmamış bölümler, fiyatlar görünmesin)
  function kapagiKaldir() {
    ['fc-yakinda', 'fc-yakinda-stil'].forEach((id) => { const k = document.getElementById(id); if (k) k.remove(); });
    document.getElementById('kok').removeAttribute('inert');
  }

  async function basla() {
    const kok = document.getElementById('kok');
    try {
      window.FCS = await veriYukle();
      if (window.FCS.ayar.yakinda === false) kapagiKaldir();
    } catch (h) {
      console.error(h); // veri gelmezse örnek liste değil "Etkinlikler şu an yüklenemiyor" görünür
      window.FCS_HATA = true;
      window.FCSBasvuru = null;
      window.FCSTanisma = null;
      window.FCSCagri = null;
      window.FCSDestek = null;
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
