// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/site.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/site.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Tam ekran afiş Esc ile kapanır
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state.afisTam) this.setState({ afisTam: '' }); });
    this.state = { uyeGirisli: false, gecmisTumu: false, sepet: {}, sepetAcik: false, sAdim: 'sepet', sAd: '', sEposta: '', sTel: '', sOnay: false, sHata: '', hak: null, sDosya: null, satilan: {}, biletler: [], tEtk: '', bAd: '', bTel: '', bEposta: '', bKosul: false, bDogal: false, bKvkk: false, bFoto: false, bHata: '', dDosya: null, dHata: '', dekontGitti: false, cv: {}, cagriKvkk: false, cagriHata: '', duyuruKapali: false, tanisma: '', tAd: '', tEposta: '', tOnay: false, tHata: '', uyeAdim: 'form', tur: 'tumu', asagi: false, kapali: false, secim: {}, cagriGitti: false, cagriAcik: false, cagriAdim: 'afis', destek: '', dsTutar: 1000, dsElle: false, dsTutarYazi: '', dsHata: '', dsKopya: '', waSecAcik: false };
    this.bekle = null;
    this.kaydir = () => {
      if (this.bekle) return;
      this.bekle = requestAnimationFrame(() => {
        this.bekle = null;
        const asagi = window.scrollY > 620;
        if (asagi !== this.state.asagi) this.setState({ asagi });
      });
    };
  }
  componentDidMount() {
    window.addEventListener('scroll', this.kaydir, { passive: true });
    this.kaydir();
    // Üye panelinde "Beni hatırla" ile giriş yapılmışsa düğme "Panelim" olur
    if (window.FCS && window.FCS.oturum) this.setState({ uyeGirisli: true });  // deneme sitesi: Supabase oturumu
    // iyzico'dan dönüş (odeme-donus?tur=destek): teşekkür ya da hata penceresi; adres temizlenir
    this.etkinligeGit();
    window.addEventListener('hashchange', () => this.etkinligeGit());
    const donus = /^#destek-(tamam|hata)$/.exec(location.hash);
    if (donus) {
      this.setState({ destek: donus[1] });
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  // Paylaşılan etkinlik bağlantısı (/#etkinlik-<id>): kart açılır (geçmişteyse geçmiş listesi genişler) ve ekrana kaydırılır
  etkinligeGit() {
    const m = /^#etkinlik-(\d+|\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    if (!m) return;
    const liste = window.FCS ? window.FCS.etkinlikler : [];
    const b = liste.find((x) => String(x.id) === m[1] || (!x.id && x.tarih === m[1]));
    if (!b) return;
    this.setState({ tur: 'tumu', gecmisTumu: true, acikEtk: `${b.tarih}|${b.ad}` }, () => {
      const el = document.getElementById(location.hash.slice(1));
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    });
  }
  componentWillUnmount() {
    window.removeEventListener('scroll', this.kaydir);
    if (this.bekle) cancelAnimationFrame(this.bekle);
  }
  renderVals() {
    const { tur } = this.state;
    const pill = (bg, fg) => `background:${bg};color:${fg};font-size:12px;font-weight:700;border-radius:999px;padding:4px 10px`;
    // Instagram @forestcluburla gönderilerinden (eskiden yeniye); bugün: 24.10.2026
    const IG = 'https://www.instagram.com/p/';
    const BUGUN = window.FCS ? window.FCS.bugun : window.FCS_HATA ? window.FC_ORTAK.bugun() : '2026-10-24';  // deneme sitesinde gerçek bugün
    // Deneme sitesinde veri gelmezse örnek liste gösterilmez (site.js FCS_HATA); tasarım önizlemesinde örnekler kalır
    const tumu = (window.FCS ? window.FCS.etkinlikler : window.FCS_HATA ? [] : [
      { tarih: '2026-09-11', gun: '11', ay: 'EYLÜL', haftaGunu: 'Cuma', ad: 'Sunset Club', saat: '18.30', tur: 'bulusma', metin: 'Fruma Table ile fine casual sunset bites, Taylan Aktuğ ile Rhythm Lab ve drum circle, DJ Jamie S.', link: 'https://www.instagram.com/forestcluburla/' },
      { tarih: '2026-09-12', gun: '12–13', ay: 'EYLÜL', haftaGunu: 'Cmt–Paz', ad: 'Tai Chi Günleri', saat: '2 gün', tur: 'hareket', metin: 'Om Yoga Stüdyo × Forest Club, Urla.', link: 'https://www.instagram.com/forestcluburla/' },
      { tarih: '2026-09-27', gun: '27', ay: 'EYLÜL', haftaGunu: 'Pazar', ad: 'Sunset Club', saat: '17.30', tur: 'bulusma', metin: 'Fruma Table ile fine casual sunset bites, Tayga Live Set (Mehmet Denizci), Elif Bilgen ile orman banyosu.', link: IG + 'DeMtTC7D_9H/' },
      { tarih: '2026-09-30', gun: '30', ay: 'EYLÜL', haftaGunu: 'Çarşamba', ad: 'Breakfast Club', saat: '09.30–12.00', tur: 'bulusma', metin: '09.30 Body Sculpt (Merve Bircan) · 10.30 kahve molası · 11.00 Rhythm Lab (Taylan Aktuğ) · 12.00 ağaçların altında brunch.', link: IG + 'Dd05NIvM9Ec/' },
      { tarih: '2026-10-06', gun: '06', ay: 'EKİM', haftaGunu: 'Salı', ad: 'Vinyasa Yoga', saat: '09.00', tur: 'yoga', metin: 'Duygu İşcan ile.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-06', gun: '06', ay: 'EKİM', haftaGunu: 'Salı', ad: 'Yin Yoga', saat: '19.00', tur: 'yoga', metin: 'Hürriyet Keskin ile.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-07', gun: '07', ay: 'EKİM', haftaGunu: 'Çarşamba', ad: 'Forest Yoga', saat: '09.00', tur: 'yoga', metin: 'Deniz Öngeç ile.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-08', gun: '08', ay: 'EKİM', haftaGunu: 'Perşembe', ad: 'Hatha Yoga', saat: '09.00', tur: 'yoga', metin: 'Aslı Albayrak ile.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-08', gun: '08', ay: 'EKİM', haftaGunu: 'Perşembe', ad: 'Clay & Create Seramik Atölyesi', saat: '17.00–19.00', tur: 'atolye', metin: 'Şule Kunak ile seramik atölyesi.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-09', gun: '09', ay: 'EKİM', haftaGunu: 'Cuma', ad: 'Sunset Club × Subkult', saat: '18.00–21.00', tur: 'bulusma', metin: 'Pizza Sunset Club: DJ Sivo ile scratch atölyesi, DJ Gasm müzik, akşam boyu pizza. Biletler Biletinial’da.', link: IG + 'DeFDnS5DKWB/' },
      { tarih: '2026-10-24', gun: '24', ay: 'EKİM', haftaGunu: 'Cumartesi', ad: 'The Common Table', saat: '09.30–12.00', tur: 'bulusma', metin: 'A Forest Club Gathering · Forest Club Urla, Pinya. Kontenjan sınırlı.', link: 'https://www.instagram.com/reel/De0pra3EXUJ/' },
      // Örnek ileri tarihli etkinlikler (demo): satis = fiyat, üye kuralı, kontenjan, şimdiye kadar kayıtlı/satılan
      { tarih: '2026-10-26', gun: '26', ay: 'EKİM', haftaGunu: 'Pazar', ad: 'Breakfast Club', saat: '10.00–12.00', tur: 'bulusma', metin: 'Örnek etkinlik (demo).', link: '#', satis: { fiyat: 600, uye: 'ucretsiz', kontenjan: 35, kayitli: 21 } },
      { tarih: '2026-11-02', gun: '02', ay: 'KASIM', haftaGunu: 'Pazar', ad: 'Sunset Club', saat: '17.30–20.30', tur: 'bulusma', metin: 'Örnek etkinlik (demo).', link: '#', satis: { fiyat: 900, uye: 'ucretsiz', kontenjan: 25, kayitli: 25 } },
      { tarih: '2026-11-07', gun: '07', ay: 'KASIM', haftaGunu: 'Cumartesi', ad: 'Seramik Atölyesi', saat: '14.00–17.00', tur: 'atolye', metin: 'Örnek atölye (demo). Malzeme dahil.', link: '#', satis: { fiyat: 1500, uye: 'yuzde50', kontenjan: 12, kayitli: 5 } },
      { tarih: '2026-11-09', gun: '09', ay: 'KASIM', haftaGunu: 'Pazartesi', ad: 'Vinyasa Yoga', saat: '09.00–10.30', tur: 'yoga', metin: 'Örnek ders (demo). Matını getir; yedek mat var.', link: '#', satis: { fiyat: 400, uye: 'yuzde50', kontenjan: 20, kayitli: 11 } },
      { tarih: '2026-11-14', gun: '14', ay: 'KASIM', haftaGunu: 'Cumartesi', ad: 'Sunset Club', saat: '17.00–20.00', tur: 'bulusma', metin: 'Örnek etkinlik (demo). Canlı müzik ve gün batımı ikramı.', link: '#', satis: { fiyat: 900, uye: 'ucretsiz', kontenjan: 50, kayitli: 32 } },
      { tarih: '2026-11-16', gun: '16', ay: 'KASIM', haftaGunu: 'Pazartesi', ad: 'Tai Chi Sabahı', saat: '10.00–11.30', tur: 'hareket', metin: 'Örnek ders (demo). Rahat kıyafet yeterli.', link: '#', satis: { fiyat: 450, uye: 'yuzde50', kontenjan: 20, kayitli: 10 } },
      { tarih: '2026-11-22', gun: '22', ay: 'KASIM', haftaGunu: 'Pazar', ad: 'Clay & Create Seramik', saat: '14.00–17.00', tur: 'atolye', metin: 'Örnek atölye (demo). Malzeme ve fırınlama dahil.', link: '#', satis: { fiyat: 1500, uye: 'yuzde50', kontenjan: 12, kayitli: 11 } },
      { tarih: '2026-11-30', gun: '30', ay: 'KASIM', haftaGunu: 'Pazar', ad: 'Breakfast Club', saat: '10.00–12.00', tur: 'bulusma', metin: 'Örnek etkinlik (demo).', link: '#', satis: { fiyat: 600, uye: 'ucretsiz', kontenjan: 35, kayitli: 13 } },
    ]).map((b) => {
      const gecti = b.tarih < BUGUN, bugun = b.tarih === BUGUN;
      // Google Takvim bağlantısı: saat yazılıysa o saat (bitiş yoksa 2 saat), yoksa tüm gün
      const g = b.tarih.replace(/-/g, '');
      const s = /(\d{2})\.(\d{2})(?:\s*[–-]\s*(\d{2})\.(\d{2}))?/.exec(b.saat);
      let tarihler;
      if (s) {
        const bitSaat = s[3] ? `${s[3]}${s[4]}` : `${String(Number(s[1]) + 2).padStart(2, '0')}${s[2]}`;
        tarihler = `${g}T${s[1]}${s[2]}00/${g}T${bitSaat}00`;
      } else {
        const d = new Date(`${b.tarih}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
        tarihler = `${g}/${d.toISOString().slice(0, 10).replace(/-/g, '')}`;
      }
      const takvim = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Forest Club · ${b.ad}`)}&dates=${tarihler}&ctz=Europe/Istanbul&location=${encodeURIComponent('Pinya, Urla')}`;
      // Satış (örnek): fiyat TL, üye: ucretsiz | yuzde50 | tam; kontenjan ve kayıtlı (üye + satılan bilet)
      const sat = !gecti ? (b.satis || (!window.FCS && b.ad === 'The Common Table' ? { fiyat: 750, uye: 'ucretsiz', kontenjan: 35, kayitli: 20 } : null)) : null;
      // Kart önce kısa özet; karta (düğme ve bağlantılar dışında) dokununca açılır / kapanır
      const yakinda15 = !gecti && !bugun && (new Date(`${b.tarih}T12:00:00Z`) - new Date(`${BUGUN}T12:00:00Z`)) / 864e5 <= 15;
      const kartKey = `${b.tarih}|${b.ad}`;
      const acik = this.state.acikEtk === kartKey;
      // Paylaş: tek etkinliğin bağlantısı (/#etkinlik-<id>); telefonda paylaşım menüsü, değilse panoya kopyalanır
      const capa = b.id ? `etkinlik-${b.id}` : `etkinlik-${b.tarih}`;
      const paylasLink = `${location.origin}/#${capa}`;
      return {
        ...b, takvim, satis: sat ? { ...sat } : null, afisVar: !!b.afis, afisAlt: `${b.ad} afişi`, linkVar: !!b.link && b.link !== '#',
        acik, acikYazi: acik ? 'true' : 'false', metinSinif: acik ? '' : 'fs-ozet', acYazi: acik ? 'Kapat ▲' : 'Ayrıntılar ▼',
        kartTikla: (e) => {
          if (e.target.closest('a, button, input, select, textarea, label')) return;
          this.setState((st) => ({ acikEtk: st.acikEtk === kartKey ? null : kartKey }));
        },
        afisAc: () => this.setState({ afisTam: b.afis, afisTamAlt: `${b.ad} afişi` }),
        capa, paylasEtiket: `${b.ad} etkinliğini paylaş`, paylasYazi: this.state.paylasildi === kartKey ? 'Bağlantı kopyalandı ✓' : 'Paylaş ↗',
        paylas: () => {
          const metin = `${b.ad} · ${b.gun} ${b.ay} ${b.haftaGunu}${b.saat ? `, ${b.saat}` : ''} · Pinya, Urla`;
          const kopyala = () => {
            const tamam = () => this.setState({ paylasildi: kartKey });
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(paylasLink).then(tamam, () => window.prompt('Bağlantıyı kopyalayın:', paylasLink));
            else window.prompt('Bağlantıyı kopyalayın:', paylasLink);
          };
          if (navigator.share && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
            navigator.share({ title: `Forest Club Urla · ${b.ad}`, text: metin, url: paylasLink }).catch((h) => { if (h && h.name !== 'AbortError') kopyala(); });
          } else kopyala();
        },
        // "Yakında" yalnız 15 gün içindeki etkinliklerde; daha uzaktakilerde etiket yok
        etiket: gecti ? 'Gerçekleşti' : bugun ? 'Bugün' : yakinda15 ? 'Yakında' : '',
        rozet: gecti ? pill('#F0F0EE', '#3A3A3A') : bugun ? pill('#E4E4E2', '#111111') : yakinda15 ? pill('#111111', '#FFFFFF') : 'display:none',
        kart: `background:#FFFFFF;border-radius:20px;border:2.5px solid #111111;box-shadow:${bugun ? '7px 7px 0 #111111' : '4px 4px 0 #111111'};padding:18px;display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;${gecti ? 'opacity:.78' : ''}`,
      };
    });
    const filtreler = [
      { id: 'tumu', ad: 'Hepsi' }, { id: 'bulusma', ad: 'Buluşmalar' }, { id: 'yoga', ad: 'Yoga' }, { id: 'hareket', ad: 'Tai Chi' }, { id: 'atolye', ad: 'Atölyeler' },
    ].map((f) => ({
      ...f,
      sec: () => this.setState({ tur: f.id }),
      stil: `font:600 14px Figtree,sans-serif;border-radius:999px;padding:10px 16px;min-height:44px;cursor:pointer;border:1px solid #111111;${f.id === tur ? 'background:#111111;color:#FFFFFF' : 'background:transparent;color:#111111'}`,
    }));
    const acik = this.state.asagi && !this.state.kapali;
    // Aylık duyuru (rozet + etkinlik şeridi): yönetim › Etkinlikler'den; {ay} seçilen ayla değişir
    const AYLIK = window.FC_AYLIK ? window.FC_AYLIK.oku(window.FCS && window.FCS.ayar && window.FCS.ayar.aylik_duyuru)
      : { goster: true, ay: 'Kasım', ust: 'Kasım programı için', ana: 'AÇIK ÇAĞRI!', alt: 'Fikrin mi var? Tıkla ✨', tur: 'cagri', formId: '', resim: '' };
    const ayDoldur = (m) => String(m || '').replace(/\{ay\}/g, AYLIK.ay);
    // Açık Çağrı: seçenek düğmeleri (tek seçim / çoklu seçim)
    const secim = this.state.secim;
    const secenekStil = (on) => `font:600 14px Figtree,sans-serif;border-radius:999px;padding:9px 15px;min-height:42px;cursor:pointer;border:2px solid #111111;${on ? 'background:#111111;color:#FFFFFF;box-shadow:3px 3px 0 #F08A24' : 'background:#FFFFFF;color:#111111'}`;
    const secimAlani = (anahtar, etiket, liste, coklu) => ({
      etiket, secim: true, yazi: false, uzun: false, uyeKutu: false, acik: false,
      secenekler: liste.map((ad) => {
        const on = coklu ? (secim[anahtar] || []).includes(ad) : secim[anahtar] === ad;
        return { ad, basili: on ? 'true' : 'false', stil: secenekStil(on), sec: () => {
          const s2 = { ...this.state.secim };
          if (coklu) { const l = s2[anahtar] || []; s2[anahtar] = l.includes(ad) ? l.filter((x) => x !== ad) : [...l, ad]; }
          else s2[anahtar] = ad;
          this.setState({ secim: s2 });
        } };
      }),
    });
    // Deneme sitesi: Açık Çağrı alanlarının değerleri state.cv'de (anahtarlar Sheets'teki sütunlar)
    const cv = this.state.cv;
    const cvYaz = (anahtar) => (e) => { const v = e.target.value; this.setState((st) => ({ cv: { ...st.cv, [anahtar]: v }, cagriHata: '' })); };
    const cvDegis = (anahtar) => () => this.setState((st) => ({ cv: { ...st.cv, [anahtar]: !st.cv[anahtar] }, cagriHata: '' }));
    const yazi = (etiket, ipucu, anahtar) => ({ etiket, ipucu, yazi: true, uzun: false, secim: false, uyeKutu: false, acik: false, secenekler: [], deger: cv[anahtar] || '', yaz: cvYaz(anahtar) });
    const uzun = (etiket, ipucu, anahtar) => ({ etiket, ipucu, yazi: false, uzun: true, secim: false, uyeKutu: false, acik: false, secenekler: [], deger: cv[anahtar] || '', yaz: cvYaz(anahtar) });
    const cagriAdimlar = [
      { no: '1', baslik: 'Biraz tanışalım', alanlar: [
        yazi('Adın ve soyadın *', 'Adın Soyadın', 'ad'),
        yazi('E-posta veya telefon numaran *', 'ornek@mail.com ya da 05xx', 'iletisim'),
        secimAlani('uye', 'Forest Club üyesi misin? *', ['Evet', 'Hayır'], false),
        ...(secim.uye === 'Hayır' ? [{ ...secimAlani('uyeOl', '', ['Evet, üye olmak istiyorum', 'Şimdilik değil'], false),
                                       secim: false, uyeKutu: true, acik: secim.uyeOl === 'Evet, üye olmak istiyorum',
                                       uyeEposta: cv.uyeEposta || '', uyeEpostaYaz: cvYaz('uyeEposta'), uyeTel: cv.uyeTelefon || '', uyeTelYaz: cvYaz('uyeTelefon'),
                                       uyeKosul: !!cv.uyeKosul, uyeKosulDegis: cvDegis('uyeKosul'), uyeDogal: !!cv.uyeDogal, uyeDogalDegis: cvDegis('uyeDogal'),
                                       uyeFoto: !!cv.uyeFoto, uyeFotoDegis: cvDegis('uyeFoto') }] : []),
      ] },
      { no: '2', baslik: 'Fikrini anlatalım', alanlar: [
        secimAlani('alan', 'Çalışman hangi alanda? *', ['Hareket ve beden', 'Ses ve müzik', 'Sanat ve el işi', 'Doğa ve farkındalık', 'Yemek ve mutfak', 'Sohbet ve paylaşım'], true),
        yazi('Atölyenin veya buluşmanın adı *', 'Örn. Ormanda ses banyosu', 'baslik'),
        uzun('Bize biraz anlatır mısın? *', 'Ne yapacağız, kimlere uygun, katılımcılar ne deneyimleyecek?', 'anlat'),
        secimAlani('deneyim', 'Daha önce bu çalışmayı gerçekleştirdin mi?', ['Evet, birçok kez', 'Evet, birkaç kez', 'Hayır, ilk kez'], false),
      ] },
      { no: '3', baslik: 'Bir araya gelelim', alanlar: [
        secimAlani('sure', 'Buluşma ne kadar sürer?', ['1 saat', '1,5 saat', '2 saat', 'Yarım gün'], false),
        secimAlani('kisi', 'Kaç kişiyle gerçekleştirmek istersin?', ['5–10', '10–20', '20+'], false),
        uzun('İhtiyaç duyduğun malzemeler veya alan var mı?', 'Matlar, ses sistemi, gölgelik…', 'ihtiyac'),
        secimAlani('gun', `${AYLIK.ay} ayında hangi günler uygunsun?`, ['Hafta içi sabah', 'Hafta içi öğleden sonra', 'Hafta içi akşam', 'Cumartesi', 'Pazar'], true),
      ] },
    ];
    // Deneme sitesi: iletişim bilgileri yönetim panelindeki ayarlardan (ayarlar.iletisim)
    const IL = (window.FCS && window.FCS.ayar && window.FCS.ayar.iletisim) || {};
    const igAd = String(IL.instagram || '').replace(/^@/, '').trim();
    const ilt = {
      eposta: IL.eposta || 'forestcluburla@gmail.com', alan: IL.alan || 'Pinya, Urla',
      instagramLink: igAd ? `https://www.instagram.com/${encodeURIComponent(igAd)}/` : '#', instagramYazi: igAd ? `@${igAd}` : '[Instagram]',
      instagramVar: !!igAd || !(window.FCS || window.FCS_HATA), toplulukVar: /^https:\/\//.test(IL.topluluk || '') || !(window.FCS || window.FCS_HATA),
      toplulukLink: /^https:\/\//.test(IL.topluluk || '') ? IL.topluluk : '#', toplulukYazi: /^https:\/\//.test(IL.topluluk || '') ? 'WhatsApp topluluğu' : '[WhatsApp topluluğu]',
    };
    ilt.epostaLink = `mailto:${ilt.eposta}`;
    // Tanışma bileti: önizlemede örnek listeler; gerçekte üyeler ve verilmiş biletler veritabanından bakılır
    const UYE_EPOSTA = ['deniz@ornek.com', 'ece@ornek.com', 'selin@ornek.com', 'can@ornek.com'];
    const BILETLI = ['misafir@ornek.com'];
    const t = this.state.tanisma;
    // Deneme sitesi: duyuru ve yakında modu ayarlardan (veri gelmediyse duyuru yok); önizlemede Tweaks › Duyuru
    const canli = !!(window.FCS || window.FCS_HATA);
    const AYAR = (window.FCS && window.FCS.ayar) || {};
    const yakinda = AYAR.yakinda === true;
    const YAKINDA_MESAJ = 'Üyelik başvuruları açılışla birlikte başlıyor. Instagram\'dan takipte kal!';
    const duyuruMetni = String(canli ? (AYAR.site_duyurusu || '') : (this.props.duyuru ?? 'Örnek duyuru: Yağmur nedeniyle bu haftaki buluşma ertelendi; yeni tarih e-postana geldi.')).trim();
    // SEPET: etkinlik biletleri. Gerçek sitede ödeme iyzico'da; başarılı ödeme biletleri kesinleştirir, muhasebeye "Etkinlik katılım ücreti" geliri yazar
    const TL = (n) => (n ? `${n.toLocaleString('tr-TR')} TL` : 'Ücretsiz');
    // Destek ol: kart yalnız canlıda ve kart_odeme açıkken; kopyalama panoya, olmazsa metin seçilir
    const odemeBilgi = (window.FC_AYAR && window.FC_AYAR.odeme) || { tutar: '3.000 TL', alici: '', iban: '' };
    const kartAcik = !canli || AYAR.kart_odeme === true;
    const destekTutar = this.state.dsElle ? Math.round(Number(String(this.state.dsTutarYazi).replace(/[^\d]/g, ''))) : this.state.dsTutar;
    const kopyala = (hangi, metin) => {
      const bitti = () => this.setState({ dsKopya: hangi });
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(metin).then(bitti, () => this.setState({ dsHata: `Kopyalanamadı; elle seç: ${metin}` }));
      else this.setState({ dsHata: `Kopyalanamadı; elle seç: ${metin}` });
    };
    const AKTIF_UYELER = ['deniz@ornek.com', 'ece@ornek.com', 'selin@ornek.com'];
    const sepet = this.state.sepet;
    const satilan = this.state.satilan;
    const urunler = tumu.filter((b) => b.satis);
    const kalanYer = (b) => b.satis.kontenjan - b.satis.kayitli - (satilan[`${b.tarih}|${b.ad}`] || 0);
    const uyeFiyati = (b) => (b.satis.uye === 'ucretsiz' ? 0 : b.satis.uye === 'yuzde50' ? Math.round(b.satis.fiyat / 2) : b.satis.fiyat);
    const sepetteKi = urunler.filter((b) => sepet[`${b.tarih}|${b.ad}`]);
    const uyeMi = AKTIF_UYELER.includes(this.state.sEposta.trim().toLowerCase());
    const araToplam = sepetteKi.reduce((t, b) => t + b.satis.fiyat * sepet[`${b.tarih}|${b.ad}`], 0);
    const indirim = uyeMi ? sepetteKi.reduce((t, b) => t + (b.satis.fiyat - uyeFiyati(b)), 0) : 0;
    const toplam = araToplam - indirim;
    const adetDegis = (key, fark, max) => this.setState((st) => {
      const yeni = Math.max(0, Math.min(max, (st.sepet[key] || 0) + fark));
      const s2 = { ...st.sepet };
      if (yeni) s2[key] = yeni; else delete s2[key];
      return { sepet: s2, sHata: '' };
    });
    const sAdim = this.state.sAdim;
    const ADIMLAR = canli ? [{ id: 'sepet', ad: '1 · Randevu' }, { id: 'bilgi', ad: '2 · Bilgiler' }, { id: 'dekont', ad: '3 · Ödeme' }]
      : [{ id: 'sepet', ad: '1 · Randevu' }, { id: 'bilgi', ad: '2 · Bilgiler' }, { id: 'tamam', ad: '3 · Bilet' }];
    const hak = this.state.hak;
    const sepetToplamAdet = Object.values(sepet).reduce((t, n) => t + n, 0);
    return {
      uyeDugme: this.state.uyeGirisli ? 'Panelim' : 'Üye girişi',
      // Ürün kartları
      urunVals: null,
      sepetVar: sepetToplamAdet > 0 && !this.state.sepetAcik,
      sepetAdet: String(sepetToplamAdet), sepetEtiket: `Randevuları aç, ${sepetToplamAdet} kişi`,
      sepetAcik: this.state.sepetAcik,
      sepetAc: () => this.setState({ sepetAcik: true, sAdim: 'sepet', sHata: '' }),
      sepetKapat: () => this.setState((st) => ({ sepetAcik: false, ...(['tamam', 'gonderildi'].includes(st.sAdim) ? { sAdim: 'sepet' } : {}) })),
      sAdimlar: ADIMLAR.map((a) => {
        const sira = ADIMLAR.findIndex((x) => x.id === ({ hata: 'bilgi', gonderildi: 'dekont' }[sAdim] || sAdim));
        const i = ADIMLAR.indexOf(a);
        return { ad: a.ad, stil: `border-radius:999px;padding:5px 10px;border:2px solid #111111;${i <= sira ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}` };
      }),
      sSepette: sAdim === 'sepet', sBilgide: sAdim === 'bilgi', sTamam: sAdim === 'tamam', sHatali: sAdim === 'hata',
      sDekontta: sAdim === 'dekont', sGonderildi: sAdim === 'gonderildi',
      hakTutarYazi: hak ? TL(Number(hak.tutar)) : '', hakAdetYazi: hak ? `${hak.adet} bilet` : '', hakIndirimli: !!hak && Number(hak.tutar) < hak.araToplam,
      odemeAlici: odemeBilgi.alici, odemeIban: odemeBilgi.iban,
      sDekontSec: (e) => { const f = e.target.files && e.target.files[0]; this.setState({ sDosya: f || null, sHata: '' }); },
      sDekontGonder: () => {
        this.setState({ sHata: 'Yükleniyor…' });
        window.FCSBiletDekont(hak, this.state.sEposta, this.state.sDosya)
          .then(() => this.setState({ sAdim: 'gonderildi', sepet: {}, hak: null, sDosya: null, sHata: '' }))
          .catch((h) => this.setState({ sHata: h.message }));
      },
      sepetSatirlar: sepetteKi.map((b) => {
        const key = `${b.tarih}|${b.ad}`;
        const n = sepet[key];
        return {
          ad: b.ad, zaman: `${b.gun} ${b.ay} · ${b.saat}`, birimYazi: `kişi başı ${TL(b.satis.fiyat)}`,
          adetYazi: `${n} kişi`, tutarYazi: TL(b.satis.fiyat * n),
          azaltEtiket: `${b.ad} bilet sayısını azalt`, arttirEtiket: `${b.ad} bilet sayısını arttır`,
          azalt: () => adetDegis(key, -1, kalanYer(b)), arttir: () => adetDegis(key, 1, kalanYer(b)),
        };
      }),
      araToplamYazi: TL(araToplam), indirimYazi: indirim ? `−${TL(indirim)}` : '—', toplamYazi: toplam ? TL(toplam) : '0 TL',
      uyeIndirimi: !canli && uyeMi && indirim > 0,
      uyeFiyatNotu: canli ? 'Aktif üyeysen önce üye girişi yap; üye fiyatı ödeme adımında uygulanır (her etkinlikte 1 kişi için).'
        : 'Aktif üyeysen, üye fiyatı bir sonraki adımda e-postanla kontrol edilip uygulanır (her etkinlikte 1 kişi için).',
      odemeDugme: canli ? 'Ödemeye geç · havale / EFT' : toplam ? `Kartla öde · ${TL(toplam)}` : 'Biletleri al (ücretsiz)',
      sAd: this.state.sAd, sEposta: this.state.sEposta, sTel: this.state.sTel, sOnay: this.state.sOnay, sHata: this.state.sHata,
      sAdYaz: (e) => this.setState({ sAd: e.target.value, sHata: '' }),
      sEpostaYaz: (e) => this.setState({ sEposta: e.target.value, sHata: '' }),
      sTelYaz: (e) => this.setState({ sTel: e.target.value, sHata: '' }),
      sOnayDegis: () => this.setState((st) => ({ sOnay: !st.sOnay, sHata: '' })),
      bilgiyeGec: () => (sepetToplamAdet ? this.setState({ sAdim: 'bilgi', sHata: '' }) : this.setState({ sHata: 'Sepetin boş.' })),
      sepeteDon: () => this.setState({ sAdim: 'sepet', sHata: '' }),
      odemeyeGec: () => {
        const { sAd, sEposta, sTel, sOnay } = this.state;
        if (!sAd.trim()) return this.setState({ sHata: 'Adını yaz.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sEposta.trim())) return this.setState({ sHata: 'Geçerli bir e-posta yaz.' });
        if (sTel.replace(/\D/g, '').length < 10) return this.setState({ sHata: 'Telefon numaranı yaz.' });
        if (!sOnay) return this.setState({ sHata: 'Devam etmek için metinleri onayla.' });
        // Ödeme sırasında kontenjan yeniden kontrol edilir
        const asan = sepetteKi.find((b) => sepet[`${b.tarih}|${b.ad}`] > kalanYer(b));
        if (asan) return this.setState({ sHata: `${asan.ad} için yeterli yer kalmadı.` });
        // Canlıda: sunucu isteği açar ve tutarı hesaplar (üye fiyatı oturumdan), sonra havale + dekont
        if (canli) {
          if (!window.FCSBiletAc) return this.setState({ sHata: 'Bilet satışı şu an yapılamıyor; biraz sonra tekrar dene.' });
          const kalemler = sepetteKi.map((b) => ({ etkinlik: window.FCS.anahtar[`${b.tarih}|${b.ad}`], adet: sepet[`${b.tarih}|${b.ad}`] }));
          this.setState({ sHata: 'Hazırlanıyor…' });
          window.FCSBiletAc({ kalemler, ad: sAd.trim(), eposta: sEposta.trim(), tel: sTel.trim() })
            .then((h) => this.setState({ sAdim: 'dekont', hak: { ...h, adet: sepetToplamAdet, araToplam }, sHata: '' }))
            .catch((h) => this.setState({ sHata: h.message }));
          return;
        }
        let no = 4821;
        const biletler = [];
        sepetteKi.forEach((b) => { for (let i = 0; i < sepet[`${b.tarih}|${b.ad}`]; i++) biletler.push({ ad: b.ad, zaman: `${b.gun} ${b.ay} · ${b.saat}`, kod: `FC-B-${no++}` }); });
        this.setState((st) => {
          const yeniSatilan = { ...st.satilan };
          sepetteKi.forEach((b) => { const k = `${b.tarih}|${b.ad}`; yeniSatilan[k] = (yeniSatilan[k] || 0) + st.sepet[k]; });
          return { sAdim: 'tamam', satilan: yeniSatilan, biletler, sepet: {}, sHata: '' };
        });
      },
      sOdemeHata: () => this.setState({ sAdim: 'hata' }),
      tekrarDene: () => this.setState({ sAdim: 'bilgi' }),
      biletlerim: this.state.biletler,
      duyuru: duyuruMetni, duyuruVar: !!duyuruMetni && !this.state.duyuruKapali,
      duyuruKapat: () => this.setState({ duyuruKapali: true }),
      // Bilinen cevaplar yazıldı; kulübün kararı gerekenler köşeli parantezde (deneme sitesinde onlar görünmez)
      galeriVar: !canli, metinlerVar: !canli,
      sss: [
        { soru: 'Üyelik ne kadar, nasıl ödeniyor?', cevap: canli && AYAR.kart_odeme !== true
          ? `30 günlük üyelik ${Number(AYAR.aidat || 3000).toLocaleString('tr-TR')} TL. Havale / EFT ile ödersin, dekontunu sitedeki dekont sayfasından yüklersin; onaylanınca üyeliğin başlar. Otomatik ücret çekilmez; devam etmek istediğinde yeni dönemi ödersin.`
          : `30 günlük üyelik ${Number(AYAR.aidat || 3000).toLocaleString('tr-TR')} TL. Kartla ödersin, üyeliğin hemen başlar. Otomatik ücret çekilmez; devam etmek istediğinde yeni dönemi ödersin.` },
        { soru: 'Üye olmadan gelebilir miyim?', cevap: 'Bir üyemizden tanışma bileti aldıysan bir etkinliğe ücretsiz gelebilirsin: sitedeki “Tanışma biletimle rezervasyon oluştur” ile yerini ayır. Tanışma rezervasyonu etkinlikten 1 gün önce, yer varsa açılır; bilet bir kez kullanılır.' },
        { soru: 'Etkinliklere nasıl kayıt oluyorum?', cevap: 'Üye panelinde etkinliğin altındaki “Randevu oluştur”a bas. Kontenjan doluysa bekleme listesine yazılırsın; yer açılınca e-postayla haber veririz.' },
        { soru: 'Yağmur yağarsa ne olur?', cevap: 'Etkinlik iptal edilir ya da ertelenirse sitenin en üstünde duyuru çıkar ve kayıtlı herkese e-posta göndeririz.' },
        { soru: 'Üyeliğimi dondurabilir miyim?', cevap: canli
          ? `Evet, üye panelinden. Bir seferde ${((AYAR.dondurma && AYAR.dondurma.gunler) || [7, 14]).join(' ya da ')} gün dondurabilirsin, yılda en çok ${(AYAR.dondurma && AYAR.dondurma.yillik) || 2} kez. Dondurduğun günler üyelik sürenden düşmez, bitiş tarihine eklenir.`
          : 'Evet, üye panelinden. Dondurduğun günler üyelik sürenden düşmez. [DONDURMA KURALI: en fazla kaç gün, kaç kez]' },
        { soru: 'Ne giymeli, yanımda ne getirmeliyim?', cevap: '[KULÜBÜN CEVABI]' },
        { soru: 'Arkadaşımı, çocuğumu ya da köpeğimi getirebilir miyim?', cevap: '[KULÜBÜN CEVABI]' },
        { soru: 'Kişisel verilerim ne olacak?', cevap: 'Bilgilerin yalnız kulüp işleri için kullanılır. Üye panelinden verilerinin kopyasını isteyebilir ya da hesabının silinmesini talep edebilirsin.' },
      ].filter((x) => !canli || !/\[[A-ZÇĞİÖŞÜ ]+/.test(x.cevap)),
      // Tanışma rezervasyonu: yalnız sunucunun açık dediği etkinlikler (24 saat kala, katılım kontenjanın yarısından azsa,
      // üyelere ücretsiz buluşma); önizlemede üyelere ücretsiz yaklaşanlar
      tEtkYok: !tumu.some((b) => b.tarih >= BUGUN && (canli ? b.tanisma : (!b.satis || b.satis.uye === 'ucretsiz'))),
      tEtkSecenek: tumu.filter((b) => b.tarih >= BUGUN && (canli ? b.tanisma : (!b.satis || b.satis.uye === 'ucretsiz'))).map((b) => {
        const on = `${b.tarih}|${b.ad}` === this.state.tEtk;
        return {
          ad: `${b.gun} ${b.ay} · ${b.ad} · ${b.saat}`, basili: on ? 'true' : 'false',
          stil: `text-align:left;font:600 15px Figtree,sans-serif;border-radius:10px;padding:10px 14px;min-height:44px;cursor:pointer;border:2px solid #111111;${on ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}`,
          sec: () => this.setState({ tEtk: `${b.tarih}|${b.ad}`, tHata: '' }),
        };
      }),
      tEtkYazi: (() => { const b = tumu.find((x) => `${x.tarih}|${x.ad}` === this.state.tEtk); return b ? `${b.ad} · ${b.gun} ${b.ay}` : ''; })(),
      tEtkTakvim: (() => { const b = tumu.find((x) => `${x.tarih}|${x.ad}` === this.state.tEtk); return b ? b.takvim : '#'; })(),
      ilt, yakindaVar: yakinda, tanismaSunuluyor: !yakinda && AYAR.tanisma_acik !== false,
      // Gerçek kod yalnız e-postayla gider (e-posta adresi böylece doğrulanmış olur)
      tKod: window.FCSTanisma ? 'E-POSTANDA' : 'FC-T-4821',
      tVerildiYazi: window.FCSTanisma ? 'Yerin ayrıldı; bilet kodunu e-postana gönderdik. Girişte kodunu göstermen yeterli. Mail gelmezse gereksiz klasörüne de bak.'
        : 'Yerin ayrıldı ve biletini e-postana da gönderdik. Girişte kodunu göstermen yeterli.',
      tanismaAcik: !!t, tForm: t === 'form', tVerildi: t === 'verildi', tUye: t === 'uye', tKullanilmis: t === 'kullanilmis',
      tAd: this.state.tAd, tEposta: this.state.tEposta, tOnay: this.state.tOnay, tHata: this.state.tHata,
      tRef: this.state.tRef || '', tNo: this.state.tNo || '', tTel: this.state.tTel || '',
      tRefYaz: (e) => this.setState({ tRef: e.target.value, tHata: '' }),
      tNoYaz: (e) => this.setState({ tNo: e.target.value, tHata: '' }),
      tTelYaz: (e) => this.setState({ tTel: e.target.value, tHata: '' }),
      tAdYaz: (e) => this.setState({ tAd: e.target.value, tHata: '' }),
      tEpostaYaz: (e) => this.setState({ tEposta: e.target.value, tHata: '' }),
      tOnayDegis: () => this.setState((s) => ({ tOnay: !s.tOnay, tHata: '' })),
      tanismaAc: () => this.setState({ tanisma: 'form', tHata: '' }),
      tanismaKapat: () => this.setState({ tanisma: '' }),
      tanismaUyeOl: () => {
        this.setState({ tanisma: '' });
        const hedef = document.getElementById('basvuru');
        if (hedef) hedef.scrollIntoView({ behavior: 'smooth' });
      },
      tanismaGonder: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const ep = this.state.tEposta.trim().toLowerCase();
        if (String(this.state.tRef || '').trim().length < 3) return this.setState({ tHata: 'Bileti veren kişinin adını ve soyadını yaz.' });
        if (this.state.tAd.trim().length < 3) return this.setState({ tHata: 'Adını ve soyadını yaz.' });
        if (String(this.state.tNo || '').trim().length < 3) return this.setState({ tHata: 'Tanışma bileti numarasını yaz.' });
        if (String(this.state.tTel || '').replace(/\D/g, '').length < 10) return this.setState({ tHata: 'Telefon numaranı yaz.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep)) return this.setState({ tHata: 'Geçerli bir e-posta yaz.' });
        if (!this.state.tEtk) return this.setState({ tHata: 'Geleceğin etkinliği seç.' });
        if (!this.state.tOnay) return this.setState({ tHata: 'Devam etmek için metinleri onayla.' });
        if (window.FCSTanisma) {  // deneme sitesi: kural sunucuda (üye mi, daha önce bilet aldı mı)
          this.setState({ tHata: 'Gönderiliyor…' });
          return window.FCSTanisma({ ad: this.state.tAd.trim(), eposta: ep, tel: this.state.tTel.trim(), referans: this.state.tRef.trim(), biletNo: this.state.tNo.trim() }, this.state.tEtk)
            .then((sonuc) => this.setState({ tanisma: sonuc, tHata: '' }))
            .catch((h) => this.setState({ tHata: h.message }));
        }
        this.setState({ tanisma: UYE_EPOSTA.includes(ep) ? 'uye' : BILETLI.includes(ep) ? 'kullanilmis' : 'verildi' });
      },
      // Tasarım önizlemesine özel notlar (örnek e-postalar, örnek fiyatlar) canlıda görünmez
      onizleme: !canli,
      // DESTEK OL: hazır tutarlar ya da elle; kart iyzico'ya gider (kart_odeme açıkken), yoksa IBAN
      destekAcik: !!this.state.destek, destekForm: this.state.destek === 'form',
      destekTamam: this.state.destek === 'tamam', destekBasarisiz: this.state.destek === 'hata',
      destekAc: () => this.setState({ destek: 'form', dsHata: '', dsKopya: '' }),
      destekKapat: () => this.setState({ destek: '' }),
      destekTekrar: () => this.setState({ destek: 'form', dsHata: '' }),
      destekTutarlar: [1000, 2500, 5000, 0].map((n) => ({
        ad: n ? TL(n) : 'Başka tutar',
        basili: (n ? !this.state.dsElle && this.state.dsTutar === n : this.state.dsElle) ? 'true' : 'false',
        sec: () => this.setState(n ? { dsTutar: n, dsElle: false, dsHata: '' } : { dsElle: true, dsHata: '' }),
      })),
      destekElle: this.state.dsElle, destekTutarYazi: this.state.dsTutarYazi, destekHata: this.state.dsHata,
      destekTutarYaz: (e) => this.setState({ dsTutarYazi: e.target.value, dsHata: '' }),
      destekKartKapali: kartAcik ? 'false' : 'true', destekKartKapaliMi: !kartAcik,
      destekKartStil: kartAcik ? 'width:100%' : 'width:100%;opacity:.45;cursor:not-allowed',
      destekKartYazi: kartAcik ? `Kartla öde · ${TL(destekTutar)}` : 'Kartla öde',
      destekKartla: () => {
        if (!kartAcik) return this.setState({ dsHata: 'Kartla ödeme çok yakında; şimdilik IBAN ile gönderebilirsin.' });
        if (!(destekTutar >= 50)) return this.setState({ dsHata: 'En az 50 TL yaz.' });
        if (destekTutar > 100000) return this.setState({ dsHata: 'En çok 100.000 TL gönderebilirsin.' });
        if (!window.FCSDestek) return this.setState({ dsHata: 'Önizleme: gerçek sitede iyzico ödeme sayfası açılır.' });
        this.setState({ dsHata: 'Ödeme sayfası açılıyor…' });
        window.FCSDestek(destekTutar).then((sayfa) => { location.href = sayfa; }).catch((h) => this.setState({ dsHata: h.message }));
      },
      aliciKopyaYazi: this.state.dsKopya === 'alici' ? 'Kopyalandı ✓' : 'Kopyala',
      ibanKopyaYazi: this.state.dsKopya === 'iban' ? 'Kopyalandı ✓' : 'Kopyala',
      aliciKopyala: () => kopyala('alici', odemeBilgi.alici),
      ibanKopyala: () => kopyala('iban', odemeBilgi.iban.replace(/\s/g, '')),
      // Üyelik metinleri ödeme yoluna göre (kart kapalıyken havale + dekont)
      kartliUyelik: kartAcik,
      uyelikMetin: kartAcik
        ? 'Üyeliğin, kartla ödemeni yaptığın anda başlar ve 30 gün geçerlidir. Otomatik ücret çekilmez; devam etmek istediğinde yeni dönemi ödersin. Süren bitmeden yenilersen yeni dönem bitiş tarihinden başlar.'
        : 'Üyeliğin, ödemen onaylandığında başlar ve 30 gün geçerlidir. Otomatik ücret çekilmez; devam etmek istediğinde yeni dönemi ödersin. Süren bitmeden yenilersen yeni dönem bitiş tarihinden başlar.',
      katilMetin: kartAcik
        ? 'Bilgilerini yaz, kartla öde; üyeliğin hemen başlar ve e-postayla haber veririz.'
        : 'Bilgilerini yaz, aidatı havale / EFT ile gönder ve dekontunu yükle; onaylanınca üyeliğin başlar ve e-postayla haber veririz.',
      uyeFormda: this.state.uyeAdim === 'form',
      uyeOdemede: this.state.uyeAdim === 'odeme',
      uyeTamam: this.state.uyeAdim === 'tamam',
      bAd: this.state.bAd, bTel: this.state.bTel, bEposta: this.state.bEposta, bHata: this.state.bHata,
      bKosul: this.state.bKosul, bDogal: this.state.bDogal, bKvkk: this.state.bKvkk,
      bAdYaz: (e) => this.setState({ bAd: e.target.value, bHata: '' }),
      bTelYaz: (e) => this.setState({ bTel: e.target.value, bHata: '' }),
      bEpostaYaz: (e) => this.setState({ bEposta: e.target.value, bHata: '' }),
      bKosulDegis: () => this.setState((s) => ({ bKosul: !s.bKosul, bHata: '' })),
      bFoto: this.state.bFoto, bFotoDegis: () => this.setState((s) => ({ bFoto: !s.bFoto })),
      odeme: odemeBilgi,
      dHata: this.state.dHata,
      dekontSec: (e) => { const f = e.target.files && e.target.files[0]; this.setState({ dDosya: f || null, dHata: '' }); },
      dekontGonder: () => {
        if (!this.state.dDosya) return this.setState({ dHata: 'Dekont dosyasını seç.' });
        this.setState({ dHata: 'Yükleniyor…' });
        window.FCSDekont(this.state.bEposta, this.state.dDosya)
          .then(() => this.setState({ uyeAdim: 'tamam', dekontGitti: true, dHata: '' }))
          .catch((h) => this.setState({ dHata: h.message }));
      },
      dekontSonra: () => this.setState({ uyeAdim: 'tamam', dekontGitti: false }),
      uyeTamamMetin: this.state.dekontGitti
        ? 'Teşekkürler! Başvurun ve dekontun bize ulaştı. Ödemen onaylanınca üyeliğin başlayacak; e-posta ile haber vereceğiz.'
        : 'Teşekkürler! Başvurun bize ulaştı. Ödemeyi yaptıktan sonra dekontunu dekont sayfasından iletebilirsin; onaylanınca üyeliğin başlar.',
      bDogalDegis: () => this.setState((s) => ({ bDogal: !s.bDogal, bHata: '' })),
      bKvkkDegis: () => this.setState((s) => ({ bKvkk: !s.bKvkk, bHata: '' })),
      uyeOdemeye: (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (yakinda) return this.setState({ bHata: YAKINDA_MESAJ });
        if (!window.FCSBasvuru) return this.setState({ uyeAdim: 'odeme' });
        const { bAd, bTel, bEposta, bKosul, bDogal, bKvkk } = this.state;
        this.setState({ bHata: 'Gönderiliyor…' });
        // Deneme sitesi: başvuru veritabanına yazılır (yönetici panelinde "Hiç ödemedi" olarak görünür)
        window.FCSBasvuru(bAd, bEposta, bTel, bKosul, bDogal, bKvkk, this.state.bFoto)
          .then((sonuc) => this.setState(sonuc === 'kayitli'
            ? { bHata: 'Bu e-postayla zaten bir kaydın var. Üye girişinden gir ya da bize yaz.' }
            : { uyeAdim: 'odeme', bHata: '' }))
          .catch((h) => this.setState({ bHata: h.message }));
      },
      uyeGeri: () => this.setState({ uyeAdim: 'form' }),
      uyeOde: () => this.setState({ uyeAdim: 'tamam' }),
      uyeBasarisiz: this.state.uyeAdim === 'hata',
      uyeHata: () => this.setState({ uyeAdim: 'hata' }),
      uyeTekrar: () => this.setState({ uyeAdim: 'odeme' }),
      cagriAdimlar,
      cagriGitti: this.state.cagriGitti,
      cagriKvkk: this.state.cagriKvkk, cagriHata: this.state.cagriHata,
      cagriKvkkDegis: () => this.setState((st) => ({ cagriKvkk: !st.cagriKvkk, cagriHata: '' })),
      cagriGonder: () => {
        if (!window.FCSCagri) return this.setState({ cagriGitti: true });
        if (!this.state.cagriKvkk) return this.setState({ cagriHata: 'Göndermek için KVKK metnini onayla.' });
        const uyeOl = secim.uye === 'Hayır' && secim.uyeOl === 'Evet, üye olmak istiyorum';
        if (uyeOl && !(cv.uyeKosul && cv.uyeDogal)) return this.setState({ cagriHata: 'Üyelik için koşullar ve doğal alan beyanını onayla.' });
        const liste = (x) => (Array.isArray(x) ? x.join(', ') : x || '');
        this.setState({ cagriHata: 'Gönderiliyor…' });
        window.FCSCagri({
          ad: cv.ad, iletisim: cv.iletisim, uye: secim.uye || '', alan: liste(secim.alan), baslik: cv.baslik, anlat: cv.anlat,
          deneyim: secim.deneyim || '', sure: secim.sure || '', kisi: secim.kisi || '', ihtiyac: cv.ihtiyac, gunler: liste(secim.gun),
          uyeOl, uyeEposta: cv.uyeEposta, uyeTelefon: cv.uyeTelefon, uyeFoto: !!cv.uyeFoto,
        }).then(() => this.setState({ cagriGitti: true, cagriHata: '' })).catch((h) => this.setState({ cagriHata: h.message }));
      },
      cagriAcik: this.state.cagriAcik,
      modalSinif: this.state.cagriAdim === 'afis' ? 'fs-modal fs-modal-afis' : 'fs-modal',
      cagriAfis: this.state.cagriAdim === 'afis',
      cagriFormda: this.state.cagriAdim === 'form',
      cagriAc: () => this.setState({ cagriAcik: true, cagriAdim: 'afis' }),
      cagriKapat: () => this.setState({ cagriAcik: false }),
      cagriForm: () => this.setState({ cagriAdim: 'form' }),
      cagriAfiseDon: () => this.setState({ cagriAdim: 'afis' }),
      yuzenSinif: acik ? 'fs-yuzen fs-yuzen-acik' : 'fs-yuzen',
      aylikRozetStil: `background:${window.FC_AYLIK ? window.FC_AYLIK.renkKodu(AYLIK.renk) : '#F6C945'};color:#111111`,
      aylikGoster: AYLIK.goster !== false, aylikAy: AYLIK.ay, aylikUst: ayDoldur(AYLIK.ust), aylikAna: ayDoldur(AYLIK.ana), aylikAltYazi: ayDoldur(AYLIK.alt),
      aylikResim: AYLIK.resim || '', aylikAlt: `${ayDoldur(AYLIK.ana)} ${ayDoldur(AYLIK.ust)}`.trim(),
      cagriOzelAfis: AYLIK.tur === 'cagri' && !!AYLIK.resim, cagriHazirAfis: !(AYLIK.tur === 'cagri' && AYLIK.resim),
      aylikTikla: () => {
        if (AYLIK.tur === 'form' && AYLIK.formId) { location.href = `/form/?id=${encodeURIComponent(AYLIK.formId)}`; return; }
        if (AYLIK.tur === 'resim' && AYLIK.resim) { this.setState({ afisTam: AYLIK.resim, afisTamAlt: `${ayDoldur(AYLIK.ana)} ${ayDoldur(AYLIK.ust)}`.trim() }); return; }
        if (AYLIK.tur === 'cagri') this.setState({ cagriAcik: true, cagriAdim: 'afis' });
      },
      afisTamVar: !!this.state.afisTam, afisTam: this.state.afisTam || '', afisTamAlt: this.state.afisTamAlt || 'Afiş',
      afisKapat: () => this.setState({ afisTam: '' }),
      yuzenGizli: acik ? 'false' : 'true',
      basaDon: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      yuzenKapat: () => this.setState({ kapali: true }),
      ozellikler: [
        { ad: 'Breakfast Club', metin: 'Her ay ağaçların altında kahvaltı buluşması' },
        { ad: 'Sunset Club', metin: 'Her ay gün batımında müzik ve sohbet' },
        { ad: 'Atölyeler', metin: 'Seramik ve özel atölyeler; üyelere %50 indirim' },
        { ad: 'Hareket', metin: 'Yoga, Tai Chi ve farkındalık çalışmaları' },
      ],
      filtreler,
      yaklasanlar: (tur === 'tumu' ? tumu : tumu.filter((b) => b.tur === tur)).filter((b) => b.tarih >= BUGUN).map((b) => {
        // Bilet satılmayan etkinlik üyelere ücretsiz (üye panelinden "Geliyorum")
        if (!b.satis) return { ...b, fiyatYazi: canli ? 'Üyelere ücretsiz' : '', uyeYazi: canli ? 'Üye panelinden yerini ayırt' : '', kalanYazi: '', kalanStil: '', dolu: true, dugme: canli ? 'Yalnız üyeler' : 'Yakında satışta', dugmeStil: 'opacity:.5;cursor:default', sepeteEkle: () => {} };
        if (yakinda) return { ...b, fiyatYazi: TL(b.satis.fiyat), uyeYazi: b.satis.uye === 'ucretsiz' ? 'Üyelere ücretsiz' : '', kalanYazi: '', kalanStil: '', dolu: true, dugme: 'Açılışta satışta', dugmeStil: 'opacity:.5;cursor:default', sepeteEkle: () => {} };
        const key = `${b.tarih}|${b.ad}`;
        const kalan = kalanYer(b);
        const sepette = sepet[key] || 0;
        return {
          ...b,
          fiyatYazi: TL(b.satis.fiyat),
          uyeYazi: b.satis.uye === 'ucretsiz' ? 'Üyelere ücretsiz' : b.satis.uye === 'yuzde50' ? `Üyelere %50 · ${TL(uyeFiyati(b))}` : 'Üyelere de aynı fiyat',
          kalanYazi: kalan <= 0 ? 'Tükendi' : kalan <= 5 ? `Son ${kalan} yer!` : `${kalan} yer kaldı`,
          kalanStil: `font-size:13px;font-weight:700;color:${kalan <= 5 ? '#82301F' : '#5E5E5E'}`,
          dolu: kalan <= sepette,
          dugme: kalan <= 0 ? 'Tükendi' : sepette ? `Randevuda ${sepette} kişi · bir kişi daha` : 'Randevu oluştur',
          dugmeStil: kalan <= sepette ? 'opacity:.5;cursor:default' : '',
          sepeteEkle: () => { if (kalan > sepette) adetDegis(key, 1, kalan); },
        };
      }),
      // Geçmiş: en yakın tarihten en eskiye
      gecmisler: (tur === 'tumu' ? tumu : tumu.filter((b) => b.tur === tur)).filter((b) => b.tarih < BUGUN).reverse().slice(0, this.state.gecmisTumu ? undefined : 3),
      gecmisDahaVar: !this.state.gecmisTumu && (tur === 'tumu' ? tumu : tumu.filter((b) => b.tur === tur)).filter((b) => b.tarih < BUGUN).length > 3,
      gecmisDugme: `Tüm geçmiş etkinlikler (${(tur === 'tumu' ? tumu : tumu.filter((b) => b.tur === tur)).filter((b) => b.tarih < BUGUN).length})`,
      gecmisAc: () => this.setState({ gecmisTumu: true }),
      yaklasanYok: !(tur === 'tumu' ? tumu : tumu.filter((b) => b.tur === tur)).some((b) => b.tarih >= BUGUN),
      yaklasanYokYazi: window.FCS_HATA ? 'Etkinlikler şu an yüklenemiyor. Biraz sonra sayfayı yenile; Instagram ve WhatsApp topluluğundan da takip edebilirsin.'
        : 'Yeni etkinlikler yakında duyurulacak. Instagram ve WhatsApp topluluğunu takipte kal.',
      aidatYazi: `${Number(AYAR.aidat || 3000).toLocaleString('tr-TR')} TL`,
      ...(() => {
        // Gönüllü ol formu
        const gn = { ad: '', eposta: '', tel: '', not: '', kvkk: false, alanlar: [], ...(this.state.gn || {}) };
        const degis = (alan, v) => this.setState((st) => ({ gn: { ...(st.gn || {}), [alan]: v }, gnHata: '' }));
        const ALANLAR = ['Kurulum ve toplama', 'Mutfak / ikram', 'Karşılama', 'Fotoğraf / video', 'Müzik / ses', 'Atölye yardımı'];
        return {
          gn, gnFormda: !this.state.gnGitti, gnGitti: !!this.state.gnGitti, gnHata: this.state.gnHata || '',
          gnYaz: Object.fromEntries(['ad', 'eposta', 'tel', 'not'].map((k) => [k, (e) => degis(k, e.target.value)])),
          gnKvkkDegis: () => degis('kvkk', !gn.kvkk),
          gnAlanlar: ALANLAR.map((a) => {
            const on = gn.alanlar.includes(a);
            return { ad: a, basili: on ? 'true' : 'false', sec: () => degis('alanlar', on ? gn.alanlar.filter((x) => x !== a) : [...gn.alanlar, a]),
              stil: `font:600 14px Figtree,sans-serif;border:2px solid #111111;border-radius:999px;padding:8px 14px;min-height:40px;cursor:pointer;${on ? 'background:#111111;color:#FFFFFF' : 'background:#FFFFFF;color:#111111'}` };
          }),
          gnGonder: () => {
            if (String(gn.ad).trim().length < 3) return this.setState({ gnHata: 'Adını ve soyadını yaz.' });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(gn.eposta).trim())) return this.setState({ gnHata: 'Geçerli bir e-posta yaz.' });
            if (!gn.kvkk) return this.setState({ gnHata: 'Devam etmek için KVKK metnini onayla.' });
            if (!window.FCSGonullu) return this.setState({ gnGitti: true });
            this.setState({ gnHata: 'Gönderiliyor…' });
            window.FCSGonullu({ ad: gn.ad.trim(), eposta: gn.eposta.trim(), tel: gn.tel.trim(), not: gn.not.trim(), alanlar: gn.alanlar, kvkk: true })
              .then(() => this.setState({ gnGitti: true, gnHata: '' }), (h) => this.setState({ gnHata: h.message }));
          },
        };
      })(),
      haklar: [
        'Breakfast buluşması',
        'Sunset buluşması',
        'Topluluğa özel buluşmalar',
        'Özel atölyelerde %50 indirim',
      ],
    };
  }
}
return Component;
});
