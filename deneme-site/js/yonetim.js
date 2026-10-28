// Forest Club Urla · yönetici paneli (deneme sitesi): Supabase girişi, verinin panele yüklenmesi ve paneldeki
// değişikliklerin veritabanına yazılması. Panel (sayfalar/yonetim.dc.html) tasarımdaki haliyle çalışır; burada
// yalnız veri katmanı var. Kapıda karekod kamerayla okunur (BarcodeDetector; yoksa jsQR). Yönetici girişi iki adımlı
// (doğrulama uygulaması kodu); kod girilmeden veritabanı yönetici yetkisi vermez.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, bildir } = window.FC_ORTAK;
  const bugun = window.FC_ORTAK.bugun;
  const trTarih = (t) => (t ? t.split('-').reverse().join('.') : '—');
  const etkEtiket = (e) => `${e.tarih.slice(8)}.${e.tarih.slice(5, 7)} ${e.ad}`;
  const SABLON_SIRA = ['basvuru', 'onay', 'dekont_red', 'yenileme', 'duyuru', 'hatirlatma', 'iptal', 'bekleme', 'dogumgunu', 'ozelgun',
    'tanisma', 'anket', 'sifre', 'saglik'];
  const GUN_YAZI = { yenileme: 'gün kala gönderilsin', hatirlatma: 'gün önce gönderilsin', anket: 'gün sonra gönderilsin' };

  // Sunucu bir istekte en çok 1000 satır verir (max_rows); tablo sayfa sayfa, sabit bir sırayla çekilir. Gelen satır
  // sayısı tablodakinden azsa (çekerken silinen satır vb.) eksikler listesine yazılır, panel açılınca uyarı çıkar.
  const SAYFA_BOYU = 1000;
  const eksikler = [];
  async function hepsi(tablo, sira) {
    const sutunlar = sira || ['id'];
    const satirlar = [];
    let toplam = null;
    for (;;) {
      let istek = sb.from(tablo).select('*', satirlar.length ? {} : { count: 'exact' });
      sutunlar.forEach((s) => { istek = istek.order(s); });
      const { data, error, count } = await istek.range(satirlar.length, satirlar.length + SAYFA_BOYU - 1);
      if (error) throw error;
      if (toplam === null) toplam = count;
      satirlar.push(...data);
      if (!data.length || toplam === null || satirlar.length >= toplam) break;
    }
    if (toplam !== null && satirlar.length < toplam) eksikler.push(`${tablo} ${satirlar.length}/${toplam}`);
    return satirlar;
  }

  // --- Veritabanı → panelin beklediği biçim ------------------------------------------------------------------
  async function veriYukle(eposta) {
    const [uyeler, odemeler, etkinlikler, kayitlar, biletler, hareketler, envanter, sablonlar, dekontlar, cagri, sayaclar] = await Promise.all([
      hepsi('uyeler'), hepsi('odemeler'), hepsi('etkinlikler'), hepsi('etkinlik_kayitlari', ['etkinlik_id', 'uye_id']),
      hepsi('tanisma_biletleri'), hepsi('muhasebe_hareketleri'), hepsi('envanter'), hepsi('eposta_sablonlari'),
      hepsi('dekontlar'), hepsi('acik_cagri'), hepsi('sayaclar', ['tarih', 'adim']),
    ]);
    // Mail kuyruğu (son 200), sağlık özeti, ayarlar ve KVKK talepleri: göç uygulanmadıysa panel yine açılır
    const [kuyruk, saglik, ayarlar, veriTalepleri] = await Promise.all([
      sb.from('eposta_kuyrugu').select('id, sablon, alici, durum, deneme, son_hata, created_at, gonderim_at')
        .order('id', { ascending: false }).limit(200).then((r) => r.data || [], () => []),
      sb.rpc('saglik_ozeti').then((r) => r.data || null, () => null),
      sb.from('ayarlar').select('anahtar, deger').then((r) => Object.fromEntries((r.data || []).map((a) => [a.anahtar, a.deger])), () => ({})),
      sb.from('veri_talepleri').select('*').order('id', { ascending: false }).limit(200).then((r) => r.data || [], () => []),
    ]);
    const B = bugun();
    const grupla = (xs, alan) => {
      const m = new Map();
      xs.forEach((x) => { const k = x[alan]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
      return m;
    };
    const odemeGrup = grupla(odemeler, 'uye_id');
    const kayitGrup = grupla(kayitlar, 'etkinlik_id');
    const biletGrup = grupla(biletler, 'etkinlik_id');
    const idSira = new Map();
    const kisiler = uyeler.map((u, i) => {
      idSira.set(u.id, i);
      const ods = (odemeGrup.get(u.id) || []).sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
      const durum = u.bitis ? (u.bitis > B ? 'aktif' : 'doldu') : 'basvuru';
      return {
        i, id: u.id, ad: u.ad, eposta: u.eposta, tel: u.tel || '', kod: u.kod, durum, bas: u.baslangic, bitis: u.bitis,
        basvuru: u.basvuru_tarihi, yol: ods.length ? ods[ods.length - 1].yol : 'kart',
        odemeler: ods.map((o) => ({ tarih: o.tarih, yol: o.yol, tutar: Number(o.tutar) })),
        kutlama: u.kutlama_izni, foto: u.foto_izni, muaf: !!u.aidat_muaf,
        profil: {
          dogum: u.dogum_gunu || '', ozel: u.ozel_gunler || [], ilgi: u.ilgi_alanlari || [], kutlama: u.kutlama_izni,
          foto: u.foto_izni, tanisma: u.nereden_duydu || '', baslangic: trTarih(u.baslangic),
        },
      };
    });
    const etkKey = new Map();
    const keyEtk = {};
    const kayitHarita = {};
    const anket = {};
    const etkDurum = {};  // iptal / erteleme (etkinlik_durum_degistir) panelde rozet olarak görünsün
    const etkListe = etkinlikler.map((e) => {
      const key = `${e.tarih}|${e.ad}`;
      etkKey.set(e.id, key);
      keyEtk[key] = e.id;
      if (e.durum === 'iptal') etkDurum[key] = 'İptal edildi';
      else if (e.eski_tarih) etkDurum[key] = `Ertelendi (önceki tarih ${trTarih(e.eski_tarih)})`;
      const rs = kayitGrup.get(e.id) || [];
      kayitHarita[key] = {
        kontenjan: e.kontenjan,
        kayitli: rs.filter((r) => r.durum === 'kayitli').map((r) => idSira.get(r.uye_id)),
        bekleme: rs.filter((r) => r.durum === 'bekleme').sort((a, b) => (a.sira || 0) - (b.sira || 0)).map((r) => idSira.get(r.uye_id)),
        gelen: rs.filter((r) => r.durum === 'kayitli' && r.geldi).map((r) => idSira.get(r.uye_id)),
        // Tanışma biletiyle yer tutanlar da doluluğa sayılır
        tanisma: (biletGrup.get(e.id) || []).filter((b) => b.durum === 'bekliyor' || b.durum === 'geldi').length,
      };
      if (e.anket_sayisi) anket[key] = { n: e.anket_sayisi, ort: Number(e.anket_ortalama) };
      const x = { id: e.id, tarih: e.tarih, saat: e.saat || '', tur: e.tur, ad: e.ad, kim: e.kim || '', kontenjan: e.kontenjan };
      if (e.bilet_fiyati) x.satis = { fiyat: Number(e.bilet_fiyati), uye: e.uyelere || 'tam', satilan: e.satilan_bilet };
      return x;
    });
    const etkById = new Map(etkinlikler.map((e) => [e.id, e]));
    const FC = {
      bugun: B, eposta,
      DEMO: {
        kisiler, kayitlar: kayitHarita, anket, aidat: [],
        biletler: biletler.map((b) => ({ id: b.id, ad: b.ad, eposta: b.eposta, alinis: b.alinis, kod: b.kod || '',
          etkinlik: b.etkinlik_id ? etkEtiket(etkById.get(b.etkinlik_id)) : '', durum: b.durum })),
      },
      etkinlikler: etkListe,
      hareketler: hareketler.map((h) => ({
        id: h.id, tarih: h.tarih, tur: h.tur, tutar: Number(h.tutar), kasa: h.kasa, hedef: h.hedef_kasa || '',
        kategori: h.kategori || '', etk: h.etkinlik_id ? etkKey.get(h.etkinlik_id) || '' : '', aciklama: h.aciklama,
        belge: h.belge || '', otomatik: h.otomatik, ...(h.odeme ? { odeme: h.odeme } : {}),
        fatura: h.fatura_durum || '', faturaNo: h.fatura_no || '', faturaTarih: h.fatura_tarih || '',
      })),
      envanter: envanter.map((e) => ({
        id: e.id, ad: e.ad, kategori: e.kategori, adet: Number(e.adet), birim: e.birim, giris: e.giris, tarih: e.tarih,
        tutar: Number(e.tutar || 0), kasa: e.kasa || 'banka', firma: e.firma || '', karsilik: e.karsilik || '',
        kaynak: e.kaynak || '', konum: e.konum || '', not: e.notlar || '',
      })),
      sablonlar: [...sablonlar].sort((a, b) => SABLON_SIRA.indexOf(a.id) - SABLON_SIRA.indexOf(b.id)).map((s) => ({
        id: s.id, ad: s.ad, ne: s.ne_zaman, acik: s.acik, konu: s.konu, metin: s.metin, alanlar: s.alanlar,
        varsayilanKonu: s.varsayilan_konu || s.konu, varsayilanMetin: s.varsayilan_metin || s.metin,
        ...(s.gun ? { gun: s.gun, gunYazi: GUN_YAZI[s.id] || 'gün' } : {}),
      })),
      // Yönetici notları üye numarasıyla (aynı adlı iki üye karışmasın)
      notlar: Object.fromEntries(uyeler.filter((u) => u.yonetici_notu).map((u) => [u.id, u.yonetici_notu])),
      muaflar: Object.fromEntries(uyeler.filter((u) => u.aidat_muaf).map((u) => [u.id, true])),
      etkDurum,
      kuyruk, saglik, ayarlar, veriTalepleri,
      eksik: eksikler,
      _keyEtk: keyEtk,
      basvurular: { dekontlar, cagri, sayaclar, uyeler: new Map(uyeler.map((u) => [u.id, u])) },
    };
    return FC;
  }

  // --- Başvurular sekmesi (Sheets'teki Dekontlar, Açık Çağrı Başvuruları, Sayılar) ----------------------------------
  const pill = (bg, fg) => `background:${bg};color:${fg};font-size:13px;font-weight:700;border-radius:999px;padding:5px 11px;display:inline-block`;
  const tl = (n) => `${Math.round(Number(n)).toLocaleString('tr-TR')} TL`;
  const zaman = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  async function dekontAc(yol) {
    // Sheets'ten taşınan dekontlar Google Drive bağlantısıdır; doğrudan açılır
    if (/^https:\/\//.test(yol)) { window.open(yol, '_blank', 'noopener'); return; }
    const pencere = window.open('', '_blank');  // tıklama anında açılır (açılır pencere engeline takılmasın)
    const { data, error } = await sb.storage.from('dekontlar').createSignedUrl(yol, 60);
    if (error) { if (pencere) pencere.close(); return bildir(`Dekont açılamadı: ${error.message}`, true); }
    if (pencere) pencere.location = data.signedUrl; else location.href = data.signedUrl;
  }
  async function dekontKarar(panel, d, onay) {
    let not = null;
    if (!onay) {
      not = window.prompt(`${d.ad} için red gerekçesi (üyeye e-postayla gider):`, 'Dekonttaki bilgiler ödemeyle eşleşmedi.');
      if (not === null) return;
    }
    const { data, error } = await sb.rpc('dekont_karar', { p_id: d.id, p_onay: onay, p_not: not });
    if (error) return bildir(error.message, true);
    bildir(onay ? `${d.ad}: üyelik ${trTarih(data.bitis)} tarihine kadar ✓` : 'Dekont reddedildi; üyeye gerekçeli mail gidecek');
    setTimeout(() => { location.hash = 'basvurular'; location.reload(); }, 900);  // üye ve muhasebe listeleri tazelensin
  }
  window.FCBasvuruGorunum = (panel) => {
    const b = window.FC && window.FC.basvurular;
    if (!b) return { bekleyen: [], kararlar: [], cagri: [], sayaclar: [], bekleyenYok: true, cagriYok: true, bekleyenSayi: '0', cagriSayi: '0' };
    const B = window.FC.bugun;
    const uyelikYazi = (u) => (!u ? '—' : u.bitis && u.bitis > B ? `aktif, bitiş ${trTarih(u.bitis)}` : u.bitis ? `süresi doldu (${trTarih(u.bitis)})` : 'hiç ödememiş');
    const sirali = [...b.dekontlar].sort((x, y) => y.created_at.localeCompare(x.created_at));
    const bekleyen = sirali.filter((d) => d.durum === 'bekliyor').map((d) => ({
      ad: d.ad, eposta: d.eposta, tarih: zaman(d.created_at), tutar: tl(d.tutar), uyelik: uyelikYazi(b.uyeler.get(d.uye_id)),
      ac: () => dekontAc(d.dosya), onayla: () => dekontKarar(panel, d, true), reddet: () => dekontKarar(panel, d, false),
    }));
    const kararlar = sirali.filter((d) => d.durum !== 'bekliyor').slice(0, 50).map((d) => ({
      ad: d.ad, eposta: d.eposta, tarih: zaman(d.created_at), tutar: tl(d.tutar), sonuc: d.sonuc || '—',
      durum: d.durum === 'onaylandi' ? 'Onaylandı' : 'Reddedildi',
      rozet: d.durum === 'onaylandi' ? pill('#111111', '#FFFFFF') : pill('#F3DCD5', '#82301F'),
      ac: () => dekontAc(d.dosya),
    }));
    const cagri = [...b.cagri].sort((x, y) => y.created_at.localeCompare(x.created_at)).map((c) => ({
      baslik: c.baslik, tarih: zaman(c.created_at), ad: c.ad, iletisim: c.iletisim, uye: c.uye, alan: c.alan, anlatim: c.anlatim,
      detay: [c.deneyim && `Deneyim: ${c.deneyim}`, c.sure && `Süre: ${c.sure}`, c.kisi && `Kişi: ${c.kisi}`,
        c.gunler && `Günler: ${c.gunler}`, c.ihtiyac && `İhtiyaç: ${c.ihtiyac}`].filter(Boolean).join(' · '),
      notlar: c.notlar || '',
    }));
    const gunler = {};
    b.sayaclar.forEach((x) => { (gunler[x.tarih] = gunler[x.tarih] || {})[x.adim] = x.adet; });
    const sayaclar = Object.keys(gunler).sort().reverse().map((t) => ({
      tarih: trTarih(t), ...Object.fromEntries(['acildi', 'bilgiler', 'onaylar', 'dekont', 'gonderildi'].map((a) => [a, String(gunler[t][a] || 0)])),
    }));
    return {
      bekleyen, bekleyenYok: !bekleyen.length, bekleyenSayi: String(bekleyen.length), kararlar, kararVar: kararlar.length > 0,
      cagri, cagriYok: !cagri.length, cagriSayi: String(cagri.length), sayaclar, mesaj: '',
    };
  };

  // --- E-postalar sekmesi: sağlık özeti ve gönderim geçmişi -------------------------------------------------------
  const KUYRUK_DURUM = {
    bekliyor: ['Sırada', pill('#F0F0EE', '#111111')], gonderiliyor: ['Gönderiliyor', pill('#F0F0EE', '#111111')],
    gonderildi: ['Gönderildi', pill('#111111', '#FFFFFF')], atlandi: ['Atlandı', pill('#E4E4E2', '#111111')],
    hata: ['Hata', pill('#F3DCD5', '#82301F')],
  };
  window.FCEpostaGorunum = (panel) => {
    const FC = window.FC;
    if (!FC) return { saglikVar: false, saglikSatirlari: [], kuyruk: [], kuyrukYok: true, kuyrukOzet: '' };
    const sablonAd = new Map(FC.sablonlar.map((x) => [x.id, x.ad]));
    const satirlar = (FC.saglik && FC.saglik.satirlar) || [];
    const kuyruk = FC.kuyruk.slice(0, 100).map((q) => ({
      zaman: zaman(q.gonderim_at || q.created_at), sablon: sablonAd.get(q.sablon) || q.sablon, alici: q.alici,
      durum: KUYRUK_DURUM[q.durum][0], rozet: KUYRUK_DURUM[q.durum][1], hata: q.son_hata || '',
      tekrarVar: q.durum === 'hata',
      tekrar: async () => {
        const { error } = await sb.rpc('eposta_yeniden_dene', { p_id: q.id });
        if (error) return bildir(error.message, true);
        Object.assign(q, { durum: 'bekliyor', son_hata: null });
        bildir('Mail yeniden sıraya alındı ✓');
        panel.forceUpdate();
      },
    }));
    const say = (d) => FC.kuyruk.filter((q) => q.durum === d).length;
    return {
      saglikVar: satirlar.length > 0, saglikSatirlari: satirlar,
      kuyruk, kuyrukYok: !kuyruk.length,
      kuyrukOzet: `Son ${FC.kuyruk.length} mail: ${say('gonderildi')} gönderildi · ${say('bekliyor') + say('gonderiliyor')} sırada · ${say('hata')} hata · ${say('atlandi')} atlandı`,
    };
  };

  // Şablonu (ekrandaki son haliyle kaydedip) yöneticinin kendi adresine örnek bilgilerle gönderir
  window.FCEpostaDeneme = async (sablon) => {
    const { error: kHata } = await sb.from('eposta_sablonlari')
      .update({ acik: sablon.acik, gun: sablon.gun || null, konu: sablon.konu, metin: sablon.metin }).eq('id', sablon.id);
    if (kHata) throw new Error(kHata.message);
    const { error } = await sb.rpc('eposta_deneme', { p_sablon: sablon.id });
    if (error) throw new Error(error.message);
    return window.FC.eposta;
  };

  // Ayar kaydı (ayarlar tablosu; site ve üye paneli herkese açık olanları okur)
  window.FCAyarKaydet = async (anahtar, deger) => {
    const { data, error } = await sb.from('ayarlar').update({ deger }).eq('anahtar', anahtar).select('anahtar');
    if (error) throw new Error(error.message);
    if (!data.length) throw new Error('Ayar bulunamadı; veritabanı güncellemesi (göç) uygulanmamış olabilir.');
    window.FC.ayarlar[anahtar] = deger;
  };

  // --- KVKK talepleri: veri kopyası (JSON) ve silme (anonimleştirme) ------------------------------------------------
  function jsonIndir(veri, ad) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' }));
    a.download = ad;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function veriKopyasi(t) {
    const { data, error } = await sb.rpc('veri_kopyasi', { p_uye: t.uye_id });
    if (error) return bildir(error.message, true);
    jsonIndir(data, `veri-kopyasi-${t.uye_id}-${bugun()}.json`);
  }
  async function veriSil(t) {
    if (!window.confirm(`${t.ad} (${t.eposta}) anonimleştirilecek: adı, iletişim bilgileri, profili, dekont dosyaları ve giriş hesabı silinir; `
      + 'muhasebe tutarları kalır. Bu işlem geri alınamaz. Devam edilsin mi?')) return;
    const { data: dosyalar, error } = await sb.rpc('uye_anonimlestir', { p_uye: t.uye_id });
    if (error) return bildir(error.message, true);
    // Depodaki dekont dosyaları (Sheets'ten gelen Drive bağlantıları depoda değil)
    const yollar = (dosyalar || []).filter((y) => y && !/^https:\/\//.test(y));
    if (yollar.length) {
      const { error: dHata } = await sb.storage.from('dekontlar').remove(yollar);
      if (dHata) bildir(`Kişi silindi ama ${yollar.length} dekont dosyası silinemedi: ${dHata.message}`, true, 15000);
    }
    bildir(`${t.ad} anonimleştirildi; sonuç üyeye mailleniyor ✓`);
    setTimeout(() => { location.hash = 'uyeler'; location.reload(); }, 1200);
  }
  window.FCVeriTalepGorunum = () => {
    const FC = window.FC;
    if (!FC) return { talepler: [], talepYok: true, talepOzet: '' };
    const talepler = FC.veriTalepleri.map((t) => ({
      ad: t.ad, eposta: t.eposta, tarih: zaman(t.created_at),
      durum: t.durum === 'tamam' ? `Silindi · ${zaman(t.tamam_at)}` : 'Bekliyor',
      rozet: t.durum === 'tamam' ? pill('#111111', '#FFFFFF') : pill('#F3DCD5', '#82301F'),
      bekliyor: t.durum === 'bekliyor' && !!t.uye_id,
      indir: () => veriKopyasi(t), sil: () => veriSil(t),
    }));
    const bekleyen = FC.veriTalepleri.filter((t) => t.durum === 'bekliyor').length;
    return { talepler, talepYok: !talepler.length, talepOzet: bekleyen ? `${bekleyen} talep bekliyor; yasal süre 30 gün.` : 'Bekleyen talep yok.' };
  };

  // --- Kapıda karekod: kamera ------------------------------------------------------------------------------------
  // Tarayıcıda BarcodeDetector varsa o; yoksa jsQR yalnız ilk kullanımda (SRI ile) yüklenir.
  let jsqrSozu = null;
  function jsqrYukle() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!jsqrSozu) {
      jsqrSozu = new Promise((ok, red) => {
        const b = document.createElement('script');
        b.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        b.integrity = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';
        b.crossOrigin = 'anonymous';
        b.onload = () => ok(window.jsQR);
        b.onerror = () => { jsqrSozu = null; red(new Error('Karekod okuyucu yüklenemedi; kodu elle yazın.')); };
        document.head.appendChild(b);
      });
    }
    return jsqrSozu;
  }
  // video: <video> öğesi; bulundu(kod): okunan FC-U-… / FC-T-… kodu (aynı kod 4 sn içinde tekrar gelmez). Dönüş: durdur()
  window.FCKameraAc = async (video, bulundu) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Bu tarayıcı kameraya erişemiyor; kodu elle yazın.');
    const akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .catch(() => { throw new Error('Kamera açılamadı (izin verilmedi ya da kamera yok); kodu elle yazın.'); });
    let dur = false;
    const durdur = () => { dur = true; akis.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
    try {
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.srcObject = akis;
      await video.play().catch(() => {});
      let oku = null;
      if ('BarcodeDetector' in window) {
        try {
          const bd = new window.BarcodeDetector({ formats: ['qr_code'] });
          oku = async () => { const r = await bd.detect(video); return r.length ? r[0].rawValue : ''; };
        } catch (h) { oku = null; }
      }
      if (!oku) {
        const jsQR = await jsqrYukle();
        const tuval = document.createElement('canvas');
        const ctx = tuval.getContext('2d', { willReadFrequently: true });
        oku = async () => {
          const w = video.videoWidth;
          const y = video.videoHeight;
          if (!w || !y) return '';
          tuval.width = w;
          tuval.height = y;
          ctx.drawImage(video, 0, 0, w, y);
          const r = jsQR(ctx.getImageData(0, 0, w, y).data, w, y, { inversionAttempts: 'dontInvert' });
          return r ? r.data : '';
        };
      }
      let son = '';
      let sonZaman = 0;
      const dongu = async () => {
        if (dur) return;
        try {
          const m = /FC-T-[A-Z0-9]{6}|FC-U-\d+/i.exec(await oku());
          const kod = m ? m[0].toUpperCase() : '';
          if (kod && (kod !== son || Date.now() - sonZaman > 4000)) { son = kod; sonZaman = Date.now(); bulundu(kod); }
        } catch (h) { /* kare okunamadı; sonrakini dene */ }
        if (!dur) setTimeout(dongu, 250);
      };
      dongu();
    } catch (h) {
      durdur();
      throw h;
    }
    return durdur;
  };

  // Üye listesini CSV indirir (Excel için noktalı virgül ve BOM; formül gibi başlayan hücreler metne çevrilir)
  window.FCUyeCsv = () => {
    const hucre = (x) => {
      let v = x == null ? '' : String(x);
      if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
      return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const DURUM = { aktif: 'Aktif', doldu: 'Süresi doldu', basvuru: 'Hiç ödemedi' };
    const satirlar = [['Kod', 'Ad Soyad', 'E-posta', 'Telefon', 'Durum', 'Başvuru', 'Başlangıç', 'Bitiş', 'Ödeme sayısı', 'Fotoğraf izni', 'Kutlama izni']];
    window.FC.DEMO.kisiler.forEach((k) => satirlar.push([k.kod, k.ad, k.eposta, k.tel, DURUM[k.durum] || k.durum, trTarih(k.basvuru), trTarih(k.bas),
      trTarih(k.bitis), k.odemeler.length, k.foto ? 'Evet' : 'Hayır', k.kutlama ? 'Evet' : 'Hayır']));
    const metin = `\uFEFF${satirlar.map((r) => r.map(hucre).join(';')).join('\r\n')}\r\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([metin], { type: 'text/csv;charset=utf-8' }));
    a.download = `forest-club-uyeler-${bugun()}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  // --- Paneldeki değişiklikler → veritabanı ------------------------------------------------------------------
  const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bekleyenler = {};
  function ertele(ad, f, ms = 700) { clearTimeout(bekleyenler[ad]); bekleyenler[ad] = setTimeout(f, ms); }
  async function yaz(is, metin) {
    try {
      const { data, error } = await is;
      if (error) throw error;
      // .select() ile istenen yazmalarda hiçbir satır değişmediyse (satır silinmiş) başarı gösterilmez
      if (Array.isArray(data) && !data.length) throw new Error('kayıt bulunamadı; sayfayı yenileyin.');
      if (metin) bildir(metin);
    } catch (h) {
      console.error(h);
      bildir(`Kaydedilemedi: ${h.message || h}`, true);
    }
  }

  function senkronKur(panel) {
    const FC = window.FC;
    const keyEtk = FC._keyEtk;
    const hareketSatiri = (h) => ({
      tarih: h.tarih, tur: h.tur, tutar: h.tutar, kasa: h.kasa, hedef_kasa: h.tur === 'aktarim' ? h.hedef || null : null,
      kategori: h.kategori || null, etkinlik_id: h.etk ? keyEtk[h.etk] || null : null, aciklama: h.aciklama,
      belge: h.belge || null, otomatik: !!h.otomatik, odeme: h.odeme || null,
      fatura_durum: h.fatura || null, fatura_no: h.faturaNo || null, fatura_tarih: h.faturaTarih || null,
    });
    const envanterSatiri = (e) => ({
      ad: e.ad, kategori: e.kategori, adet: e.adet, birim: e.birim, giris: e.giris, tarih: e.tarih,
      tutar: e.giris === 'satin' ? e.tutar || null : null, kasa: e.giris === 'satin' ? e.kasa : null,
      firma: e.firma || null, karsilik: e.karsilik || null, kaynak: e.kaynak || null, konum: e.konum || null,
      notlar: e.not || null,
    });
    const yeniId = (liste, eski, yeni) => liste.map((x) => (x.id === eski ? { ...x, id: yeni } : x));
    // Veritabanında olan (ya da yazılmakta olan) satırların numaraları: yeni numara verilen satır ikinci kez yazılmasın
    const bilinenH = new Set(FC.hareketler.map((h) => h.id));
    const bilinenE = new Set(FC.envanter.map((e) => e.id));
    // Yazılmakta olan satırlar (geçici numara → numara gelince yapılacak son düzenleme / silme)
    const yazilanH = new Map();
    const yazilanE = new Map();
    // Kayıt listesini sunucunun dediğiyle eşitler (uye_id → panelin kişi sırası); bu değişiklik yeniden yazılmaz
    const kisiSira = () => new Map(FC.DEMO.kisiler.map((k, i) => [k.id, i]));
    const sunucudan = new WeakSet();
    const listeUygula = (key, l) => {
      const sira = kisiSira();
      const cevir = (ids) => ids.map((id) => sira.get(id)).filter((i) => i !== undefined);
      const yeni = { kontenjan: l.kontenjan, kayitli: cevir(l.kayitli), bekleme: cevir(l.bekleme), gelen: cevir(l.gelen), tanisma: l.tanisma || 0 };
      sunucudan.add(yeni);
      panel.setState((s) => ({ kayitlar: { ...s.kayitlar, [key]: yeni } }));
    };
    async function listeYaz(key, onceki, istek, metin) {
      const { data, error } = await istek;
      if (error) {
        bildir(`Kaydedilemedi: ${error.message}`, true);
        sunucudan.add(onceki);
        panel.setState((s) => ({ kayitlar: { ...s.kayitlar, [key]: onceki } }));
        return;
      }
      listeUygula(key, data);
      if (metin) bildir(metin);
    }

    // Elden aidat: ödeme, üyelik uzatma ve muhasebe kaydı sunucuda tek işlemde (elden_odeme). Dönen muhasebe satırı
    // panelin listesine eklenir; numarası bilindiği için ikinci kez yazılmaz. Dönüş: {ad, bitis, hareket}
    window.FCEldenOdeme = async (uyeId, tutar, tarih) => {
      const { data, error } = await sb.rpc('elden_odeme', { p_uye: uyeId, p_tutar: tutar, p_tarih: tarih });
      if (error) throw new Error(error.message);
      const k = FC.DEMO.kisiler.find((x) => x.id === uyeId);
      if (k) {
        Object.assign(k, { bitis: data.bitis, bas: k.bas || tarih, durum: 'aktif', yol: 'elden' });
        k.odemeler.push({ tarih, yol: 'elden' });
      }
      bilinenH.add(data.hareket_id);
      return {
        ad: data.ad, bitis: data.bitis,
        hareket: { id: data.hareket_id, tarih, tur: 'gelir', tutar, kasa: 'nakit', hedef: '', kategori: 'Aidat', etk: '',
          aciklama: `Aidat · ${data.ad}`, belge: data.ref, otomatik: true, odeme: 'elden' },
      };
    };

    // Kapıda karekod: kod sunucuda uyeler.kod ile eşleşir (giris_kaydet). Dönüş: {ad, uye_id, zaten}
    window.FCGirisKaydet = async (key, kod) => {
      const etkId = keyEtk[key];
      if (!etkId || etkId === 'yaziliyor') throw new Error('Etkinlik henüz kaydedilmedi; biraz sonra tekrar deneyin.');
      const { data, error } = await sb.rpc('giris_kaydet', { p_etkinlik: etkId, p_kod: kod });
      if (error) throw new Error(error.message);
      return data;
    };

    // İptal / erteleme (etkinlik_durum_degistir): duyuru metni kayıtlılara ve bekleme listesine maille gider.
    // tur: 'iptal' | 'ertele'. Dönüş: {durum, tarih, eski_tarih, kisi, mail}
    window.FCEtkinlikDurum = async (key, tur, yeniTarih, neden, duyuru) => {
      const etkId = keyEtk[key];
      if (!etkId || etkId === 'yaziliyor') throw new Error('Etkinlik henüz kaydedilmedi; biraz sonra tekrar deneyin.');
      const { data, error } = await sb.rpc('etkinlik_durum_degistir', {
        p_id: etkId, p_durum: tur === 'iptal' ? 'iptal' : 'ertelendi', p_yeni_tarih: yeniTarih || null, p_neden: neden || null,
        p_duyuru: duyuru || null,
      });
      if (error) throw new Error(error.message);
      return data;
    };

    window.DC.durumDegisti = (bilesen, once, simdi) => {
      if (bilesen !== panel) return;
      // Muhasebe hareketleri
      if (once.hareketler !== simdi.hareketler) {
        const eskiId = new Map(once.hareketler.map((h) => [h.id, h]));
        const yeniIdler = new Set(simdi.hareketler.map((h) => h.id));
        simdi.hareketler.forEach((h) => {
          const eski = eskiId.get(h.id);
          if (!bilinenH.has(h.id)) {
            bilinenH.add(h.id);
            yazilanH.set(h.id, { guncel: null, sil: false });
            sb.from('muhasebe_hareketleri').insert(hareketSatiri(h)).select('id').single().then(({ data, error }) => {
              const bekleyen = yazilanH.get(h.id);
              yazilanH.delete(h.id);
              if (error) {
                panel.setState((s) => ({ hareketler: s.hareketler.filter((x) => x.id !== h.id) }));
                return bildir(`Kaydedilemedi (satır listeden kaldırıldı): ${error.message}`, true);
              }
              bilinenH.add(data.id);
              if (bekleyen.sil) return yaz(sb.from('muhasebe_hareketleri').delete().eq('id', data.id).select('id'), 'Silindi ✓');
              panel.setState((s) => ({ hareketler: yeniId(s.hareketler, h.id, data.id) }));
              if (bekleyen.guncel) yaz(sb.from('muhasebe_hareketleri').update(bekleyen.guncel).eq('id', data.id).select('id'), 'Güncellendi ✓');
              else if (h.kategori === 'Aidat' && !h.otomatik) {
                bildir('Muhasebeye kaydedildi. Üyeliği uzatmak için Ana sayfadaki “Elden ödeme gir”i kullanın; bu kayıt üyeliği uzatmaz.', true);
              } else bildir('Muhasebeye kaydedildi ✓');
            });
          } else if (eski && !esit(hareketSatiri(eski), hareketSatiri(h))) {
            if (yazilanH.has(h.id)) yazilanH.get(h.id).guncel = hareketSatiri(h);
            else yaz(sb.from('muhasebe_hareketleri').update(hareketSatiri(h)).eq('id', h.id).select('id'), 'Güncellendi ✓');
          }
        });
        once.hareketler.filter((h) => !yeniIdler.has(h.id) && bilinenH.has(h.id)).forEach((h) => {
          if (yazilanH.has(h.id)) yazilanH.get(h.id).sil = true;
          else yaz(sb.from('muhasebe_hareketleri').delete().eq('id', h.id).select('id'), 'Silindi ✓');
        });
      }
      // Envanter
      if (once.envanter !== simdi.envanter) {
        const eskiId = new Map(once.envanter.map((e) => [e.id, e]));
        simdi.envanter.forEach((e) => {
          const eski = eskiId.get(e.id);
          if (!bilinenE.has(e.id)) {
            bilinenE.add(e.id);
            yazilanE.set(e.id, { guncel: null });
            sb.from('envanter').insert(envanterSatiri(e)).select('id').single().then(({ data, error }) => {
              const bekleyen = yazilanE.get(e.id);
              yazilanE.delete(e.id);
              if (error) {
                panel.setState((s) => ({ envanter: s.envanter.filter((x) => x.id !== e.id) }));
                return bildir(`Kaydedilemedi (kalem listeden kaldırıldı): ${error.message}`, true);
              }
              bilinenE.add(data.id);
              panel.setState((s) => ({ envanter: yeniId(s.envanter, e.id, data.id) }));
              if (bekleyen.guncel) yaz(sb.from('envanter').update(bekleyen.guncel).eq('id', data.id).select('id'), 'Envanter güncellendi ✓');
              else bildir('Envantere kaydedildi ✓');
            });
          } else if (eski && !esit(envanterSatiri(eski), envanterSatiri(e))) {
            if (yazilanE.has(e.id)) yazilanE.get(e.id).guncel = envanterSatiri(e);
            else ertele(`env${e.id}`, () => yaz(sb.from('envanter').update(envanterSatiri(e)).eq('id', e.id).select('id'), 'Envanter güncellendi ✓'), 400);
          }
        });
      }
      // Yeni etkinlik
      if (once.etkinlikler !== simdi.etkinlikler) {
        simdi.etkinlikler.filter((e) => !e.id).forEach((e) => {
          const key = `${e.tarih}|${e.ad}`;
          const onceki = keyEtk[key];
          if (onceki === 'yaziliyor') return;
          keyEtk[key] = 'yaziliyor';
          sb.from('etkinlikler').insert({
            tarih: e.tarih, saat: e.saat || null, tur: e.tur, ad: e.ad, kim: e.kim || null, kontenjan: e.kontenjan,
            bilet_fiyati: e.satis ? e.satis.fiyat : null, uyelere: e.satis ? e.satis.uye : null,
            aciklama: (e.metin || '').trim() || null, link: /^https:\/\//.test(e.link || '') ? e.link.trim() : null,
          }).select('id').single().then(({ data, error }) => {
            if (error) {
              if (onceki === undefined) delete keyEtk[key]; else keyEtk[key] = onceki;
              panel.setState((s) => {
                const kayitlar = { ...s.kayitlar };
                if (onceki === undefined) delete kayitlar[key];
                return { etkinlikler: s.etkinlikler.filter((x) => x.id || `${x.tarih}|${x.ad}` !== key), kayitlar };
              });
              return bildir(`Etkinlik kaydedilemedi: ${error.message}`, true);
            }
            keyEtk[key] = data.id;
            panel.setState((s) => ({ etkinlikler: s.etkinlikler.map((x) => (`${x.tarih}|${x.ad}` === key && !x.id ? { ...x, id: data.id } : x)) }));
            bildir('Etkinlik kaydedildi ✓');
          });
        });
      }
      // Kayıtlar: kontenjan (bekleme listesinden yükseltme sunucuda) ve yoklama sunucu işlevleriyle yazılır; dönen
      // liste panele geri yazılır. Kayıt eklemeyi / çıkarmayı yalnız üye (ya da kapıda giris_kaydet) yapar.
      if (once.kayitlar !== simdi.kayitlar) {
        Object.keys(simdi.kayitlar).forEach((key) => {
          const o = once.kayitlar[key];
          const n = simdi.kayitlar[key];
          if (!o || o === n || sunucudan.has(n)) return;
          const etkId = keyEtk[key];
          if (!etkId || etkId === 'yaziliyor') return;
          if (o.kontenjan !== n.kontenjan) {
            ertele(`kont${etkId}`, () => listeYaz(key, o, sb.rpc('kontenjan_degistir', { p_etkinlik: etkId, p_kontenjan: n.kontenjan }), 'Kontenjan güncellendi ✓'), 800);
          }
          [...new Set([...o.gelen, ...n.gelen])].filter((i) => o.gelen.includes(i) !== n.gelen.includes(i)).forEach((i) => {
            listeYaz(key, o, sb.rpc('yoklama_isaretle', { p_etkinlik: etkId, p_uye: FC.DEMO.kisiler[i].id, p_geldi: n.gelen.includes(i) }), 'Yoklama kaydedildi ✓');
          });
        });
      }
      // E-posta şablonları (yazarken biraz bekleyip)
      if (once.sablonlar !== simdi.sablonlar) {
        simdi.sablonlar.forEach((s) => {
          const e = once.sablonlar.find((x) => x.id === s.id);
          if (e && !esit(e, s)) {
            ertele(`sab${s.id}`, () => yaz(sb.from('eposta_sablonlari').update({ acik: s.acik, gun: s.gun || null, konu: s.konu, metin: s.metin }).eq('id', s.id), 'Şablon kaydedildi ✓'));
          }
        });
      }
      // Tanışma biletleri (kapıda okutulanlar giris_kaydet ile zaten yazıldı: kapida)
      if (once.biletler !== simdi.biletler) {
        simdi.biletler.forEach((b) => {
          const e = once.biletler.find((x) => x.id === b.id);
          if (e && e.durum !== b.durum && !b.kapida) yaz(sb.from('tanisma_biletleri').update({ durum: b.durum }).eq('id', b.id), 'Bilet güncellendi ✓');
        });
      }
      // Yönetici notu (anahtar üye numarası)
      if (once.notlar !== simdi.notlar) {
        Object.keys(simdi.notlar).forEach((id) => {
          if (once.notlar[id] === simdi.notlar[id]) return;
          ertele(`not${id}`, () => yaz(sb.from('uyeler').update({ yonetici_notu: simdi.notlar[id] || null }).eq('id', Number(id)), 'Not kaydedildi ✓'));
        });
      }
      // Aidattan muaf (bitişi sunucu ayarlar: muafken 31.12.2099, kaldırılınca bugünden 30 gün)
      if (once.muaflar !== simdi.muaflar) {
        Object.keys(simdi.muaflar).forEach((id) => {
          if (!!once.muaflar[id] === !!simdi.muaflar[id]) return;
          const muaf = !!simdi.muaflar[id];
          yaz(sb.from('uyeler').update({ aidat_muaf: muaf }).eq('id', Number(id)).select('id'), muaf ? 'Aidattan muaf ✓' : 'Muafiyet kaldırıldı ✓');
        });
      }
    };
  }

  // --- İki adımlı giriş (TOTP): veritabanı yöneticiyi yalnız aal2 oturumunda tanır (yonetici_mi) ----------------
  // İlk girişte doğrulama uygulaması kurulur (karekod), sonraki girişlerde 6 haneli kod istenir. Ekran tasarım
  // sayfasından önce, kök öğeye düz DOM ile çizilir.
  const MFA_STIL = {
    kart: 'max-width:440px;margin:48px auto;padding:28px;border:2.5px solid #111111;border-radius:14px;box-shadow:5px 5px 0 #111111;background:#FFFFFF;font:16px Figtree,sans-serif;color:#111111;display:flex;flex-direction:column;gap:14px',
    dugme: 'font:700 15px Figtree,sans-serif;border-radius:10px;padding:11px 18px;min-height:44px;cursor:pointer;border:2.5px solid #111111;background:#111111;color:#FFFFFF',
    ikincil: 'font:700 15px Figtree,sans-serif;border-radius:10px;padding:11px 18px;min-height:44px;cursor:pointer;border:2.5px solid #111111;background:#FFFFFF;color:#111111',
    kutu: 'font:400 22px Figtree,sans-serif;letter-spacing:.3em;width:100%;box-sizing:border-box;padding:12px 14px;border:2px solid #111111;border-radius:12px;text-align:center',
  };
  function ogeYap(etiket, stil, metin) {
    const e = document.createElement(etiket);
    if (stil) e.style.cssText = stil;
    if (metin) e.textContent = metin;
    return e;
  }
  // kurulum: ilk kez kuruluyorsa {qr, gizli}, yoksa null
  function ikinciAdim(kok, faktorId, kurulum) {
    return new Promise((tamam) => {
      kok.removeAttribute('style');
      kok.textContent = '';
      const kart = ogeYap('form', MFA_STIL.kart);
      kart.appendChild(ogeYap('h1', 'margin:0;font-size:24px', kurulum ? 'İki adımlı girişi kur' : 'Doğrulama kodu'));
      kart.appendChild(ogeYap('p', 'margin:0;line-height:1.5;color:#3A3A3A', kurulum
        ? 'Yönetim paneli üye bilgilerine eriştiği için şifrenin yanında telefonundaki bir kod da gerekiyor. Google Authenticator, Microsoft Authenticator ya da 1Password ile aşağıdaki karekodu okut, sonra uygulamanın gösterdiği 6 haneli kodu yaz.'
        : 'Telefonundaki doğrulama uygulamasında (Forest Club yönetim) görünen 6 haneli kodu yaz.'));
      if (kurulum) {
        const qr = ogeYap('img', 'width:200px;height:200px;align-self:center;border:2px solid #111111;border-radius:10px;padding:6px;background:#FFFFFF');
        qr.alt = 'İki adımlı giriş karekodu';
        qr.src = /^data:image\/svg\+xml/.test(kurulum.qr) ? kurulum.qr : '';
        kart.appendChild(qr);
        kart.appendChild(ogeYap('p', 'margin:0;font-size:13px;color:#5E5E5E;word-break:break-all', `Karekod okutamıyorsan uygulamaya bu anahtarı elle gir: ${kurulum.gizli}`));
      }
      const kutu = ogeYap('input', MFA_STIL.kutu);
      Object.assign(kutu, { inputMode: 'numeric', autocomplete: 'one-time-code', maxLength: 7, required: true });  // "123 456" de olur
      kutu.setAttribute('aria-label', '6 haneli kod');
      kart.appendChild(kutu);
      const mesaj = ogeYap('p', 'margin:0;min-height:20px;font-size:14px;color:#82301F');
      mesaj.setAttribute('role', 'status');
      kart.appendChild(mesaj);
      const dugme = ogeYap('button', MFA_STIL.dugme, kurulum ? 'Kur ve gir' : 'Doğrula');
      dugme.type = 'submit';
      const cikis = ogeYap('button', MFA_STIL.ikincil, 'Çıkış yap');
      cikis.type = 'button';
      cikis.addEventListener('click', () => window.FCCikis());
      kart.appendChild(dugme);
      kart.appendChild(cikis);
      kart.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kod = kutu.value.replace(/\s/g, '');
        if (!/^\d{6}$/.test(kod)) { mesaj.textContent = 'Kod 6 haneli olmalı.'; return; }
        dugme.disabled = true;
        mesaj.textContent = '';
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: faktorId, code: kod });
        dugme.disabled = false;
        if (error) { mesaj.textContent = /invalid|expired/i.test(error.message) ? 'Kod tutmadı; uygulamadaki güncel kodu yaz.' : error.message; kutu.select(); return; }
        tamam();
      });
      kok.appendChild(kart);
      kutu.focus();
    });
  }
  // Oturum aal2 değilse kodu ister; hesapta doğrulama uygulaması yoksa önce kurdurur
  async function ikinciAdimGerekirse(kok) {
    const { data: seviye, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (seviye.currentLevel === 'aal2') return;
    const { data: f, error: fHata } = await sb.auth.mfa.listFactors();
    if (fHata) throw fHata;
    const dogrulanmis = (f.totp || []).find((x) => x.status === 'verified');
    if (dogrulanmis) {
      await ikinciAdim(kok, dogrulanmis.id, null);
      return;
    }
    // Yarım kalmış kurulumlar silinir (en fazla faktör sınırına takılmasın)
    for (const x of (f.all || []).filter((y) => y.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data: yeni, error: kHata } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Forest Club yönetim' });
    if (kHata) throw kHata;
    await ikinciAdim(kok, yeni.id, { qr: yeni.totp.qr_code, gizli: yeni.totp.secret });
  }

  async function basla() {
    const kok = document.getElementById('kok');
    const kurtarma = window.FC_ORTAK.kurtarma;
    let hata = '';
    const { data: { session } } = await sb.auth.getSession();
    if (session && kurtarma) window.FC_SIFRE_YENILE = true;
    else if (session) {
      const { data: yon } = await sb.from('yoneticiler').select('ad').eq('user_id', session.user.id).maybeSingle();
      if (yon) {
        try {
          await ikinciAdimGerekirse(kok);
          window.FC = await veriYukle(session.user.email);
        } catch (h) {
          hata = `Veriler yüklenemedi: ${h.message}`;
        }
      } else {
        hata = `${session.user.email} bir yönetici hesabı değil. Yönetici e-postanla gir.`;
      }
    }
    kok.textContent = '';
    const panel = await window.DC.bagla('/sayfalar/yonetim.dc.html', kok, { varliklar: A.varliklar });
    if (hata) panel.setState({ girisHata: hata });
    if (window.FC) senkronKur(panel);
    if (window.FC && window.FC.eksik.length) {
      bildir(`Uyarı: bazı kayıtlar eksik yüklendi (${window.FC.eksik.join(', ')}). Sayfayı yenileyin; sürerse bize haber verin.`, true, 30000);
    }
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
