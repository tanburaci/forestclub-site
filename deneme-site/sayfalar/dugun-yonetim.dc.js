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
    this.state = { alt: 'talepler', filtre: 'acik', acik: null, talepler: V.talepler, katalog: V.katalog, notlar: {}, duz: null, duzHata: '', mesaj: '' };
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
      ['konsept', 'Masa konseptleri', 'Ana sayfada vitrin, sihirbazda seçim.'],
      ['urun', 'Ürünler', 'Konsepti değiştirmek için gruplara ayrılır (Örtü, Çiçek…).'],
      ['ekstra', 'Ekstralar', 'Müzik, fotoğraf, ışık, pasta…'],
    ];
    const kat = st.katalog;
    const duz = st.duz;
    const duzKaydet = () => {
      if (!duz.ad.trim()) return this.setState({ duzHata: 'Ad yazın.' });
      if (duz.tur === 'urun' && !String(duz.grup || '').trim()) return this.setState({ duzHata: 'Ürünün grubunu yazın (örn. Çiçek).' });
      const kayit = { ...duz, ad: duz.ad.trim(), aciklama: (duz.aciklama || '').trim(), grup: (duz.grup || '').trim(), mekan_id: duz.mekan_id ? Number(duz.mekan_id) : null };
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
    return {
      mesaj: st.mesaj,
      altSekmeler: [['talepler', `Talepler (${st.talepler.filter((t) => t.durum === 'yeni').length} yeni)`], ['katalog', 'Katalog']].map(([id, ad]) => ({
        ad, sinif: st.alt === id ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ alt: id, mesaj: '' }),
      })),
      taleplerSekme: st.alt === 'talepler', katalogSekme: st.alt === 'katalog',
      filtreler: FILTRE.map(([id, ad, f]) => ({ ad: `${ad} (${st.talepler.filter(f).length})`, sinif: st.filtre === id ? 'fc-sekme fc-sekme-aktif' : 'fc-sekme', sec: () => this.setState({ filtre: id }) })),
      talepYok: !liste.length,
      durumlar: DURUM,
      talepler: liste.map((t) => {
        const d = DURUM.find((x) => x.id === t.durum) || DURUM[0];
        const s = t.secimler || {};
        const acik = st.acik === t.id;
        const yNot = st.notlar[t.id] !== undefined ? st.notlar[t.id] : t.yonetici_notu || '';
        return {
          ad: t.ad, durum: t.durum, durumAd: d.ad, rozet: d.rozet, acik, acikYazi: acik ? 'true' : 'false', ok: acik ? '▴' : '▾',
          ozet: `${t.tarih ? tYaz(t.tarih) : 'Tarih belli değil'} · ${KISI[t.kisi] || ''} · talep ${tYaz(t.created_at)}`,
          ac: () => this.setState({ acik: acik ? null : t.id }),
          tel: t.tel, telLink: `tel:${String(t.tel || '').replace(/[^\d+]/g, '')}`, eposta: t.eposta, mailLink: `mailto:${t.eposta}`,
          secimler: [
            ['Mekan', s.mekan], ['Akış', (s.bolumler || []).join(', ')], ['Menü', s.menu || 'Mekanın menüsü'], ['Masa konsepti', s.konsept || 'Birlikte seçilecek'],
            ['Ayrıntılar', (s.urunler || []).map((u) => (u.grup ? `${u.grup}: ${u.ad}` : u.ad)).join(', ')], ['Ekstralar', (s.ekstralar || []).join(', ')],
          ].map(([ad, deger]) => ({ ad, deger: deger || '—' })),
          notVar: !!t.notlar, notlar: t.notlar || '',
          durumDegis: (e) => {
            const v = e.target.value;
            yaz(() => Y.durum(t.id, v), () => { talepGuncelle(t.id, { durum: v }); bilgi(`${t.ad}: ${(DURUM.find((x) => x.id === v) || d).ad}`); });
          },
          yNot,
          notYaz: (e) => { const v = e.target.value; this.setState((s2) => ({ notlar: { ...s2.notlar, [t.id]: v } })); },
          notKaydet: () => yaz(() => Y.not(t.id, yNot.trim()), () => { talepGuncelle(t.id, { yonetici_notu: yNot.trim() || null }); bilgi('Not kaydedildi.'); }),
        };
      }),

      gruplar: TUR.map(([tur, ad, not]) => ({
        ad, not,
        ekle: () => this.setState({ duz: { tur, ad: '', aciklama: '', resim: '', grup: '', mekan_id: '', yemek_mekandan: true, sira: kat.filter((k) => k.tur === tur).length + 1, acik: true }, duzHata: '', mesaj: '' }),
        kalemler: kat.filter((k) => k.tur === tur).sort((a, b) => (a.grup || '').localeCompare(b.grup || '', 'tr') || a.sira - b.sira || a.id - b.id).map((k) => ({
          ad: k.ad, resim: k.resim || '/dugun/cizim/mekan.svg', soluk: k.acik ? '' : 'opacity: .45',
          alt: [k.grup, k.acik ? '' : 'gizli', k.aciklama].filter(Boolean).join(' · '),
          acKapaYazi: k.acik ? 'Gizle' : 'Göster',
          duzenle: () => this.setState({ duz: { ...k, aciklama: k.aciklama || '', grup: k.grup || '', mekan_id: k.mekan_id ? String(k.mekan_id) : '' }, duzHata: '', mesaj: '' }),
          acKapa: () => yaz(() => Y.katalogKaydet({ ...k, acik: !k.acik }), () => this.setState((s) => ({ katalog: s.katalog.map((x) => (x.id === k.id ? { ...x, acik: !k.acik } : x)),
            mesaj: k.acik ? `“${k.ad}” sitede gizlendi.` : `“${k.ad}” sitede görünüyor.` }))),
          sil: () => {
            if (!window.confirm(`“${k.ad}” silinsin mi? Gönderilmiş talepler etkilenmez.`)) return;
            yaz(() => Y.katalogSil(k.id), () => this.setState((s) => ({ katalog: s.katalog.filter((x) => x.id !== k.id && x.mekan_id !== k.id), mesaj: `“${k.ad}” silindi.` })));
          },
        })),
      })),
      duzVar: !!duz, duz: duz || {}, duzBaslik: duz ? `${duz.id ? 'Düzenle' : 'Yeni'} · ${(TUR.find((x) => x[0] === duz.tur) || [0, ''])[1]}` : '',
      duzUrun: !!duz && duz.tur === 'urun', duzMenu: !!duz && duz.tur === 'menu', duzMekan: !!duz && duz.tur === 'mekan',
      duzResim: (duz && duz.resim) || '/dugun/cizim/mekan.svg', duzHata: st.duzHata,
      mekanSecenek: kat.filter((k) => k.tur === 'mekan').map((m) => ({ id: String(m.id), ad: m.ad })),
      duzAlan: Object.fromEntries(['ad', 'aciklama', 'grup', 'mekan_id', 'sira'].map((k) => [k, (e) => { const v = e.target.value; this.setState((s) => ({ duz: { ...s.duz, [k]: v }, duzHata: '' })); }])),
      yemekDegis: (e) => { const v = !!e.target.checked; this.setState((s) => ({ duz: { ...s.duz, yemek_mekandan: v } })); },
      resimSec: (e) => {
        const dosya = e.target.files && e.target.files[0];
        if (!dosya) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(dosya.type)) return this.setState({ duzHata: 'Resim JPG, PNG ya da WebP olmalı.' });
        if (dosya.size > 5 * 1024 * 1024) return this.setState({ duzHata: 'Resim 5 MB\'tan büyük.' });
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
