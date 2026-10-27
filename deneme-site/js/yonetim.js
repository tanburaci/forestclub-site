// Forest Club Urla · yönetici paneli (deneme sitesi): Supabase girişi, verinin panele yüklenmesi ve paneldeki
// değişikliklerin veritabanına yazılması. Panel (sayfalar/yonetim.dc.html) tasarımdaki haliyle çalışır; burada
// yalnız veri katmanı var.
(function () {
  'use strict';
  const A = window.FC_AYAR;
  const { sb, bildir } = window.FC_ORTAK;
  const bugun = window.FC_ORTAK.bugun;
  const gunEkle = (t, n) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const trTarih = (t) => (t ? t.split('-').reverse().join('.') : '—');
  const etkEtiket = (e) => `${e.tarih.slice(8)}.${e.tarih.slice(5, 7)} ${e.ad}`;
  const SABLON_SIRA = ['basvuru', 'onay', 'yenileme', 'duyuru', 'hatirlatma', 'sifre', 'dogumgunu', 'ozelgun', 'tanisma', 'iptal', 'bekleme', 'anket'];
  const GUN_YAZI = { yenileme: 'gün kala gönderilsin', hatirlatma: 'gün önce gönderilsin', anket: 'gün sonra gönderilsin' };

  async function hepsi(tablo, sira) {
    const { data, error } = await sb.from(tablo).select('*').order(sira || 'id').range(0, 9999);
    if (error) throw error;
    return data;
  }

  // --- Veritabanı → panelin beklediği biçim ------------------------------------------------------------------
  async function veriYukle(eposta) {
    const [uyeler, odemeler, etkinlikler, kayitlar, biletler, hareketler, envanter, sablonlar, dekontlar, cagri, sayaclar] = await Promise.all([
      hepsi('uyeler'), hepsi('odemeler'), hepsi('etkinlikler'), hepsi('etkinlik_kayitlari', 'etkinlik_id'),
      hepsi('tanisma_biletleri'), hepsi('muhasebe_hareketleri'), hepsi('envanter'), hepsi('eposta_sablonlari'),
      hepsi('dekontlar'), hepsi('acik_cagri'), hepsi('sayaclar', 'tarih'),
    ]);
    const B = bugun();
    const idSira = new Map();
    const kisiler = uyeler.map((u, i) => {
      idSira.set(u.id, i);
      const ods = odemeler.filter((o) => o.uye_id === u.id).sort((a, b) => a.tarih.localeCompare(b.tarih));
      const durum = u.bitis ? (u.bitis > B ? 'aktif' : 'doldu') : 'basvuru';
      return {
        i, id: u.id, ad: u.ad, eposta: u.eposta, tel: u.tel || '', kod: u.kod, durum, bas: u.baslangic, bitis: u.bitis,
        basvuru: u.basvuru_tarihi, yol: ods.length ? ods[ods.length - 1].yol : 'kart',
        odemeler: ods.map((o) => ({ tarih: o.tarih, yol: o.yol })),
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
    const etkListe = etkinlikler.map((e) => {
      const key = `${e.tarih}|${e.ad}`;
      etkKey.set(e.id, key);
      keyEtk[key] = e.id;
      const rs = kayitlar.filter((r) => r.etkinlik_id === e.id);
      kayitHarita[key] = {
        kontenjan: e.kontenjan,
        kayitli: rs.filter((r) => r.durum === 'kayitli').map((r) => idSira.get(r.uye_id)),
        bekleme: rs.filter((r) => r.durum === 'bekleme').sort((a, b) => (a.sira || 0) - (b.sira || 0)).map((r) => idSira.get(r.uye_id)),
        gelen: rs.filter((r) => r.durum === 'kayitli' && r.geldi).map((r) => idSira.get(r.uye_id)),
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
        biletler: biletler.map((b) => ({ id: b.id, ad: b.ad, eposta: b.eposta, alinis: b.alinis,
          etkinlik: b.etkinlik_id ? etkEtiket(etkById.get(b.etkinlik_id)) : '', durum: b.durum })),
      },
      etkinlikler: etkListe,
      hareketler: hareketler.map((h) => ({
        id: h.id, tarih: h.tarih, tur: h.tur, tutar: Number(h.tutar), kasa: h.kasa, hedef: h.hedef_kasa || '',
        kategori: h.kategori || '', etk: h.etkinlik_id ? etkKey.get(h.etkinlik_id) || '' : '', aciklama: h.aciklama,
        belge: h.belge || '', otomatik: h.otomatik, ...(h.odeme ? { odeme: h.odeme } : {}),
      })),
      envanter: envanter.map((e) => ({
        id: e.id, ad: e.ad, kategori: e.kategori, adet: Number(e.adet), birim: e.birim, giris: e.giris, tarih: e.tarih,
        tutar: Number(e.tutar || 0), kasa: e.kasa || 'banka', firma: e.firma || '', karsilik: e.karsilik || '',
        kaynak: e.kaynak || '', konum: e.konum || '', not: e.notlar || '',
      })),
      sablonlar: [...sablonlar].sort((a, b) => SABLON_SIRA.indexOf(a.id) - SABLON_SIRA.indexOf(b.id)).map((s) => ({
        id: s.id, ad: s.ad, ne: s.ne_zaman, acik: s.acik, konu: s.konu, metin: s.metin, alanlar: s.alanlar,
        ...(s.gun ? { gun: s.gun, gunYazi: GUN_YAZI[s.id] || 'gün' } : {}),
      })),
      notlar: Object.fromEntries(uyeler.filter((u) => u.yonetici_notu).map((u) => [u.ad, u.yonetici_notu])),
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
    const pencere = window.open('', '_blank');  // tıklama anında açılır (açılır pencere engeline takılmasın)
    const { data, error } = await sb.storage.from('dekontlar').createSignedUrl(yol, 60);
    if (error) { if (pencere) pencere.close(); return bildir(`Dekont açılamadı: ${error.message}`, true); }
    if (pencere) pencere.location = data.signedUrl; else location.href = data.signedUrl;
  }
  async function dekontKarar(panel, d, onay) {
    const { data, error } = await sb.rpc('dekont_karar', { p_id: d.id, p_onay: onay });
    if (error) return bildir(error.message, true);
    bildir(onay ? `${d.ad}: üyelik ${trTarih(data.bitis)} tarihine kadar ✓` : 'Dekont reddedildi');
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

  // --- Paneldeki değişiklikler → veritabanı ------------------------------------------------------------------
  const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const bekleyenler = {};
  function ertele(ad, f, ms = 700) { clearTimeout(bekleyenler[ad]); bekleyenler[ad] = setTimeout(f, ms); }
  async function yaz(is, metin) {
    try {
      const { error } = await is;
      if (error) throw error;
      if (metin) bildir(metin);
    } catch (h) {
      console.error(h);
      bildir(`Kaydedilemedi: ${h.message || h}`, true);
    }
  }

  function senkronKur(panel) {
    const FC = window.FC;
    const keyEtk = FC._keyEtk;
    const uyeAd = new Map(FC.DEMO.kisiler.map((k) => [k.ad, k]));
    const hareketSatiri = (h) => ({
      tarih: h.tarih, tur: h.tur, tutar: h.tutar, kasa: h.kasa, hedef_kasa: h.tur === 'aktarim' ? h.hedef || null : null,
      kategori: h.kategori || null, etkinlik_id: h.etk ? keyEtk[h.etk] || null : null, aciklama: h.aciklama,
      belge: h.belge || null, otomatik: !!h.otomatik, odeme: h.odeme || null,
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

    async function eldenOdeme(h) { // "Aidat · Ad" elden: üyeye ödeme + üyelik 30 gün uzar
      const ad = (h.aciklama || '').replace(/^Aidat · /, '').trim();
      const k = uyeAd.get(ad);
      if (!k) return bildir(`“${ad}” adlı üye bulunamadı; ödeme yalnız muhasebeye yazıldı.`, true);
      const temel = k.bitis && k.bitis > h.tarih ? k.bitis : h.tarih;
      const bitis = gunEkle(temel, 30);
      await yaz(sb.from('odemeler').insert({ uye_id: k.id, tarih: h.tarih, tutar: h.tutar, yol: 'elden', aciklama: 'Elden ödeme' }));
      await yaz(sb.from('uyeler').update({ bitis, baslangic: k.bas || h.tarih, durum: 'aktif' }).eq('id', k.id));
      Object.assign(k, { bitis, bas: k.bas || h.tarih, durum: 'aktif' });
      k.odemeler.push({ tarih: h.tarih, yol: 'elden' });
      panel.forceUpdate();
    }

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
            sb.from('muhasebe_hareketleri').insert(hareketSatiri(h)).select('id').single().then(({ data, error }) => {
              if (error) return bildir(`Kaydedilemedi: ${error.message}`, true);
              bilinenH.add(data.id);
              panel.setState((s) => ({ hareketler: yeniId(s.hareketler, h.id, data.id) }));
              bildir('Muhasebeye kaydedildi ✓');
              if (h.kategori === 'Aidat' && h.odeme === 'elden' && !h.otomatik) eldenOdeme(h);
            });
          } else if (eski && !esit(hareketSatiri(eski), hareketSatiri(h))) {
            yaz(sb.from('muhasebe_hareketleri').update(hareketSatiri(h)).eq('id', h.id), 'Güncellendi ✓');
          }
        });
        once.hareketler.filter((h) => !yeniIdler.has(h.id) && h.id < 1e12 && bilinenH.has(h.id)).forEach((h) => {
          yaz(sb.from('muhasebe_hareketleri').delete().eq('id', h.id), 'Silindi ✓');
        });
      }
      // Envanter
      if (once.envanter !== simdi.envanter) {
        const eskiId = new Map(once.envanter.map((e) => [e.id, e]));
        simdi.envanter.forEach((e) => {
          const eski = eskiId.get(e.id);
          if (!bilinenE.has(e.id)) {
            bilinenE.add(e.id);
            sb.from('envanter').insert(envanterSatiri(e)).select('id').single().then(({ data, error }) => {
              if (error) return bildir(`Kaydedilemedi: ${error.message}`, true);
              bilinenE.add(data.id);
              panel.setState((s) => ({ envanter: yeniId(s.envanter, e.id, data.id) }));
              bildir('Envantere kaydedildi ✓');
            });
          } else if (eski && !esit(envanterSatiri(eski), envanterSatiri(e))) {
            ertele(`env${e.id}`, () => yaz(sb.from('envanter').update(envanterSatiri(e)).eq('id', e.id), 'Envanter güncellendi ✓'), 400);
          }
        });
      }
      // Yeni etkinlik
      if (once.etkinlikler !== simdi.etkinlikler) {
        simdi.etkinlikler.filter((e) => !e.id).forEach((e) => {
          const key = `${e.tarih}|${e.ad}`;
          if (keyEtk[key] === 'yaziliyor') return;
          keyEtk[key] = 'yaziliyor';
          sb.from('etkinlikler').insert({
            tarih: e.tarih, saat: e.saat || null, tur: e.tur, ad: e.ad, kim: e.kim || null, kontenjan: e.kontenjan,
            bilet_fiyati: e.satis ? e.satis.fiyat : null, uyelere: e.satis ? e.satis.uye : null,
          }).select('id').single().then(({ data, error }) => {
            if (error) { delete keyEtk[key]; return bildir(`Etkinlik kaydedilemedi: ${error.message}`, true); }
            keyEtk[key] = data.id;
            panel.setState((s) => ({ etkinlikler: s.etkinlikler.map((x) => (`${x.tarih}|${x.ad}` === key && !x.id ? { ...x, id: data.id } : x)) }));
            bildir('Etkinlik kaydedildi ✓');
          });
        });
      }
      // Kayıtlar, yoklama, bekleme listesi, kontenjan
      if (once.kayitlar !== simdi.kayitlar) {
        Object.keys(simdi.kayitlar).forEach((key) => {
          const o = once.kayitlar[key];
          const n = simdi.kayitlar[key];
          if (o === n) return;
          const etkId = keyEtk[key];
          if (!etkId || etkId === 'yaziliyor') return;
          if (o && o.kontenjan !== n.kontenjan) {
            ertele(`kont${etkId}`, () => yaz(sb.from('etkinlikler').update({ kontenjan: n.kontenjan }).eq('id', etkId), 'Kontenjan güncellendi ✓'));
          }
          const satir = (i) => {
            const k = FC.DEMO.kisiler[i];
            const b = n.bekleme.indexOf(i);
            return { etkinlik_id: etkId, uye_id: k.id, durum: b >= 0 ? 'bekleme' : 'kayitli', geldi: n.gelen.includes(i), sira: b >= 0 ? b + 1 : null };
          };
          const simdiki = new Set([...n.kayitli, ...n.bekleme]);
          const onceki = o ? new Set([...o.kayitli, ...o.bekleme]) : new Set();
          const degisen = [...simdiki].filter((i) => !o || !onceki.has(i) || o.gelen.includes(i) !== n.gelen.includes(i)
            || o.bekleme.indexOf(i) !== n.bekleme.indexOf(i));
          if (degisen.length) yaz(sb.from('etkinlik_kayitlari').upsert(degisen.map(satir)), 'Yoklama kaydedildi ✓');
          const cikan = [...onceki].filter((i) => !simdiki.has(i)).map((i) => FC.DEMO.kisiler[i].id);
          if (cikan.length) yaz(sb.from('etkinlik_kayitlari').delete().eq('etkinlik_id', etkId).in('uye_id', cikan));
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
      // Tanışma biletleri
      if (once.biletler !== simdi.biletler) {
        simdi.biletler.forEach((b) => {
          const e = once.biletler.find((x) => x.id === b.id);
          if (e && e.durum !== b.durum) yaz(sb.from('tanisma_biletleri').update({ durum: b.durum }).eq('id', b.id), 'Bilet güncellendi ✓');
        });
      }
      // Yönetici notu
      if (once.notlar !== simdi.notlar) {
        Object.keys(simdi.notlar).forEach((ad) => {
          if (once.notlar[ad] === simdi.notlar[ad]) return;
          const k = uyeAd.get(ad);
          if (k) ertele(`not${k.id}`, () => yaz(sb.from('uyeler').update({ yonetici_notu: simdi.notlar[ad] || null }).eq('id', k.id), 'Not kaydedildi ✓'));
        });
      }
    };
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
  }
  basla().catch((h) => { document.getElementById('kok').textContent = `Sayfa açılamadı: ${h.message}`; console.error(h); });
})();
