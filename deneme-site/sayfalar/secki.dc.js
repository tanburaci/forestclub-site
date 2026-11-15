// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/secki.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/secki.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { adim: 'secim', sec: {}, yol: '', ad: '', eposta: '', tel: '', kvkk: false, uye: false, hata: '', siparis: null, dosya: null };
  }
  componentDidMount() {
    const u = window.FCSecki && window.FCSecki.uye;
    if (u && u.ad && u.eposta) this.setState({ ad: u.ad, eposta: u.eposta, tel: u.tel || '', kvkk: true, uye: true });
  }
  componentWillUnmount() { clearInterval(this.takipNo); }
  // Shopier penceresindeki ödemeyi bekler: 4 sn'de bir sorulur, en çok 30 dk
  takip(id, eposta) {
    clearInterval(this.takipNo);
    const bas = Date.now();
    this.takipNo = setInterval(() => {
      if (Date.now() - bas > 30 * 60 * 1000 || !window.FCSUrunDurum) { clearInterval(this.takipNo); return; }
      window.FCSUrunDurum(id, eposta).then((d) => {
        if (d === 'onaylandi') { clearInterval(this.takipNo); this.setState({ adim: 'tamam', hata: '' }); }
        if (d === 'reddedildi') { clearInterval(this.takipNo); this.setState({ hata: 'Ödemen siparişle eşleşmedi; ücretin iade edilecek. Ayrıntı e-postanda.' }); }
      }, () => {});
    }, 4000);
  }
  renderVals() {
    const V = window.FCSecki || { urunler: [{ id: 1, ad: 'Yelpaze', aciklama: 'Örnek açıklama.', fiyat: 1500, foto: null, kalan: 6 }, { id: 2, ad: 'Yelpaze 2', fiyat: 2000, foto: null, kalan: 2 }], kartAcik: true };
    const liste = V.urunler || [];
    const kartAcik = !!V.kartAcik;
    const st = this.state;
    const sec = st.sec || {};
    // Fiyat: binlik noktalı, kuruşsuz, "₺" (sade; ",99" ya da "1500.00 TL" yok)
    const TL = (n) => `${Math.round(Number(n)).toLocaleString('tr-TR')} ₺`;
    const toplam = liste.reduce((t, u) => t + (sec[u.id] || 0) * Number(u.fiyat), 0);
    const yol = st.yol || (kartAcik ? 'kart' : '');
    const sip = st.siparis || {};
    // Stok: "kalan" (null = sınırsız); en çok 20 ve kalan kadar
    const sinir = (id) => { const u = liste.find((x) => x.id === id); const k = u && u.kalan != null ? Math.floor(Number(u.kalan)) : 20; return Math.min(20, k); };
    const degis = (id, d) => this.setState((s) => {
      const eski = (s.sec || {})[id] || 0;
      return { sec: { ...(s.sec || {}), [id]: Math.max(0, Math.min(sinir(id), eski + d)) }, hata: '' };
    });
    const YOLLAR = [
      { id: 'kart', ad: 'Kredi / banka kartı', alt: kartAcik ? 'Shopier\'in güvenli ödeme sayfasında' : 'Şu an kapalı', kapali: !kartAcik },
      { id: 'havale', ad: 'Havale / EFT', alt: 'IBAN\'a gönder, dekontunu yükle' },
    ];
    const TAMAM = {
      kart: ['Teşekkürler', 'Ödemen alındı. Ürününü bir sonraki buluşmada, Pinya\'da bu kodla teslim alırsın. Onay e-postana da gönderildi.'],
      havale: ['Teşekkürler', 'Dekontun bize ulaştı. Onaylanınca e-postana bilgi gelir; ürününü bir sonraki buluşmada, Pinya\'da bu kodla teslim alırsın.'],
    };
    const [tamamBaslik, tamamYazi] = TAMAM[sip.yol] || TAMAM.havale;
    const satilabilir = liste.some((u) => sinir(u.id) > 0);
    const odeme = (window.FC_AYAR && window.FC_AYAR.odeme) || { alici: '', iban: '' };
    return {
      bos: !liste.length && st.adim === 'secim',
      secimde: st.adim === 'secim' && liste.length > 0, dekontta: st.adim === 'dekont', kartBekle: st.adim === 'kart', tamam: st.adim === 'tamam',
      formVar: satilabilir,
      urunler: liste.map((u) => {
        const n = sinir(u.id);
        const kalan = u.kalan != null ? Math.floor(Number(u.kalan)) : null;
        return {
          ad: u.ad, foto: u.foto || '', fotoVar: !!u.foto, fotoYok: !u.foto, aciklama: u.aciklama || '', aciklamaVar: !!u.aciklama,
          fiyatYazi: TL(u.fiyat), adet: String(sec[u.id] || 0), satilir: n > 0,
          stokYazi: n <= 0 ? 'Bu seri tamamlandı.' : (kalan != null && kalan <= 5 ? `Bu seriden ${kalan} adet kaldı.` : ''),
          azaltKapali: !(sec[u.id] > 0), arttirKapali: (sec[u.id] || 0) >= n,
          azalt: () => degis(u.id, -1), arttir: () => degis(u.id, 1), azaltEtiket: `${u.ad} adedini azalt`, arttirEtiket: `${u.ad} adedini arttır`,
        };
      }),
      ad: st.ad, eposta: st.eposta, tel: st.tel, kvkk: !!st.kvkk, hata: st.hata,
      uyeOzet: !!st.uye, alanlar: !st.uye, uyeYazi: [st.ad, st.eposta, st.tel].filter(Boolean).join(' · '),
      uyeDegistir: () => this.setState({ uye: false }),
      adYaz: (e) => this.setState({ ad: e.target.value, hata: '' }),
      epostaYaz: (e) => this.setState({ eposta: e.target.value, hata: '' }),
      telYaz: (e) => this.setState({ tel: e.target.value, hata: '' }),
      kvkkDegis: () => this.setState((s) => ({ kvkk: !s.kvkk, hata: '' })),
      yollar: YOLLAR.map((y) => ({
        ...y, secili: yol === y.id ? 'true' : 'false', kapaliYazi: y.kapali ? 'true' : 'false', isaret: yol === y.id ? '●' : '○',
        sec: () => { if (!y.kapali) this.setState({ yol: y.id, hata: '' }); },
      })),
      dugme: toplam ? `Siparişi ver · ${TL(toplam)}` : 'Ürün seç',
      gonder: () => {
        if (/…$/.test(st.hata || '')) return;  // gönderim sürüyor: çift tıklama ikinci sipariş açmasın
        const kalemler = liste.filter((u) => sec[u.id] > 0).map((u) => ({ urun: u.id, adet: sec[u.id] }));
        const ad = (st.ad || '').trim();
        const eposta = (st.eposta || '').trim();
        const tel = (st.tel || '').trim();
        if (!kalemler.length) return this.setState({ hata: 'En az bir ürün seç.' });
        if (!ad) return this.setState({ hata: 'Adını yaz.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return this.setState({ hata: 'Geçerli bir e-posta yaz.' });
        if (tel.replace(/\D/g, '').length < 10) return this.setState({ hata: 'Telefon numaranı yaz.' });
        if (!yol) return this.setState({ hata: 'Ödeme yöntemini seç.' });
        if (!st.kvkk) return this.setState({ hata: 'Devam etmek için KVKK metnini onayla.' });
        if (!window.FCSUrunSiparis) return this.setState({ hata: 'Önizleme: gerçek sitede sipariş burada verilir.' });
        // Kart: pencere tıklama anında açılır (sonra açılırsa tarayıcı engeller), adres sunucudan gelince yüklenir
        let pencere = null;
        if (yol === 'kart') {
          try { pencere = window.open('', 'shopier-odeme', 'popup=yes,width=520,height=780'); } catch (e) { pencere = null; }
        }
        this.setState({ hata: 'Gönderiliyor…' });
        window.FCSUrunSiparis({ secki: true, kalemler, ad, eposta, tel, yol, kvkk: true }).then((s) => {
          if (s.yol === 'kart' && /^https:\/\//.test(s.sayfa || '')) {
            if (pencere && !pencere.closed) pencere.location.href = s.sayfa;
            this.setState({ adim: 'kart', siparis: s, sayfa: s.sayfa, pencereYok: !pencere || pencere.closed, hata: '', sec: {} });
            this.takip(s.id, eposta);
            return;
          }
          if (pencere && !pencere.closed) pencere.close();
          this.setState({ adim: 'dekont', siparis: s, hata: '', sec: {} });
        }).catch((h) => { if (pencere && !pencere.closed) pencere.close(); this.setState({ hata: h.message }); });
      },
      kod: sip.kod || '', tutarYazi: sip.tutar ? TL(sip.tutar) : '', tamamBaslik, tamamYazi,
      sayfa: st.sayfa || '#', pencereYazi: st.pencereYok ? "Shopier'de öde" : 'Ödeme penceresini yeniden aç',
      odemeAlici: odeme.alici, odemeIban: odeme.iban,
      dekontSec: (e) => this.setState({ dosya: (e.target.files && e.target.files[0]) || null, hata: '' }),
      dekontGonder: () => {
        if (/…$/.test(st.hata || '')) return;
        const kutu = document.querySelector('.sk-form input[type="file"]');
        const dosya = st.dosya || (kutu && kutu.files && kutu.files[0]) || null;
        if (!dosya) return this.setState({ hata: 'Dekontu seç.' });
        this.setState({ hata: 'Yükleniyor…' });
        window.FCSUrunDekont(sip, st.eposta, dosya).then(() => this.setState({ adim: 'tamam', dosya: null, hata: '' }), (h) => this.setState({ hata: h.message }));
      },
      // Bitince liste yeniden (kalan stok güncel olsun)
      yeni: () => { clearInterval(this.takipNo); location.reload(); },
    };
  }
}
return Component;
});
