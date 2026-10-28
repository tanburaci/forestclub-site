// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/yonetim.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/yonetim.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const BOS = { tarih: '', saat: '', tur: 'bulusma', ad: '', kim: '', metin: '', link: '', kontenjan: '30', fiyat: '', uye: 'ucretsiz' };
    this.BOS = BOS;
    this.BUGUN = window.FC ? window.FC.bugun : '2026-10-24';  // deneme sitesinde gerçek bugün
    this.MBOS = { tur: 'gider', tarih: this.BUGUN, tutar: '', kasa: 'banka', hedef: 'nakit', kategori: 'İkram', etk: '', aciklama: '', belge: '' };
    this.SABLONLAR = [
      { id: 'basvuru', ad: 'Başvuru alındı, ödeme yok', ne: 'Biri başvurup kartla ödemeyi tamamlamazsa gider.', acik: true,
        konu: 'Forest Club Urla başvurun bize ulaştı 🌲', alanlar: ['ad', 'odemeLinki'],
        metin: 'Merhaba {ad},\n\nBaşvurun bize ulaştı, teşekkürler!\n\nÜyeliğin ödemenle başlar. Ödemeyi tamamlamadıysan şu bağlantıdan kartla ödeyebilirsin: {odemeLinki}\n\nOrmanda görüşmek üzere,\nForest Club Urla' },
      { id: 'onay', ad: 'Ödeme alındı', ne: 'Kartla ödeme geçince ya da yönetici elden ödeme girince gider.', acik: true,
        // Metin kulüpten geldi (25.10.2026), aynen
        konu: 'Welcome to Forest Club Urla 🌲', alanlar: ['ad', 'bitis'],
        metin: 'WELCOME TO FOREST CLUB URLA.\n\nMerhaba,\n\nGüzel bir haberimiz var! 🌿\n\nForest Club Urla üyeliğiniz onaylandı.\n\nArtık siz de doğanın içinde bir araya gelen, birlikte üreten, keşfeden ve yeni karşılaşmalara alan açan topluluğumuzun bir parçasısınız.\n\nÜyeliğiniz kapsamında;\n\n•  Aylık Breakfast Club buluşmalarımıza,\n•  Aylık Sunset Club etkinliklerimize,\n•  Topluluğumuza özel buluşmalara katılabilir,\n•  Özel atölyelerimizden %50 indirimle yararlanabilirsiniz.\n\nKüçük bir hatırlatma:\n\nEtkinliklerimiz ve derslerimiz sınırlı kontenjanla gerçekleşmektedir. Bu nedenle katılmak istediğiniz her buluşma ve ders öncesinde WhatsApp topluluğumuzdaki Reservation grubu üzerinden rezervasyon oluşturmanız zorunludur.\n\nGüncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.\n\nSizi ağaçların altında görmek için sabırsızlanıyoruz.\n\nWe listen carefully.\nTo the trees. To the music. To each other.\n\nSevgiler,\nForest Club Urla\nGatherings in Nature. 🌲' },
      { id: 'yenileme', ad: 'Üyelik yenileme hatırlatması', ne: 'Üyelik bitmeden önce gider.', acik: true, gun: 3, gunYazi: 'gün kala gönderilsin',
        konu: 'Üyeliğin {bitis} tarihinde bitiyor', alanlar: ['ad', 'bitis', 'odemeLinki'],
        metin: 'Merhaba {ad},\n\nÜyeliğin {bitis} tarihinde bitiyor. Devam etmek istersen şu bağlantıdan kartla yenileyebilirsin: {odemeLinki}\n\nErken yenilersen kalan günlerin kaybolmaz.\n\nForest Club Urla' },
      { id: 'duyuru', ad: 'Etkinlik duyurusu', ne: 'Etkinlik “Hazır” olunca aktif üyelere gider.', acik: true,
        konu: 'Yeni etkinlik: {etkinlik}', alanlar: ['ad', 'etkinlik', 'tarih', 'saat', 'yer'],
        metin: 'Merhaba {ad},\n\n{etkinlik} için seni bekliyoruz!\n\n📅 {tarih}\n🕘 {saat}\n📍 {yer}\n\nForest Club Urla' },
      { id: 'hatirlatma', ad: 'Etkinlik hatırlatması', ne: 'Etkinlikten önce aktif üyelere gider.', acik: true, gun: 3, gunYazi: 'gün önce gönderilsin',
        konu: 'Hatırlatma: {etkinlik} yaklaşıyor', alanlar: ['ad', 'etkinlik', 'tarih', 'saat', 'yer'],
        metin: 'Merhaba {ad},\n\n{etkinlik} çok yakında: {tarih}, {saat}.\n\n📍 {yer}\n\nForest Club Urla' },
      { id: 'sifre', ad: 'Geçici şifre', ne: 'Üye “İlk girişim / şifremi unuttum” deyince gider.', acik: true,
        konu: 'Forest Club Urla geçici şifren', alanlar: ['ad', 'kod'],
        metin: 'Merhaba {ad},\n\nGeçici şifren: {kod}\n\nŞifre 24 saat geçerli. Bununla girince kendi şifreni belirleyeceksin.\n\nBu isteği sen yapmadıysan bu maili yok sayabilirsin.\n\nForest Club Urla' },
      { id: 'dogumgunu', ad: 'Doğum günü kutlaması', ne: 'Üyenin doğum günü sabahı gider (üye izin verdiyse).', acik: true,
        konu: 'Doğum günün kutlu olsun {ad}! 🎂', alanlar: ['ad'],
        metin: 'Merhaba {ad},\n\nBugün senin günün! Forest Club ailesi olarak doğum gününü kutluyoruz. Nice ağaçlı, müzikli, güzel yıllara 🌲\n\nForest Club Urla' },
      { id: 'ozelgun', ad: 'Özel gün kutlaması', ne: 'Üyenin profilindeki özel günlerde gider (üye izin verdiyse).', acik: true,
        konu: 'Kutlu olsun {ad} 🌿', alanlar: ['ad', 'ozelGun'],
        metin: 'Merhaba {ad},\n\n{ozelGun} kutlu olsun! Bu güzel gününde seni düşündük.\n\nForest Club Urla' },
      { id: 'tanisma', ad: 'Tanışma bileti', ne: 'Biri sitede tanışma biletini alınca gider.', acik: true,
        konu: 'İlk buluşman bizden: biletin hazır 🎟️', alanlar: ['ad', 'biletKodu', 'etkinlik', 'tarih', 'saat'],
        metin: 'Merhaba {ad},\n\nForest Club Urla’ya hoş geldin! Tanışma biletin: {biletKodu}\n\n{etkinlik} ({tarih}, {saat}) için yerin ayrıldı. Bilet ücretsiz, tek kullanımlık ve yalnız bu buluşmada geçerli; girişte kodunu göstermen yeterli.\n\nOrmanda görüşmek üzere,\nForest Club Urla' },
      { id: 'iptal', ad: 'Etkinlik iptal / erteleme', ne: 'Yönetici “İptal / ertele” ile duyurunca kayıtlılara ve bekleme listesine gider.', acik: true,
        konu: '{etkinlik}: önemli değişiklik', alanlar: ['ad', 'etkinlik', 'duyuru'],
        metin: 'Merhaba {ad},\n\n{duyuru}\n\nSorun olursa WhatsApp’tan yazabilirsin.\n\nForest Club Urla' },
      { id: 'bekleme', ad: 'Bekleme listesinden yer açıldı', ne: 'Kayıtlı biri vazgeçince sıradaki kişiye gider.', acik: true,
        konu: 'Yer açıldı: {etkinlik} 🎉', alanlar: ['ad', 'etkinlik', 'tarih', 'saat'],
        metin: 'Merhaba {ad},\n\nMüjde! {etkinlik} ({tarih}, {saat}) için yer açıldı ve kaydın yapıldı. Gelemeyeceksen üye panelinden “Gelemeyeceğim” de ki yer sıradakine geçsin.\n\nForest Club Urla' },
      { id: 'anket', ad: 'Etkinlik sonrası anket', ne: 'Etkinlikten sonra gelenlere gider.', acik: true, gun: 1, gunYazi: 'gün sonra gönderilsin',
        konu: '{etkinlik} nasıldı?', alanlar: ['ad', 'etkinlik'],
        metin: 'Merhaba {ad},\n\n{etkinlik} için geldiğin için teşekkürler! Üye panelinden 1–5 arası puan verip bir cümle yazarsan bir sonrakini daha güzel yaparız. Fotoğraflar da panelde.\n\nForest Club Urla' },
    ];
    this.ORNEK = { ad: 'Deniz', bitis: '23.11.2026', odemeLinki: '[ödeme bağlantısı]', etkinlik: 'Breakfast Club', tarih: '26 Ekim Pazar', saat: '10.00', yer: 'Pinya, Urla', kod: 'FC-4821', ozelGun: 'Evlilik yıldönümün', biletKodu: 'FC-T-4821', duyuru: '26.10.2026 tarihli Breakfast Club, yağmur nedeniyle 02.11.2026 tarihine ertelendi. Kaydın yeni tarihe taşındı.' };
    this.ALAN_AD = { neden: 'Red gerekçesi', ozet: 'Sorun özeti', ad: 'Ad', bitis: 'Üyelik bitişi', odemeLinki: 'Ödeme (dekont) sayfası bağlantısı', etkinlik: 'Etkinlik adı', tarih: 'Etkinlik tarihi', saat: 'Saat', yer: 'Yer', kod: 'Geçici şifre', ozelGun: 'Özel günün adı', biletKodu: 'Tanışma bileti kodu', duyuru: 'İptal / erteleme duyuru metni' };
    // Örnek üye profilleri (gerçekte üye kendi panelinden girer)
    this.PROFILLER = {
      'Deniz Yılmaz': { dogum: '1992-11-03', ozel: [{ ad: 'Evlilik yıldönümü', tarih: '2019-06-14' }], ilgi: ['Yoga', 'Kahvaltı buluşmaları'], kutlama: true, foto: true, tanisma: 'Instagram', baslangic: '26.08.2026' },
      'Ece Arslan': { dogum: '1995-10-28', ozel: [], ilgi: ['Atölyeler', 'Müzik / DJ'], kutlama: true, foto: true, tanisma: 'Tanışma bileti · 11.09 Sunset Club', baslangic: '26.09.2026' },
      'Mert Kaya': { dogum: '', ozel: [], ilgi: ['Hareket'], kutlama: false, foto: false, tanisma: 'Arkadaş tavsiyesi', baslangic: '—' },
      'Selin Demir': { dogum: '1989-03-21', ozel: [{ ad: 'Evlilik yıldönümü', tarih: '2015-11-12' }], ilgi: ['Yoga', 'Gün batımı buluşmaları', 'Doğa yürüyüşü'], kutlama: true, foto: false, tanisma: 'Instagram', baslangic: '02.09.2026' },
      'Can Öztürk': { dogum: '1990-06-02', ozel: [], ilgi: ['Müzik / DJ'], kutlama: true, foto: true, tanisma: 'Tanışma bileti · 27.09 Sunset Club', baslangic: '18.09.2026' },
      'Zeynep Aydın': { dogum: '1998-11-19', ozel: [], ilgi: ['Atölyeler'], kutlama: false, foto: true, tanisma: 'Instagram', baslangic: '—' },
    };
    // Instagram @forestcluburla gönderilerinden
    const ETKINLIKLER = [
      { tarih: '2026-09-11', saat: '18.30', tur: 'bulusma', ad: 'Sunset Club', kim: 'Fruma Table, Taylan Aktuğ, DJ Jamie S' },
      { tarih: '2026-09-12', saat: '12–13 Eylül', tur: 'hareket', ad: 'Tai Chi Günleri', kim: 'Om Yoga Stüdyo × Forest Club' },
      { tarih: '2026-09-27', saat: '17.30', tur: 'bulusma', ad: 'Sunset Club', kim: 'Fruma Table, Tayga (Mehmet Denizci), Elif Bilgen' },
      { tarih: '2026-09-30', saat: '09.30', tur: 'bulusma', ad: 'Breakfast Club', kim: 'Merve Bircan, Taylan Aktuğ' },
      { tarih: '2026-10-06', saat: '09.00', tur: 'yoga', ad: 'Vinyasa Yoga', kim: 'Duygu İşcan' },
      { tarih: '2026-10-06', saat: '19.00', tur: 'yoga', ad: 'Yin Yoga', kim: 'Hürriyet Keskin' },
      { tarih: '2026-10-07', saat: '09.00', tur: 'yoga', ad: 'Forest Yoga', kim: 'Deniz Öngeç' },
      { tarih: '2026-10-08', saat: '09.00', tur: 'yoga', ad: 'Hatha Yoga', kim: 'Aslı Albayrak' },
      { tarih: '2026-10-08', saat: '17.00–19.00', tur: 'atolye', ad: 'Clay & Create Seramik', kim: 'Şule Kunak' },
      { tarih: '2026-10-09', saat: '18.00–21.00', tur: 'bulusma', ad: 'Sunset Club × Subkult', kim: 'DJ Sivo, DJ Gasm' },
      { tarih: '2026-10-24', saat: '09.30–12.00', tur: 'bulusma', ad: 'The Common Table', kim: 'A Forest Club Gathering' },
      // Örnek yaklaşan etkinlikler (kayıt/yoklama demosu için)
      // satis: bilet fiyatı, üyelere (ucretsiz | yuzde50 | tam), şimdiye kadar satılan bilet
      { tarih: '2026-10-26', saat: '10.00–12.00', tur: 'bulusma', ad: 'Breakfast Club', kim: 'Örnek etkinlik', kontenjan: 35, satis: { fiyat: 600, uye: 'ucretsiz', satilan: 4 } },
      { tarih: '2026-11-02', saat: '17.30–20.30', tur: 'bulusma', ad: 'Sunset Club', kim: 'Örnek etkinlik', kontenjan: 25, satis: { fiyat: 900, uye: 'ucretsiz', satilan: 6 } },
      { tarih: '2026-11-07', saat: '14.00–17.00', tur: 'atolye', ad: 'Seramik Atölyesi', kim: 'Örnek atölye', kontenjan: 12, satis: { fiyat: 1500, uye: 'yuzde50', satilan: 3 } },
      { tarih: '2026-11-09', saat: '09.00–10.30', tur: 'yoga', ad: 'Vinyasa Yoga', kim: 'Örnek ders', kontenjan: 20, satis: { fiyat: 400, uye: 'yuzde50', satilan: 5 } },
      { tarih: '2026-11-14', saat: '17.00–20.00', tur: 'bulusma', ad: 'Sunset Club', kim: 'Örnek etkinlik', kontenjan: 50, satis: { fiyat: 900, uye: 'ucretsiz', satilan: 14 } },
      { tarih: '2026-11-16', saat: '10.00–11.30', tur: 'hareket', ad: 'Tai Chi Sabahı', kim: 'Örnek ders', kontenjan: 20, satis: { fiyat: 450, uye: 'yuzde50', satilan: 4 } },
      { tarih: '2026-11-22', saat: '14.00–17.00', tur: 'atolye', ad: 'Clay & Create Seramik', kim: 'Örnek atölye', kontenjan: 12, satis: { fiyat: 1500, uye: 'yuzde50', satilan: 8 } },
      { tarih: '2026-11-30', saat: '10.00–12.00', tur: 'bulusma', ad: 'Breakfast Club', kim: 'Örnek etkinlik', kontenjan: 35, satis: { fiyat: 600, uye: 'ucretsiz', satilan: 3 } },
    ];
    this.DEMO = window.FC ? window.FC.DEMO : this.demoUret(ETKINLIKLER);  // deneme sitesinde Supabase verisi
    // Karekod numarası = sıra (0 → FC-U-0001 Deniz Yılmaz)
    this.KISILER = this.DEMO.kisiler.map((k) => k.ad);
    this.EBOS = { giris: 'satin', ad: '', kategori: 'Yoga / hareket', adet: '1', birim: 'adet', tarih: this.BUGUN, konum: '', tutar: '', kasa: 'banka', muhasebe: true, firma: '', karsilik: '', kaynak: '', not: '' };
    this.state = {
      adim: window.FC_SIFRE_YENILE ? 'yeniSifre' : 'giris', eposta: window.FC ? window.FC.eposta : '', sifre: '', hatirla: true, yeni1: '', yeni2: '', girisHata: '', geciciGitti: false,
      girildi: !!window.FC, sekme: ['#basvurular', '#uyeler'].includes(location.hash) ? location.hash.slice(1) : 'ana', bvrMesaj: '', filtre: 'tumu', formAcik: false, form: { ...BOS }, formHata: '', eklendiMesaj: '',
      elden: { acik: false, ad: '', tutar: '3.000', tarih: this.BUGUN, hata: '' },
      // Etkinlik kayıtları: kişi sıra numaraları (this.KISILER), kod = FC-U-0001…
      kayitlar: this.DEMO.kayitlar,
      etkPanel: null, kod: '', kodMesaj: '', iptal: { tur: 'ertele', tarih: '', neden: 'Yağmur / hava durumu', mesaj: '' }, iptalMesaj: '', etkDurum: window.FC ? window.FC.etkDurum : {},
      veriTalepleri: window.FC ? [] : [
        { id: 1, ad: 'Can Öztürk', tur: 'Hesap silme', tarih: '2026-10-23', tamam: false },
        { id: 2, ad: 'Selin Demir', tur: 'Veri kopyası', tarih: '2026-10-20', tamam: true },
      ],
      profilSecili: null, notlar: window.FC ? window.FC.notlar : { 2: 'Seramik atölyesinde gönüllü yardım etmek istiyor.' },  // anahtar: üye numarası
      // Ayarlar (deneme sitesinde ayarlar tablosundan)
      tanismaSunuluyor: window.FC ? window.FC.ayarlar.tanisma_acik !== false : true,
      kartOdeme: window.FC ? window.FC.ayarlar.kart_odeme === true : false,
      ilt: { eposta: 'forestcluburla@gmail.com', alan: 'Pinya, Urla', whatsapp: '', topluluk: '', instagram: '', ...((window.FC && window.FC.ayarlar.iletisim) || {}) },
      iltMesaj: '', kameraAcik: false,
      yakinda: window.FC ? window.FC.ayarlar.yakinda === true : false,
      siteDuyurusu: window.FC ? String(window.FC.ayarlar.site_duyurusu || '') : '', duyuruMesaj: '',
      biletler: this.DEMO.biletler,
      komisyonOran: '',
      anaMesaj: '',
      // Muhasebe
      hareketler: window.FC ? window.FC.hareketler : this.ornekHareketler(this.DEMO.aidat),
      // Muhasebedeki katılımcı sayısı = yoklamada gelenler (geçmiş etkinlikler)
      katilimci: Object.fromEntries(Object.entries(this.DEMO.kayitlar).filter(([k]) => k.split('|')[0] <= this.BUGUN).map(([k, v]) => [k, v.gelen.length])),
      arama: '', uyeSayisi: 100,
      mAy: '2026-10', mEtk: '', mGorunum: 'hareketler', mFiltre: 'tumu', mFormAcik: false, mForm: { ...this.MBOS }, mHata: '', mMesaj: '',
      // Envanter (örnek kalemler; satın alınanların gideri muhasebede ayrıca kayıtlı)
      envanter: window.FC ? window.FC.envanter : [
        { id: 1, ad: 'Yoga matı', kategori: 'Yoga / hareket', adet: 6, birim: 'adet', giris: 'satin', tarih: '2026-09-03', tutar: 4800, kasa: 'banka', konum: 'Depo' },
        { id: 2, ad: 'Çıkartma', kategori: 'Tanıtım', adet: 140, birim: 'adet', giris: 'satin', tarih: '2026-09-08', tutar: 1250, kasa: 'banka', konum: 'Kulüp kutusu' },
        { id: 3, ad: 'İlk yardım çantası', kategori: 'İlk yardım / güvenlik', adet: 1, birim: 'adet', giris: 'satin', tarih: '2026-09-15', tutar: 650, kasa: 'nakit', konum: 'Kulüp kutusu' },
        { id: 4, ad: 'Seramik kili', kategori: 'Atölye malzemesi', adet: 0, birim: 'kg', giris: 'satin', tarih: '2026-10-08', tutar: 2400, kasa: 'banka', konum: 'Depo' },
        { id: 5, ad: 'Kahve çekirdeği', kategori: 'Mutfak / ikram', adet: 3, birim: 'paket', giris: 'firma', tarih: '2026-09-25', firma: 'Örnek Kahve Ltd.', karsilik: 'Instagram paylaşımı', konum: 'Depo' },
        { id: 6, ad: 'Taşınabilir hoparlör', kategori: 'Ses / ışık', adet: 1, birim: 'adet', giris: 'firma', tarih: '2026-10-02', firma: 'Örnek Ses Ltd.', karsilik: 'Etkinlik afişinde logo', konum: 'Depo' },
        { id: 7, ad: 'Katlanır sandalye', kategori: 'Mobilya / kamp', adet: 8, birim: 'adet', giris: 'diger', tarih: '2026-09-20', kaynak: 'Üye bağışı', konum: 'Depo' },
        { id: 8, ad: 'Hamak', kategori: 'Mobilya / kamp', adet: 2, birim: 'adet', giris: 'diger', tarih: '2026-10-10', kaynak: 'Ödünç (geri verilecek)', konum: 'Alan' },
      ],
      eFiltre: 'tumu', eFormAcik: false, eForm: { ...this.EBOS }, eHata: '', eMesaj: '',
      // E-posta şablonları (ilk metinler taslak; kulüp kendi metniyle değiştirir)
      sablonlar: window.FC ? window.FC.sablonlar : this.SABLONLAR.map((s) => ({ ...s })), sSecili: 'basvuru', sMesaj: '',
      etkinlikler: window.FC ? window.FC.etkinlikler : ETKINLIKLER,
    };
    this.alan = {};
    Object.keys(BOS).forEach((k) => {
      this.alan[k] = (e) => { const v = e.target.value; this.setState((s) => ({ form: { ...s.form, [k]: v }, formHata: '' })); };
    });
    this.kaydet = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const f = this.state.form;
      if (!f.tarih) return this.setState({ formHata: 'Tarih seçin.' });
      if (!f.ad.trim()) return this.setState({ formHata: 'Etkinlik adını yazın.' });
      if (this.state.etkinlikler.some((x) => x.tarih === f.tarih && x.ad === f.ad.trim())) {
        return this.setState({ formHata: 'Bu tarihte aynı adla bir etkinlik zaten var; adı biraz değiştirin.' });
      }
      if (f.link && !/^https:\/\//.test(f.link.trim())) return this.setState({ formHata: 'Instagram bağlantısı https:// ile başlamalı.' });
      const kontenjan = Math.max(1, Number(f.kontenjan) || 30);
      this.setState((s) => ({
        etkinlikler: [...s.etkinlikler, { ...f, ad: f.ad.trim(), kontenjan, satis: Number(String(f.fiyat).replace(/\./g, '')) > 0 ? { fiyat: Number(String(f.fiyat).replace(/\./g, '')), uye: f.uye, satilan: 0 } : null }],
        kayitlar: { ...s.kayitlar, [`${f.tarih}|${f.ad.trim()}`]: { kontenjan, kayitli: [], bekleme: [], gelen: [] } },
        form: { ...this.BOS }, formAcik: false, formHata: '',
        eklendiMesaj: window.FC ? `“${f.ad.trim()}” eklendi; sitede ve üye panelinde görünür.` : `“${f.ad.trim()}” eklendi. Duyurusu hazır olunca üyelere gönderilecek.`,
      }));
    };
    // Muhasebe formu
    this.mAlan = {};
    Object.keys(this.MBOS).forEach((k) => {
      this.mAlan[k] = (e) => { const v = e.target.value; this.setState((s) => ({ mForm: { ...s.mForm, [k]: v }, mHata: '' })); };
    });
    // tarih değişince ay değişebilir; seçili etkinlik sıfırlanır
    this.mAlan.tarih = (e) => { const v = e.target.value; this.setState((s) => ({ mForm: { ...s.mForm, tarih: v, etk: '' }, mHata: '' })); };
    this.mAlan.belge = (e) => { const f = e.target.files && e.target.files[0]; this.setState((s) => ({ mForm: { ...s.mForm, belge: f ? f.name : '' } })); };
    this.mTurKategori = (tur) => (tur === 'gelir' ? 'Etkinlik katılım ücreti' : tur === 'gider' ? 'İkram' : '');
    this.mFormAc = (tur) => this.setState({ mFormAcik: true, mMesaj: '', mHata: '', mForm: { ...this.MBOS, tur, kategori: this.mTurKategori(tur) } });
    this.mKaydet = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const f = this.state.mForm;
      const tutar = Number(String(f.tutar).trim().replace(/\./g, '').replace(',', '.'));
      if (!f.tarih) return this.setState({ mHata: 'Tarih seçin.' });
      if (!(tutar > 0)) return this.setState({ mHata: 'Tutarı yazın (örn. 1.250).' });
      if (f.tur === 'aktarim' && f.kasa === f.hedef) return this.setState({ mHata: 'Nereden ve nereye aynı kasa olamaz.' });
      if (f.tur !== 'aktarim' && !f.aciklama.trim()) return this.setState({ mHata: 'Kısa bir açıklama yazın.' });
      const aktarim = f.tur === 'aktarim';
      const kayit = {
        id: Date.now(), tarih: f.tarih, tur: f.tur, tutar, kasa: f.kasa, hedef: aktarim ? f.hedef : '',
        kategori: aktarim ? '' : f.kategori, etk: aktarim ? '' : f.etk, belge: aktarim ? '' : f.belge, otomatik: false,
        aciklama: f.aciklama.trim() || (f.hedef === 'nakit' ? 'Bankadan nakit çekildi' : 'Nakit bankaya yatırıldı'),
      };
      const ad = { gider: 'Gider', gelir: 'Gelir', aktarim: 'Aktarım' }[f.tur];
      this.setState((s) => ({
        hareketler: [...s.hareketler, kayit], mFormAcik: false, mForm: { ...this.MBOS }, mHata: '', mAy: f.tarih.slice(0, 7),
        mMesaj: `${ad} kaydedildi: ${tutar.toLocaleString('tr-TR')} TL.`,
      }));
    };
    // Envanter formu
    this.eAlan = {};
    Object.keys(this.EBOS).forEach((k) => {
      this.eAlan[k] = (e) => { const v = e.target.value; this.setState((s) => ({ eForm: { ...s.eForm, [k]: v }, eHata: '' })); };
    });
    this.eKaydet = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      const f = this.state.eForm;
      const adet = Number(f.adet);
      const tutar = Number(String(f.tutar).trim().replace(/\./g, '').replace(',', '.')) || 0;
      if (!f.ad.trim()) return this.setState({ eHata: 'Ne olduğunu yazın.' });
      if (!(adet >= 0) || String(f.adet).trim() === '') return this.setState({ eHata: 'Miktarı yazın.' });
      if (f.giris === 'satin' && f.muhasebe && !(tutar > 0)) return this.setState({ eHata: 'Muhasebeye yazmak için ödenen tutarı girin.' });
      if (f.giris === 'firma' && !f.firma.trim()) return this.setState({ eHata: 'Firma adını yazın.' });
      if (f.giris === 'diger' && !f.kaynak.trim()) return this.setState({ eHata: 'Nereden ya da kimden geldiğini yazın.' });
      const id = Date.now();
      const kalem = {
        id, ad: f.ad.trim(), kategori: f.kategori, adet, birim: f.birim, giris: f.giris, tarih: f.tarih || this.BUGUN,
        konum: f.konum.trim(), not: f.not.trim(),
        tutar: f.giris === 'satin' ? tutar : 0, kasa: f.kasa,
        firma: f.giris === 'firma' ? f.firma.trim() : '', karsilik: f.giris === 'firma' ? f.karsilik.trim() : '',
        kaynak: f.giris === 'diger' ? f.kaynak.trim() : '',
      };
      const giderYaz = f.giris === 'satin' && f.muhasebe && tutar > 0;
      this.setState((s) => ({
        envanter: [...s.envanter, kalem],
        hareketler: giderYaz ? [...s.hareketler, {
          id: id + 1, tarih: kalem.tarih, tur: 'gider', tutar, kasa: f.kasa, hedef: '', kategori: 'Malzeme', etk: '',
          aciklama: `${kalem.ad} (${adet} ${f.birim})`, belge: '', otomatik: true,
        }] : s.hareketler,
        eFormAcik: false, eForm: { ...this.EBOS }, eHata: '',
        eMesaj: `“${kalem.ad}” envantere eklendi.${giderYaz ? ` ${tutar.toLocaleString('tr-TR')} TL muhasebeye gider olarak yazıldı.` : ''}`,
      }));
    };
  }
  // Beni hatırla: bu tarayıcıda oturum açık kalır (tarayıcı depolaması kapalıysa sessizce çalışmaz)
  componentDidMount() {
    // Deneme sitesi: oturum Supabase'de tutulur (Beni hatırla kapalıysa tarayıcı kapanınca biter)
  }
  componentWillUnmount() { this.kameraKapat(); }
  // Açık / kapalı ayar: ekranda hemen değişir, kaydedilemezse geri alınır
  ayarDegis(alan, anahtar, etiket) {
    const yeni = !this.state[alan];
    this.setState({ [alan]: yeni });
    if (!window.FCAyarKaydet) return;
    window.FCAyarKaydet(anahtar, yeni).then(() => window.FC_ORTAK.bildir(`${etiket} ${yeni ? 'açık' : 'kapalı'} ✓`),
      (h) => { this.setState({ [alan]: !yeni }); window.FC_ORTAK.bildir(h.message, true); });
  }
  // Sitenin en üstündeki duyuru (ayarlar.site_duyurusu); boş metin kaldırır
  duyuruYaz(metin) {
    if (metin.length > 300) return this.setState({ duyuruMesaj: 'Duyuru en çok 300 karakter olabilir.' });
    const tamam = metin ? 'Yayında ✓ Sitenin en üstünde görünüyor.' : 'Duyuru kaldırıldı ✓';
    if (!window.FCAyarKaydet) return this.setState({ siteDuyurusu: metin, duyuruMesaj: `Önizleme: ${tamam}` });
    this.setState({ duyuruMesaj: 'Kaydediliyor…' });
    return window.FCAyarKaydet('site_duyurusu', metin).then(() => this.setState({ siteDuyurusu: metin, duyuruMesaj: tamam }),
      (h) => this.setState({ duyuruMesaj: h.message }));
  }
  // Kapıda kamera: okunan kod yoklama kutusuna yazılır ve hemen işlenir
  kameraKapat() {
    if (this.kameraDur) { this.kameraDur(); this.kameraDur = null; }
    if (this.state.kameraAcik) this.setState({ kameraAcik: false });
  }
  kameraAc() {
    if (!window.FCKameraAc) return this.setState({ kodMesaj: 'Önizlemede kamera yok; kodu elle yazın.' });
    this.setState({ kameraAcik: true, kodMesaj: 'Kamera açılıyor…' }, () => {
      const video = document.getElementById('fc-kamera');
      if (!video) return this.setState({ kameraAcik: false });
      window.FCKameraAc(video, (kod) => this.setState({ kod }, () => this.okut && this.okut()))
        .then((dur) => {
          if (!this.state.kameraAcik) return dur();
          this.kameraDur = dur;
          this.setState({ kodMesaj: 'Kamera açık: karekodu gösterin.' });
        }, (h) => this.setState({ kameraAcik: false, kodMesaj: h.message }));
    });
  }

  // DEMO VERİSİ: 200 kişi (30 aktif, 50 süresi dolmuş, 120 hiç ödememiş), sistemdeki etkinliklere kayıt/yoklama/anket,
  // aidat ödemeleri ve tanışma biletleri. Sabit tohumla üretilir: her açılışta aynı veri.
  demoUret(etkinlikler) {
    let tohum = 20261024;
    const r = () => {
      tohum = (tohum + 0x6D2B79F5) | 0;
      let t = Math.imul(tohum ^ (tohum >>> 15), 1 | tohum);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const sec = (xs) => xs[Math.floor(r() * xs.length)];
    const karistir = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const BUGUN = this.BUGUN;
    const gunEkle = (t, n) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const gunFark = (a, b) => Math.round((new Date(`${a}T12:00:00Z`) - new Date(`${b}T12:00:00Z`)) / 86400000);
    const arada = (a, b) => gunEkle(a, Math.floor(r() * (gunFark(b, a) + 1)));
    const ascii = (x) => x.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z]/g, '');
    const ADLAR = ['Ada', 'Ahmet', 'Ali', 'Arda', 'Aslı', 'Ayşe', 'Barış', 'Begüm', 'Berk', 'Burak', 'Cem', 'Defne', 'Derya', 'Ebru', 'Efe', 'Elif', 'Emre', 'Eren', 'Esra', 'Gizem',
      'Hakan', 'İpek', 'İrem', 'Kaan', 'Kerem', 'Lale', 'Melis', 'Mert', 'Nazlı', 'Nil', 'Onur', 'Ozan', 'Pınar', 'Rüya', 'Selin', 'Sinan', 'Tuna', 'Umut', 'Yasemin', 'Zeynep'];
    const SOYADLAR = ['Acar', 'Akın', 'Aksoy', 'Arslan', 'Aydın', 'Bulut', 'Çelik', 'Çetin', 'Demir', 'Doğan', 'Erdem', 'Eren', 'Güneş', 'Işık', 'Kaplan', 'Kara', 'Kaya', 'Koç', 'Korkmaz', 'Kurt',
      'Oral', 'Öztürk', 'Özdemir', 'Polat', 'Sezer', 'Şahin', 'Tekin', 'Yıldız', 'Yılmaz', 'Yücel'];
    const ILGI = ['Yoga', 'Hareket', 'Atölyeler', 'Müzik / DJ', 'Gün batımı buluşmaları', 'Kahvaltı buluşmaları', 'Doğa yürüyüşü'];
    const KAYNAK = ['Instagram', 'Instagram', 'Instagram', 'Arkadaş tavsiyesi', 'Arkadaş tavsiyesi', 'WhatsApp topluluğu', 'Açık Çağrı'];
    // Önceki demolarla tutarlı ilk 6 kişi
    const SABIT = [
      { ad: 'Deniz Yılmaz', eposta: 'deniz@ornek.com', durum: 'aktif', bas: '2026-09-26', yol: 'kart', profil: { dogum: '1992-11-03', ozel: [{ ad: 'Evlilik yıldönümü', tarih: '2019-06-14' }], ilgi: ['Yoga', 'Kahvaltı buluşmaları'], kutlama: true, foto: true, tanisma: 'Instagram' } },
      { ad: 'Ece Arslan', eposta: 'ece@ornek.com', durum: 'aktif', bas: '2026-09-26', yol: 'kart', profil: { dogum: '1995-10-28', ozel: [], ilgi: ['Atölyeler', 'Müzik / DJ'], kutlama: true, foto: true, tanisma: 'Instagram' } },
      { ad: 'Mert Kaya', eposta: 'mert@ornek.com', durum: 'basvuru', basvuru: '2026-10-23', profil: { dogum: '', ozel: [], ilgi: ['Hareket'], kutlama: false, foto: false, tanisma: 'Arkadaş tavsiyesi' } },
      { ad: 'Selin Demir', eposta: 'selin@ornek.com', durum: 'aktif', bas: '2026-09-02', yol: 'kart', profil: { dogum: '1989-03-21', ozel: [{ ad: 'Evlilik yıldönümü', tarih: '2015-11-12' }], ilgi: ['Yoga', 'Gün batımı buluşmaları', 'Doğa yürüyüşü'], kutlama: true, foto: false, tanisma: 'Instagram' } },
      { ad: 'Can Öztürk', eposta: 'can@ornek.com', durum: 'doldu', bas: '2026-09-18', yol: 'elden', profil: { dogum: '1990-06-02', ozel: [], ilgi: ['Müzik / DJ'], kutlama: true, foto: true, tanisma: 'Instagram' } },
      { ad: 'Zeynep Aydın', eposta: 'zeynep@ornek.com', durum: 'basvuru', basvuru: '2026-10-22', profil: { dogum: '1998-11-19', ozel: [], ilgi: ['Atölyeler'], kutlama: false, foto: true, tanisma: 'Instagram' } },
    ];
    const durumlar = karistir([...Array(27).fill('aktif'), ...Array(49).fill('doldu'), ...Array(118).fill('basvuru')]);
    const adlar = new Set(SABIT.map((x) => x.ad));
    const kisiler = SABIT.map((x) => ({ ...x }));
    durumlar.forEach((durum) => {
      let ad;
      do { ad = `${sec(ADLAR)} ${sec(SOYADLAR)}`; } while (adlar.has(ad));
      adlar.add(ad);
      const [a, b] = ad.split(' ');
      const kisi = {
        ad, eposta: `${ascii(a)}.${ascii(b)}@ornek.com`, durum,
        profil: {
          dogum: r() < 0.65 ? `${1975 + Math.floor(r() * 28)}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}` : '',
          ozel: r() < 0.12 ? [{ ad: sec(['Evlilik yıldönümü', 'Mezuniyet', 'İlk yoga dersim']), tarih: `20${10 + Math.floor(r() * 15)}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}` }] : [],
          ilgi: karistir(ILGI).slice(0, 1 + Math.floor(r() * 3)), kutlama: r() < 0.7, foto: r() < 0.8, tanisma: sec(KAYNAK),
        },
      };
      if (durum === 'aktif') kisi.bas = arada('2026-09-01', '2026-10-22');
      if (durum === 'doldu') kisi.bas = arada('2026-09-01', '2026-09-23');
      if (durum !== 'basvuru') kisi.yol = r() < 0.85 ? 'kart' : 'elden';
      else kisi.basvuru = arada('2026-09-01', BUGUN);
      kisiler.push(kisi);
    });
    // Ödemeler: başlangıçtan bugüne her 30 günde bir; süresi dolanlar bir dönem ödemiş
    kisiler.forEach((k, i) => {
      k.i = i;
      k.id = i + 1;
      k.kod = `FC-U-${String(i + 1).padStart(4, '0')}`;
      k.tel = `05${['32', '33', '35', '36', '42', '44', '53', '55'][i % 8]} 000 ${String(Math.floor(i / 100)).padStart(2, '0')} ${String(i % 100).padStart(2, '0')}`;
      k.odemeler = [];
      if (k.bas) {
        let t = k.bas;
        do { k.odemeler.push({ tarih: t, yol: k.odemeler.length && r() < 0.1 ? 'elden' : k.yol }); t = gunEkle(t, 30); } while (k.durum === 'aktif' && t <= BUGUN);
        k.bitis = gunEkle(k.odemeler[k.odemeler.length - 1].tarih, 30);
        k.basvuru = gunEkle(k.bas, -Math.floor(r() * 5));
      }
      k.profil.baslangic = k.bas ? k.bas.split('-').reverse().join('.') : '—';
    });
    // Etkinlik kayıtları + yoklama
    const KONT = { bulusma: 50, yoga: 20, atolye: 12, hareket: 25 };
    const OLASILIK = { bulusma: 0.6, yoga: 0.3, atolye: 0.2, hareket: 0.4 };
    const ILGI_TUR = { yoga: 'Yoga', atolye: 'Atölyeler', hareket: 'Hareket' };
    const kayitlar = {};
    const sirali = [...etkinlikler].sort((a, b) => a.tarih.localeCompare(b.tarih));
    sirali.forEach((e) => {
      const key = `${e.tarih}|${e.ad}`;
      const kontenjan = e.kontenjan || (/Breakfast|Common/.test(e.ad) ? 35 : e.tarih > BUGUN && /Sunset/.test(e.ad) ? 25 : KONT[e.tur] || 30);
      // Gelecek etkinliklerde bugünkü aktif üyeler kayıt olur
      const ref = e.tarih > BUGUN ? BUGUN : e.tarih;
      const uyeler = kisiler.filter((k) => k.bas && k.bas <= ref && ref < k.bitis);
      const istekli = karistir(uyeler).filter((k) => {
        let o = OLASILIK[e.tur] || 0.5;
        if (ILGI_TUR[e.tur] && k.profil.ilgi.includes(ILGI_TUR[e.tur])) o += 0.35;
        if (e.tarih > BUGUN && /Sunset/.test(e.ad)) o = 0.95;
        return r() < o;
      }).map((k) => k.i);
      const uyeYeri = kontenjan - (e.satis ? e.satis.satilan : 0);
      const kayitli = istekli.slice(0, uyeYeri);
      const bekleme = e.tarih > BUGUN ? istekli.slice(uyeYeri) : [];
      const oran = e.tarih < BUGUN ? 0.88 : e.tarih === BUGUN ? 0.6 : 0;
      const gelen = kayitli.filter(() => r() < oran);
      kayitlar[key] = { kontenjan, kayitli, bekleme, gelen };
    });
    // Tanışma biletleri: 18'i sonradan üye oldu, 42'si hiç ödemeyenlerden (28'i geldi)
    const gecmisEtk = sirali.filter((e) => e.tarih < BUGUN);
    const etkYaz = (e) => `${e.tarih.slice(8)}.${e.tarih.slice(5, 7)} ${e.ad}`;
    const biletler = [];
    const biletVer = (k, alinis, kullan) => {
      // Kontenjanda yer olan ilk etkinlik
      const e = kullan ? gecmisEtk.find((x) => { const kk = kayitlar[`${x.tarih}|${x.ad}`]; return x.tarih >= alinis && (!k.bas || x.tarih < k.bas) && kk.kayitli.length < kk.kontenjan; }) : null;
      if (e) { const kk = kayitlar[`${e.tarih}|${e.ad}`]; kk.kayitli.push(k.i); kk.gelen.push(k.i); }
      k.profil.tanisma = e ? `Tanışma bileti · ${etkYaz(e)}` : 'Tanışma bileti';
      biletler.push({ id: biletler.length + 1, ad: k.ad, eposta: k.eposta, alinis, etkinlik: e ? etkYaz(e) : '', durum: k.bas ? 'uye' : e ? 'geldi' : 'bekliyor' });
    };
    karistir(kisiler.filter((k) => k.bas && k.bas >= '2026-09-12' && k.i > 5)).slice(0, 18).forEach((k) => biletVer(k, gunEkle(k.bas, -(3 + Math.floor(r() * 10))), true));
    karistir(kisiler.filter((k) => k.durum === 'basvuru' && k.i > 5)).slice(0, 42).forEach((k, j) => {
      const alinis = j < 28 ? arada('2026-09-05', '2026-10-08') : arada('2026-10-10', '2026-10-23');
      biletVer(k, alinis, j < 28);
    });
    // Anket: gelenlerin yaklaşık %45'i yanıtlar
    const anket = {};
    gecmisEtk.forEach((e) => {
      const key = `${e.tarih}|${e.ad}`;
      anket[key] = { n: Math.round(kayitlar[key].gelen.length * 0.45), ort: 3.9 + r() * 0.9 };
    });
    // Aidat gelirleri muhasebeye
    const aidat = [];
    kisiler.forEach((k) => k.odemeler.forEach((o) => aidat.push({
      tarih: o.tarih, tur: 'gelir', kategori: 'Aidat', kasa: o.yol === 'kart' ? 'banka' : 'nakit', tutar: 3000,
      aciklama: `Aidat · ${k.ad}`, otomatik: o.yol === 'kart', odeme: o.yol, belge: o.yol === 'kart' ? 'iyzico' : '',
    })));
    // Bilet satışları: her etkinliğin satılan biletleri 1-3 satış hâlinde, son iki haftada
    etkinlikler.filter((e) => e.satis && e.satis.satilan).forEach((e) => {
      let kalan = e.satis.satilan;
      while (kalan > 0) {
        const adet = Math.min(kalan, 1 + Math.floor(r() * 4));
        kalan -= adet;
        aidat.push({
          tarih: arada('2026-10-11', BUGUN), tur: 'gelir', kategori: 'Etkinlik katılım ücreti', kasa: 'banka', tutar: adet * e.satis.fiyat,
          aciklama: `Bilet satışı · ${adet} kişi`, otomatik: true, odeme: 'kart', belge: 'iyzico', etk: `${e.tarih}|${e.ad}`,
        });
      }
    });
    aidat.sort((a, b) => a.tarih.localeCompare(b.tarih));
    return { kisiler, kayitlar, biletler, anket, aidat };
  }
  // Tasarım önizlemesi için örnek kayıtlar (Eylül–Ekim 2026); etkinlik giderleri `etk` = "tarih|ad" ile etkinliğe bağlanır
  ornekHareketler(aidat) {
    const h = [];
    let no = 0;
    const ekle = (x) => h.push({ id: ++no, etk: '', hedef: '', belge: '', otomatik: false, ...x });
    aidat.forEach(ekle);
    const g = (tarih, tutar, kategori, kasa, aciklama, ad) => ekle({
      tarih, tur: 'gider', tutar, kategori, kasa, aciklama, etk: ad ? `${tarih}|${ad}` : '',
      belge: `${kasa === 'banka' ? 'fatura' : 'fis'}-${tarih.slice(8)}${tarih.slice(5, 7)}.${kasa === 'banka' ? 'pdf' : 'jpg'}`,
    });
    g('2026-09-03', 4800, 'Malzeme', 'banka', 'Yoga matı (6 adet)');
    g('2026-09-08', 1250, 'Baskı / tanıtım', 'banka', 'Çıkartma baskısı');
    g('2026-09-11', 4200, 'İkram', 'banka', 'İkram', 'Sunset Club');
    g('2026-09-11', 2500, 'Eğitmen / sanatçı', 'nakit', 'DJ ücreti', 'Sunset Club');
    g('2026-09-12', 3000, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Tai Chi Günleri');
    g('2026-09-15', 650, 'Malzeme', 'nakit', 'İlk yardım çantası');
    g('2026-09-27', 3800, 'İkram', 'banka', 'İkram', 'Sunset Club');
    g('2026-09-27', 2000, 'Eğitmen / sanatçı', 'nakit', 'Müzisyen ücreti', 'Sunset Club');
    g('2026-09-30', 2600, 'İkram', 'banka', 'Kahvaltı malzemeleri', 'Breakfast Club');
    ekle({ tarih: '2026-10-05', tur: 'aktarim', kasa: 'banka', hedef: 'nakit', tutar: 5000, aciklama: 'Bankadan nakit çekildi' });
    g('2026-10-06', 1500, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Vinyasa Yoga');
    g('2026-10-06', 1500, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Yin Yoga');
    g('2026-10-07', 1500, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Forest Yoga');
    g('2026-10-08', 1500, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Hatha Yoga');
    g('2026-10-08', 2400, 'Malzeme', 'banka', 'Kil ve sır', 'Clay & Create Seramik');
    g('2026-10-08', 3000, 'Eğitmen / sanatçı', 'banka', 'Eğitmen ücreti', 'Clay & Create Seramik');
    ekle({ tarih: '2026-10-08', tur: 'gelir', kategori: 'Etkinlik katılım ücreti', kasa: 'nakit', tutar: 4500, aciklama: 'Katılım ücreti (6 kişi × 750)', etk: '2026-10-08|Clay & Create Seramik' });
    g('2026-10-09', 3500, 'Ses / ekipman', 'banka', 'Ses sistemi kirası', 'Sunset Club × Subkult');
    g('2026-10-09', 4000, 'İkram', 'banka', 'İkram', 'Sunset Club × Subkult');
    g('2026-10-12', 380, 'Diğer', 'nakit', 'Çöp poşeti, temizlik');
    g('2026-10-15', 1500, 'Mekân / alan', 'banka', 'Alan bakımı');
    g('2026-10-24', 3200, 'İkram', 'nakit', 'Kahvaltı malzemeleri', 'The Common Table');
    return h;
  }
  renderVals() {
    const { girildi, sekme, filtre } = this.state;
    const pill = (bg, fg) => `background:${bg};color:${fg};font-size:13px;font-weight:700;border-radius:999px;padding:5px 11px;display:inline-block`;
    const AKTIF = pill('#111111', '#FFFFFF');
    const BEKLER = pill('#E4E4E2', '#111111');
    const DOLDU = pill('#F3DCD5', '#82301F');
    const TASLAK = pill('#F0F0EE', '#3A3A3A');
    const sekmeler = [
      { id: 'ana', ad: 'Ana sayfa' }, { id: 'uyeler', ad: 'Üyeler' },
      { id: 'etkinlikler', ad: 'Etkinlikler' }, { id: 'muhasebe', ad: 'Muhasebe' }, { id: 'envanter', ad: 'Envanter' }, { id: 'eposta', ad: 'E-postalar' }, { id: 'basvurular', ad: 'Başvurular' }, { id: 'iletisim', ad: 'İletişim' },
    ].map((s) => ({ ...s, sinif: s.id === sekme ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ sekme: s.id }) }));
    const BUGUN_SABIT = this.BUGUN;
    const tYaz = (t) => (t ? t.split('-').reverse().join('.') : '—');
    const kalanGun = (t) => Math.round((new Date(`${t}T12:00:00Z`) - new Date(`${BUGUN_SABIT}T12:00:00Z`)) / 86400000);
    const tumUyeler = this.DEMO.kisiler.map((k) => {
      const kalan = k.bitis ? kalanGun(k.bitis) : null;
      const tur = k.durum;
      return {
        id: k.id, ad: k.ad, tel: k.tel, eposta: k.eposta, kod: k.kod, profil: k.profil, basvuru: tYaz(k.basvuru), odemeSayisi: String(k.odemeler.length),
        bitis: tYaz(k.bitis), tur, bitisSira: k.bitis || '0',
        durum: tur === 'aktif' ? (kalan <= 3 ? `Aktif · ${kalan} gün kaldı` : 'Aktif') : tur === 'doldu' ? 'Süresi doldu' : 'Hiç ödemedi',
        rozet: tur === 'aktif' ? (kalan <= 3 ? BEKLER : AKTIF) : tur === 'doldu' ? DOLDU : TASLAK,
      };
    });
    const sayac = { aktif: 0, doldu: 0, basvuru: 0 };
    tumUyeler.forEach((u) => { sayac[u.tur] += 1; });
    // Seçili etkinlik paneli: yoklama (karekod) / iptal-erteleme
    const secilenEtkinlik = (() => {
      const p = this.state.etkPanel;
      const bos = { epAcik: false, epYoklama: false, epIptal: false, ep: {}, iptalTurler: [], iptalErtele: false, iptal: this.state.iptal, iptalMetin: '', iptalAlan: {} };
      if (!p) return bos;
      const k = this.state.kayitlar[p.key] || { kontenjan: 0, kayitli: [], bekleme: [], gelen: [] };
      const [t, ad] = p.key.split('|');
      const tYaz = (x) => x.split('-').reverse().join('.');
      const KOD = (i) => (this.DEMO.kisiler[i] || {}).kod || '';
      const kGuncelle = (deg) => this.setState((s) => ({ kayitlar: { ...s.kayitlar, [p.key]: { ...s.kayitlar[p.key], ...deg } } }));
      const ip = this.state.iptal;
      const varsayilan = ip.tur === 'iptal'
        ? `${tYaz(t)} tarihli ${ad}, ${ip.neden.toLowerCase()} nedeniyle iptal edildi. Anlayışın için teşekkürler.`
        : `${tYaz(t)} tarihli ${ad}, ${ip.neden.toLowerCase()} nedeniyle ${ip.tarih ? `${tYaz(ip.tarih)} tarihine` : 'ileri bir tarihe'} ertelendi. Kaydın yeni tarihe taşındı.`;
      const iptalAlan = {};
      ['neden', 'tarih', 'mesaj'].forEach((a) => {
        iptalAlan[a] = (e) => { const v = e.target.value; this.setState((s) => ({ iptal: { ...s.iptal, [a]: v }, iptalMesaj: '' })); };
      });
      return {
        epAcik: true, epYoklama: p.mod === 'yoklama', epIptal: p.mod === 'iptal',
        epKapat: () => { this.kameraKapat(); this.setState({ etkPanel: null }); },
        ep: {
          baslik: `${ad} · ${tYaz(t)}${p.mod === 'iptal' ? ' · iptal / ertele' : ''}`,
          sayilar: [
            { baslik: 'Kayıtlı', sayi: `${k.kayitli.length}${k.tanisma ? ` + ${k.tanisma} tanışma` : ''}/${k.kontenjan}` },
            { baslik: 'Gelen', sayi: String(k.gelen.length) },
            { baslik: 'Bekleme listesi', sayi: String(k.bekleme.length) },
          ],
          kisiler: k.kayitli.map((i) => {
            const geldi = k.gelen.includes(i);
            return {
              ad: this.KISILER[i], kod: KOD(i), basili: geldi ? 'true' : 'false', yazi: geldi ? 'Geldi ✓' : 'Gelmedi',
              stil: `font:700 14px Figtree,sans-serif;border-radius:999px;padding:8px 14px;min-height:40px;cursor:pointer;border:2px solid #111111;${geldi ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}`,
              degis: () => kGuncelle({ gelen: geldi ? k.gelen.filter((x) => x !== i) : [...k.gelen, i] }),
            };
          }),
          beklemeListe: k.bekleme.length ? `Bekleme listesi: ${k.bekleme.map((i) => this.KISILER[i]).join(', ')} — yer açılınca sıradaki aktif üye kendiliğinden kayda geçer ve mail alır.` : 'Bekleme listesi boş.',
          alicilar: `Duyuru metni ${k.kayitli.length} kayıtlı${k.bekleme.length ? ` ve ${k.bekleme.length} bekleme listesindeki` : ''} kişiye maille gider.`,
        },
        kod: this.state.kod, kodMesaj: this.state.kodMesaj,
        kodYaz: (e) => this.setState({ kod: e.target.value, kodMesaj: '' }),
        kameraAcik: this.state.kameraAcik, kameraYazi: this.state.kameraAcik ? 'Kamerayı kapat' : 'Kamerayla okut',
        kameraDegis: () => (this.state.kameraAcik ? this.kameraKapat() : this.kameraAc()),
        kodOkut: (e) => {
          if (e && e.preventDefault) e.preventDefault();
          const kod = this.state.kod.trim();
          if (!kod) return this.setState({ kodMesaj: 'Kodu yazın ya da okutun.' });
          // Deneme sitesi: kod sunucuda uyeler.kod ile eşleşir ve "geldi" orada yazılır (giris_kaydet)
          if (window.FCGirisKaydet) {
            this.setState({ kodMesaj: 'Kontrol ediliyor…' });
            window.FCGirisKaydet(p.key, kod).then((r) => this.setState((s) => {
              const mesaj = r.zaten ? `${r.ad} zaten giriş yapmış.` : `Hoş geldin ${r.ad}! Giriş işlendi.${r.tanisma ? ' (tanışma bileti)' : ''}`;
              // Tanışma bileti: sunucuda "geldi" yazıldı; liste yalnız ekranda güncellenir (kapida: ikinci kez yazılmasın)
              if (r.tanisma) return { kodMesaj: mesaj, kod: '', biletler: s.biletler.map((b) => (b.id === r.bilet_id ? { ...b, durum: 'geldi', kapida: true } : b)) };
              const i = this.DEMO.kisiler.findIndex((x) => x.id === r.uye_id);
              if (i < 0) return { kodMesaj: `${mesaj} (Liste sayfa yenilenince güncellenir.)`, kod: '' };
              const kk = s.kayitlar[p.key] || { kontenjan: 0, kayitli: [], bekleme: [], gelen: [] };
              return {
                kayitlar: { ...s.kayitlar, [p.key]: { ...kk, kayitli: kk.kayitli.includes(i) ? kk.kayitli : [...kk.kayitli, i],
                  bekleme: kk.bekleme.filter((x) => x !== i), gelen: kk.gelen.includes(i) ? kk.gelen : [...kk.gelen, i] } },
                kodMesaj: mesaj, kod: '',
              };
            })).catch((h) => this.setState({ kodMesaj: h.message }));
            return;
          }
          const m = /FC-U-\d+/i.exec(kod);
          const i = m ? this.DEMO.kisiler.findIndex((x) => x.kod === m[0].toUpperCase()) : -1;
          if (i < 0 || !k.kayitli.includes(i)) return this.setState({ kodMesaj: 'Bu kod bu etkinliğe kayıtlı değil.' });
          if (k.gelen.includes(i)) return this.setState({ kodMesaj: `${this.KISILER[i]} zaten giriş yapmış.`, kod: '' });
          kGuncelle({ gelen: [...k.gelen, i] });
          this.setState({ kodMesaj: `Hoş geldin ${this.KISILER[i]}! Giriş işlendi.`, kod: '' });
        },
        // Katılımcı sayısı kaydedilmez: muhasebe ekranı sayfa açılışında yoklamadan sayar
        muhasebeyeAktar: () => this.setState((s) => ({ katilimci: { ...s.katilimci, [p.key]: k.gelen.length }, kodMesaj: `Kişi başı maliyet bu ekranda ${k.gelen.length} kişiye göre hesaplanıyor. Bu sayı kaydedilmez; sayfa açılışında yoklamadan yeniden sayılır.` })),
        iptalTurler: [{ id: 'ertele', ad: 'Ertele' }, { id: 'iptal', ad: 'İptal et' }].map((x) => ({
          ...x, sinif: x.id === ip.tur ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme',
          sec: () => this.setState((s) => ({ iptal: { ...s.iptal, tur: x.id }, iptalMesaj: '' })),
        })),
        iptalErtele: ip.tur === 'ertele', iptal: ip, iptalAlan,
        iptalMetin: ip.mesaj || varsayilan, iptalMesaj: this.state.iptalMesaj,
        iptalDuyur: () => {
          if (ip.tur === 'ertele' && !ip.tarih) return this.setState({ iptalMesaj: 'Yeni tarihi seçin.' });
          const etiket = ip.tur === 'iptal' ? 'İptal edildi' : `Ertelendi → ${tYaz(ip.tarih)}`;
          if (!window.FCEtkinlikDurum) {
            return this.setState((s) => ({ etkDurum: { ...s.etkDurum, [p.key]: etiket }, iptalMesaj: `Önizleme: ${etiket}. ${k.kayitli.length + k.bekleme.length} kişiye mail gider.` }));
          }
          this.setState({ iptalMesaj: 'Kaydediliyor…' });
          window.FCEtkinlikDurum(p.key, ip.tur, ip.tarih, ip.neden, ip.mesaj || varsayilan)
            .then((r) => {
              // Ekrandaki söz: duyuru "sitenin üstünde ve maille"
              if (window.FCAyarKaydet) window.FCAyarKaydet('site_duyurusu', (ip.mesaj || varsayilan).slice(0, 300)).then(() => this.setState({ siteDuyurusu: (ip.mesaj || varsayilan).slice(0, 300) }), () => {});
              return r;
            })
            .then((r) => this.setState((s) => ({
              etkDurum: { ...s.etkDurum, [p.key]: etiket },
              iptalMesaj: `${ip.tur === 'iptal' ? 'İptal edildi: etkinlik sitedeki listeden kalktı.' : `Ertelendi: sitede yeni tarihiyle (${tYaz(ip.tarih)}) görünüyor, kayıtlar taşındı; bu listede sayfa yenilenince güncellenir.`} Duyuru sitenin en üstünde yayında (İletişim › Site durumu’ndan kaldırılır) ve ${r.mail} kişiye maille gidiyor.`,
            })))
            .catch((h) => this.setState({ iptalMesaj: h.message }));
        },
      };
    })();
    this.okut = secilenEtkinlik.kodOkut;  // kameradan okunan kod da aynı yoldan işlenir
    // Üye profilleri ve yaklaşan özel günler (doğum günü + profildeki özel günler, ay-gün üzerinden)
    const AY_KISA = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
    const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const gunAy = (t) => { const [, m, d] = t.split('-'); return `${Number(d)} ${AY_UZUN[Number(m) - 1]}`; };
    const profilUye = tumUyeler.find((u) => u.id === this.state.profilSecili);
    const pr = profilUye ? profilUye.profil : null;
    const profilGorunum = pr ? {
      ad: profilUye.ad, harf: profilUye.ad[0], eposta: profilUye.eposta, tel: profilUye.tel, durum: profilUye.durum, rozet: profilUye.rozet,
      dogum: pr.dogum ? gunAy(pr.dogum) : 'Girilmedi', ozel: pr.ozel.length ? pr.ozel.map((g) => `${g.ad} · ${gunAy(g.tarih)}`).join(', ') : 'Yok',
      kutlama: pr.kutlama ? 'Gönderilsin' : 'Gönderilmesin', foto: pr.foto ? 'Var' : 'Yok', tanisma: pr.tanisma, baslangic: pr.baslangic,
      ilgi: pr.ilgi, not: this.state.notlar[profilUye.id] || '',
    } : {};
    const bugunT = new Date(`${BUGUN_SABIT}T12:00:00Z`);
    const ozelGunler = [];
    tumUyeler.forEach((u) => {
      const p = u.profil;
      if (!p) return;
      [...(p.dogum ? [{ ad: 'Doğum günü', tarih: p.dogum }] : []), ...p.ozel].forEach((g) => {
        const [, m, d] = g.tarih.split('-');
        let t = new Date(`${BUGUN_SABIT.slice(0, 4)}-${m}-${d}T12:00:00Z`);
        if (t < bugunT) t = new Date(`${Number(BUGUN_SABIT.slice(0, 4)) + 1}-${m}-${d}T12:00:00Z`);
        const kalan = Math.round((t - bugunT) / 86400000);
        if (kalan > 30) return;
        ozelGunler.push({
          kalanSayi: kalan, kisi: u.ad, ne: g.ad, gun: String(Number(d)), ay: AY_KISA[Number(m) - 1],
          kalan: kalan === 0 ? 'Bugün' : `${kalan} gün sonra`,
          durum: p.kutlama ? 'Mail kendiliğinden gidecek' : 'İzin yok · mail gitmez',
          rozet: p.kutlama ? AKTIF : TASLAK,
        });
      });
    });
    ozelGunler.sort((a, b) => a.kalanSayi - b.kalanSayi);
    // Etkinlikler: tarihe göre (eskiden yeniye), görünüm alanları tarihten türetilir
    const BUGUN = this.BUGUN;
    const AYLAR = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    const etkGorunum = [...this.state.etkinlikler].sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat)).map((x) => {
      const [y, m, d] = x.tarih.split('-');
      const bugun = x.tarih === BUGUN;
      return {
        ...x, gun: d, ay: AYLAR[Number(m) - 1], tarihYazi: `${d}.${m}.${y}`, kim: x.kim || '—',
        durum: bugun ? 'Bugün' : window.FC ? 'Yayında' : 'Taslak · duyuru bekliyor',
        rozet: bugun ? BEKLER : TASLAK,
        bilgi: x.kim || '',
      };
    });
    // Üye listesi: filtre + arama (ad, e-posta, telefon, karekod); aktifler bitişe göre, diğerleri son tarihe göre
    // Yalnız Üyeler sekmesinde hesaplanır; ekrana ilk 100 (sonra 100'er) satır çizilir
    const ara = this.state.arama.trim().toLocaleLowerCase('tr');
    const SIRA = { aktif: 0, doldu: 1, basvuru: 2 };
    const adSira = this.adSira || (this.adSira = new Intl.Collator('tr').compare);
    const uyeListesi = sekme !== 'uyeler' ? [] : tumUyeler
      .filter((u) => filtre === 'tumu' || u.tur === filtre)
      .filter((u) => !ara || `${u.ad} ${u.eposta} ${u.tel} ${u.kod}`.toLocaleLowerCase('tr').includes(ara))
      .sort((a, b) => SIRA[a.tur] - SIRA[b.tur] || (a.tur === 'aktif' ? (a.bitisSira < b.bitisSira ? -1 : a.bitisSira > b.bitisSira ? 1 : 0)
        : (a.bitisSira > b.bitisSira ? -1 : a.bitisSira < b.bitisSira ? 1 : 0)) || adSira(a.ad, b.ad));
    const uyeGoster = uyeListesi.slice(0, this.state.uyeSayisi);
    const filtreler = [
      { id: 'tumu', ad: `Tümü · ${tumUyeler.length}` }, { id: 'aktif', ad: `Aktif · ${sayac.aktif}` }, { id: 'doldu', ad: `Süresi doldu · ${sayac.doldu}` }, { id: 'basvuru', ad: `Hiç ödemedi · ${sayac.basvuru}` },
    ].map((f) => ({ ...f, sinif: f.id === filtre ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ filtre: f.id, uyeSayisi: 100 }) }));
    const secimler = (liste, secili, alan) => liste.map((x) => ({
      ...x, sinif: x.id === secili ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ [alan]: x.id }),
    }));

    // MUHASEBE
    const TL = (n) => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString('tr-TR')} TL`;
    const tarihYaz = (t) => t.split('-').reverse().join('.');
    const topla = (xs) => xs.reduce((t, h) => t + h.tutar, 0);
    // Kart (iyzico) komisyonu: oran girildiyse her ayın kart ödemelerinden tek satır gider türetilir (saklanmaz)
    const oran = Number(String(this.state.komisyonOran).replace(',', '.')) || 0;
    const kartH = this.state.hareketler.filter((h) => h.odeme === 'kart');
    const komisyonlar = [];
    if (oran > 0) {
      [...new Set(kartH.map((h) => h.tarih.slice(0, 7)))].forEach((ay) => {
        const xs = kartH.filter((h) => h.tarih.startsWith(ay));
        komisyonlar.push({
          id: 0, tarih: xs.map((h) => h.tarih).sort().pop(), tur: 'gider', kasa: 'banka', hedef: '', etk: '', kategori: 'Kart komisyonu',
          tutar: Math.round(topla(xs) * oran) / 100, aciklama: `iyzico komisyonu (%${String(oran).replace('.', ',')} · ${xs.length} kart ödemesi)`, otomatik: true, belge: '',
        });
      });
    }
    const hareketler = [...this.state.hareketler, ...komisyonlar];

    // Ana sayfa: son üyelik ödemeleri (kart = otomatik, elden = yönetici girdi)
    const sonOdemeler = this.state.hareketler.filter((h) => h.tur === 'gelir' && h.kategori === 'Aidat')
      .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.id - a.id).slice(0, 5)
      .map((h) => ({
        ad: h.aciklama.replace('Aidat · ', ''), tutar: TL(h.tutar),
        detay: h.odeme === 'elden' ? `${tarihYaz(h.tarih)} · nakit kasaya yazıldı` : `${tarihYaz(h.tarih)} · üyelik uzadı, bankaya yazıldı`,
        yol: { kart: 'Kart · iyzico', havale: 'Havale · dekont', elden: 'Elden' }[h.odeme] || 'Elden', rozet: h.odeme === 'elden' ? TASLAK : AKTIF,
      }));
    const buAyKart = kartH.filter((h) => h.kategori === 'Aidat' && h.tarih.startsWith(BUGUN.slice(0, 7)));
    const elden = this.state.elden;
    const eldenAlan = {};
    ['ad', 'tutar', 'tarih'].forEach((k) => {
      eldenAlan[k] = (e) => { const v = e.target.value; this.setState((s) => ({ elden: { ...s.elden, [k]: v, hata: '' } })); };
    });
    const KASA = { banka: 'Banka', nakit: 'Nakit' };
    const ACILIS = { banka: 8000, nakit: 1000 }; // 1 Eylül 2026 açılış bakiyesi (örnek)
    const etki = (h, k) => {
      if (h.tur === 'gelir') return h.kasa === k ? h.tutar : 0;
      if (h.tur === 'gider') return h.kasa === k ? -h.tutar : 0;
      return (h.hedef === k ? h.tutar : 0) - (h.kasa === k ? h.tutar : 0);
    };
    const bakiye = (k, f) => hareketler.filter(f).reduce((t, h) => t + etki(h, k), ACILIS[k]);
    const banka = bakiye('banka', () => true);
    const nakit = bakiye('nakit', () => true);
    const kasalar = [
      { baslik: 'Banka', sayi: TL(banka), alt: 'Aidatların geldiği hesap' },
      { baslik: 'Nakit (elden)', sayi: TL(nakit), alt: 'Kasada duran para' },
      { baslik: 'Toplam', sayi: TL(banka + nakit), alt: `${tarihYaz(BUGUN)} itibarıyla` },
    ];
    const AY_ADLARI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const mAy = this.state.mAy;
    const aylar = [...new Set([...hareketler.map((h) => h.tarih.slice(0, 7)), BUGUN.slice(0, 7)])].sort().map((a) => ({
      ad: `${AY_ADLARI[Number(a.slice(5)) - 1]} ${a.slice(0, 4)}`, sinif: a === mAy ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme',
      sec: () => this.setState({ mAy: a, mEtk: '' }),
    }));
    const ayH = hareketler.filter((h) => h.tarih.startsWith(mAy));
    const aidatH = ayH.filter((h) => h.tur === 'gelir' && h.kategori === 'Aidat');
    const digerGelirH = ayH.filter((h) => h.tur === 'gelir' && h.kategori !== 'Aidat');
    // Destek: kartla gelenler kendiliğinden (iyzico), IBAN'a gelenler elle "Destek" kategorisiyle yazılır
    const destekH = digerGelirH.filter((h) => h.kategori === 'Destek');
    const giderH = ayH.filter((h) => h.tur === 'gider');
    const etkGider = topla(giderH.filter((h) => h.etk));
    const genelGider = topla(giderH.filter((h) => !h.etk));
    const gelirTop = topla(aidatH) + topla(digerGelirH);
    const ayOzet = [
      { baslik: 'Aidat geliri', sayi: TL(topla(aidatH)), alt: `${aidatH.length} ödeme onaylandı` },
      { baslik: 'Diğer gelir', sayi: TL(topla(digerGelirH)), alt: !digerGelirH.length ? 'Bu ay yok'
        : destekH.length ? `Destek ${TL(topla(destekH))} (${destekH.length}) · katılım ücreti, sponsor` : 'Katılım ücreti, destek, sponsor' },
      { baslik: 'Toplam gider', sayi: TL(etkGider + genelGider), alt: `Etkinlik ${TL(etkGider)} · genel ${TL(genelGider)}` },
      { baslik: 'Kasaya net giren', sayi: TL(gelirTop - etkGider - genelGider), alt: 'Bu ayın gelirleri eksi giderleri' },
    ];

    const etkAdi = {};
    this.state.etkinlikler.forEach((x) => { etkAdi[`${x.tarih}|${x.ad}`] = x.ad; });
    const TUR_AD = { gelir: 'Gelir', gider: 'Gider', aktarim: 'Aktarım' };
    const TUR_ROZET = { gelir: AKTIF, gider: TASLAK, aktarim: `${pill('#FFFFFF', '#111111')};border:1.5px dashed #111111` };
    const mFiltre = this.state.mFiltre;
    // Etkinlik seçiliyse ay sınırı yok: o etkinliğin bütün giriş ve çıkışları
    const mEtk = this.state.mEtk;
    const etkH = hareketler.filter((h) => h.etk === mEtk);
    const hareketSatirlari = (mEtk ? etkH : ayH).filter((h) => mFiltre === 'tumu' || h.tur === mFiltre)
      .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.id - a.id)
      .map((h) => ({
        tarihYazi: tarihYaz(h.tarih), turAd: TUR_AD[h.tur], rozet: TUR_ROZET[h.tur], aciklama: h.aciklama, otomatik: h.otomatik,
        baglam: h.tur === 'aktarim' ? 'Kasalar arası' : [h.kategori, h.etk ? etkAdi[h.etk] : (h.tur === 'gider' ? 'Genel' : '')].filter(Boolean).join(' · '),
        kasaAd: h.tur === 'aktarim' ? `${KASA[h.kasa]} → ${KASA[h.hedef]}` : KASA[h.kasa],
        tutarYazi: `${h.tur === 'gelir' ? '+' : h.tur === 'gider' ? '−' : ''}${TL(h.tutar)}`,
        belge: h.belge || '—',
      }));

    // Etkinlik maliyeti: giderler − katılım geliri = kulübe maliyeti; katılımcıya bölünür
    const kat = this.state.katilimci;
    const etkMaliyet = etkGorunum.filter((x) => x.tarih.startsWith(mAy)).map((x) => {
      const key = `${x.tarih}|${x.ad}`;
      const giderler = hareketler.filter((h) => h.etk === key && h.tur === 'gider');
      const gelir = topla(hareketler.filter((h) => h.etk === key && h.tur === 'gelir'));
      const net = topla(giderler) - gelir;
      const n = Number(kat[key]) || 0;
      return {
        gun: x.gun, ay: x.ay, ad: x.ad, kim: x.kim, net,
        maliyetYazi: TL(topla(giderler)), gelirYazi: gelir ? TL(gelir) : '—', netYazi: TL(net),
        katilimci: kat[key] ?? '',
        katilimciYaz: (e) => { const v = e.target.value; this.setState((s) => ({ katilimci: { ...s.katilimci, [key]: v } })); },
        kisiBasi: n > 0 ? TL(net / n) : '—',
        kalemler: hareketler.filter((h) => h.etk === key).sort((a, b) => a.tarih.localeCompare(b.tarih) || a.id - b.id)
          .map((h) => ({ aciklama: h.aciklama, tutarYazi: `${h.tur === 'gelir' ? '+' : '−'}${TL(h.tutar)}`, kasa: KASA[h.kasa] })),
        kalemYok: !hareketler.some((h) => h.etk === key),
        hareketGor: () => this.setState({ mGorunum: 'hareketler', mEtk: key, mFiltre: 'tumu' }),
      };
    });
    const etkNet = etkMaliyet.reduce((t, e) => t + e.net, 0);
    const uye = aidatH.length;
    const etkOzetMetin = `Bu ay ${etkMaliyet.length} etkinliğin kulübe toplam maliyeti ${TL(etkNet)}.`
      + (uye ? ` ${uye} aidat ödemesine bölününce üye başına ${TL(etkNet / uye)}; genel giderlerle birlikte ${TL((etkNet + genelGider) / uye)} (aidat 3.000 TL).` : '');

    const dagilim = (xs) => {
      const m = {};
      xs.forEach((h) => { m[h.kategori] = (m[h.kategori] || 0) + h.tutar; });
      const satirlar = Object.entries(m).sort((a, b) => b[1] - a[1]);
      const toplam = topla(xs) || 1;
      const enBuyuk = satirlar.length ? satirlar[0][1] : 1;
      return satirlar.map(([ad, t]) => ({
        ad, tutarYazi: TL(t), yuzde: `%${Math.round((t * 100) / toplam)}`, ipucu: `${ad}: ${TL(t)}`,
        cubuk: `height:10px;background:#111111;border-radius:4px;width:${Math.max(2, (t * 100) / enBuyuk)}%`,
      }));
    };
    const ayBasi = `${mAy}-01`;
    const kasaTablo = ['banka', 'nakit'].map((k) => {
      const acilis = bakiye(k, (h) => h.tarih < ayBasi);
      const giren = ayH.reduce((t, h) => t + Math.max(0, etki(h, k)), 0);
      const cikan = ayH.reduce((t, h) => t + Math.max(0, -etki(h, k)), 0);
      return { ad: KASA[k], acilis: TL(acilis), giren: TL(giren), cikan: TL(cikan), kapanis: TL(acilis + giren - cikan) };
    });

    const mForm = this.state.mForm;
    const mEtkSecenek = [{ id: '', ad: 'Genel' }, ...etkGorunum.filter((x) => mForm.tarih && x.tarih.startsWith(mForm.tarih.slice(0, 7)))
      .map((x) => ({ id: `${x.tarih}|${x.ad}`, ad: `${x.gun}.${x.tarih.slice(5, 7)} ${x.ad}` }))]
      .map((o) => ({
        ...o, sinif: o.id === mForm.etk ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme',
        sec: () => this.setState((s) => ({ mForm: { ...s.mForm, etk: o.id } })),
      }));
    const mTurler = [{ id: 'gider', ad: 'Gider' }, { id: 'gelir', ad: 'Gelir' }, { id: 'aktarim', ad: 'Aktarım' }].map((t) => ({
      ...t, sinif: t.id === mForm.tur ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme',
      sec: () => this.setState((s) => ({ mForm: { ...s.mForm, tur: t.id, kategori: this.mTurKategori(t.id) }, mHata: '' })),
    }));
    const mGorunum = this.state.mGorunum;

    // ENVANTER
    const envanter = this.state.envanter;
    const GIRIS_AD = { satin: 'Satın alındı', firma: 'Firmadan geldi', diger: 'Diğer' };
    const GIRIS_ROZET = { satin: AKTIF, firma: BEKLER, diger: TASLAK };
    const eForm = this.state.eForm;
    const eFiltre = this.state.eFiltre;
    const miktarDegis = (id, fark) => this.setState((s) => ({
      envanter: s.envanter.map((x) => (x.id === id ? { ...x, adet: Math.max(0, x.adet + fark) } : x)),
    }));
    const eSatirlar = envanter.filter((x) => eFiltre === 'tumu' || x.giris === eFiltre)
      .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.id - a.id)
      .map((x) => ({
        ad: x.ad, kategori: x.kategori, girisAd: GIRIS_AD[x.giris], rozet: GIRIS_ROZET[x.giris], tarihYazi: tarihYaz(x.tarih),
        alt: [x.konum, x.not].filter(Boolean).join(' · '),
        kaynak: x.giris === 'satin' ? (x.tutar ? `${TL(x.tutar)} · ${KASA[x.kasa]}` : '—')
          : x.giris === 'firma' ? `${x.firma}${x.karsilik ? ` · karşılığı: ${x.karsilik}` : ''}` : x.kaynak,
        miktar: `${x.adet} ${x.birim}`, bitti: x.adet === 0,
        azalt: () => miktarDegis(x.id, -1), arttir: () => miktarDegis(x.id, 1),
        azaltEtiket: `${x.ad} miktarını azalt`, arttirEtiket: `${x.ad} miktarını arttır`,
      }));
    const firmaKalem = envanter.filter((x) => x.giris === 'firma');
    const satinKalem = envanter.filter((x) => x.giris === 'satin');
    const eOzet = [
      { baslik: 'Toplam kalem', sayi: String(envanter.length), alt: `${envanter.filter((x) => x.adet > 0).length} kalem elde var` },
      { baslik: 'Satın alınan', sayi: TL(satinKalem.reduce((t, x) => t + (x.tutar || 0), 0)), alt: `${satinKalem.length} kalem için ödenen` },
      { baslik: 'Firmalardan gelen', sayi: String(firmaKalem.length), alt: `${new Set(firmaKalem.map((x) => x.firma)).size} firmadan` },
      { baslik: 'Tükenen', sayi: String(envanter.filter((x) => x.adet === 0).length), alt: 'Yeniden alınması gerekebilir' },
    ];
    // E-POSTA ŞABLONLARI
    const sablonlar = this.state.sablonlar;
    const sSec = sablonlar.find((s) => s.id === this.state.sSecili) || sablonlar[0];
    const sGuncelle = (alan) => (e) => {
      const v = e.target.value;
      this.setState((s) => ({ sablonlar: s.sablonlar.map((x) => (x.id === sSec.id ? { ...x, [alan]: v } : x)), sMesaj: '' }));
    };
    const doldur = (t) => t.replace(/\{(\w+)\}/g, (m, k) => (this.ORNEK[k] !== undefined ? this.ORNEK[k] : m));
    return {
      epostaSekme: sekme === 'eposta',
      ep2: window.FCEpostaGorunum ? window.FCEpostaGorunum(this) : { saglikVar: false, saglikSatirlari: [], kuyruk: [], kuyrukYok: true, kuyrukOzet: '' },
      csvVar: !!window.FCUyeCsv, csvIndir: () => window.FCUyeCsv(),
      sListe: sablonlar.map((s) => ({
        ad: s.ad, durum: s.acik ? (s.gun ? `Açık · ${s.gun} ${s.gunYazi.replace(' gönderilsin', '')}` : 'Açık') : 'Kapalı',
        stil: `text-align:left;border:0;border-radius:10px;padding:12px 14px;min-height:44px;font-family:Figtree,sans-serif;${s.id === sSec.id ? 'background:#111111;color:#FFFFFF' : 'background:transparent;color:#111111'}`,
        sec: () => this.setState({ sSecili: s.id, sMesaj: '' }),
      })),
      sSec: { ...sSec, gunlu: !!sSec.gun },
      sAlanlar: sSec.alanlar.map((k) => ({
        etiket: `{${k}} · ${this.ALAN_AD[k]}`,
        ekle: () => this.setState((s) => ({ sablonlar: s.sablonlar.map((x) => (x.id === sSec.id ? { ...x, metin: `${x.metin}{${k}}` } : x)) })),
      })),
      sKonuYaz: sGuncelle('konu'), sMetinYaz: sGuncelle('metin'),
      sGunYaz: (e) => { const v = Math.min(14, Math.max(1, Number(e.target.value) || 1)); this.setState((s) => ({ sablonlar: s.sablonlar.map((x) => (x.id === sSec.id ? { ...x, gun: v } : x)) })); },
      sAcikDegis: () => this.setState((s) => ({ sablonlar: s.sablonlar.map((x) => (x.id === sSec.id ? { ...x, acik: !x.acik } : x)), sMesaj: '' })),
      sKaydet: () => this.setState({ sMesaj: `“${sSec.ad}” şablonu kaydedildi.` }),
      sDeneme: () => {
        if (!window.FCEpostaDeneme) return this.setState({ sMesaj: 'Önizlemede mail gönderilmez.' });
        this.setState({ sMesaj: 'Gönderiliyor…' });
        window.FCEpostaDeneme(sSec)
          .then((adres) => this.setState({ sMesaj: `Deneme maili ${adres} adresine sıraya alındı; bir dakika içinde gelir.` }))
          .catch((h) => this.setState({ sMesaj: h.message }));
      },
      sSifirla: () => this.setState((s) => ({
        sablonlar: s.sablonlar.map((x) => (x.id !== sSec.id ? x : window.FC
          ? { ...x, konu: x.varsayilanKonu, metin: x.varsayilanMetin }
          : { ...this.SABLONLAR.find((o) => o.id === x.id) })),
        sMesaj: 'Şablon ilk hâline döndü.',
      })),
      sOnizKonu: doldur(sSec.konu), sOnizMetin: doldur(sSec.metin),
      sMesaj: this.state.sMesaj,
      envanterSekme: sekme === 'envanter',
      eOzet, eSatirlar, eYok: !eSatirlar.length,
      eFiltreler: secimler([{ id: 'tumu', ad: 'Tümü' }, { id: 'satin', ad: 'Satın alınan' }, { id: 'firma', ad: 'Firmalardan' }, { id: 'diger', ad: 'Diğer' }], eFiltre, 'eFiltre'),
      eGirisler: [{ id: 'satin', ad: 'Satın alındı' }, { id: 'firma', ad: 'Firmadan geldi' }, { id: 'diger', ad: 'Diğer' }].map((t) => ({
        ...t, sinif: t.id === eForm.giris ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme',
        sec: () => this.setState((s) => ({ eForm: { ...s.eForm, giris: t.id }, eHata: '' })),
      })),
      eSatin: eForm.giris === 'satin', eFirma: eForm.giris === 'firma', eDiger: eForm.giris === 'diger',
      eFormAcik: this.state.eFormAcik, eForm, eAlan: this.eAlan, eKaydet: this.eKaydet, eHata: this.state.eHata, eMesaj: this.state.eMesaj,
      eFormAc: () => this.setState({ eFormAcik: true, eMesaj: '', eHata: '', eForm: { ...this.EBOS } }),
      eFormKapat: () => this.setState({ eFormAcik: false, eForm: { ...this.EBOS }, eHata: '' }),
      eMuhasebeDegis: () => this.setState((s) => ({ eForm: { ...s.eForm, muhasebe: !s.eForm.muhasebe } })),
      sonOdemeler,
      kartRozet: `Bu ay ${buAyKart.length} kart ödemesi`,
      anaMesaj: this.state.anaMesaj,
      elden, eldenAlan, eldenAcik: elden.acik,
      eldenAc: () => this.setState((s) => ({ elden: { ...s.elden, acik: true, hata: '' }, anaMesaj: '' })),
      eldenKapat: () => this.setState({ elden: { acik: false, ad: '', tutar: '3.000', tarih: BUGUN, hata: '' } }),
      // Üye listeden seçilir ("Ad Soyad · FC-U-0001"); kod yoksa ad tek bir üyeye denk gelmeli
      uyeSecenekleri: elden.acik ? (() => {
        const q = elden.ad.trim().toLocaleLowerCase('tr');
        const hepsi = this.DEMO.kisiler.map((k) => `${k.ad} · ${k.kod}`);
        return (q ? hepsi.filter((x) => x.toLocaleLowerCase('tr').includes(q)) : hepsi).slice(0, 50);
      })() : [],
      eldenKaydet: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (this.eldenYaziliyor) return;
        const hata = (metin) => this.setState((s) => ({ elden: { ...s.elden, hata: metin } }));
        const tutar = Number(String(elden.tutar).trim().replace(/\./g, '').replace(',', '.'));
        const yazi = elden.ad.trim();
        if (!yazi) return hata('Üyeyi listeden seçin.');
        const kodu = /FC-U-\d+/i.exec(yazi);
        const adlar = this.DEMO.kisiler.filter((k) => k.ad.toLocaleLowerCase('tr') === yazi.toLocaleLowerCase('tr'));
        const uye = kodu ? this.DEMO.kisiler.find((k) => k.kod === kodu[0].toUpperCase()) : adlar.length === 1 ? adlar[0] : null;
        if (!uye) return hata(adlar.length > 1 ? 'Bu adla birden çok üye var; listeden kodlu olanı seçin.' : 'Üye bulunamadı; listeden seçin.');
        if (!(tutar > 0)) return hata('Tutarı yazın.');
        const tarih = elden.tarih || BUGUN;
        const kapali = { acik: false, ad: '', tutar: '3.000', tarih: BUGUN, hata: '' };
        if (window.FCEldenOdeme) {
          this.eldenYaziliyor = true;
          hata('Kaydediliyor…');
          window.FCEldenOdeme(uye.id, tutar, tarih)
            .then((r) => this.setState((s) => ({
              hareketler: [...s.hareketler, r.hareket], elden: kapali,
              anaMesaj: `${r.ad} için ${tutar.toLocaleString('tr-TR')} TL elden ödeme nakit kasaya yazıldı; üyelik ${tYaz(r.bitis)} tarihine kadar uzadı.`,
            })))
            .catch((h) => hata(h.message))
            .finally(() => { this.eldenYaziliyor = false; });
          return;
        }
        // Tasarım önizlemesi: yalnız ekranda
        this.setState((s) => ({
          hareketler: [...s.hareketler, {
            id: Date.now(), tarih, tur: 'gelir', kategori: 'Aidat', kasa: 'nakit', hedef: '', etk: '', tutar,
            aciklama: `Aidat · ${uye.ad}`, otomatik: false, odeme: 'elden', belge: '',
          }],
          elden: kapali,
          anaMesaj: `${uye.ad} için ${tutar.toLocaleString('tr-TR')} TL elden ödeme nakit kasaya yazıldı; üyelik 30 gün uzadı.`,
        }));
      },
      komisyonOran: this.state.komisyonOran,
      komisyonYaz: (e) => this.setState({ komisyonOran: e.target.value }),
      muhasebeSekme: sekme === 'muhasebe',
      kasalar, aylar, ayOzet, hareketSatirlari, etkMaliyet, etkOzetMetin, kasaTablo,
      hareketYok: !hareketSatirlari.length,
      hareketYokMetin: mEtk ? 'Bu etkinliğe bu türde kayıt yok.' : 'Bu ay bu türde kayıt yok.',
      mEtkFiltre: [{ id: '', ad: 'Tüm kayıtlar' }, ...etkGorunum.filter((x) => x.tarih.startsWith(mAy) || `${x.tarih}|${x.ad}` === mEtk)
        .map((x) => ({ id: `${x.tarih}|${x.ad}`, ad: `${x.gun}.${x.tarih.slice(5, 7)} ${x.ad}` }))]
        .map((o) => ({ ...o, sinif: o.id === mEtk ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ mEtk: o.id }) })),
      mEtkSecili: !!mEtk,
      mEtkOzet: (() => {
        if (!mEtk) return {};
        const giren = topla(etkH.filter((h) => h.tur === 'gelir'));
        const cikan = topla(etkH.filter((h) => h.tur === 'gider'));
        const n = Number(kat[mEtk]) || 0;
        const [t, ad] = mEtk.split('|');
        return {
          baslik: `${ad} · ${tarihYaz(t)}`, adet: `${etkH.length} kayıt${n ? ` · ${n} katılımcı` : ''}`,
          giren: TL(giren), cikan: TL(cikan), net: TL(cikan - giren), kisiBasi: n ? TL((cikan - giren) / n) : '—',
        };
      })(),
      etkYok: !etkMaliyet.length,
      giderDagilim: dagilim(giderH), giderYok: !giderH.length,
      gelirDagilim: dagilim([...aidatH, ...digerGelirH]), gelirYok: !gelirTop,
      mGorunumler: secimler([{ id: 'hareketler', ad: 'Hareketler' }, { id: 'etkinlik', ad: 'Etkinlik maliyetleri' }, { id: 'ozet', ad: 'Aylık özet' }], mGorunum, 'mGorunum'),
      gHareketler: mGorunum === 'hareketler', gEtkinlik: mGorunum === 'etkinlik', gOzet: mGorunum === 'ozet',
      mFiltreler: secimler([{ id: 'tumu', ad: 'Tümü' }, { id: 'gelir', ad: 'Gelir' }, { id: 'gider', ad: 'Gider' }, { id: 'aktarim', ad: 'Aktarım' }], mFiltre, 'mFiltre'),
      mFormAcik: this.state.mFormAcik, mForm, mAlan: this.mAlan, mKaydet: this.mKaydet, mHata: this.state.mHata, mMesaj: this.state.mMesaj,
      mFormBaslik: { gider: 'Gider ekle', gelir: 'Gelir ekle', aktarim: 'Kasalar arası aktar' }[mForm.tur],
      mGider: mForm.tur === 'gider', mGelir: mForm.tur === 'gelir', mAktarim: mForm.tur === 'aktarim', mAktarimDegil: mForm.tur !== 'aktarim',
      mTurler, mEtkSecenek,
      mGiderAc: () => this.mFormAc('gider'), mGelirAc: () => this.mFormAc('gelir'), mAktarAc: () => this.mFormAc('aktarim'),
      mFormKapat: () => this.setState({ mFormAcik: false, mForm: { ...this.MBOS }, mHata: '' }),
      girisEkrani: !girildi,
      panel: girildi,
      // Üye girişi akışı (önizleme): geçici şifre FC-4821 ile girilince yeni şifre istenir
      adimGiris: this.state.adim === 'giris',
      adimGecici: this.state.adim === 'gecici',
      adimGonderildi: this.state.adim === 'gonderildi',
      adimYeniSifre: this.state.adim === 'yeniSifre',
      eposta: this.state.eposta, sifre: this.state.sifre, yeni1: this.state.yeni1, yeni2: this.state.yeni2,
      girisHata: this.state.girisHata,
      epostaYaz: (e) => this.setState({ eposta: e.target.value, girisHata: '' }),
      sifreYaz: (e) => this.setState({ sifre: e.target.value, girisHata: '' }),
      yeni1Yaz: (e) => this.setState({ yeni1: e.target.value, girisHata: '' }),
      yeni2Yaz: (e) => this.setState({ yeni2: e.target.value, girisHata: '' }),
      geciciIste: () => this.setState({ adim: 'gecici', girisHata: '' }),
      girisDon: () => this.setState({ adim: 'giris', girisHata: '' }),
      geciciGonder: () => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.state.eposta.trim())) return this.setState({ girisHata: 'Geçerli bir e-posta yaz.' });
        window.FCSifreBaglantisi(this.state.eposta.trim())
          .then(() => this.setState({ adim: 'gonderildi', sifre: '', girisHata: '' }))
          .catch((h) => this.setState({ girisHata: h.message }));
      },
      onizlemeGiris: () => this.setState({ girildi: true, sekme: 'ana', girisHata: '', eposta: 'forestcluburla@gmail.com' }),
      girisYap: () => {
        const { eposta, sifre, hatirla } = this.state;
        if (!eposta.trim() || !sifre) return this.setState({ girisHata: 'E-posta ve şifreni yaz.' });
        this.setState({ girisHata: 'Giriş yapılıyor…' });
        window.FCGiris(eposta.trim(), sifre, hatirla).catch((h) => this.setState({ girisHata: h.message }));
      },
      sifreKaydet: () => {
        const { yeni1, yeni2 } = this.state;
        if (yeni1.length < 8 || !/\d/.test(yeni1)) return this.setState({ girisHata: 'Şifre en az 8 karakter olmalı ve bir rakam içermeli.' });
        if (yeni1 !== yeni2) return this.setState({ girisHata: 'İki şifre aynı değil.' });
        window.FCSifreKaydet(yeni1).catch((h) => this.setState({ girisHata: h.message }));
      },
      cikis: () => { window.FCCikis(); },
      hatirla: this.state.hatirla,
      hatirlaDegis: () => this.setState((s) => ({ hatirla: !s.hatirla })),
      etkinlikSec: () => this.setState({ sekme: 'etkinlikler', formAcik: true, eklendiMesaj: '' }),
      formAc: () => this.setState({ formAcik: true, eklendiMesaj: '' }),
      formKapat: () => this.setState({ formAcik: false, form: { ...this.BOS }, formHata: '' }),
      formAcik: this.state.formAcik,
      form: this.state.form,
      alan: this.alan,
      kaydet: this.kaydet,
      formHata: this.state.formHata,
      eklendiMesaj: this.state.eklendiMesaj,
      yaklasanEtk: etkGorunum.filter((x) => x.tarih >= BUGUN).map((x) => {
        const key = `${x.tarih}|${x.ad}`;
        const k = this.state.kayitlar[key];
        const ozelDurum = this.state.etkDurum[key];
        return {
          ...x,
          durum: ozelDurum || x.durum, rozet: ozelDurum ? DOLDU : x.rozet,
          kayitYazi: k ? (() => {
            const sat = x.satis ? x.satis.satilan : 0;
            const tn = k.tanisma || 0;
            const bos = k.kontenjan - k.kayitli.length - sat - tn;
            return `${k.kayitli.length} üye${sat ? ` + ${sat} bilet` : ''}${tn ? ` + ${tn} tanışma` : ''}${bos <= 0 ? ' · dolu' : ` · ${bos} yer var`}`;
          })() : 'Kayıt açılmadı',
          biletYazi: x.satis
            ? `Bilet ${x.satis.fiyat.toLocaleString('tr-TR')} TL · ${{ ucretsiz: 'üyelere ücretsiz', yuzde50: 'üyelere %50', tam: 'üyelere tam fiyat' }[x.satis.uye]} · ${x.satis.satilan} satıldı (${(x.satis.fiyat * x.satis.satilan).toLocaleString('tr-TR')} TL)`
            : 'Bilet satışı yok (yalnız üyeler)',
          beklemeYazi: k && k.bekleme.length ? `Bekleme listesi: ${k.bekleme.length}` : '',
          kontenjan: k ? String(k.kontenjan) : '',
          // Kontenjan artınca bekleme listesinden sıradakiler kayda geçer (gerçekte "yer açıldı" maili gider)
          kontenjanYaz: (ev) => {
            const yeni = Math.max(1, Number(ev.target.value) || 1);
            if (window.FC) return this.setState((s) => ({ kayitlar: { ...s.kayitlar, [key]: { ...(s.kayitlar[key] || { kayitli: [], bekleme: [], gelen: [] }), kontenjan: yeni } } }));
            this.setState((s) => {
              const kk = s.kayitlar[key] || { kayitli: [], bekleme: [], gelen: [] };
              const bos = Math.max(0, yeni - kk.kayitli.length);
              return { kayitlar: { ...s.kayitlar, [key]: { ...kk, kontenjan: yeni, kayitli: [...kk.kayitli, ...kk.bekleme.slice(0, bos)], bekleme: kk.bekleme.slice(bos) } } };
            });
          },
          yoklamaAc: () => this.setState({ etkPanel: { key, mod: 'yoklama' }, kod: '', kodMesaj: '' }),
          iptalAc: () => this.setState({ etkPanel: { key, mod: 'iptal' }, iptal: { tur: 'ertele', tarih: '', neden: 'Yağmur / hava durumu', mesaj: '' }, iptalMesaj: '' }),
          duyuruDuzenle: () => this.setState({ sekme: 'eposta', sSecili: 'duyuru', sMesaj: '' }),
        };
      }),
      gecmisEtk: etkGorunum.filter((x) => x.tarih < BUGUN).reverse().map((x, i) => ({
        ...x, anket: (() => { const a = this.DEMO.anket[`${x.tarih}|${x.ad}`]; return a && a.n ? `★ ${a.ort.toFixed(1).replace('.', ',')} · ${a.n} yanıt · ${this.state.kayitlar[`${x.tarih}|${x.ad}`].gelen.length} kişi geldi` : ''; })(),
      })),
      ...secilenEtkinlik,
      yaklasanYok: !etkGorunum.some((x) => x.tarih >= BUGUN),
      sekmeler,
      anaSayfa: sekme === 'ana',
      uyelerSekme: sekme === 'uyeler',
      etkinliklerSekme: sekme === 'etkinlikler',
      iletisimSekme: sekme === 'iletisim',
      basvuruSekme: sekme === 'basvurular',
      bvr: window.FCBasvuruGorunum ? window.FCBasvuruGorunum(this) : { bekleyen: [], kararlar: [], cagri: [], sayaclar: [], bekleyenYok: true, cagriYok: true, bekleyenSayi: '0', cagriSayi: '0' },
      ozet: [
        { baslik: 'Aktif üye', sayi: String(sayac.aktif), alt: `${this.DEMO.kisiler.filter((k) => k.bas && k.bas >= `${BUGUN_SABIT.slice(0, 7)}-01`).length} kişi bu ay katıldı · ${tumUyeler.length} kayıt` },
        { baslik: 'Bu ay kart ödemesi', sayi: String(buAyKart.length), alt: `${TL(topla(buAyKart))} · kendiliğinden işlendi` },
        { baslik: 'Bu hafta biten üyelik', sayi: String(this.DEMO.kisiler.filter((k) => k.durum === 'aktif' && kalanGun(k.bitis) <= 7).length), alt: 'Yenileme hatırlatması kendiliğinden gider' },
        { baslik: 'Yaklaşan etkinlik', sayi: String(etkGorunum.filter((x) => x.tarih > BUGUN).length), alt: (() => { const y = etkGorunum.filter((x) => x.tarih > BUGUN); const sat = y.reduce((t, x) => t + (x.satis ? x.satis.satilan : 0), 0); return y.length ? `En yakını ${y[0].gun} ${y[0].ay.charAt(0)}${y[0].ay.slice(1).toLocaleLowerCase('tr')} · ${sat} bilet satıldı` : 'Planlanan yok'; })() },
      ],
      // Deneme sitesi: sabit örnek yerine bugünden sonraki ilk iki etkinlik (kayıt sayısıyla)
      bugunYazi: (() => { const [y, m, d] = BUGUN.split('-'); return `${Number(d)} ${AY_UZUN[Number(m) - 1]} ${y}`; })(),
      yaklasan: etkGorunum.filter((x) => x.tarih >= BUGUN).slice(0, 2).map((x) => {
        const k = this.state.kayitlar[`${x.tarih}|${x.ad}`];
        return { gun: x.gun, ay: x.ay, ad: x.ad, durum: k ? `${k.kayitli.length} kayıt · ${k.kontenjan} kişilik` : 'Kayıt açılmadı' };
      }),
      filtreler,
      uyeOzet: `${sayac.aktif} aktif · ${sayac.doldu} süresi dolmuş · ${sayac.basvuru} hiç ödememiş · toplam ${tumUyeler.length} kayıt`,
      arama: this.state.arama,
      aramaYaz: (e) => this.setState({ arama: e.target.value, uyeSayisi: 100 }),
      uyeDahaVar: uyeListesi.length > uyeGoster.length,
      uyeDahaYazi: `${uyeGoster.length} / ${uyeListesi.length} kişi gösteriliyor · ${Math.min(100, uyeListesi.length - uyeGoster.length)} kişi daha göster`,
      uyeDaha: () => this.setState((s) => ({ uyeSayisi: s.uyeSayisi + 100 })),
      uyeler: uyeGoster.map((u) => ({
        ...u, elden: () => this.setState((s) => ({ sekme: 'ana', anaMesaj: '', elden: { ...s.elden, acik: true, ad: `${u.ad} · ${u.kod}`, hata: '' } })),
        profilAc: () => this.setState({ profilSecili: u.id }),
      })),
      profilAcik: !!profilUye, profil: profilGorunum,
      ...(window.FCVeriTalepGorunum ? (() => {
        const g = window.FCVeriTalepGorunum();
        return { veriTalepVar: true, veriTalepOzet: g.talepOzet, veriTalepleri: g.talepler.map((t) => ({ ...t, tur: `Silme talebi · ${t.eposta}` })) };
      })() : {
        veriTalepVar: this.state.veriTalepleri.length > 0,
        veriTalepOzet: 'Önizleme: örnek talepler.',
        veriTalepleri: this.state.veriTalepleri.map((v) => {
        const son = new Date(`${v.tarih}T12:00:00Z`); son.setUTCDate(son.getUTCDate() + 30);
        return {
          ad: v.ad, tur: v.tur, tarih: v.tarih.split('-').reverse().join('.'), bekliyor: !v.tamam,
          durum: v.tamam ? 'Tamamlandı' : `Son gün ${son.toISOString().slice(0, 10).split('-').reverse().join('.')}`,
          rozet: v.tamam ? TASLAK : DOLDU,
          tamamla: () => this.setState((s) => ({ veriTalepleri: s.veriTalepleri.map((x) => (x.id === v.id ? { ...x, tamam: true } : x)) })),
          indir: () => window.alert('Önizleme: üyenin bütün verisi JSON dosyası olarak iner.'),
          sil: () => this.setState((s) => ({ veriTalepleri: s.veriTalepleri.map((x) => (x.id === v.id ? { ...x, tamam: true } : x)) })),
        };
        }),
      }),
      profilKapat: () => this.setState({ profilSecili: null }),
      profilNotYaz: (e) => { const v = e.target.value; this.setState((s) => ({ notlar: { ...s.notlar, [s.profilSecili]: v } })); },
      ozelGunler,
      tanismaSunuluyor: this.state.tanismaSunuluyor,
      // Deneme sitesinde kart komisyonu iyzico'nun bildirdiği tutarla her ödemede gider olarak yazılır (oran girilmez)
      yakindaKapali: !!window.FC, yakindaIpucu: window.FC ? 'iyzico komisyonu her kart ödemesinde kendiliğinden gider olarak yazılır' : '',
      komisyonNot: window.FC ? 'Gerek yok: iyzico komisyonu her kart ödemesinde muhasebeye kendiliğinden gider olarak yazılır.'
        : 'Sözleşmedeki oranı yazın; her ayın kart ödemelerinden kendiliğinden gider olarak düşülür. Boşsa hesaplanmaz.',
      tanismaDegis: () => this.ayarDegis('tanismaSunuluyor', 'tanisma_acik', 'Tanışma bileti sitede'),
      kartOdeme: this.state.kartOdeme,
      kartOdemeDegis: () => this.ayarDegis('kartOdeme', 'kart_odeme', 'Kartla ödeme'),
      ilt: this.state.ilt, iltMesaj: this.state.iltMesaj,
      yakinda: this.state.yakinda,
      yakindaNot: this.state.yakinda
        ? 'Açık: ana sayfada “Yakında yayındayız” kapağı var, site tıklanamaz; üyelik başvurusu, tanışma bileti ve bilet satışı kapalı. Üye paneli ve dekont sayfası çalışır. Açılış günü işareti kaldırın.'
        : 'Kapalı: site tam açık; kapak yok, başvuru, tanışma bileti ve bilet satışı çalışıyor.',
      yakindaDegis: () => {
        // Kapatmak siteyi herkese açar (etkinlikler, fiyatlar, başvuru): yanlışlıkla tıklanmasın
        if (this.state.yakinda && !window.confirm('Site herkese açılacak: kapak kalkar; etkinlikler, fiyatlar ve başvuru görünür. Emin misin?')) return;
        this.ayarDegis('yakinda', 'yakinda', '“Yakında” modu');
      },
      siteDuyurusu: this.state.siteDuyurusu, duyuruMesaj: this.state.duyuruMesaj,
      siteDuyurusuYaz: (e) => this.setState({ siteDuyurusu: e.target.value, duyuruMesaj: '' }),
      siteDuyurusuKaydet: () => this.duyuruYaz(this.state.siteDuyurusu.trim()),
      siteDuyurusuKaldir: () => this.duyuruYaz(''),
      iltAlan: Object.fromEntries(['eposta', 'alan', 'whatsapp', 'topluluk', 'instagram'].map((a) => [a, (e) => {
        const v = e.target.value;
        this.setState((s) => ({ ilt: { ...s.ilt, [a]: v }, iltMesaj: '' }));
      }])),
      iltKaydet: () => {
        const ilt = Object.fromEntries(Object.entries(this.state.ilt).map(([a, v]) => [a, String(v || '').trim()]));
        if (ilt.topluluk && !/^https:\/\//.test(ilt.topluluk)) return this.setState({ iltMesaj: 'WhatsApp topluluğu bağlantısı https:// ile başlamalı.' });
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ilt.eposta)) return this.setState({ iltMesaj: 'Geçerli bir e-posta yazın.' });
        if (!window.FCAyarKaydet) return this.setState({ ilt, iltMesaj: 'Önizleme: kaydedildi (sitede görünür).' });
        this.setState({ iltMesaj: 'Kaydediliyor…' });
        window.FCAyarKaydet('iletisim', ilt).then(() => this.setState({ ilt, iltMesaj: 'Kaydedildi ✓ Sitede bir sonraki açılışta görünür.' }),
          (h) => this.setState({ iltMesaj: h.message }));
      },
      tOzet: [
        { baslik: 'Verilen bilet', sayi: String(this.state.biletler.length) },
        { baslik: 'Gelen', sayi: String(this.state.biletler.filter((b) => b.durum !== 'bekliyor').length) },
        { baslik: 'Sonra üye olan', sayi: String(this.state.biletler.filter((b) => b.durum === 'uye').length) },
        { baslik: 'Gelenlerin üye olma oranı', sayi: (() => { const g = this.state.biletler.filter((b) => b.durum !== 'bekliyor').length; return g ? `%${Math.round((this.state.biletler.filter((b) => b.durum === 'uye').length * 100) / g)}` : '—'; })() },
      ],
      biletler: [...this.state.biletler].sort((a, b) => b.alinis.localeCompare(a.alinis)).map((b) => ({
        ad: b.ad, eposta: b.eposta, alinis: b.alinis.split('-').reverse().join('.'), etkinlik: b.etkinlik || '—',
        durum: { uye: 'Üye oldu', geldi: 'Geldi', bekliyor: 'Henüz gelmedi' }[b.durum],
        rozet: b.durum === 'uye' ? AKTIF : b.durum === 'geldi' ? BEKLER : TASLAK,
        bekliyor: b.durum === 'bekliyor',
        geldi: () => this.setState((s) => ({ biletler: s.biletler.map((x) => (x.id === b.id ? { ...x, durum: 'geldi' } : x)) })),
      })),
      etkinlikler: [
        { gun: '26', ay: 'EKİM', ad: 'Breakfast Club', saat: 'Pazar 10.00 · Pinya', durum: 'Duyuruldu', rozet: AKTIF, bilgi: 'Hatırlatma 23 Ekim’de gitti' },
        { gun: '02', ay: 'KASIM', ad: 'Sunset Club', saat: 'Pazar 17.30 · Pinya', durum: 'Taslak', rozet: TASLAK, bilgi: 'Duyuru metni bekleniyor' },
        { gun: '09', ay: 'KASIM', ad: 'Seramik atölyesi', saat: 'Cumartesi 14.00 · %50 üye indirimi', durum: 'Hazır', rozet: BEKLER, bilgi: 'Duyuru bugün gidecek' },
        { gun: '16', ay: 'KASIM', ad: 'Yoga ve nefes', saat: 'Pazar 09.30 · Pinya', durum: 'Taslak', rozet: TASLAK, bilgi: 'Duyuru metni bekleniyor' },
      ],
      mesajlar: window.FC ? [{ ad: 'Sitede iletişim formu yok', zaman: '', metin: 'Mesajlar WhatsApp ve e-postayla geliyor.' }] : [
        { ad: 'Selin Demir', zaman: 'Bugün 09.12', metin: 'Breakfast Club için yanımda bir arkadaşımı getirebilir miyim?' },
        { ad: 'Can Öztürk', zaman: 'Dün 18.40', metin: 'Üyeliğimi yenilemek istiyorum, dekontu nereden gönderiyorum?' },
        { ad: 'Ece Arslan', zaman: '22 Ekim', metin: 'Seramik atölyesinin kontenjanı doldu mu?' },
      ],
    };
  }
}
return Component;
});
