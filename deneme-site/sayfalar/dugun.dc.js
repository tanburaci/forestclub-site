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
    const davet = D.davet && !D.davet.gecersiz ? D.davet : null;
    const mekanlar = D.katalog.filter((k) => k.tur === 'mekan');
    this.state = {
      adim: 1, hata: '', gitti: false, gonderiliyor: false, acikGrup: {},
      v: { tarih: '', tarihEsnek: false, kisi: '', mekan: mekanlar.length === 1 ? mekanlar[0].id : null, bolumler: [], palet: null, renkler: [], his: [], menu: null, konsept: null, urunler: [], ekstralar: [],
        ad: davet ? davet.ad : '', eposta: '', tel: '', not: '', kvkk: false },
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
      ['Tarih', 'Tarih ve misafirler', 'Kesin değilse sorun değil; yaklaşık bir fikir yeterli.'],
      ['Mekan', 'Mekan ve akış', 'Düğününüz nerede olsun, gün nasıl aksın?'],
      ['Renk', 'Renkler ve his', 'Mood board\'unuzun temeli: bir palet seçin ya da kendi renklerinizi ekleyin.'],
      ['Menu', 'Menü tercihi', 'İsterseniz bu adımı atlayabilirsiniz.'],
      ['Masa', 'Masalarınız', 'Bir konsept seçin; dilerseniz ayrıntılarını değiştirin.'],
      ['Alan', 'Alan ve dekor', 'Nikah alanı, karşılama, oturma köşeleri ve ışıklar. İsteğe bağlı.'],
      ['Ekstra', 'Ekstralar', 'Düğününüzü tamamlayacak dokunuşlar.'],
      ['Son', 'Son adım', 'Mood board\'unuz hazır. Bilgilerinizi bırakın; size özel teklifimizle dönelim.'],
    ];
    const ID = ADIMLAR[adim - 1][0];
    const SON = ADIMLAR.length;
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
          return { ad: u.ad, secili: sec ? 'true' : 'false', sinif: sec ? 'dg-hap dg-urun secili' : 'dg-hap dg-urun', resim: FD.resim(u),
            fiyat: fiyatYazi(u.id),
            sec: () => deg({ urunler: ac(v.urunler, u.id) }) };
        }),
      };
    };
    // Müşteri fiyatı (yönetimde kâr girilen ürün); yoksa teklif görüşmede
    const BIRIM = { adet: 'adet', kisi: 'kişi', masa: 'masa', metre: 'metre', sabit: '' };
    const fiyatYazi = (id) => {
      const f = (D.fiyatlar || []).find((x) => x.katalog_id === id);
      if (!f) return 'teklif ile';
      return `${Math.round(Number(f.fiyat)).toLocaleString('tr-TR')} TL${BIRIM[f.birim] ? ` / ${BIRIM[f.birim]}` : ''}`;
    };
    const urunAd = (g) => K('urun').filter((u) => (u.grup || 'Diğer') === g && v.urunler.includes(u.id)).map((u) => u.ad).join(', ');
    const ozet = [
      ['Tarih', v.tarihEsnek || !v.tarih ? 'Henüz belli değil' : v.tarih.split('-').reverse().join('.')],
      ['Misafir', (KISI.find((k) => k[0] === v.kisi) || [0, '—'])[1]],
      ['Mekan', mekan ? mekan.ad : '—'],
      ['Akış', v.bolumler.map(ad).join(', ') || '—'],
      ['Renkler', [v.palet ? ad(v.palet) : '', v.renkler.length ? `kendi renkleriniz (${v.renkler.length})` : ''].filter(Boolean).join(' + ') || 'Birlikte seçelim'],
      ['His', v.his.map(ad).join(', ') || '—'],
      ['Menü', v.menu ? ad(v.menu) : 'Mekanın menüsü, sonra konuşuruz'],
      ['Masa konsepti', v.konsept ? ad(v.konsept) : 'Birlikte seçelim'],
      ['Masa ayrıntıları', gruplar.filter((g) => !FD.alanMi(g)).map((g) => (urunAd(g) ? `${g}: ${urunAd(g)}` : '')).filter(Boolean).join(' · ') || '—'],
      ['Alan ve dekor', gruplar.filter((g) => FD.alanMi(g)).map((g) => (urunAd(g) ? `${g}: ${urunAd(g)}` : '')).filter(Boolean).join(' · ') || '—'],
      ['Ekstralar', v.ekstralar.map(ad).join(', ') || '—'],
    ].map(([a, d]) => ({ ad: a, deger: d }));

    const palet = K('palet').find((x) => x.id === v.palet);
    const renkStil = (r) => `background:${/^#[0-9a-f]{6}$/i.test(r) ? r : '#EFE5D3'}`;
    const moodRenk = [...((palet && palet.renkler) || []), ...v.renkler].slice(0, 8);
    const konsept = K('konsept').find((x) => x.id === v.konsept);
    const kucukler = [...v.urunler, ...v.ekstralar].map((id) => D.katalog.find((k) => k.id === id)).filter(Boolean);
    const mood = {
      ana: konsept ? FD.resim(konsept) : mekan ? FD.resim(mekan) : '/dugun/cizim/mekan.svg', anaAd: konsept ? konsept.ad : mekan ? mekan.ad : '',
      renkVar: moodRenk.length > 0, renkler: moodRenk.map(renkStil),
      paletAd: palet ? palet.ad + (v.renkler.length ? ' + kendi renkleriniz' : '') : v.renkler.length ? 'Kendi renkleriniz' : 'Renkleri birlikte seçelim',
      hisler: v.his.map(ad).filter(Boolean),
      // Aynı çizimi tekrar göstermemek için resme göre tekilleştir (fotoğraflılar önce)
      kucukler: kucukler.sort((a, b) => (b.resim ? 1 : 0) - (a.resim ? 1 : 0)).filter((k, i, d) => d.findIndex((x) => FD.resim(x) === FD.resim(k)) === i).slice(0, 10)
        .map((k) => ({ resim: FD.resim(k), ad: k.ad })),
    };
    const denetle = () => {
      if (ID === 'Tarih' && !v.tarihEsnek && !v.tarih) return 'Bir tarih seçin ya da "Tarih henüz belli değil"i işaretleyin.';
      if (ID === 'Tarih' && !v.kisi) return 'Yaklaşık misafir sayısını seçin.';
      if (ID === 'Mekan' && K('mekan').length && !v.mekan) return 'Bir mekan seçin.';
      if (ID === 'Son') {
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
        secimler: { mekan: v.mekan, bolumler: v.bolumler, palet: v.palet, renkler: v.renkler, his: v.his, menu: v.menu, konsept: v.konsept, urunler: urunSecili, ekstralar: v.ekstralar } };
      if (!window.FCDGonder) return this.setState({ gitti: true });
      this.setState({ gonderiliyor: true, hata: '' });
      window.FCDGonder(veri).then(() => this.setState({ gitti: true, gonderiliyor: false }), (h) => this.setState({ hata: h.message, gonderiliyor: false }));
    };
    const kaydir = () => { const el = document.getElementById('tasarla'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

    const davet = D.davet && !D.davet.gecersiz ? D.davet : null;
    return {
      bugun: D.bugun,
      tanitim: !D.davet, davetVar: !!davet, davetGecersiz: !!(D.davet && D.davet.gecersiz), formVar: !(D.davet && D.davet.gecersiz),
      davetBaslik: davet && davet.ad ? `Merhaba ${davet.ad} 🤍` : 'Düğününüzü birlikte tasarlayalım',
      adimlarTanitim: [
        { no: '01', baslik: 'Tasarlayın', metin: 'Tarihinizi, akışı, masa konseptinizi ve ekstraları birkaç adımda seçin.' },
        { no: '02', baslik: 'Tanışalım', metin: 'Sizi arayıp hayalinizi dinleyelim; dilerseniz alanı birlikte gezelim.' },
        { no: '03', baslik: 'Size özel teklif', metin: 'Seçimlerinize göre hazırladığımız teklifle her ayrıntıyı birlikte planlayalım.' },
      ],
      konseptVitrin: K('konsept').map((k) => ({ ...k, resim: FD.resim(k), aciklama: k.aciklama || '' })),
      sihirbazda: !this.state.gitti, gitti: this.state.gitti, v,
      adimYazi: `${adim} / ${SON}`, adimBaslik: ADIMLAR[adim - 1][1], adimAciklama: ADIMLAR[adim - 1][2],
      ilerleme: ADIMLAR.map((_, i) => (i < adim ? 'tamam' : '')),
      ...Object.fromEntries(ADIMLAR.map(([id]) => [`adim${id}`, ID === id])),
      tarihYaz: (e) => deg({ tarih: e.target.value }),
      esnekDegis: (e) => deg({ tarihEsnek: !!e.target.checked, ...(e.target.checked ? { tarih: '' } : {}) }),
      kisiSecenek: KISI.map(([id, a]) => ({ ad: a, secili: v.kisi === id ? 'true' : 'false', sinif: v.kisi === id ? 'dg-hap secili' : 'dg-hap', sec: () => deg({ kisi: id }) })),
      mekanlar: K('mekan').map((m) => kart(m, v.mekan === m.id, () => deg({ mekan: m.id, menu: null }))),
      bolumler: K('bolum').map((b) => kart(b, v.bolumler.includes(b.id), () => deg({ bolumler: ac(v.bolumler, b.id) }))),
      menuler: [{ id: null, ad: 'Mekanın menüsü, sonra konuşuruz', aciklama: mekan && mekan.yemek_mekandan === false ? 'Menüyü görüşmede birlikte belirleyelim.' : 'Yemeği mekan karşılıyor; menüyü mekanla birlikte netleştiririz.' }, ...menuler]
        .map((m) => ({ ...kart(m, v.menu === m.id, () => deg({ menu: m.id })),
          nokta: v.menu === m.id ? 'width: 10px; height: 10px; border-radius: 50%; background: #5B6B4E' : 'display: none' })),
      konseptler: K('konsept').map((k) => kart(k, v.konsept === k.id, () => deg({ konsept: v.konsept === k.id ? null : k.id }))),
      paletler: K('palet').map((pl) => ({ ...kart(pl, v.palet === pl.id, () => deg({ palet: v.palet === pl.id ? null : pl.id })), renkler: (pl.renkler || []).map(renkStil) })),
      kendiRenkler: v.renkler.map((r, i) => ({ deger: r, etiket: `Renk ${i + 1}`, silEtiket: `Renk ${i + 1}'i kaldır`,
        yaz: (e) => { const x = String(e.target.value || '').toLowerCase(); deg({ renkler: v.renkler.map((y, j) => (j === i ? x : y)) }); },
        sil: () => deg({ renkler: v.renkler.filter((_, j) => j !== i) }) })),
      renkEkleVar: v.renkler.length < 5,
      renkEkle: () => deg({ renkler: [...v.renkler, ['#c8a15a', '#9caf88', '#e9c9c0', '#c9825f', '#2f5d8a'][v.renkler.length % 5]] }),
      hisler: K('his').map((h) => {
        const sec = v.his.includes(h.id);
        return { ad: h.ad, secili: sec ? 'true' : 'false', sinif: sec ? 'dg-hap secili' : 'dg-hap',
          sec: () => (sec ? deg({ his: v.his.filter((x) => x !== h.id) }) : v.his.length >= 3 ? this.setState({ hata: 'En çok 3 his seçebilirsiniz.' }) : deg({ his: [...v.his, h.id] })) };
      }),
      mood,
      masaGruplari: gruplar.filter((g) => !FD.alanMi(g)).map(grupKart),
      alanGruplari: gruplar.filter((g) => FD.alanMi(g)).map(grupKart),
      ekstralar: K('ekstra').map((e) => kart(e, v.ekstralar.includes(e.id), () => deg({ ekstralar: ac(v.ekstralar, e.id) }))),
      ozet,
      alan: Object.fromEntries(['ad', 'eposta', 'tel', 'not'].map((k) => [k, (e) => deg({ [k]: e.target.value })])),
      kvkkDegis: (e) => deg({ kvkk: !!e.target.checked }),
      hata: this.state.hata, gonderiliyor: this.state.gonderiliyor,
      geriVar: adim > 1, geriYok: adim === 1,
      geri: () => { this.setState({ adim: adim - 1, hata: '' }); kaydir(); },
      ileriYazi: ID === 'Son' ? (this.state.gonderiliyor ? 'Gönderiliyor…' : 'Teklif isteyin') : ID === 'Menu' && !v.menu ? 'Atla →' : 'Devam →',
      ileri: () => {
        const h = denetle();
        if (h) return this.setState({ hata: h });
        if (ID === 'Son') return gonder();
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
