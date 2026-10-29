// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/uye.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/uye.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Tam ekran afiş Esc ile kapanır
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state.afisTam) this.setState({ afisTam: '' }); });
    this.BUGUN = window.FCU ? window.FCU.bugun : '2026-10-24';  // deneme sitesinde gerçek bugün
    // Önizleme hesapları: yönetici panelindeki demo verisiyle aynı kişiler ve durumlar
    this.HESAPLAR = window.FCU ? { [window.FCU.eposta]: window.FCU.hesap } : {
      'deniz@ornek.com': { ad: 'Deniz Yılmaz', kod: 'FC-U-0001', bitis: '2026-10-26', odemeler: [{ tarih: '2026-09-26', yol: 'Kart · iyzico' }],
        profil: { telefon: '0532 000 00 00', dogum: '1992-11-03', kutlama: true, foto: true, ilgi: ['Yoga', 'Kahvaltı buluşmaları'], ozel: [{ ad: 'Evlilik yıldönümü', tarih: '2019-06-14' }] },
        katildi: ['ct', 'sk', 'bf'] },
      'can@ornek.com': { ad: 'Can Öztürk', kod: 'FC-U-0005', bitis: '2026-10-18', odemeler: [{ tarih: '2026-09-18', yol: 'Elden' }],
        profil: { telefon: '0536 000 00 04', dogum: '1990-06-02', kutlama: true, foto: true, ilgi: ['Müzik / DJ'], ozel: [] },
        katildi: ['sk', 'bf'] },
      'mert@ornek.com': { ad: 'Mert Kaya', kod: 'FC-U-0003', bitis: '', odemeler: [],
        profil: { telefon: '0535 000 00 02', dogum: '', kutlama: false, foto: false, ilgi: ['Hareket'], ozel: [] },
        katildi: [] },
    };
    this.state = {
      girildi: false, eposta: window.FCU ? window.FCU.eposta : '', sifre: '', hatirla: true, girisHata: '', girisBilgi: '',
      sifreYenile: !!window.FCU_SIFRE_YENILE, yeni1: '', yeni2: '',
      hesap: window.FCU ? window.FCU.eposta : 'deniz@ornek.com', sekme: 'ana',  // ilk çizimde de üyenin kendi hesabı
      bitis: '', odemeler: [], odeme: 'yok', profil: null, katildi: [],
      kayit: {}, sepet: {}, sepetAdim: 'yok', satinAlinan: [],
      secili: '', bilet: null, kodHata: '',
      yeniOzel: { ad: '', tarih: '' }, profilMesaj: '',
      dondurma: null, dondurmaSecim: false, silmeSoru: false, silmeIstendi: false, veriMesaj: '',
      anket: { ct: { puan: 0, yorum: '', bitti: false }, sk: { puan: 5, yorum: '', bitti: true }, bf: { puan: 0, yorum: '', bitti: false } },
      galeri: '',
    };
    this.pAlan = {};
    ['telefon', 'dogum'].forEach((k) => {
      this.pAlan[k] = (e) => { const v = e.target.value; this.setState((s) => ({ profil: { ...s.profil, [k]: v }, profilMesaj: '' })); };
    });
  }
  // Seçilen hesabın verisiyle paneli açar (her girişte temiz başlar)
  hesapAc(eposta) {
    const h = this.HESAPLAR[eposta];
    const benKayitli = h.bitis > this.BUGUN;
    this.setState({
      girildi: true, girisHata: '', sifre: '', hesap: eposta, sekme: 'ana',
      bitis: h.bitis, odemeler: h.odemeler.map((o) => ({ ...o })), odeme: 'yok', profil: { ...h.profil, ozel: [...h.profil.ozel] }, katildi: h.katildi,
      // Örnek buluşmalar: kontenjan / kayıtlı / benim durumum (yönetici panelindeki demo ile aynı)
      kayit: window.FCU ? window.FCU.kayit : {
        // fiyat: bilet; uye: ucretsiz (üyelik kapsamında) | yuzde50 | tam
        bf: { ad: 'Breakfast Club', tarih: '2026-10-26', saat: '10.00', bitisSaat: '12.00', bilgi: 'Pazar 10.00', kontenjan: 35, kayitli: 21, ben: benKayitli ? 'kayitli' : 'yok', sira: 0, fiyat: 600, uye: 'ucretsiz' },
        sc: { ad: 'Sunset Club', tarih: '2026-11-02', saat: '17.30', bitisSaat: '20.30', bilgi: 'Pazar 17.30', kontenjan: 25, kayitli: 25, ben: 'yok', sira: 0, fiyat: 900, uye: 'ucretsiz' },
        sm: { ad: 'Seramik Atölyesi', tarih: '2026-11-07', saat: '14.00', bitisSaat: '17.00', bilgi: 'Cumartesi 14.00', kontenjan: 12, kayitli: 5, ben: 'yok', sira: 0, fiyat: 1500, uye: 'yuzde50' },
        vy: { ad: 'Vinyasa Yoga', tarih: '2026-11-09', saat: '09.00', bitisSaat: '10.30', bilgi: 'Pazartesi 09.00', kontenjan: 20, kayitli: 11, ben: 'yok', sira: 0, fiyat: 400, uye: 'yuzde50' },
        s2: { ad: 'Sunset Club', tarih: '2026-11-14', saat: '17.00', bitisSaat: '20.00', bilgi: 'Cumartesi 17.00', kontenjan: 50, kayitli: 32, ben: 'yok', sira: 0, fiyat: 900, uye: 'ucretsiz' },
        tc: { ad: 'Tai Chi Sabahı', tarih: '2026-11-16', saat: '10.00', bitisSaat: '11.30', bilgi: 'Pazartesi 10.00', kontenjan: 20, kayitli: 10, ben: 'yok', sira: 0, fiyat: 450, uye: 'yuzde50' },
        cc: { ad: 'Clay & Create Seramik', tarih: '2026-11-22', saat: '14.00', bitisSaat: '17.00', bilgi: 'Pazar 14.00', kontenjan: 12, kayitli: 11, ben: 'yok', sira: 0, fiyat: 1500, uye: 'yuzde50' },
        b2: { ad: 'Breakfast Club', tarih: '2026-11-30', saat: '10.00', bitisSaat: '12.00', bilgi: 'Pazar 10.00', kontenjan: 35, kayitli: 13, ben: 'yok', sira: 0, fiyat: 600, uye: 'ucretsiz' },
      },
      ...(window.FCU ? { anket: window.FCU.anket } : {}),
      sepet: {}, sepetAdim: 'yok', satinAlinan: [], hak: null, sepetDosya: null, sepetHata: '', secili: '', bilet: null, kodHata: '', dondurma: h.dondurma || null, dondurmaSecim: false, silmeSoru: false, silmeIstendi: false, veriMesaj: '', profilMesaj: '',
    });
  }
  componentDidMount() {
    // Deneme sitesi: oturum Supabase'de; giriş yapılmışsa panel kendi verisiyle açılır
    if (window.FCU) this.hesapAc(window.FCU.eposta);
    // iyzico ödeme sayfasından dönüş
    const donus = /^#odeme-(tamam|hata)$/.exec(location.hash);
    if (window.FCU && donus) {
      this.setState({ sekme: 'uyelik', odeme: donus[1] === 'tamam' ? 'basarili' : 'hata' });
      history.replaceState(null, '', location.pathname);
    }
  }
  renderVals() {
    const { girildi, bitis, odeme, sekme } = this.state;
    const BUGUN = this.BUGUN;
    // Deneme sitesinde (gerçek veriyle) kartla ödeme, bilet sepeti, dondurma, anket ve veri talepleri henüz kaydedilmez:
    // ekranda başarı göstermek yerine "yakında" denir. Tasarım önizlemesinde eskisi gibi çalışır.
    const canli = !!window.FCU;
    const kartla = canli && window.FCU.kartOdeme;  // iyzico açık mı (ayarlar.kart_odeme)
    const kural = canli ? window.FCU.dondurmaKurali : { gunler: [7, 14], yillik: 2 };
    const yakinda = (metin) => { if (window.FC_ORTAK) window.FC_ORTAK.bildir(metin, false, 8000); };
    const h = this.HESAPLAR[this.state.hesap];
    const gunEkle = (t, n) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const gunFark = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 86400000);
    const tarihYaz = (t) => t.split('-').reverse().join('.');
    const TL = (n) => `${Math.round(n).toLocaleString('tr-TR')} TL`;
    const pill = (bg, fg) => `background:${bg};color:${fg};font-size:13px;font-weight:700;border-radius:999px;padding:5px 11px;display:inline-block`;
    const AYLAR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const takvimLink = (ad, tarih, bas, son) => {
      const g = tarih.replace(/-/g, '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Forest Club · ${ad}`)}&dates=${g}T${bas.replace('.', '')}00/${g}T${son.replace('.', '')}00&ctz=Europe/Istanbul&location=${encodeURIComponent('Pinya, Urla')}`;
    };

    // Üyelik durumu: aktif / süresi dolmuş / hiç ödememiş
    const muaf = !!h.muaf;  // aidattan muaf (yönetim ekibi): süresiz aktif, ödeme ve dondurma yok
    const aktif = muaf || (!!bitis && bitis > BUGUN);
    const durumTur = aktif ? 'aktif' : bitis ? 'doldu' : 'basvuru';
    const kalan = aktif && bitis ? gunFark(bitis, BUGUN) : 0;
    const dond = this.state.dondurma;
    const AIDAT = TL(canli ? window.FCU.aidat || 3000 : 3000);
    const dekontBekliyor = !aktif && !!h.dekontBekliyor;  // yüklediği dekont incelemede: yeniden ödeme istenmez
    const uyari = dekontBekliyor
      ? { baslik: 'Dekontun inceleniyor', metin: 'Dekontun bize ulaştı, inceleniyor. Onaylanınca üyeliğin başlar ve e-postayla haber veririz.', dugme: '' }
      : durumTur === 'doldu'
        ? { baslik: 'Üyeliğinin süresi doldu', metin: `Üyeliğin ${tarihYaz(bitis)} tarihinde sona erdi. Buluşmalara katılmak ve giriş karekodu almak için üyeliğini yenile.`, dugme: `Üyeliğini yenile · ${AIDAT}` }
        : { baslik: 'Üyeliğin henüz başlamadı', metin: canli && !kartla
          ? 'Başvurun bize ulaştı. Buluşmalara katılmak ve giriş karekodu almak için üyelik ödemesini yap ve dekontunu yükle; onaylanınca üyeliğin başlar.'
          : 'Başvurun bize ulaştı. Buluşmalara katılmak ve giriş karekodu almak için üyelik ödemesini tamamla; üyeliğin hemen başlar.', dugme: `Üye ol · ${AIDAT}` };
    const yeniBitis = gunEkle(aktif && bitis ? bitis : BUGUN, 30);
    const ben = {
      ad: h.ad, ilkAd: h.ad.split(' ')[0], harf: h.ad[0], eposta: this.state.hesap,
      ozet: muaf ? 'Üyeliğin aktif · aidattan muafsın' : aktif ? `Üyeliğin aktif · ${kalan} gün kaldı (bitiş ${tarihYaz(bitis)})` : durumTur === 'doldu' ? `Üyeliğin ${tarihYaz(bitis)} tarihinde sona erdi` : 'Başvurun alındı, üyeliğin henüz başlamadı',
      durumYazi: muaf ? 'Aidattan muaf' : dond ? 'Donduruldu' : aktif ? (kalan <= 3 ? 'Aktif · yakında bitiyor' : 'Aktif') : durumTur === 'doldu' ? 'Süresi doldu' : 'Üye değil',
      rozet: muaf ? pill('#111111', '#FFFFFF') : dond ? pill('#E4E4E2', '#111111') : aktif ? (kalan <= 3 ? pill('#E4E4E2', '#111111') : pill('#111111', '#FFFFFF')) : pill('#F3DCD5', '#82301F'),
      kalan: String(kalan), bitisYazi: bitis ? tarihYaz(bitis) : '—', kalanEtiket: `30 günden ${kalan} gün kaldı`,
      kalanCubuk: `height:12px;border-radius:4px;background:#111111;width:${Math.max(2, Math.min(100, (kalan * 100) / 30))}%`,
    };

    // Yaklaşan buluşmalar (kayıt + kontenjan + bekleme)
    const kayit = this.state.kayit;
    const kGuncelle = (id, deg) => this.setState((s) => ({ kayit: { ...s.kayit, [id]: { ...s.kayit[id], ...deg } } }));
    // Tarih sırası (yakından uzağa): kayit'in anahtarları sayısal olduğu için nesne sırası etkinlik numarasına göredir
    const sira = (e) => `${e.tarih} ${String(e.saat || '').replace(/^(\d)[.:]/, '0$1.')}`;  // 9.30 < 10.00
    const yaklasan = Object.entries(kayit).sort(([, a], [, b]) => sira(a).localeCompare(sira(b))).map(([id, e]) => {
      const dolu = e.kayitli >= e.kontenjan;
      const [, m, d] = e.tarih.split('-');
      let durum, rozet, dugme, islem, dugmeSinif = 'fu-btn';
      if (e.ben === 'kayitli') {
        durum = 'Yerin ayrıldı ✓'; rozet = pill('#C9E33A', '#111111'); dugme = 'Randevumu iptal et'; dugmeSinif = 'fu-btn fu-btn-ikincil';
        islem = () => kGuncelle(id, { ben: 'yok', kayitli: e.kayitli - 1 });
      } else if (e.ben === 'bekleme') {
        durum = `Bekleme listesinde ${e.sira}. sıradasın`; rozet = pill('#F6C945', '#111111'); dugme = 'Listeden çık'; dugmeSinif = 'fu-btn fu-btn-ikincil';
        islem = () => kGuncelle(id, { ben: 'yok', sira: 0 });
      } else if (dolu) {
        durum = `Dolu · ${e.kontenjan}/${e.kontenjan}`; rozet = pill('#F3DCD5', '#82301F'); dugme = 'Bekleme listesine yazıl';
        islem = () => kGuncelle(id, { ben: 'bekleme', sira: 4 });
      } else {
        durum = `${e.kontenjan - e.kayitli} yer kaldı`; rozet = pill('#F0F0EE', '#111111'); dugme = 'Randevu oluştur';
        islem = () => kGuncelle(id, { ben: 'kayitli', kayitli: e.kayitli + 1 });
      }
      const sepette = this.state.sepet[id] || 0;
      const kalan = e.kontenjan - e.kayitli;
      const ucretli = e.uye !== 'ucretsiz';
      return {
        id, gun: d, ay: AYLAR[Number(m) - 1], ad: e.ad, bilgi: `${e.bilgi} · Pinya, Urla · ${e.kayitli}/${e.kontenjan} kişi`,
        durum, rozet, dugme, islem, dugmeSinif, takvim: takvimLink(e.ad, e.tarih, e.saat, e.bitisSaat),
        acik: this.state.acikEtk === id, acikYazi: this.state.acikEtk === id ? 'true' : 'false',
        acYazi: this.state.acikEtk === id ? 'Ayrıntıları gizle ▲' : 'Ayrıntılar ▼',
        ac: () => this.setState((s) => ({ acikEtk: s.acikEtk === id ? null : id })),
        kartTikla: (e) => {
          if (e.target.closest('a, button:not(.fu-kart-bas), input, select, textarea, label')) return;
          this.setState((s) => ({ acikEtk: s.acikEtk === id ? null : id }));
        },
        afisAc: () => this.setState({ afisTam: e.afis, afisTamAlt: `${e.ad} afişi` }),
        satisVar: !!e.fiyat, afisVar: !!e.afis, afis: e.afis || '', afisAlt: `${e.ad} afişi`, kimVar: !!e.kim, kim: e.kim || '',
        aciklama: e.aciklama || 'Ayrıntılar yakında.',
        // Ücretsiz (üyelik kapsamında) etkinlikte aktif üye "Geliyorum" der; sepet misafir bileti içindir
        geliyorVar: aktif && (!ucretli || e.ben === 'kayitli'),
        // Üyeye kendi fiyatı büyük: üyelik kapsamındakilerde “Sana ücretsiz”, bilet yalnız misafir için
        fiyatYazi: !e.fiyat ? 'Üyelere ücretsiz' : !aktif ? `Bilet ${TL(e.fiyat)}` : e.uye === 'ucretsiz' ? 'Sana ücretsiz' : e.uye === 'yuzde50' ? `Sana ${TL(e.fiyat / 2)}` : `Bilet ${TL(e.fiyat)}`,
        benimFiyat: !e.fiyat ? (aktif ? 'Üyelerimize ücretsiz · “Randevu oluştur” de' : 'Üyelerimize ücretsiz · üyeliğin aktif olunca') : !aktif ? (e.uye === 'ucretsiz' ? 'Üyelere ücretsiz · üyeliğin aktif değil, bilet tam fiyat' : 'Üyelik aktif değil: tam fiyat') : e.uye === 'ucretsiz' ? `Üyelik kapsamında · misafir bileti ${TL(e.fiyat)}` : e.uye === 'yuzde50' ? `Normal fiyat ${TL(e.fiyat)} · üyelere %50` : 'Üyelere de aynı fiyat',
        sepetDugme: !e.fiyat ? 'Bilet satışı yok' : kalan <= sepette ? 'Yer kalmadı' : sepette ? `Sepette ${sepette} · bir tane daha` : aktif && !ucretli ? 'Misafir için randevu' : 'Randevu oluştur',
        sepetSinif: aktif && !ucretli ? 'fu-btn fu-btn-ikincil' : 'fu-btn',
        sepetKapali: !e.fiyat || kalan <= sepette,  // canlıda bilet havale + dekontla (yönetici onayı)
        sepeteEkle: () => { if (kalan > sepette) this.setState((s) => ({ sepet: { ...s.sepet, [id]: (s.sepet[id] || 0) + 1 }, sepetAdim: 'sepet' })); },
      };
    });
    // Sepet tutarı: aktif üyeye %50'li etkinlikte (henüz kayıtlı değilse) 1 bilet indirimli, gerisi tam
    const birimler = (id, n) => {
      const e = kayit[id];
      const indirimli = aktif && e.uye === 'yuzde50' && e.ben !== 'kayitli' ? 1 : 0;
      return { tutar: indirimli ? e.fiyat / 2 + (n - 1) * e.fiyat : n * e.fiyat, indirimli };
    };
    const sepetIdler = Object.keys(this.state.sepet).filter((id) => this.state.sepet[id] > 0);
    const sepetToplamTL = sepetIdler.reduce((t, id) => t + birimler(id, this.state.sepet[id]).tutar, 0);

    // Ana sayfa: etkinlik seç → karekod (kayıtlı değilse yer ayrılır, doluysa uyarır)
    const secili = this.state.secili;
    // Üye karekodu yalnız üyelere ücretsiz buluşmalarda; ücretli etkinlikte girişte bilet kodu (FC-B) geçer
    const secimEtk = Object.entries(kayit).filter(([, e]) => e.uye === 'ucretsiz' || e.ben === 'kayitli')
      .sort(([, a], [, b]) => sira(a).localeCompare(sira(b))).map(([id, e]) => {
      const [, m, d] = e.tarih.split('-');
      const on = id === secili;
      return {
        ad: e.ad, tarihYazi: `${Number(d)} ${AY_UZUN[Number(m) - 1]} · ${e.saat}`,
        durum: e.ben === 'kayitli' ? 'Yerin ayrıldı' : e.ben === 'bekleme' ? 'Bekleme listesindesin' : e.kayitli >= e.kontenjan ? 'Dolu' : `${e.kontenjan - e.kayitli} yer kaldı`,
        basili: on ? 'true' : 'false',
        stil: `text-align:left;font-family:Figtree,sans-serif;border-radius:12px;padding:14px 16px;min-height:44px;cursor:pointer;border:2.5px solid #111111;${on ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}`,
        sec: () => this.setState({ secili: id, kodHata: '', bilet: null, secimAcik: false }),
      };
    });
    const seciliEtk = kayit[secili];
    const karekodDesen = (tohumYazi) => {
      let t = 0;
      for (const c of tohumYazi) t = (t * 31 + c.charCodeAt(0)) >>> 0;
      const N = 21, hucre = [];
      const bul = (r, c) => [[0, 0], [0, N - 7], [N - 7, 0]].find(([y, x]) => r - y >= -1 && r - y <= 7 && c - x >= -1 && c - x <= 7);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const k = bul(r, c);
        let dolu;
        if (k) {
          const a = r - k[0], b = c - k[1];
          dolu = a >= 0 && b >= 0 && a <= 6 && b <= 6 && (a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4));
        } else {
          t = (t * 1103515245 + 12345) >>> 0;
          dolu = (t >>> 16) % 100 < 45;
        }
        hucre.push(`display:block;background:${dolu ? '#111111' : '#FFFFFF'}`);
      }
      return hucre;
    };
    const kodOlustur = () => {
      if (!secili) return this.setState({ kodHata: 'Önce gitmek istediğin buluşmayı seç.' });
      const e = kayit[secili];
      if (e.ben !== 'kayitli' && e.uye !== 'ucretsiz') {
        return this.setState({ kodHata: `${e.ad} ücretli bir etkinlik (sana ${e.uye === 'yuzde50' ? TL(e.fiyat / 2) : TL(e.fiyat)}). Önce “Etkinlikler” sekmesinden biletini al, sonra karekodunu oluştur.` });
      }
      if (e.ben !== 'kayitli' && e.kayitli >= e.kontenjan) {
        return this.setState({ kodHata: `${e.ad} dolu. “Etkinlikler” sekmesinden bekleme listesine yazılabilirsin; yer açılınca karekodunu oluşturursun.` });
      }
      const [, m, d] = e.tarih.split('-');
      const kod = `${h.kod}-${m}${d}`;
      // Gerçek karekod: kenarda 4 hücre boşluk (okuyucular için); kütüphane yoksa önizleme deseni
      const qr = window.FCKarekod ? window.FCKarekod(kod) : null;
      const hucre = qr && qr.n > 25 ? 6 : 8;
      const izgara = (n, h2) => `display:grid;grid-template-columns:repeat(${n},${h2}px);grid-auto-rows:${h2}px;padding:${qr ? h2 * 4 : 12}px;background:#FFFFFF;border:2px solid #111111;border-radius:10px`;
      this.setState((s) => ({
        kodHata: '',
        kayit: e.ben === 'kayitli' ? s.kayit : { ...s.kayit, [secili]: { ...e, ben: 'kayitli', kayitli: e.kayitli + 1 } },
        bilet: {
          etkinlik: e.ad, zaman: `${Number(d)} ${AY_UZUN[Number(m) - 1]} · ${e.saat}`, kod,
          karekod: qr ? qr.hucreler.map((k) => `display:block;background:${k ? '#111111' : '#FFFFFF'}`) : karekodDesen(`${h.kod}|${secili}`),
          izgara: qr ? izgara(qr.n, hucre) : izgara(21, 9),
          not: qr ? 'Girişte bu karekodu okut; okunmazsa kodu söylemen yeterli.' : 'Önizleme: desen örnektir, gerçek karekod sitede üretilir.',
          takvim: takvimLink(e.ad, e.tarih, e.saat, e.bitisSaat),
        },
      }));
    };

    // Katıldığım buluşmalar: galeri + anket
    const GECMIS = window.FCU ? window.FCU.gecmis : {
      ct: { ad: 'The Common Table', tarih: '24.10.2026' },
      sk: { ad: 'Sunset Club × Subkult', tarih: '09.10.2026' },
      bf: { ad: 'Breakfast Club', tarih: '30.09.2026' },
    };
    const gecmis = this.state.katildi.map((id) => {
      const g = GECMIS[id];
      const a = this.state.anket[id];
      const acik = this.state.galeri === id;
      const anketGuncelle = (deg) => this.setState((s) => ({ anket: { ...s.anket, [id]: { ...s.anket[id], ...deg } } }));
      return {
        ...g, galeriAcik: acik, galeriDugme: acik ? 'Fotoğrafları kapat' : 'Fotoğraflar', galeriVar: !canli,  // galeri henüz yok
        galeriDegis: () => this.setState((s) => ({ galeri: s.galeri === id ? '' : id })),
        fotolar: ['[Fotoğraf]', '[Fotoğraf]', '[Fotoğraf]', '[Fotoğraf]', '[Fotoğraf]', '[Fotoğraf]'],
        anketBekliyor: !a.bitti, anketBitti: a.bitti, puanYazi: `${a.puan} / 5`, yorum: a.yorum,
        yorumYaz: (e) => anketGuncelle({ yorum: e.target.value }),
        gonder: () => {
          if (!a.puan) return;
          if (!canli) return anketGuncelle({ bitti: true });
          window.FCUAnket(id, a.puan, a.yorum).then(() => anketGuncelle({ bitti: true }), (h) => window.FC_ORTAK.bildir(h.message, true));
        },
        puanlar: [1, 2, 3, 4, 5].map((p) => ({
          yazi: String(p), etiket: `${p} puan`, basili: a.puan === p ? 'true' : 'false',
          stil: `font:700 15px Figtree,sans-serif;width:44px;height:44px;border-radius:50%;cursor:pointer;border:2px solid #111111;${a.puan >= p ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}`,
          sec: () => anketGuncelle({ puan: p }),
        })),
      };
    });

    const profil = this.state.profil || { telefon: '', dogum: '', kutlama: false, foto: false, ilgi: [], ozel: [] };
    const sekmeler = [
      { id: 'ana', ad: 'Karekodum' }, { id: 'etkinlikler', ad: 'Etkinlikler' }, { id: 'katildiklarim', ad: 'Katıldıklarım' },
      { id: 'uyelik', ad: 'Üyeliğim' }, { id: 'profil', ad: 'Profilim' }, { id: 'veri', ad: 'Verilerim' },
    ].map((s) => ({ ...s, sinif: s.id === sekme ? 'fu-sekme fu-sekme-aktif' : 'fu-sekme', sec: () => this.setState({ sekme: s.id }) }));

    return {
      girisEkrani: !girildi, panel: girildi,
      // Şifre sıfırlama bağlantısıyla gelindiyse yeni şifre formu; deneme hesapları yalnız deneme sitesinde
      sifreYenile: this.state.sifreYenile, girisNormal: !this.state.sifreYenile,
      girisAlt: this.state.sifreYenile ? 'Yeni şifreni belirle.' : 'E-postana gelen giriş bağlantısıyla ya da şifrenle gir.',
      ornekGoster: !window.FC_AYAR || window.FC_AYAR.deneme !== false, onizleme: !canli,
      yeni1: this.state.yeni1, yeni2: this.state.yeni2,
      yeni1Yaz: (e) => this.setState({ yeni1: e.target.value, girisHata: '' }),
      yeni2Yaz: (e) => this.setState({ yeni2: e.target.value, girisHata: '' }),
      sifreKaydet: () => {
        const { yeni1, yeni2 } = this.state;
        if (yeni1.length < 8 || !/\d/.test(yeni1)) return this.setState({ girisHata: 'Şifre en az 8 karakter olmalı ve bir rakam içermeli.' });
        if (yeni1 !== yeni2) return this.setState({ girisHata: 'İki şifre aynı değil.' });
        window.FCSifreKaydet(yeni1).catch((h) => this.setState({ girisHata: h.message }));
      },
      sifreFormu: !!this.state.sifreFormu,
      sifreDegistir: () => this.setState((s) => ({ sifreFormu: !s.sifreFormu, yeni1: '', yeni2: '', profilMesaj: '' })),
      panelSifreKaydet: () => {
        const { yeni1, yeni2 } = this.state;
        if (yeni1.length < 8 || !/\d/.test(yeni1)) return this.setState({ profilMesaj: 'Şifre en az 8 karakter olmalı ve bir rakam içermeli.' });
        if (yeni1 !== yeni2) return this.setState({ profilMesaj: 'İki şifre aynı değil.' });
        if (!window.FCSifreGuncelle) return this.setState({ profilMesaj: 'Önizlemede şifre kaydedilmez.' });
        this.setState({ profilMesaj: 'Kaydediliyor…' });
        window.FCSifreGuncelle(yeni1)
          .then(() => this.setState({ profilMesaj: 'Şifren kaydedildi ✓ Sonraki girişte e-posta ve şifrenle girebilirsin.', sifreFormu: false, yeni1: '', yeni2: '' }))
          .catch((h) => this.setState({ profilMesaj: h.message }));
      },
      eposta: this.state.eposta, sifre: this.state.sifre, hatirla: this.state.hatirla, girisHata: this.state.girisHata,
      epostaYaz: (e) => this.setState({ eposta: e.target.value, girisHata: '', girisBilgi: '' }),
      sifreYaz: (e) => this.setState({ sifre: e.target.value, girisHata: '' }),
      hatirlaDegis: () => this.setState((s) => ({ hatirla: !s.hatirla })),
      girisYap: () => {
        const ep = this.state.eposta.trim().toLowerCase();
        if (!ep || !this.state.sifre) return this.setState({ girisHata: 'E-posta ve şifreni yaz.' });
        this.setState({ girisHata: 'Giriş yapılıyor…' });
        window.FCGiris(ep, this.state.sifre, this.state.hatirla).catch((h) => this.setState({ girisHata: h.message }));
      },
      girisBilgi: this.state.girisBilgi,
      // Şifresiz giriş: e-postaya tek kullanımlık bağlantı; bağlantıyla dönünce başvuru hesaba bağlanır (uye_bagla)
      baglantiGonder: () => {
        const ep = this.state.eposta.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep)) return this.setState({ girisHata: 'Başvuruda yazdığın e-postayı yaz.', girisBilgi: '' });
        if (!window.FCGirisBaglantisi) return this.setState({ girisHata: 'Önizlemede bağlantı gönderilmez.', girisBilgi: '' });
        this.setState({ girisHata: '', girisBilgi: 'Gönderiliyor…' });
        window.FCGirisBaglantisi(ep, this.state.hatirla)
          .then(() => this.setState({ girisBilgi: `${ep} adresine giriş bağlantısı gönderdik. Bağlantıyı bu tarayıcıda aç (mail uygulamasının içinde açılırsa oturum orada kalır). Girince Profilim'den şifre belirle; sonra hep şifreyle girersin.` }))
          .catch((h) => this.setState({ girisBilgi: '', girisHata: h.message }));
      },
      ornekHesaplar: [
        { ad: 'Deniz Yılmaz', durum: 'aktif üye', ep: 'deniz@ornek.com' },
        { ad: 'Can Öztürk', durum: 'süresi dolmuş', ep: 'can@ornek.com' },
        { ad: 'Mert Kaya', durum: 'hiç ödememiş', ep: 'mert@ornek.com' },
      ].map((x) => ({ ...x, gir: () => this.setState({ eposta: x.ep, girisHata: '' }) })),
      cikis: () => { window.FCCikis(); },
      sekmeler,
      sAna: sekme === 'ana', sEtkinlikler: sekme === 'etkinlikler', sKatildiklarim: sekme === 'katildiklarim',
      sUyelik: sekme === 'uyelik', sProfil: sekme === 'profil', sVeri: sekme === 'veri',
      afisTamVar: !!this.state.afisTam, afisTam: this.state.afisTam || '', afisTamAlt: this.state.afisTamAlt || 'Afiş',
      afisKapat: () => this.setState({ afisTam: '' }),
      ben, aktif, pasif: !aktif, uyari, muaf, kalanGoster: aktif && !muaf, yoneticiMi: !!(window.FCU && window.FCU.yonetici),
      formVar: !!(window.FCU && window.FCU.formlar && window.FCU.formlar.length),
      formlar: ((window.FCU && window.FCU.formlar) || []).map((f) => ({
        baslik: f.baslik, durum: f.doldu ? '· doldurdun ✓' : '', link: `/form/?id=${f.id}`,
        dugme: f.doldu ? 'Cevabını düzelt' : 'Doldur', sinif: f.doldu ? 'fu-btn fu-btn-ikincil' : 'fu-btn',
      })),
      // Canlıda (kartla ödeme gelene kadar) ödeme havale + dekont sayfasından
      odemeyeGit: () => (canli && !kartla ? location.assign('/dekont') : this.setState({ sekme: 'uyelik', odeme: 'ozet' })),
      anaSayfayaGit: () => this.setState({ sekme: 'ana', odeme: 'yok' }),
      secimEtk, kodOlustur,
      secimAcik: !!this.state.secimAcik, secimAcikYazi: this.state.secimAcik ? 'true' : 'false', secimOk: this.state.secimAcik ? '▲' : '▼', secimYok: !secimEtk.length,
      secimYazi: seciliEtk ? `${seciliEtk.ad} · ${tarihYaz(seciliEtk.tarih)}` : 'Etkinlik seç',
      secimAcDegis: () => this.setState((st) => ({ secimAcik: !st.secimAcik })), kodHata: this.state.kodHata, bilet: this.state.bilet || { karekod: [], izgara: '', not: '' }, biletVar: !!this.state.bilet,
      yaklasan,
      sepetVar: sepetIdler.length > 0, sepetOdemede: this.state.sepetAdim === 'odeme', satinTamam: this.state.sepetAdim === 'tamam' && !sepetIdler.length,
      sepetDekontta: this.state.sepetAdim === 'dekont', biletGonderildi: this.state.sepetAdim === 'gonderildi' && !sepetIdler.length,
      sepetOdemeNotu: canli ? `Havale / EFT ile ödersin, dekontunu yüklersin; onaylanınca biletler ${this.state.hesap} adresine gelir.`
        : `“Kartla öde”ye basınca iyzico’nun güvenli ödeme penceresi açılır; biletler ${this.state.hesap} adresine gelir.`,
      sepetHata: this.state.sepetHata, hakTutar: this.state.hak ? TL(Number(this.state.hak.tutar)) : '',
      odemeAlici: ((window.FC_AYAR && window.FC_AYAR.odeme) || {}).alici || '', odemeIban: ((window.FC_AYAR && window.FC_AYAR.odeme) || {}).iban || '',
      sepetDekontSec: (e) => { const f = e.target.files && e.target.files[0]; this.setState({ sepetDosya: f || null, sepetHata: '' }); },
      satinAlinan: this.state.satinAlinan,
      sepetToplam: TL(sepetToplamTL),
      sepetSatirlar: sepetIdler.map((id) => {
        const e = kayit[id];
        const n = this.state.sepet[id];
        const b = birimler(id, n);
        const degis = (fark) => this.setState((s) => {
          const yeni = Math.max(0, Math.min(e.kontenjan - e.kayitli, (s.sepet[id] || 0) + fark));
          const sp = { ...s.sepet }; if (yeni) sp[id] = yeni; else delete sp[id];
          return { sepet: sp };
        });
        return {
          ad: e.ad, adet: String(n), tutar: TL(b.tutar),
          detay: `${e.tarih.split('-').reverse().join('.')} · ${b.indirimli ? `1 üye bileti %50${n > 1 ? ` + ${n - 1} tam` : ''}` : `${n} × ${TL(e.fiyat)}`}`,
          azaltEtiket: `${e.ad} bilet sayısını azalt`, arttirEtiket: `${e.ad} bilet sayısını arttır`,
          azalt: () => degis(-1), arttir: () => degis(1),
        };
      }),
      sepetOdeDugme: this.state.sepetAdim === 'dekont' ? 'Dekontu gönder' : this.state.sepetAdim !== 'odeme' ? 'Ödemeye geç'
        : canli ? 'Devam · havale / EFT' : `Kartla öde · ${TL(sepetToplamTL)}`,
      sepetBosalt: () => this.setState({ sepet: {}, sepetAdim: 'yok', hak: null, sepetHata: '' }),
      sepetOnay: !!this.state.sepetOnay, sepetOnayDegis: () => this.setState((st) => ({ sepetOnay: !st.sepetOnay, sepetHata: '' })),
      // Gerçek sitede iyzico; başarılı ödemede biletler kesinleşir, üye bileti alınan etkinlikte yerin ayrılır
      sepetOde: () => {
        // Canlıda: 1) sunucu isteği açar ve tutarı söyler, 2) dekont yüklenir; yönetici onaylayınca biletler e-postayla
        if (canli && this.state.sepetAdim === 'dekont') {
          this.setState({ sepetHata: 'Yükleniyor…' });
          return window.FCSBiletDekont(this.state.hak, this.state.hesap, this.state.sepetDosya)
            .then(() => this.setState({ sepetAdim: 'gonderildi', sepet: {}, hak: null, sepetDosya: null, sepetHata: '' }))
            .catch((h) => this.setState({ sepetHata: h.message }));
        }
        if (this.state.sepetAdim !== 'odeme') return this.setState({ sepetAdim: 'odeme', sepetHata: '' });
        if (!this.state.sepetOnay) return this.setState({ sepetHata: 'Devam etmek için sözleşmeleri onayla.' });
        if (canli) {
          this.setState({ sepetHata: 'Hazırlanıyor…' });
          const kalemler = sepetIdler.map((id) => ({ etkinlik: Number(id), adet: this.state.sepet[id] }));
          return window.FCSBiletAc({ kalemler, ad: h.ad, eposta: this.state.hesap, tel: (this.state.profil && this.state.profil.telefon) || '' })
            .then((hak) => this.setState({ sepetAdim: 'dekont', hak, sepetHata: '' }))
            .catch((x) => this.setState({ sepetHata: x.message }));
        }
        let no = 7301;
        const biletler = [];
        sepetIdler.forEach((id) => { for (let i = 0; i < this.state.sepet[id]; i++) biletler.push({ ad: kayit[id].ad, zaman: tarihYaz(kayit[id].tarih), kod: `FC-B-${no++}` }); });
        this.setState((s) => {
          const k2 = { ...s.kayit };
          sepetIdler.forEach((id) => {
            const e = k2[id];
            const benimki = aktif && e.uye !== 'ucretsiz' && e.ben !== 'kayitli';
            k2[id] = { ...e, kayitli: e.kayitli + s.sepet[id], ...(benimki ? { ben: 'kayitli' } : {}) };
          });
          return { kayit: k2, sepet: {}, sepetAdim: 'tamam', satinAlinan: biletler };
        });
      },
      gecmis, gecmisYok: !gecmis.length,
      // Ödeme (ilk üyelik, yeniden başlatma ya da yenileme)
      odemeYok: odeme === 'yok' && !muaf, odemeOzet: odeme === 'ozet', odemeBasarili: odeme === 'basarili', odemeHata: odeme === 'hata',
      odemeTuru: aktif ? 'Üyelik yenileme' : durumTur === 'doldu' ? 'Üyeliği yeniden başlatma' : 'İlk üyelik',
      odemeDugme: aktif ? (canli && !kartla ? 'Yenile · havale / EFT' : `Kartla yenile · ${AIDAT}`) : uyari.dugme,
      odemeAciklama: aktif ? 'Erken yenilersen kalan günlerin kaybolmaz; yeni 30 gün mevcut bitişinden sonra başlar. Otomatik ücret çekilmez.'
        : dekontBekliyor ? uyari.metin
        : canli && !kartla ? 'Dekontun onaylandığında üyeliğin başlar ve 30 gün geçerlidir. Otomatik ücret çekilmez.'
        : 'Ödemen geçtiği anda üyeliğin başlar ve 30 gün geçerlidir. Otomatik ücret çekilmez.',
      aidatYazi: AIDAT,
      yeniBitisYazi: tarihYaz(yeniBitis),
      odemeBasla: () => (canli && !kartla ? location.assign('/dekont') : this.setState({ odeme: 'ozet' })),
      odemeVazgec: () => this.setState({ odeme: 'yok' }),
      odeHata: () => this.setState({ odeme: 'hata' }),
      // Deneme sitesi: iyzico ödeme sayfası → dönüşte üyelik uzamış, muhasebeye yazılmış, onay maili kuyrukta
      ode: () => (canli ? window.FCOdemeBaslat().catch((h) => { window.FC_ORTAK.bildir(h.message, true); this.setState({ odeme: 'hata' }); }) : this.setState((s) => ({
        odeme: 'basarili', bitis: yeniBitis,
        odemeler: [{ tarih: BUGUN, yol: 'Kart · iyzico' }, ...s.odemeler],
      }))),
      odemeler: this.state.odemeler.map((o) => ({ ad: 'Üyelik · 30 gün', detay: `${tarihYaz(o.tarih)} · ${o.yol}`, tutar: o.tutar ? TL(o.tutar) : AIDAT })),
      odemeGecmisiYok: !this.state.odemeler.length,
      // Dondurma
      dondurulmus: !!dond, dondurmaSecimde: !dond && this.state.dondurmaSecim, dondurmaDugme: !dond && !this.state.dondurmaSecim,
      dondurmaYazi: dond ? `${tarihYaz(dond.bas)} – ${tarihYaz(gunEkle(dond.bas, dond.gun - 1))}; yeni bitiş ${tarihYaz(bitis)}` : '',
      dondurmaAc: () => this.setState({ dondurmaSecim: true }),
      dondurmaVazgec: () => this.setState({ dondurmaSecim: false }),
      dondurmaKural: `Bugünden başlar; dondurduğun günler bitiş tarihine eklenir. Yılda en çok ${kural.yillik} kez dondurabilirsin; istediğin zaman erken dönebilirsin.`,
      dondurmaSecenek: kural.gunler.map((n) => ({
        ad: `${n} gün`,
        sec: () => (canli
          ? window.FCUDondur(n).then((r) => this.setState({ dondurma: { bas: r.bas, gun: r.gun }, dondurmaSecim: false, bitis: r.bitis, odeme: 'yok' }),
            (h) => window.FC_ORTAK.bildir(h.message, true))
          : this.setState((s) => ({ dondurma: { bas: BUGUN, gun: n }, dondurmaSecim: false, bitis: gunEkle(s.bitis, n), odeme: 'yok' }))),
      })),
      dondurmaBitir: () => (canli
        ? window.FCUDondurmaBitir().then((r) => this.setState({ dondurma: null, bitis: r.bitis }), (h) => window.FC_ORTAK.bildir(h.message, true))
        : this.setState((s) => ({ dondurma: null, bitis: gunEkle(s.bitis, -s.dondurma.gun) }))),
      // Profil
      profil, pAlan: this.pAlan, yeniOzel: this.state.yeniOzel, profilMesaj: this.state.profilMesaj,
      ozelGunler: profil.ozel.map((g, i) => ({
        ad: g.ad, tarihYazi: (() => { const [, m, d] = g.tarih.split('-'); return `${Number(d)} ${AY_UZUN[Number(m) - 1]}`; })(),
        silEtiket: `${g.ad} sil`,
        sil: () => this.setState((s) => ({ profil: { ...s.profil, ozel: s.profil.ozel.filter((_, j) => j !== i) }, profilMesaj: '' })),
      })),
      yeniOzelAd: (e) => { const v = e.target.value; this.setState((s) => ({ yeniOzel: { ...s.yeniOzel, ad: v } })); },
      yeniOzelTarih: (e) => { const v = e.target.value; this.setState((s) => ({ yeniOzel: { ...s.yeniOzel, tarih: v } })); },
      ozelEkle: () => {
        const y = this.state.yeniOzel;
        if (!y.ad.trim() || !y.tarih) return this.setState({ profilMesaj: 'Özel gün için ad ve tarih yaz.' });
        this.setState((s) => ({ profil: { ...s.profil, ozel: [...s.profil.ozel, { ad: y.ad.trim(), tarih: y.tarih }] }, yeniOzel: { ad: '', tarih: '' }, profilMesaj: '' }));
      },
      ilgiler: ['Yoga', 'Hareket', 'Atölyeler', 'Müzik / DJ', 'Gün batımı buluşmaları', 'Kahvaltı buluşmaları', 'Doğa yürüyüşü'].map((ad) => {
        const on = profil.ilgi.includes(ad);
        return {
          ad, basili: on ? 'true' : 'false',
          stil: `font:600 14px Figtree,sans-serif;border-radius:999px;padding:9px 14px;min-height:42px;cursor:pointer;border:2px solid #111111;${on ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}`,
          sec: () => this.setState((s) => ({ profil: { ...s.profil, ilgi: on ? s.profil.ilgi.filter((x) => x !== ad) : [...s.profil.ilgi, ad] }, profilMesaj: '' })),
        };
      }),
      kutlamaDegis: () => this.setState((s) => ({ profil: { ...s.profil, kutlama: !s.profil.kutlama }, profilMesaj: '' })),
      fotoDegis: () => this.setState((s) => ({ profil: { ...s.profil, foto: !s.profil.foto }, profilMesaj: '' })),
      profilKaydet: () => (window.FCUProfil ? window.FCUProfil(this.state.profil) : Promise.resolve())
        .then(() => this.setState({ profilMesaj: 'Profilin kaydedildi.' }))
        .catch((h) => this.setState({ profilMesaj: `Kaydedilemedi: ${h.message}` })),
      // KVKK
      silmeSoru: this.state.silmeSoru, silmeDugme: !this.state.silmeSoru && !this.state.silmeIstendi, veriMesaj: this.state.veriMesaj,
      silmeAc: () => this.setState({ silmeSoru: true, veriMesaj: '' }),
      silmeVazgec: () => this.setState({ silmeSoru: false }),
      silmeOnay: () => (canli
        ? window.FCUSilmeTalebi().then((r) => this.setState({ silmeSoru: false, silmeIstendi: true, veriMesaj: r === 'zaten'
          ? 'Silme talebin zaten alınmış; en geç 30 gün içinde sonuçlandırıp e-postayla haber vereceğiz.'
          : 'Silme talebin alındı. En geç 30 gün içinde sonuçlandırıp e-postayla haber vereceğiz.' }), (h) => this.setState({ silmeSoru: false, veriMesaj: h.message }))
        : this.setState({ silmeSoru: false, silmeIstendi: true, veriMesaj: 'Silme talebin alındı. En geç 30 gün içinde sonuçlandırıp e-postayla haber vereceğiz.' })),
      kopyaIste: () => (canli
        ? window.FCUVeriKopyasi().then(() => this.setState({ veriMesaj: 'Verilerinin kopyası indirildi (JSON dosyası).' }), (h) => this.setState({ veriMesaj: h.message }))
        : this.setState({ veriMesaj: 'Talebin alındı; verilerinin kopyası e-postana gönderilecek.' })),
    };
  }
}
return Component;
});
