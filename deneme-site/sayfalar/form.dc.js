// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/form.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/form.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Canlıda veri form.js'ten (window.FCF); önizlemede örnek form
    const F = window.FCF || { durum: 'form', form: { id: 1, baslik: 'Kasım ayı önerileri', aciklama: 'Kasım buluşmaları için fikirlerini merak ediyoruz.', sorular: [
      { id: 's1', metin: 'Hangi buluşmalara katılmak istersin?', tur: 'coklu', secenekler: ['Breakfast Club', 'Sunset Club', 'Yoga', 'Atölye'], zorunlu: true },
      { id: 's2', metin: 'Hangi gün sana uygun?', tur: 'tek', secenekler: ['Cumartesi', 'Pazar'], zorunlu: true },
      { id: 's3', metin: 'Önerdiğin etkinlik', tur: 'kisa' },
      { id: 's4', metin: 'Eklemek istediğin bir şey var mı?', tur: 'uzun' },
    ] }, cevaplar: {} };
    this.F = F;
    this.state = { cevaplar: { ...(F.cevaplar || {}) }, kimlik: { ad: '', eposta: '' }, hata: '', gitti: false };
  }
  renderVals() {
    const F = this.F;
    const c = this.state.cevaplar;
    const formda = F.durum === 'form' && !this.state.gitti;
    const sorular = ((F.form && F.form.sorular) || []).map((s) => {
      const coklu = s.tur === 'coklu';
      const secili = coklu ? (Array.isArray(c[s.id]) ? c[s.id] : []) : c[s.id];
      return {
        id: s.id, metin: s.metin, yildiz: s.zorunlu ? ' *' : '',
        kisa: s.tur === 'kisa', uzun: s.tur === 'uzun', secimli: s.tur === 'tek' || coklu, girdi: coklu ? 'checkbox' : 'radio',
        deger: typeof c[s.id] === 'string' ? c[s.id] : '',
        yaz: (e) => { const v = e.target.value; this.setState((st) => ({ cevaplar: { ...st.cevaplar, [s.id]: v }, hata: '' })); },
        secenekler: (s.secenekler || []).map((o) => ({
          ad: o, secili: coklu ? secili.includes(o) : secili === o,
          sec: () => this.setState((st) => {
            if (!coklu) return { cevaplar: { ...st.cevaplar, [s.id]: o }, hata: '' };
            const eski = Array.isArray(st.cevaplar[s.id]) ? st.cevaplar[s.id] : [];
            return { cevaplar: { ...st.cevaplar, [s.id]: eski.includes(o) ? eski.filter((x) => x !== o) : [...eski, o] }, hata: '' };
          }),
        })),
      };
    });
    return {
      girisYok: F.durum === 'giris', girisLink: '/uye', kapali: F.durum === 'kapali', formda, gitti: this.state.gitti,
      // Özel form: girişsiz, ad + e-postayla; dönüş ana sayfaya
      ozel: !!F.ozel, kimlik: this.state.kimlik,
      adYaz: (e) => { const v = e.target.value; this.setState((st) => ({ kimlik: { ...st.kimlik, ad: v }, hata: '' })); },
      epostaYaz: (e) => { const v = e.target.value; this.setState((st) => ({ kimlik: { ...st.kimlik, eposta: v }, hata: '' })); },
      kapaliYazi: F.ozel ? 'Bu form şu an cevap almıyor ya da bağlantı hatalı.' : 'Bu form şu an cevap almıyor. Üye panelinde açık formları görebilirsin.',
      donLink: F.ozel ? '/' : '/uye', donYazi: F.ozel ? 'Ana sayfaya dön' : 'Üye paneline dön',
      baslik: F.form ? F.form.baslik : '', aciklama: F.form ? F.form.aciklama || '' : '', aciklamaVar: !!(F.form && F.form.aciklama),
      dahaOnce: !!F.dahaOnce, sorular, hata: this.state.hata, gonderYazi: F.dahaOnce ? 'Cevaplarımı güncelle' : 'Gönder',
      duzelt: () => this.setState({ gitti: false }),
      gonder: () => {
        const k = this.state.kimlik;
        if (F.ozel && k.ad.trim().length < 3) return this.setState({ hata: 'Adını ve soyadını yaz.' });
        if (F.ozel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k.eposta.trim())) return this.setState({ hata: 'Geçerli bir e-posta yaz.' });
        const eksik = F.form.sorular.find((s) => s.zorunlu && (s.tur === 'coklu' ? !(Array.isArray(c[s.id]) && c[s.id].length) : !String(c[s.id] || '').trim()));
        if (eksik) return this.setState({ hata: `"${eksik.metin}" sorusunu cevapla.` });
        if (!window.FCFGonder) return this.setState({ gitti: true, hata: '' });
        this.setState({ hata: 'Gönderiliyor…' });
        window.FCFGonder(c, { ad: k.ad.trim(), eposta: k.eposta.trim().toLowerCase() }).then(() => { F.dahaOnce = true; this.setState({ gitti: true, hata: '' }); }).catch((h) => this.setState({ hata: h.message }));
      },
    };
  }
}
return Component;
});
