// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/dugun.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/dugun.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Canlıda katalog js/dugun.js'ten (window.FCD); önizlemede örnek
    const D = window.FCD || { bugun: '2026-11-01', katalog: [
      { id: 1, tur: 'mekan', ad: 'Pinya, Urla', aciklama: 'Zeytin ağaçları ve çam gölgesinde.', resim: '/dugun/cizim/mekan.svg', yemek_mekandan: true },
      { id: 2, tur: 'bolum', ad: 'Nikah töreni', resim: '/dugun/cizim/kemer.svg' }, { id: 3, tur: 'bolum', ad: 'Kokteyl', resim: '/dugun/cizim/kokteyl.svg' },
      { id: 4, tur: 'konsept', ad: 'Kır sofrası', aciklama: 'Keten, kır çiçekleri, ahşap.', resim: '/dugun/cizim/konsept-kir.svg' },
      { id: 5, tur: 'konsept', ad: 'Işıklı gece', aciklama: 'Mumlar ve ampul zincirleri.', resim: '/dugun/cizim/konsept-gece.svg' },
      { id: 6, tur: 'urun', ad: 'Doğal keten', grup: 'Örtü' }, { id: 7, tur: 'urun', ad: 'Kır çiçekleri', grup: 'Çiçek' },
      { id: 8, tur: 'ekstra', ad: 'Fotoğraf ve video', resim: '/dugun/cizim/foto.svg' },
    ] };
    this.D = D;
    const mekanlar = D.katalog.filter((k) => k.tur === 'mekan');
    this.state = {
      adim: 1, hata: '', gitti: false, gonderiliyor: false, acikGrup: {},
      v: { tarih: '', tarihEsnek: false, kisi: '', mekan: mekanlar.length === 1 ? mekanlar[0].id : null, bolumler: [], menu: null, konsept: null, urunler: [], ekstralar: [],
        ad: '', eposta: '', tel: '', not: '', kvkk: false },
    };
  }
  renderVals() {
    const D = this.D;
    const { adim, v } = this.state;
    const K = (tur) => D.katalog.filter((k) => k.tur === tur);
    const deg = (d) => this.setState((s) => ({ v: { ...s.v, ...d }, hata: '' }));
    const ac = (dizi, id) => (dizi.includes(id) ? dizi.filter((x) => x !== id) : [...dizi, id]);
    // Ortak katalog ayarı (js/ayar.js); önizlemede yoksa basit yedek
    const FD = window.FC_DUGUN || { resim: (k) => k.resim || '/dugun/cizim/mekan.svg', alanMi: () => false, sirala: (g) => g, cizim: {} };
    const kart = (k, secili, sec) => ({ ...k, resim: FD.resim(k), aciklama: k.aciklama || '', secili: secili ? 'true' : 'false',
      sinif: secili ? 'dg-sec secili' : 'dg-sec', sec });
    const KISI = [['50den_az', '50 kişiden az'], ['50_100', '50–100'], ['100_150', '100–150'], ['150den_fazla', '150+'], ['bilmiyorum', 'Henüz bilmiyorum']];
    const ADIMLAR = [
      ['Tarih ve misafirler', 'Kesin değilse sorun değil; yaklaşık bir fikir yeterli.'],
      ['Mekan ve akış', 'Düğününüz nerede olsun, gün nasıl aksın?'],
      ['Menü tercihi', 'İsterseniz bu adımı atlayabilirsiniz.'],
      ['Masalarınız', 'Bir konsept seçin; dilerseniz ayrıntılarını değiştirin.'],
      ['Alan ve dekor', 'Nikah alanı, karşılama, oturma köşeleri ve ışıklar. İsteğe bağlı.'],
      ['Ekstralar', 'Düğününüzü tamamlayacak dokunuşlar.'],
      ['Son adım', 'Bilgilerinizi bırakın; size özel teklifimizle dönelim.'],
    ];
    const mekan = K('mekan').find((m) => m.id === v.mekan);
    const menuler = K('menu').filter((m) => !m.mekan_id || m.mekan_id === v.mekan);
    const ad = (id) => (D.katalog.find((k) => k.id === id) || {}).ad;
    const gruplar = FD.sirala([...new Set(K('urun').map((u) => u.grup || 'Diğer'))]);
    const urunSecili = v.urunler;
    const grupKart = (g) => {
      const urunler = K('urun').filter((u) => (u.grup || 'Diğer') === g);
      const secilen = urunler.filter((u) => v.urunler.includes(u.id)).length;
      const acik = !!this.state.acikGrup[g];
      return {
        ad: g, resim: FD.resim({ tur: 'urun', grup: g }), acik, acikYazi: acik ? 'true' : 'false', ok: acik ? '▴' : '▾', sayi: secilen ? `${secilen} seçili` : '',
        ac: () => this.setState((s) => ({ acikGrup: { ...s.acikGrup, [g]: !s.acikGrup[g] } })),
        urunler: urunler.map((u) => {
          const sec = v.urunler.includes(u.id);
          return { ad: u.ad, secili: sec ? 'true' : 'false', sinif: sec ? 'dg-hap secili' : 'dg-hap', foto: !!u.resim && !u.resim.startsWith('/dugun/cizim/'), resim: u.resim,
            sec: () => deg({ urunler: ac(v.urunler, u.id) }) };
        }),
      };
    };
    const urunAd = (g) => K('urun').filter((u) => (u.grup || 'Diğer') === g && v.urunler.includes(u.id)).map((u) => u.ad).join(', ');
    const ozet = [
      ['Tarih', v.tarihEsnek || !v.tarih ? 'Henüz belli değil' : v.tarih.split('-').reverse().join('.')],
      ['Misafir', (KISI.find((k) => k[0] === v.kisi) || [0, '—'])[1]],
      ['Mekan', mekan ? mekan.ad : '—'],
      ['Akış', v.bolumler.map(ad).join(', ') || '—'],
      ['Menü', v.menu ? ad(v.menu) : 'Mekanın menüsü, sonra konuşuruz'],
      ['Masa konsepti', v.konsept ? ad(v.konsept) : 'Birlikte seçelim'],
      ['Masa ayrıntıları', gruplar.filter((g) => !FD.alanMi(g)).map((g) => (urunAd(g) ? `${g}: ${urunAd(g)}` : '')).filter(Boolean).join(' · ') || '—'],
      ['Alan ve dekor', gruplar.filter((g) => FD.alanMi(g)).map((g) => (urunAd(g) ? `${g}: ${urunAd(g)}` : '')).filter(Boolean).join(' · ') || '—'],
      ['Ekstralar', v.ekstralar.map(ad).join(', ') || '—'],
    ].map(([a, d]) => ({ ad: a, deger: d }));

    const denetle = () => {
      if (adim === 1 && !v.tarihEsnek && !v.tarih) return 'Bir tarih seçin ya da "Tarih henüz belli değil"i işaretleyin.';
      if (adim === 1 && !v.kisi) return 'Yaklaşık misafir sayısını seçin.';
      if (adim === 2 && K('mekan').length && !v.mekan) return 'Bir mekan seçin.';
      if (adim === 7) {
        if (v.ad.trim().length < 3) return 'Adınızı ve soyadınızı yazın.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.eposta.trim())) return 'Geçerli bir e-posta yazın.';
        if (v.tel.replace(/\D/g, '').length < 10) return 'Telefon numaranızı yazın.';
        if (!v.kvkk) return 'Devam etmek için KVKK metnini onaylayın.';
      }
      return '';
    };
    const gonder = () => {
      const veri = { ad: v.ad.trim(), eposta: v.eposta.trim().toLowerCase(), tel: v.tel.trim(), tarih: v.tarihEsnek ? null : v.tarih || null,
        tarih_esnek: v.tarihEsnek || !v.tarih, kisi: v.kisi, not: v.not.trim(), kvkk: v.kvkk,
        secimler: { mekan: v.mekan, bolumler: v.bolumler, menu: v.menu, konsept: v.konsept, urunler: urunSecili, ekstralar: v.ekstralar } };
      if (!window.FCDGonder) return this.setState({ gitti: true });
      this.setState({ gonderiliyor: true, hata: '' });
      window.FCDGonder(veri).then(() => this.setState({ gitti: true, gonderiliyor: false }), (h) => this.setState({ hata: h.message, gonderiliyor: false }));
    };
    const kaydir = () => { const el = document.getElementById('tasarla'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    return {
      bugun: D.bugun,
      adimlarTanitim: [
        { no: '01', baslik: 'Tasarlayın', metin: 'Tarihinizi, akışı, masa konseptinizi ve ekstraları birkaç adımda seçin.' },
        { no: '02', baslik: 'Tanışalım', metin: 'Sizi arayıp hayalinizi dinleyelim; dilerseniz alanı birlikte gezelim.' },
        { no: '03', baslik: 'Size özel teklif', metin: 'Seçimlerinize göre hazırladığımız teklifle her ayrıntıyı birlikte planlayalım.' },
      ],
      konseptVitrin: K('konsept').map((k) => ({ ...k, resim: FD.resim(k), aciklama: k.aciklama || '' })),
      sihirbazda: !this.state.gitti, gitti: this.state.gitti, v,
      adimYazi: `${adim} / ${ADIMLAR.length}`, adimBaslik: ADIMLAR[adim - 1][0], adimAciklama: ADIMLAR[adim - 1][1],
      ilerleme: ADIMLAR.map((_, i) => (i < adim ? 'tamam' : '')),
      adim1: adim === 1, adim2: adim === 2, adim3: adim === 3, adim4: adim === 4, adim5: adim === 5, adim6: adim === 6, adim7: adim === 7,
      tarihYaz: (e) => deg({ tarih: e.target.value }),
      esnekDegis: (e) => deg({ tarihEsnek: !!e.target.checked, ...(e.target.checked ? { tarih: '' } : {}) }),
      kisiSecenek: KISI.map(([id, a]) => ({ ad: a, secili: v.kisi === id ? 'true' : 'false', sinif: v.kisi === id ? 'dg-hap secili' : 'dg-hap', sec: () => deg({ kisi: id }) })),
      mekanlar: K('mekan').map((m) => kart(m, v.mekan === m.id, () => deg({ mekan: m.id, menu: null }))),
      bolumler: K('bolum').map((b) => kart(b, v.bolumler.includes(b.id), () => deg({ bolumler: ac(v.bolumler, b.id) }))),
      menuler: [{ id: null, ad: 'Mekanın menüsü, sonra konuşuruz', aciklama: mekan && mekan.yemek_mekandan === false ? 'Menüyü görüşmede birlikte belirleyelim.' : 'Yemeği mekan karşılıyor; menüyü mekanla birlikte netleştiririz.' }, ...menuler]
        .map((m) => ({ ...kart(m, v.menu === m.id, () => deg({ menu: m.id })),
          nokta: v.menu === m.id ? 'width: 10px; height: 10px; border-radius: 50%; background: #5B6B4E' : 'display: none' })),
      konseptler: K('konsept').map((k) => kart(k, v.konsept === k.id, () => deg({ konsept: v.konsept === k.id ? null : k.id }))),
      masaGruplari: gruplar.filter((g) => !FD.alanMi(g)).map(grupKart),
      alanGruplari: gruplar.filter((g) => FD.alanMi(g)).map(grupKart),
      ekstralar: K('ekstra').map((e) => kart(e, v.ekstralar.includes(e.id), () => deg({ ekstralar: ac(v.ekstralar, e.id) }))),
      ozet,
      alan: Object.fromEntries(['ad', 'eposta', 'tel', 'not'].map((k) => [k, (e) => deg({ [k]: e.target.value })])),
      kvkkDegis: (e) => deg({ kvkk: !!e.target.checked }),
      hata: this.state.hata, gonderiliyor: this.state.gonderiliyor,
      geriVar: adim > 1, geriYok: adim === 1,
      geri: () => { this.setState({ adim: adim - 1, hata: '' }); kaydir(); },
      ileriYazi: adim === 7 ? (this.state.gonderiliyor ? 'Gönderiliyor…' : 'Teklif isteyin') : adim === 3 && !v.menu ? 'Atla →' : 'Devam →',
      ileri: () => {
        const h = denetle();
        if (h) return this.setState({ hata: h });
        if (adim === 7) return gonder();
        this.setState({ adim: adim + 1, hata: '' });
        kaydir();
      },
      sss: [
        { s: 'Sitede neden fiyat yok?', c: 'Her düğün farklı: misafir sayısı, akış ve seçimler fiyatı belirler. Tasarımınızı aldıktan sonra sizi arayıp size özel teklif hazırlıyoruz.' },
        { s: 'Yemeği kim veriyor?', c: 'Yemek mekanın mutfağından gelir. Menü tercihinizi bize iletirseniz mekanla birlikte netleştiririz.' },
        { s: 'Tarihimiz kesin değil, yine de yazabilir miyiz?', c: 'Elbette. "Tarih henüz belli değil" seçeneğiyle gönderin; uygun tarihleri birlikte konuşalım.' },
        { s: 'Alanı görebilir miyiz?', c: 'Evet. Görüşmemizde uygun bir gün belirleyip alanı birlikte gezebiliriz.' },
        { s: 'Kötü hava olursa?', c: 'Açık hava düğünlerinde hava durumuna göre yedek planı (tente, düzen değişikliği) teklif aşamasında birlikte belirliyoruz.' },
      ],
    };
  }
}
return Component;
});
