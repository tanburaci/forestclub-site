// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/acik-cagri.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/acik-cagri.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { cv: {}, secim: {}, cagriKvkk: false, cagriHata: '', cagriGitti: false };
  }
  renderVals() {
    // Seçenek düğmeleri (tek seçim / çoklu seçim)
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
        secimAlani('gun', 'Hangi günler uygunsun?', ['Hafta içi sabah', 'Hafta içi öğleden sonra', 'Hafta içi akşam', 'Cumartesi', 'Pazar'], true),
      ] },
    ];
    return {
      formda: !this.state.cagriGitti,
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
    };
  }
}
return Component;
});
