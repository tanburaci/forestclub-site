// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/dugun-yonetim.dc.html içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip `node araclar/dc_derle.mjs` çalıştırın.
window.DC.sinif('/sayfalar/dugun-yonetim.dc.html', function (DCLogic) {
class Component extends DCLogic {
  constructor(props) {
    super(props);
    // Canlıda veri js/dugun-yonetim.js'ten (window.FCDYV); önizlemede örnek
    const V = window.FCDYV || {
      talepler: [{ id: 1, ad: 'Ayşe ve Can', eposta: 'cift@posta.test', tel: '0532 000 00 00', tarih: '2027-06-12', tarih_esnek: false, kisi: '50_100', durum: 'yeni',
        secimler: { mekan: 'Pinya, Urla', bolumler: ['Nikah töreni', 'Kokteyl'], konsept: 'Kır sofrası', urunler: [{ grup: 'Çiçek', ad: 'Kır çiçekleri' }], ekstralar: ['Düğün pastası'] },
        notlar: 'Gün batımında nikah istiyoruz.', yonetici_notu: null, created_at: '2026-11-02T10:00:00Z' }],
      katalog: [{ id: 1, tur: 'konsept', ad: 'Kır sofrası', aciklama: 'Keten, kır çiçekleri.', resim: '/dugun/cizim/konsept-kir.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true }],
    };
    this.GBOS = { tarih: new Date().toISOString().slice(0, 10), tutar: '', kasa: 'banka', talep: '', aciklama: '', envantere: true, kalem: '', ad: '', grup: '', birim: 'adet', konum: '', adet: '1' };
    this.OBOS = { kalem: '', ad: '', grup: '', birim: 'adet', konum: '', adet: '1', neden: 'diger', not: '' };
    this.state = { envanter: V.envanter || [], hareketler: V.hareketler || [], form: null, g: { ...this.GBOS }, o: { ...this.OBOS }, dF: null, gHata: '', gecmis: null,
      davetler: V.davetler || [], davetForm: false, davetYeni: { ad: '', notlar: '' }, kopya: null,
      maliyetler: V.maliyetler || [], fiyatlar: V.fiyatlar || [], malDuz: {}, malDurum: {}, grupKar: {},
      alt: 'talepler', filtre: 'acik', acik: null, talepler: V.talepler, katalog: V.katalog, notlar: {}, duz: null, duzHata: '', mesaj: '', hizli: null, yukleniyor: null };
  }
  // Maliyet: satır düzenlemesi (malDuz) kaydedilmemiş değişikliktir; müşteri fiyatı burada da sunucudaki formülle hesaplanır
  maliyetVals(st, Y, FD) {
    const sayi = (v) => {
      const t = String(v == null ? '' : v).trim().replace(/\s|TL/gi, '');
      if (!t) return null;
      const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
      return Number.isFinite(n) ? n : NaN;
    };
    const yazi = (v) => (v == null ? '' : String(Number(v)).replace('.', ','));
    const BIRIM = { adet: 'adet', kisi: 'kişi', masa: 'masa', metre: 'metre', sabit: '' };
    const tl = (n) => `${Math.round(n).toLocaleString('tr-TR')} TL`;
    const malMap = Object.fromEntries(st.maliyetler.map((m) => [m.katalog_id, m]));
    const satir = (k) => ({ alis: '', kira: '', esas: 'kira', kar_yuzde: '', birim: 'adet', tedarikci: '', notlar: '',
      ...Object.fromEntries(Object.entries(malMap[k.id] || {}).map(([a, v]) => [a, ['alis', 'kira', 'kar_yuzde'].includes(a) ? yazi(v) : v == null ? '' : v])),
      ...(st.malDuz[k.id] || {}) });
    const fiyatHesap = (r) => {
      const esas = sayi(r.esas === 'alis' ? r.alis : r.kira);
      const kar = sayi(r.kar_yuzde);
      if (esas == null || kar == null || Number.isNaN(esas) || Number.isNaN(kar)) return null;
      return Math.round(esas * (1 + kar / 100));
    };
    const urunler = st.katalog.filter((k) => k.tur === 'urun');
    // Ana ürün, hemen ardından seçenekleri (ust_id)
    const sirali = (liste) => {
      const sr = (a, b) => a.sira - b.sira || a.id - b.id;
      const anaUrunler = liste.filter((u) => !u.ust_id || !liste.some((x) => x.id === u.ust_id)).sort(sr);
      return anaUrunler.flatMap((u) => [u, ...liste.filter((c) => c.ust_id === u.id).sort(sr)]);
    };
    const ust = (k) => (k.ust_id ? st.katalog.find((x) => x.id === k.ust_id) : null);
    const kaydet = (k, r) => {
      const p = { katalog_id: k.id, esas: r.esas, birim: r.birim, tedarikci: String(r.tedarikci || '').trim(), notlar: r.notlar || '' };
      for (const a of ['alis', 'kira', 'kar_yuzde']) {
        const n = sayi(r[a]);
        if (Number.isNaN(n) || (n != null && n < 0)) return Promise.reject(new Error('Rakamları sayı olarak yazın (örn. 1.250 ya da 40).'));
        p[a] = n;
      }
      if (p.tedarikci && !/^https:\/\//.test(p.tedarikci)) return Promise.reject(new Error('Tedarikçi bağlantısı https:// ile başlamalı.'));
      const bitti = (sonuc) => this.setState((s) => {
        const yeni = { ...p, tedarikci: p.tedarikci || null };
        const fiyat = sonuc && sonuc.fiyat != null ? Number(sonuc.fiyat) : null;
        const malDuz = { ...s.malDuz }; delete malDuz[k.id];
        return {
          maliyetler: [...s.maliyetler.filter((m) => m.katalog_id !== k.id), yeni], malDuz,
          fiyatlar: fiyat == null ? s.fiyatlar.filter((f) => f.katalog_id !== k.id) : [...s.fiyatlar.filter((f) => f.katalog_id !== k.id), { katalog_id: k.id, fiyat, birim: p.birim }],
          malDurum: { ...s.malDurum, [k.id]: { kaydedildi: true } },
        };
      });
      if (!Y || !Y.maliyetKaydet) return Promise.resolve(bitti({ fiyat: fiyatHesap(r) }));
      return Y.maliyetKaydet(p).then(bitti);
    };
    const tekKaydet = (k, r) => {
      this.setState((s) => ({ malDurum: { ...s.malDurum, [k.id]: { kaydediliyor: true } } }));
      kaydet(k, r).catch((h) => this.setState((s) => ({ malDurum: { ...s.malDurum, [k.id]: { hata: h.message } } })));
    };
    const gruplar = FD.sirala([...new Set(urunler.map((u) => u.grup || 'Diğer'))]);
    const fiyatli = st.fiyatlar.length;
    const maliyetsiz = urunler.filter((k) => { const r = satir(k); return sayi(r.alis) == null && sayi(r.kira) == null; }).length;
    return {
      malOzet: {
        fiyatli: `${fiyatli} üründe sitede fiyat var`, maliyetsiz: `${maliyetsiz} ürünün maliyeti bilinmiyor`,
        rozet1: 'background:#DCE9C8;color:#2F4A1F;font-weight:700;border-radius:999px;padding:5px 11px',
        rozet2: 'background:#F3E6C8;color:#6B5420;font-weight:700;border-radius:999px;padding:5px 11px',
      },
      malGruplar: gruplar.map((g) => {
        const kalemler = sirali(urunler.filter((u) => (u.grup || 'Diğer') === g));
        const kar = st.grupKar[g] || '';
        const durum = st.malDurum[`grup:${g}`] || {};
        return {
          ad: g, kar,
          karYaz: (e) => { const v = e.target.value; this.setState((s) => ({ grupKar: { ...s.grupKar, [g]: v } })); },
          uygulaYazi: durum.kaydediliyor ? 'Uygulanıyor…' : durum.tamam ? 'Uygulandı ✓' : 'Hepsine uygula',
          karUygula: () => {
            const n = sayi(kar);
            if (n == null || Number.isNaN(n) || n < 0) return this.setState((s) => ({ malDurum: { ...s.malDurum, [`grup:${g}`]: {} }, mesaj: `${g}: kâr yüzdesini sayı olarak yazın.` }));
            this.setState((s) => ({ malDurum: { ...s.malDurum, [`grup:${g}`]: { kaydediliyor: true } } }));
            kalemler.reduce((zincir, k) => zincir.then(() => kaydet(k, { ...satir(k), kar_yuzde: String(n) })), Promise.resolve())
              .then(() => this.setState((s) => ({ malDurum: { ...s.malDurum, [`grup:${g}`]: { tamam: true } }, mesaj: `${g}: kâr %${yazi(n)} uygulandı.` })),
                (h) => this.setState((s) => ({ malDurum: { ...s.malDurum, [`grup:${g}`]: {} }, mesaj: `${g}: uygulanamadı: ${h.message}` })));
          },
          kalemler: kalemler.map((k) => {
            const r = satir(k);
            const f = fiyatHesap(r);
            const d = st.malDurum[k.id] || {};
            const degisti = !!st.malDuz[k.id];
            const alan = Object.fromEntries(['alis', 'kira', 'esas', 'kar_yuzde', 'birim', 'tedarikci'].map((a) => [a, (e) => {
              const v = e.target.value;
              this.setState((s) => ({ malDuz: { ...s.malDuz, [k.id]: { ...(s.malDuz[k.id] || {}), [a]: v } }, malDurum: { ...s.malDurum, [k.id]: {} } }));
            }]));
            return {
              ad: ust(k) ? `↳ ${k.ad}` : k.ad, resim: FD.resim(k.resim || !ust(k) ? k : ust(k)), alis: r.alis, kira: r.kira, esas: r.esas, kar: r.kar_yuzde, birim: r.birim,
              etiketAlis: `${ust(k) ? `${ust(k).ad} · ` : ''}${k.ad} alış maliyeti`, etiketKira: `${ust(k) ? `${ust(k).ad} · ` : ''}${k.ad} kira maliyeti`,
              etiketKar: `${ust(k) ? `${ust(k).ad} · ` : ''}${k.ad} kâr yüzdesi`,
              tedarikci: r.tedarikci || '', tedVar: /^https:\/\//.test(r.tedarikci || ''), notlar: r.notlar || '', notVar: !!r.notlar,
              fiyat: f == null ? 'teklif ile' : `${tl(f)}${BIRIM[r.birim] ? ` / ${BIRIM[r.birim]}` : ''}`,
              alan, hata: d.hata || '',
              kaydetYazi: d.kaydediliyor ? 'Kaydediliyor…' : d.kaydedildi && !degisti ? 'Kaydedildi ✓' : 'Kaydet',
              kaydet: () => tekKaydet(k, r),
            };
          }),
        };
      }),
    };
  }
  // Düğün envanteri (etkinlik envanterinden ayrı): özet, gider / ödemesiz giriş / düşüm formları, gruplu liste ve geçmiş
  envanterVals(st, Y, bilgi, tYaz, pill, FD) {
    const env = st.envanter;
    const sayi = (x) => Number(String(x == null ? '' : x).trim().replace(/\./g, '').replace(',', '.'));
    const NEDEN = { satin: 'satın alındı', hediye: 'hediye / bağış', diger: 'eldeki / diğer', hasarli: 'hasarlı', kullanilamaz: 'kullanılamaz', kayip: 'kayıp' };
    const yenile = (mesaj) => {
      const bitir = (v) => this.setState({ ...v, form: null, dF: null, gHata: '', g: { ...this.GBOS }, o: { ...this.OBOS }, mesaj });
      if (!Y) return bitir({});
      return Y.envanterOku().then(bitir, (h) => bilgi(`Yenilenemedi: ${h.message}`));
    };
    const hataGoster = (h) => this.setState({ gHata: h.message || String(h) });
    const alanlar = (anahtar, BOS) => Object.fromEntries(Object.keys(BOS).map((k) => [k, (e) => { const v = e.target.value; this.setState((s) => ({ [anahtar]: { ...s[anahtar], [k]: v }, gHata: '' })); }]));
    const ayBas = new Date().toISOString().slice(0, 7);
    const buAyDusen = st.hareketler.filter((h) => h.tur === 'dusum' && String(h.tarih).slice(0, 7) === ayBas).reduce((t, h) => t + Number(h.adet), 0);
    const g = st.g; const o = st.o; const dF = st.dF;
    const dKalem = dF ? env.find((x) => x.id === dF.id) : null;
    const gruplar = (FD.sirala ? FD.sirala([...new Set(env.map((x) => x.grup || 'Diğer'))]) : [...new Set(env.map((x) => x.grup || 'Diğer'))]);
    return {
      envOzet: [
        { baslik: 'Kalem', sayi: String(env.length), alt: `${env.filter((x) => Number(x.adet) > 0).length} kalem elde var` },
        { baslik: 'Toplam parça', sayi: String(env.reduce((t, x) => t + Number(x.adet), 0)), alt: 'Kullanılabilir durumda' },
        { baslik: 'Bu ay düşülen', sayi: String(buAyDusen), alt: 'Hasarlı / kullanılamaz / kayıp' },
      ],
      envYok: !env.length,
      talepSecenek: st.talepler.filter((t) => t.durum !== 'iptal').map((t) => ({ id: String(t.id), ad: `${t.ad}${t.tarih ? ` · ${tYaz(t.tarih)}` : ''}` })),
      kalemSecenek: env.map((x) => ({ id: String(x.id), ad: `${x.ad} (${Number(x.adet)} ${x.birim})` })),
      gAcik: st.form === 'gider', oAcik: st.form === 'odemesiz', dAcik: !!dKalem, gHata: st.gHata,
      gAc: () => this.setState({ form: st.form === 'gider' ? null : 'gider', dF: null, gHata: '', g: { ...this.GBOS }, mesaj: '' }),
      oAc: () => this.setState({ form: st.form === 'odemesiz' ? null : 'odemesiz', dF: null, gHata: '', o: { ...this.OBOS }, mesaj: '' }),
      formKapat: () => this.setState({ form: null, dF: null, gHata: '' }),
      g, gAlan: alanlar('g', this.GBOS), gYeniKalem: !g.kalem,
      gEnvDegis: (e) => { const v = !!e.target.checked; this.setState((s) => ({ g: { ...s.g, envantere: v }, gHata: '' })); },
      gKaydet: () => {
        const tutar = sayi(g.tutar);
        if (!(tutar > 0)) return this.setState({ gHata: 'Tutarı yazın (örn. 12.000).' });
        if (!g.aciklama.trim()) return this.setState({ gHata: 'Kısa bir açıklama yazın.' });
        if (g.envantere && !g.kalem && !g.ad.trim()) return this.setState({ gHata: 'Envanter kaleminin adını yazın ya da listeden seçin.' });
        if (g.envantere && !(Number(g.adet) > 0)) return this.setState({ gHata: 'Envantere girecek miktarı yazın.' });
        const p = { tarih: g.tarih, tutar, kasa: g.kasa, aciklama: g.aciklama.trim(), talep_id: g.talep ? Number(g.talep) : null, envantere: !!g.envantere,
          envanter_id: g.kalem ? Number(g.kalem) : null, ad: g.ad.trim(), grup: g.grup.trim(), birim: g.birim, konum: g.konum.trim(), adet: Number(g.adet) };
        const mesaj = `${tutar.toLocaleString('tr-TR')} TL gider muhasebeye yazıldı${g.envantere ? ', ürün envantere eklendi' : ''}.`;
        if (!Y) return this.setState({ form: null, mesaj });
        this.setState({ gHata: 'Kaydediliyor…' });
        Y.giderEkle(p).then(() => yenile(mesaj), hataGoster);
      },
      o, oAlan: alanlar('o', this.OBOS), oYeniKalem: !o.kalem,
      oKaydet: () => {
        const adet = Number(o.adet);
        if (!o.kalem && !o.ad.trim()) return this.setState({ gHata: 'Kalem adını yazın ya da listeden seçin.' });
        if (!(adet > 0)) return this.setState({ gHata: 'Miktarı yazın.' });
        if (!Y) return this.setState({ form: null, mesaj: 'Envantere eklendi.' });
        this.setState({ gHata: 'Kaydediliyor…' });
        (async () => {
          const id = o.kalem ? Number(o.kalem) : await Y.kalemEkle({ ad: o.ad.trim(), grup: o.grup.trim() || null, birim: o.birim, konum: o.konum.trim() || null });
          await Y.hareketEkle({ envanter_id: id, tur: 'giris', neden: o.neden, adet, notlar: o.not.trim() || null });
        })().then(() => yenile(`${adet} parça envantere eklendi.`), hataGoster);
      },
      dKalem: dKalem ? { ad: dKalem.ad, miktar: `${Number(dKalem.adet)} ${dKalem.birim}` } : {}, dF: dF || {}, dAlan: alanlar('dF', { adet: '', neden: '', talep: '', not: '' }),
      dKaydet: () => {
        const adet = Number(dF.adet);
        if (!(adet > 0)) return this.setState({ gHata: 'Kaç tane düşüleceğini yazın.' });
        if (adet > Number(dKalem.adet)) return this.setState({ gHata: `Envanterde ${Number(dKalem.adet)} ${dKalem.birim} var; en çok o kadar düşülebilir.` });
        const mesaj = `“${dKalem.ad}”: ${adet} ${dKalem.birim} ${NEDEN[dF.neden]} olarak envanterden düşüldü.`;
        if (!Y) return this.setState((s) => ({ envanter: s.envanter.map((x) => (x.id === dKalem.id ? { ...x, adet: Number(x.adet) - adet } : x)), dF: null, mesaj }));
        this.setState({ gHata: 'Kaydediliyor…' });
        Y.hareketEkle({ envanter_id: dKalem.id, tur: 'dusum', neden: dF.neden, adet, talep_id: dF.talep ? Number(dF.talep) : null, notlar: dF.not.trim() || null })
          .then(() => yenile(mesaj), hataGoster);
      },
      envGruplar: gruplar.map((ad) => ({
        ad,
        kalemler: env.filter((x) => (x.grup || 'Diğer') === ad).map((x) => {
          const hs = st.hareketler.filter((h) => h.envanter_id === x.id);
          const dusen = hs.filter((h) => h.tur === 'dusum').reduce((t, h) => t + Number(h.adet), 0);
          const acik = st.gecmis === x.id;
          const n = Number(x.adet);
          return {
            ad: x.ad, miktar: `${n} ${x.birim}`, rozet: n > 0 ? pill('#DCE9C8', '#2F4A1F') : pill('#F3DCD5', '#82301F'),
            alt: [x.konum, dusen ? `${dusen} ${x.birim} düşüldü` : '', x.notlar].filter(Boolean).join(' · ') || ' ',
            dus: () => this.setState({ dF: { id: x.id, adet: '1', neden: 'hasarli', talep: '', not: '' }, form: null, gHata: '', mesaj: '' }),
            gecmisAcik: acik, gecmisYazi: acik ? 'Geçmişi gizle' : `Geçmiş (${hs.length})`, gecmisYok: !hs.length,
            gecmisAc: () => this.setState({ gecmis: acik ? null : x.id }),
            gecmis: hs.map((h) => ({
              isaret: h.tur === 'giris' ? `+${Number(h.adet)}` : `−${Number(h.adet)}`, renk: h.tur === 'giris' ? 'color: #2F4A1F' : 'color: #82301F',
              yazi: [tYaz(String(h.tarih)), NEDEN[h.neden], h.tutar ? `${Number(h.tutar).toLocaleString('tr-TR')} TL` : '', h.talep_id ? (st.talepler.find((t) => t.id === h.talep_id) || {}).ad : '', h.notlar].filter(Boolean).join(' · '),
              sil: () => {
                if (!window.confirm('Bu hareket geri alınsın mı? Adet buna göre düzelir; muhasebedeki gider silinmez (gerekirse Muhasebe\'den silin).')) return;
                if (!Y) return;
                Y.hareketSil(h.id).then(() => yenile('Hareket geri alındı.'), (e) => bilgi(e.message));
              },
            })),
          };
        }),
      })),
    };
  }
  renderVals() {
    const st = this.state;
    const Y = window.FCDY;
    const pill = (bg, fg) => `background:${bg};color:${fg};font-size:13px;font-weight:700;border-radius:999px;padding:5px 11px;display:inline-block`;
    const DURUM = [
      { id: 'yeni', ad: 'Yeni', rozet: pill('#111111', '#FFFFFF') }, { id: 'gorusuldu', ad: 'Görüşüldü', rozet: pill('#E4E4E2', '#111111') },
      { id: 'teklif', ad: 'Teklif verildi', rozet: pill('#F3E6C8', '#6B5420') }, { id: 'kesin', ad: 'Kesinleşti', rozet: pill('#DCE9C8', '#2F4A1F') },
      { id: 'tamamlandi', ad: 'Tamamlandı', rozet: pill('#F0F0EE', '#3A3A3A') }, { id: 'iptal', ad: 'İptal', rozet: pill('#F3DCD5', '#82301F') },
    ];
    const KISI = { '50den_az': '50 kişiden az', '50_100': '50–100 kişi', '100_150': '100–150 kişi', '150den_fazla': '150+ kişi', bilmiyorum: 'kişi sayısı belli değil' };
    const tYaz = (t) => (t ? t.slice(0, 10).split('-').reverse().join('.') : '');
    const bilgi = (m) => this.setState({ mesaj: m });
    const yaz = (is, tamam) => (Y ? is().then(tamam, (h) => bilgi(`Kaydedilemedi: ${h.message}`)) : tamam());
    const aktif = (t) => !['tamamlandi', 'iptal'].includes(t.durum);
    const FILTRE = [['acik', 'Açık', aktif], ['yeni', 'Yeni', (t) => t.durum === 'yeni'], ['kesin', 'Kesinleşen', (t) => t.durum === 'kesin'],
      ['kapali', 'Tamamlanan / iptal', (t) => !aktif(t)], ['hepsi', 'Hepsi', () => true]];
    const filtreF = (FILTRE.find((f) => f[0] === st.filtre) || FILTRE[0])[2];
    const talepGuncelle = (id, d) => this.setState((s) => ({ talepler: s.talepler.map((x) => (x.id === id ? { ...x, ...d } : x)) }));

    const TUR = [
      ['mekan', 'Mekanlar', 'Sihirbazda ilk seçim; tek mekan varsa kendiliğinden seçili gelir.'],
      ['bolum', 'Akış bölümleri', 'Nikah, kokteyl, yemek, after party…'],
      ['menu', 'Menüler', 'Mekanın menüleri; çift isterse tercih olarak işaretler (isteğe bağlı).'],
      ['urun', 'Ürünler', 'Gruplara ayrılır; masa grupları "Masalarınız", Nikah alanı / Karşılama / Lounge / Işıklandırma "Alan ve dekor" adımında.'],
      ['ekstra', 'Ekstralar', 'Müzik, fotoğraf, ışık, pasta…'],
      ['palet', 'Renk paletleri', '"Renkler ve his" adımında; çift ayrıca kendi renklerini ekleyebilir.'],
      ['his', 'His', 'Düğünün hissi (doğal, romantik, bohem…); çift en çok 3 seçer.'],
    ];
    const kat = st.katalog;
    const duz = st.duz;
    const FD = window.FC_DUGUN || { resim: (k) => k.resim || '/dugun/cizim/mekan.svg', sirala: (g) => [...g].sort(), masaGruplari: [], alanGruplari: [] };
    const resimDenetle = (dosya) => (!['image/jpeg', 'image/png', 'image/webp'].includes(dosya.type) ? 'Resim JPG, PNG ya da WebP olmalı.'
      : dosya.size > 5 * 1024 * 1024 ? 'Resim 5 MB\'tan büyük.' : '');
    const ORNEK = { mekan: 'Bağ evi, Seferihisar', bolum: 'Kına gecesi\nSabah kahvaltısı', menu: 'Ege mezeleri menüsü', konsept: 'Lavanta bahçesi',
      urun: 'Keten peçete\nAltın peçete halkası\nPeçetede lavanta dalı', ekstra: 'Havai balon\nSaz ekibi' };
    const hizli = st.hizli;
    const hizliKaydet = () => {
      const adlar = [...new Set(String(hizli.metin || '').split('\n').map((x) => x.trim()).filter(Boolean))].slice(0, 50);
      const grup = String(hizli.grup || '').trim();
      if (!adlar.length) return bilgi('En az bir kalem yazın (her satıra bir tane).');
      if (hizli.tur === 'urun' && !grup) return bilgi('Ürünlerin grubunu yazın (örn. Peçete).');
      const tekrar = adlar.filter((a) => kat.some((k) => k.tur === hizli.tur && k.ad.toLocaleLowerCase('tr') === a.toLocaleLowerCase('tr') && (hizli.tur !== 'urun' || (k.grup || '') === grup)));
      const yeni = adlar.filter((a) => !tekrar.includes(a));
      if (!yeni.length) return bilgi('Bu kalemlerin hepsi zaten var.');
      const sira0 = kat.filter((k) => k.tur === hizli.tur && (hizli.tur !== 'urun' || k.grup === grup)).length;
      const kayitlar = yeni.map((a, i) => ({ tur: hizli.tur, ad: a.slice(0, 80), aciklama: '', resim: '', grup: hizli.tur === 'urun' ? grup : '', mekan_id: null, yemek_mekandan: true, sira: sira0 + i + 1, acik: true }));
      const bitir = (satirlar) => this.setState((s) => ({ katalog: [...s.katalog, ...satirlar], hizli: null,
        mesaj: `${satirlar.length} kalem eklendi${tekrar.length ? ` (zaten olan ${tekrar.length} kalem atlandı)` : ''}.` }));
      if (!Y) return bitir(kayitlar.map((k, i) => ({ ...k, id: Date.now() + i })));
      this.setState((s) => ({ hizli: { ...s.hizli, kaydediliyor: true } }));
      // Sırayla: biri hata verirse kalanlar eklenmez, eklenenler listede kalır
      (async () => {
        const eklenen = [];
        try {
          for (const k of kayitlar) eklenen.push({ ...k, ...(await Y.katalogKaydet(k)) });
          bitir(eklenen);
        } catch (h) {
          this.setState((s) => ({ katalog: [...s.katalog, ...eklenen], hizli: { ...s.hizli, kaydediliyor: false }, mesaj: `${eklenen.length} kalem eklendi, sonra hata: ${h.message}` }));
        }
      })();
    };
    const duzKaydet = () => {
      if (!duz.ad.trim()) return this.setState({ duzHata: 'Ad yazın.' });
      if (duz.tur === 'urun' && !String(duz.grup || '').trim()) return this.setState({ duzHata: 'Ürünün grubunu yazın (örn. Çiçek).' });
      if (duz.tur === 'palet' && !(duz.renkler || []).length) return this.setState({ duzHata: 'Palete en az bir renk ekleyin.' });
      const kayit = { ...duz, ad: duz.ad.trim(), aciklama: (duz.aciklama || '').trim(), grup: (duz.grup || '').trim(), mekan_id: duz.mekan_id ? Number(duz.mekan_id) : null,
        ust_id: duz.tur === 'urun' && duz.ust_id ? Number(duz.ust_id) : null };
      const bitir = (donen) => this.setState((s) => {
        const satir = { ...kayit, ...donen };
        return {
        katalog: s.katalog.some((x) => x.id === satir.id) ? s.katalog.map((x) => (x.id === satir.id ? satir : x)) : [...s.katalog, satir],
        duz: null, duzHata: '', mesaj: `“${satir.ad}” kaydedildi.`,
        };
      });
      if (!Y) return bitir({ ...kayit, id: kayit.id || Date.now() });
      this.setState({ duzHata: 'Kaydediliyor…' });
      Y.katalogKaydet(kayit).then(bitir, (h) => this.setState({ duzHata: h.message }));
    };

    const liste = st.talepler.filter(filtreF);
    const davetLink = (d) => `${location.origin}/dugun/?k=${d.anahtar}`;
    return {
      davetFormAcik: st.davetForm, davetFormYazi: st.davetForm ? 'Kapat' : '+ Yeni bağlantı', davetYeni: st.davetYeni,
      davetFormAc: () => this.setState({ davetForm: !st.davetForm, davetYeni: { ad: '', notlar: '' } }),
      davetAd: (e) => { const v = e.target.value; this.setState((s) => ({ davetYeni: { ...s.davetYeni, ad: v } })); },
      davetNot: (e) => { const v = e.target.value; this.setState((s) => ({ davetYeni: { ...s.davetYeni, notlar: v } })); },
      davetOlustur: () => {
        const ad = st.davetYeni.ad.trim();
        const notlar = st.davetYeni.notlar.trim();
        const bitir = (d) => this.setState((s) => ({ davetler: [d, ...s.davetler], davetForm: false, mesaj: `Bağlantı hazır${d.ad ? ` (${d.ad})` : ''}: “Kopyala” ile alıp çifte gönderin.` }));
        if (!Y) return bitir({ id: Date.now(), anahtar: 'deneme', ad, notlar, talep_id: null, created_at: new Date().toISOString() });
        Y.davetOlustur(ad, notlar).then((d) => bitir({ ad, notlar, talep_id: null, created_at: new Date().toISOString(), ...d }), (h) => bilgi(`Oluşturulamadı: ${h.message}`));
      },
      davetler: st.davetler.map((d) => {
        const talep = d.talep_id && st.talepler.find((t) => t.id === d.talep_id);
        const link = davetLink(d);
        return {
          ad: d.ad || 'Adsız davet', link, talepVar: !!talep,
          durum: d.talep_id ? 'Dolduruldu' : 'Bekliyor', rozet: d.talep_id ? pill('#DCE9C8', '#2F4A1F') : pill('#E4E4E2', '#111111'),
          alt: [`oluşturuldu ${tYaz(d.created_at)}`, d.notlar].filter(Boolean).join(' · '),
          sec: (e) => e.target.select(),
          kopyalaYazi: st.kopya === d.id ? 'Kopyalandı ✓' : 'Kopyala',
          kopyala: () => {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(() => this.setState({ kopya: d.id }), () => bilgi(link));
            else bilgi(link);
          },
          talebeGit: () => this.setState({ filtre: 'hepsi', acik: d.talep_id }),
          sil: () => {
            if (!window.confirm(`“${d.ad || 'Adsız davet'}” bağlantısı silinsin mi? Bağlantı artık açılmaz; gelen talep silinmez.`)) return;
            yaz(() => Y.davetSil(d.id), () => this.setState((s) => ({ davetler: s.davetler.filter((x) => x.id !== d.id), mesaj: 'Bağlantı silindi.' })));
          },
        };
      }),
      mesaj: st.mesaj,
      altSekmeler: [['talepler', `Talepler (${st.talepler.filter((t) => t.durum === 'yeni').length} yeni)`], ['envanter', 'Envanter'], ['maliyet', 'Maliyet'], ['katalog', 'Katalog']].map(([id, ad]) => ({
        ad, sinif: st.alt === id ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ alt: id, mesaj: '' }),
      })),
      taleplerSekme: st.alt === 'talepler', katalogSekme: st.alt === 'katalog', envanterSekme: st.alt === 'envanter', maliyetSekme: st.alt === 'maliyet',
      ...this.maliyetVals(st, Y, FD),
      ...this.envanterVals(st, Y, bilgi, tYaz, pill, FD),
      filtreler: FILTRE.map(([id, ad, f]) => ({ ad: `${ad} (${st.talepler.filter(f).length})`, sinif: st.filtre === id ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ filtre: id }) })),
      talepYok: !liste.length,
      durumlar: DURUM,
      talepler: liste.map((t) => {
        const d = DURUM.find((x) => x.id === t.durum) || DURUM[0];
        const s = t.secimler || {};
        const acik = st.acik === t.id;
        const yNot = st.notlar[t.id] !== undefined ? st.notlar[t.id] : t.yonetici_notu || '';
        return {
          ad: t.davet_id ? `${t.ad} · davetle` : t.ad, durum: t.durum, durumAd: d.ad, rozet: d.rozet, acik, acikYazi: acik ? 'true' : 'false', ok: acik ? '▴' : '▾',
          ozet: `${t.tarih ? tYaz(t.tarih) : 'Tarih belli değil'} · ${KISI[t.kisi] || ''} · talep ${tYaz(t.created_at)}`,
          ac: () => this.setState({ acik: acik ? null : t.id }),
          tel: t.tel, telLink: `tel:${String(t.tel || '').replace(/[^\d+]/g, '')}`, eposta: t.eposta, mailLink: `mailto:${t.eposta}`,
          secimler: [
            ['Mekan', s.mekan], ['Akış', (s.bolumler || []).join(', ')],
            ['Renkler', [s.palet, (s.renkler || []).length ? `kendi renkleri: ${s.renkler.join(' ')}` : ''].filter(Boolean).join(' + ')], ['His', (s.his || []).join(', ')], ['Menü', s.menu || 'Mekanın menüsü'], ['Masa konsepti', s.konsept || 'Birlikte seçilecek'],
            ['Ayrıntılar', (s.urunler || []).map((u) => (u.grup ? `${u.grup}: ${u.ad}` : u.ad)).join(', ')], ['Ekstralar', (s.ekstralar || []).join(', ')],
          ].map(([ad, deger]) => ({ ad, deger: deger || '—' })),
          notVar: !!t.notlar, notlar: t.notlar || '',
          renkVar: !!((s.palet_renkler || []).length || (s.renkler || []).length),
          renkler: [...(s.palet_renkler || []), ...(s.renkler || [])].map((r) => `flex:1;height:34px;background:${r}`),
          durumDegis: (e) => {
            const v = e.target.value;
            yaz(() => Y.durum(t.id, v), () => { talepGuncelle(t.id, { durum: v }); bilgi(`${t.ad}: ${(DURUM.find((x) => x.id === v) || d).ad}`); });
          },
          yNot,
          notYaz: (e) => { const v = e.target.value; this.setState((s2) => ({ notlar: { ...s2.notlar, [t.id]: v } })); },
          notKaydet: () => yaz(() => Y.not(t.id, yNot.trim()), () => { talepGuncelle(t.id, { yonetici_notu: yNot.trim() || null }); bilgi('Not kaydedildi.'); }),
        };
      }),

      grupOneri: FD.sirala([...new Set([...FD.masaGruplari, ...FD.alanGruplari, ...kat.filter((k) => k.tur === 'urun' && k.grup).map((k) => k.grup)])]),
      hizli: hizli || {}, hizliYazi: hizli && hizli.kaydediliyor ? 'Ekleniyor…' : 'Hepsini ekle',
      hizliGrup: (e) => { const v = e.target.value; this.setState((s) => ({ hizli: { ...s.hizli, grup: v } })); },
      hizliMetin: (e) => { const v = e.target.value; this.setState((s) => ({ hizli: { ...s.hizli, metin: v } })); },
      hizliKaydet: () => { if (!(hizli && hizli.kaydediliyor)) hizliKaydet(); },
      hizliKapat: () => this.setState({ hizli: null }),
      gruplar: TUR.map(([tur, ad, not]) => ({
        ad, not, urun: tur === 'urun', ornek: ORNEK[tur],
        hizliAcik: !!hizli && hizli.tur === tur,
        hizliAc: () => this.setState({ hizli: hizli && hizli.tur === tur ? null : { tur, metin: '', grup: '' }, duz: null, mesaj: '' }),
        ekle: () => this.setState({ duz: { tur, ad: '', aciklama: '', resim: '', grup: '', mekan_id: '', yemek_mekandan: true, sira: kat.filter((k) => k.tur === tur).length + 1, acik: true }, duzHata: '', hizli: null, mesaj: '' }),
        altlar: (tur === 'urun' ? FD.sirala([...new Set(kat.filter((k) => k.tur === 'urun').map((k) => k.grup || 'Diğer'))]) : ['']).map((g) => ({
          baslik: g,
          kalemler: (() => {
            const liste = kat.filter((k) => k.tur === tur && (tur !== 'urun' || (k.grup || 'Diğer') === g));
            const sr = (a, b) => a.sira - b.sira || a.id - b.id;
            const anaUrunler = liste.filter((k) => !k.ust_id || !liste.some((x) => x.id === k.ust_id)).sort(sr);
            return anaUrunler.flatMap((k) => [k, ...liste.filter((c) => c.ust_id === k.id).sort(sr)]);
          })().map((k) => ({
          ad: k.ust_id ? `↳ ${k.ad}` : k.ad, resim: FD.resim(k.resim || !k.ust_id ? k : (kat.find((x) => x.id === k.ust_id) || k)), soluk: k.acik ? '' : 'opacity: .45',
          alt: [k.tur === 'palet' ? (k.renkler || []).join(' ') : ['palet', 'his'].includes(k.tur) || (k.resim && !k.resim.startsWith('/dugun/cizim/')) ? '' : 'fotoğraf yok', k.acik ? '' : 'gizli', k.aciklama].filter(Boolean).join(' · '),
          resimVar: k.tur !== 'palet',
          serit: k.tur === 'palet' ? (k.renkler || []).map((r) => `flex:1;background:${r}`) : [], seritVar: k.tur === 'palet',
          fotoYazi: st.yukleniyor === k.id ? 'Yükleniyor…' : 'Fotoğraf',
          fotoSec: (e) => {
            const dosya = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!dosya) return;
            const h = resimDenetle(dosya);
            if (h) return bilgi(h);
            if (!Y) return;
            this.setState({ yukleniyor: k.id });
            Y.resimYukle(dosya).then((url) => Y.katalogKaydet({ ...k, resim: url }).then(() => this.setState((s) => ({
              katalog: s.katalog.map((x) => (x.id === k.id ? { ...x, resim: url } : x)), yukleniyor: null, mesaj: `“${k.ad}” fotoğrafı yüklendi.` }))))
              .catch((hata2) => this.setState({ yukleniyor: null, mesaj: `Yüklenemedi: ${hata2.message}` }));
          },
          acKapaYazi: k.acik ? 'Gizle' : 'Göster',
          duzenle: () => this.setState({ duz: { ...k, aciklama: k.aciklama || '', grup: k.grup || '', mekan_id: k.mekan_id ? String(k.mekan_id) : '', ust_id: k.ust_id ? String(k.ust_id) : '' }, duzHata: '', mesaj: '' }),
          acKapa: () => yaz(() => Y.katalogKaydet({ ...k, acik: !k.acik }), () => this.setState((s) => ({ katalog: s.katalog.map((x) => (x.id === k.id ? { ...x, acik: !k.acik } : x)),
            mesaj: k.acik ? `“${k.ad}” sitede gizlendi.` : `“${k.ad}” sitede görünüyor.` }))),
          sil: () => {
            if (!window.confirm(`“${k.ad}” silinsin mi? Gönderilmiş talepler etkilenmez.`)) return;
            yaz(() => Y.katalogSil(k.id), () => this.setState((s) => ({ katalog: s.katalog.filter((x) => x.id !== k.id && x.mekan_id !== k.id), mesaj: `“${k.ad}” silindi.` })));
          },
          })),
        })),
      })),
      duzVar: !!duz, duz: duz || {}, duzBaslik: duz ? `${duz.id ? 'Düzenle' : 'Yeni'} · ${(TUR.find((x) => x[0] === duz.tur) || [0, ''])[1]}` : '',
      duzUrun: !!duz && duz.tur === 'urun', duzMenu: !!duz && duz.tur === 'menu', duzMekan: !!duz && duz.tur === 'mekan', duzPalet: !!duz && duz.tur === 'palet',
      duzRenkler: ((duz && duz.renkler) || []).map((r, i) => ({ deger: r, etiket: `Renk ${i + 1}`, silEtiket: `Renk ${i + 1}'i kaldır`,
        yaz: (e) => { const x = String(e.target.value).toLowerCase(); this.setState((s) => ({ duz: { ...s.duz, renkler: s.duz.renkler.map((y, j) => (j === i ? x : y)) } })); },
        sil: () => this.setState((s) => ({ duz: { ...s.duz, renkler: s.duz.renkler.filter((_, j) => j !== i) } })) })),
      duzRenkEkleVar: !!duz && ((duz.renkler || []).length < 6),
      duzRenkEkle: () => this.setState((s) => ({ duz: { ...s.duz, renkler: [...(s.duz.renkler || []), '#c8a15a'] } })),
      duzResim: duz ? FD.resim(duz) : '', duzHata: st.duzHata,
      mekanSecenek: kat.filter((k) => k.tur === 'mekan').map((m) => ({ id: String(m.id), ad: m.ad })),
      ustSecenek: kat.filter((k) => k.tur === 'urun' && !k.ust_id && (!duz || k.id !== duz.id) && (!duz || !duz.grup || k.grup === duz.grup))
        .sort((a, b) => String(a.grup).localeCompare(String(b.grup), 'tr') || a.sira - b.sira).map((k) => ({ id: String(k.id), ad: `${k.grup || 'Diğer'} · ${k.ad}` })),
      duzAlan: Object.fromEntries(['ad', 'aciklama', 'grup', 'mekan_id', 'sira', 'ust_id'].map((k) => [k, (e) => { const v = e.target.value; this.setState((s) => ({ duz: { ...s.duz, [k]: v }, duzHata: '' })); }])),
      yemekDegis: (e) => { const v = !!e.target.checked; this.setState((s) => ({ duz: { ...s.duz, yemek_mekandan: v } })); },
      resimSec: (e) => {
        const dosya = e.target.files && e.target.files[0];
        if (!dosya) return;
        const h = resimDenetle(dosya);
        if (h) return this.setState({ duzHata: h });
        if (!Y) return;
        this.setState({ duzHata: 'Resim yükleniyor…' });
        Y.resimYukle(dosya).then((url) => this.setState((s) => ({ duz: { ...s.duz, resim: url }, duzHata: '' })), (h) => this.setState({ duzHata: h.message }));
      },
      duzKaydet, duzVazgec: () => this.setState({ duz: null, duzHata: '' }),
    };
  }
}
return Component;
});
