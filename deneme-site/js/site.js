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
    const [etk, dol, oturum, ayr, tan] = await Promise.all([
      sb.from('etkinlikler').select('*').eq('durum', 'yayinda').order('tarih').order('saat'),
      sb.rpc('etkinlik_doluluk'),
      sb.auth.getSession(),
      sb.from('ayarlar').select('anahtar, deger'),  // yalnız herkese açık ayarlar gelir
      // Tanışma rezervasyonuna şu an açık etkinlikler (24 saat kala, katılım düşükse); göç yoksa boş
      sb.rpc('tanisma_etkinlikleri').then((r) => r.data || [], () => []),
    ]);
    if (etk.error) throw etk.error;
    const d = new Map((dol.data || []).map((x) => [x.etkinlik_id, x]));
    const anahtar = {};
    // Tarih ve saat sırası (9.30, 10.00'dan önce gelsin; veritabanı saati metin olarak sıralar)
    const sira = (e) => `${e.tarih} ${String(e.saat || '').replace(/^(\d)[.:]/, '0$1.')}`;
    const etkinlikler = [...etk.data].sort((a, b) => sira(a).localeCompare(sira(b))).map((e) => {
      const [, m, g] = e.tarih.split('-');
      anahtar[`${e.tarih}|${e.ad}`] = e.id;
      const satis = e.bilet_fiyati && e.tarih >= B ? {
        fiyat: Number(e.bilet_fiyati), uye: e.uyelere || 'tam', kontenjan: e.kontenjan,
        kayitli: ((d.get(e.id) || {}).kayitli || 0) + e.satilan_bilet,
      } : null;
      return {
        id: e.id, tarih: e.tarih, gun: g, ay: AYLAR[Number(m) - 1], haftaGunu: GUNLER[new Date(`${e.tarih}T12:00:00`).getDay()],
        ad: e.ad, saat: e.saat || '', tur: e.tur, metin: e.aciklama || e.kim || '', link: e.link || '#', afis: e.afis || '',
        ...(satis ? { satis } : {}),
      };
    });
    const ayar = Object.fromEntries((ayr.data || []).map((a) => [a.anahtar, a.deger]));
    const tanismaAcik = new Set((tan || []).map((x) => x.etkinlik_id));
    etkinlikler.forEach((e) => { e.tanisma = tanismaAcik.has(anahtar[`${e.tarih}|${e.ad}`]); });
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
  window.FCSGonullu = (veri) => formGonder('gonullu', veri);
  // Destek ol (kartla): sunucu iyzico ödeme sayfasının adresini döndürür
  window.FCSDestek = async (tutar) => (await formGonder('destek', { tutar })).sayfa;
  // Tanışma biletiyle rezervasyon (bileti bir üye verir; site bilet dağıtmaz)
  window.FCSTanisma = async (veri, etkAnahtar) => {
    const id = window.FCS && window.FCS.anahtar[etkAnahtar];
    if (!id) throw new Error('Geleceğin etkinliği seç.');
    return formGonder('tanisma', { ...veri, etkinlik: id });
  };

  // "Yakında yayındayız" kapağı (index.html) yalnız yönetimde "Yakında" modu kapatılınca kalkar; ayar okunamazsa kapak
  // kalır (açılmamış bölümler, fiyatlar görünmesin)
  function kapagiKaldir() {
    ['fc-yakinda', 'fc-yakinda-stil'].forEach((id) => { const k = document.getElementById(id); if (k) k.remove(); });
    document.getElementById('kok').removeAttribute('inert');
  }

  function kapagiGoster() {
    const k = document.getElementById('fc-yakinda');
    if (k) k.classList.add('goster');
  }

  // Gökyüzü (ana sayfanın üstü): Urla'da güneşin doğuş / batışına göre gündüz, şafak, gece; Open-Meteo'dan anlık hava
  // (bulutlu, yağmur, kar). Sınıflar <html>'de: gok-gunduz | gok-safak | gok-gece ve hava-acik | hava-bulutlu | hava-yagmur |
  // hava-kar. Hava alınamazsa yalnız gündüz / gece. Deneme: window.FC_GOK_TEST = 'gece,kar'
  const URLA = { enlem: 38.32, boylam: 26.76 };
  function gunesSaatleri(t) {
    // NOAA'nın sadeleştirilmiş formülü: doğuş ve batış (UTC dakika)
    const rad = Math.PI / 180;
    const gun = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - Date.UTC(t.getUTCFullYear(), 0, 0)) / 864e5);
    const g = (2 * Math.PI / 365) * (gun - 1);
    const denk = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const egim = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(URLA.enlem * rad) * Math.cos(egim)) - Math.tan(URLA.enlem * rad) * Math.tan(egim)) / rad;
    return { dogus: 720 - 4 * (URLA.boylam + ha) - denk, batis: 720 - 4 * (URLA.boylam - ha) - denk };
  }
  let hava = 'acik';
  function gokSinifi() {
    const test = String(window.FC_GOK_TEST || '').split(',');
    let evre = ['gunduz', 'safak', 'gece'].find((x) => test.includes(x));
    if (!evre) {
      const t = new Date();
      const dk = t.getUTCHours() * 60 + t.getUTCMinutes();
      const { dogus, batis } = gunesSaatleri(t);
      evre = dk < dogus - 30 || dk > batis + 30 ? 'gece' : Math.abs(dk - dogus) <= 40 || Math.abs(dk - batis) <= 40 ? 'safak' : 'gunduz';
    }
    const h = ['acik', 'bulutlu', 'yagmur', 'kar'].find((x) => test.includes(x)) || hava;
    const k = document.documentElement.classList;
    ['gok-gunduz', 'gok-safak', 'gok-gece', 'hava-acik', 'hava-bulutlu', 'hava-yagmur', 'hava-kar'].forEach((x) => k.remove(x));
    k.add(`gok-${evre}`, `hava-${h}`);
  }
  async function havaGetir() {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${URLA.enlem}&longitude=${URLA.boylam}&current=weather_code`);
      const kod = (await r.json()).current.weather_code;
      hava = [71, 73, 75, 77, 85, 86].includes(kod) ? 'kar'
        : (kod >= 51 && kod <= 67) || (kod >= 80 && kod <= 82) || kod >= 95 ? 'yagmur'
          : [2, 3, 45, 48].includes(kod) ? 'bulutlu' : 'acik';
    } catch (h) { /* hava alınamadı: açık say */ }
    gokSinifi();
  }
  gokSinifi();
  if (!window.FC_GOK_TEST) { havaGetir(); setInterval(havaGetir, 15 * 60 * 1000); }
  setInterval(gokSinifi, 60 * 1000);

  async function basla() {
    const kok = document.getElementById('kok');
    try {
      window.FCS = await veriYukle();
      if (window.FCS.ayar.yakinda === false) kapagiKaldir(); else kapagiGoster();
    } catch (h) {
      kapagiGoster();
      console.error(h); // veri gelmezse örnek liste değil "Etkinlikler şu an yüklenemiyor" görünür
      window.FCS_HATA = true;
      window.FCSBasvuru = null;
      window.FCSTanisma = null;
      window.FCSCagri = null;
      window.FCSGonullu = null;
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
  // Küçük TV alttakileri örtmesin: kapak dururken alttaki logo şeridinin üstünde, sayfa sonunda ise alt bilginin
  // (logolar, bağlantılar) üstündeki lamba dizisinin üstünde durur; o görünür olduğunda TV o kadar yukarı kalkar
  function tvYeri() {
    const iletisim = document.getElementById('iletisim');
    const serit = document.querySelector('#fc-yakinda .alt') || (iletisim && iletisim.previousElementSibling);
    const ust = serit ? serit.getBoundingClientRect().top : innerHeight;
    const alt = ust < innerHeight ? Math.ceil(innerHeight - ust) + 8 : 0;
    document.documentElement.style.setProperty('--fs-yuzen-alt', `${alt}px`);
  }
  addEventListener('scroll', tvYeri, { passive: true });
  addEventListener('resize', tvYeri);
  setInterval(tvYeri, 1000);  // kapak kalkınca ya da sayfa çizilince de güncellensin
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
