// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/dekont.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/dekont.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { eposta: '', dosya: null, hata: '', gitti: false };
  }
  renderVals() {
    return {
      formda: !this.state.gitti, gitti: this.state.gitti, eposta: this.state.eposta, hata: this.state.hata,
      odeme: (window.FC_AYAR && window.FC_AYAR.odeme) || { tutar: '3.000 TL', alici: '', iban: '' },
      epostaYaz: (e) => this.setState({ eposta: e.target.value, hata: '' }),
      dosyaSec: (e) => { const f = e.target.files && e.target.files[0]; this.setState({ dosya: f || null, hata: '' }); },
      gonder: () => {
        this.setState({ hata: 'Yükleniyor…' });
        window.FCSDekont(this.state.eposta, this.state.dosya)
          .then(() => this.setState({ gitti: true, hata: '' }))
          .catch((h) => this.setState({ hata: h.message }));
      },
    };
  }
}
return Component;
});
