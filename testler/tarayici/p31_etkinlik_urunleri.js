// Etkinliğe özel ürünler: etkinliğin kendi sayfasında (/e/<id>) "Etkinliğe özel ürünler" (liste sunucudan; yalnız etkinlik
// saatinin çevresinde dolu gelir), girişsiz sipariş: nakit / POS (ekranda sipariş kodu), kart (Shopier ayrı pencerede),
// havale (dekont). Yönetim: Ürünler sekmesi (ekle, aç/kapat), etkinlik düzenlemede ürün seçimi, siparişler (Ödendi / Reddet).
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const PDF = { name: 'dekont.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 dekont') };
const etk = { id: 7, tarih: gun(0), saat: '18.00', tur: 'bulusma', ad: 'Sunset Club', kim: null, kontenjan: 50, bilet_fiyati: null,
  uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'Gün batımı', link: null };
const URUNLER = [{ id: 1, ad: 'Yelpaze 1', fiyat: 1500, foto: null }, { id: 2, ad: 'Yelpaze 2', fiyat: 2000, foto: null }];
const anaHtml = fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8');

async function siteAc(tarayici, { urunler = URUNLER, kart = false, boy = { width: 1280, height: 860 } } = {}) {
  const istenen = [];
  let sor = 0;
  const v = { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: kart }] },
    rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null],
      etkinlik_urun_listesi: (g) => { istenen.push(g); return [200, urunler]; },
      urun_siparis_durum: (g) => [200, (++sor >= 2 && g.p_id === 43 && g.p_eposta === 'misafir@posta.test') ? 'onaylandi' : 'bekliyor'] } };
  const s = await sayfaAc(tarayici, v);
  await s.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
  await s.page.setViewportSize(boy);
  const formlar = [];
  const yuklemeler = [];
  await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
  await s.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    const g = JSON.parse(r.request().postData());
    formlar.push(g);
    const yol = g.veri.yol;
    const sonuc = g.tur !== 'urun_siparis' ? 'tamam'
      : yol === 'kart' ? { id: 43, kod: 'U-43', tutar: 1500, yol, sayfa: 'https://shopier.test/urun/43' }
        : yol === 'havale' ? { id: 42, kod: 'U-42', tutar: 2000, yol, dosya: 'yeni/1730000000000-abcdef0123456789', jeton: 'imza-jetonu' }
          : { id: 41, kod: 'U-41', tutar: 5000, yol };
    r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ sonuc }) }).catch(() => {});
  });
  await s.page.route(`${SB}/storage/v1/object/upload/sign/**`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    yuklemeler.push(new URL(r.request().url()).pathname);
    r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ Key: 'dekontlar/yeni/x' }) });
  });
  await s.ctx.route('https://shopier.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Shopier</title>' }).catch(() => {}));
  await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: anaHtml }));
  return { ...s, istenen, formlar, yuklemeler };
}

async function bilgileriDoldur(b, yolAdi) {
  await b.getByLabel('Ad Soyad *').fill('Misafir Kişi');
  await b.getByLabel('E-posta *').fill('misafir@posta.test');
  await b.getByLabel('Telefon *').fill('0532 000 00 00');
  await b.getByRole('radio', { name: yolAdi }).click();
  await b.getByRole('checkbox', { name: /KVKK/ }).check();
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Etkinlik sayfası: liste + nakit ----------
    const s = await siteAc(tarayici);
    await s.page.goto(`${SITE}/e/7`);
    const b = s.page.locator('section.fe-urunler');
    await b.getByRole('heading', { name: 'Etkinliğe özel ürünler' }).waitFor({ timeout: 10000 });
    dogru(s.istenen.length === 1 && s.istenen[0].p_etkinlik === 7, 'liste sunucudan bu etkinlik için istendi');
    dogru((await b.innerText()).includes('Yelpaze 1') && (await b.innerText()).includes('1.500 TL') && (await b.innerText()).includes('2.000 TL'), 'ürünler adı ve fiyatıyla görünür');
    await b.getByRole('button', { name: 'Yelpaze 1 adedini arttır' }).click();
    await b.getByRole('button', { name: 'Yelpaze 1 adedini arttır' }).click();
    await b.getByRole('button', { name: 'Yelpaze 2 adedini arttır' }).click();
    dogru(await b.getByRole('radio', { name: /Kredi \/ banka kartı/ }).getAttribute('aria-disabled') === 'true', 'kart ödemesi kapalıyken kart seçilemez');
    await bilgileriDoldur(b, /Standda nakit/);
    await b.getByRole('button', { name: /Siparişi ver · 5\.000 TL/ }).click();
    await b.getByText('U-41').waitFor({ timeout: 8000 });
    const g = s.formlar.find((x) => x.tur === 'urun_siparis');
    dogru(g && g.jeton && g.veri.etkinlik === 7 && g.veri.yol === 'nakit' && g.veri.kvkk === true && g.veri.eposta === 'misafir@posta.test'
      && JSON.stringify(g.veri.kalemler) === JSON.stringify([{ urun: 1, adet: 2 }, { urun: 2, adet: 1 }]), `sipariş form-gonder'e gitti (${JSON.stringify(g && g.veri)})`);
    dogru((await b.innerText()).includes('standdaki ekibimize'), 'nakit: kodu standda göster yazısı');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');
    await s.ctx.close();

    // ---------- Liste boş (pencere dışı) ve ana sayfa: bölüm yok ----------
    const s2 = await siteAc(tarayici, { urunler: [] });
    await s2.page.goto(`${SITE}/e/7`);
    await s2.page.getByRole('heading', { name: 'Sunset Club' }).first().waitFor({ timeout: 10000 });
    await s2.page.waitForTimeout(300);
    dogru(await s2.page.getByText('Etkinliğe özel ürünler').count() === 0, 'satış saatinin dışında bölüm görünmez');
    await s2.page.goto(`${SITE}/`);
    await s2.page.locator('#bulusmalar').waitFor({ timeout: 10000 });
    dogru(await s2.page.getByText('Etkinliğe özel ürünler').count() === 0 && s2.istenen.length === 1, 'ana sayfada ürün yok, liste istenmez');
    await s2.ctx.close();

    // ---------- Kart: Shopier ayrı pencerede, ödeme gelince "Ödemen alındı" (telefon) ----------
    const s3 = await siteAc(tarayici, { kart: true, boy: { width: 390, height: 844 } });
    await s3.page.goto(`${SITE}/e/7`);
    const b3 = s3.page.locator('section.fe-urunler');
    await b3.getByRole('heading', { name: 'Etkinliğe özel ürünler' }).waitFor({ timeout: 10000 });
    dogru(await s3.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'telefon: yatay kaydırma yok');
    await b3.getByRole('button', { name: 'Yelpaze 1 adedini arttır' }).click();
    await bilgileriDoldur(b3, /Kredi \/ banka kartı/);
    const pencereSoz = s3.ctx.waitForEvent('page');
    await b3.getByRole('button', { name: /Siparişi ver · 1\.500 TL/ }).click();
    const pencere = await pencereSoz;
    await pencere.waitForURL('https://shopier.test/urun/43', { timeout: 8000 });
    await b3.getByText('Ödemen bekleniyor…').waitFor({ timeout: 5000 });
    dogru(true, 'kart: Shopier ayrı pencerede açıldı, sayfa bekliyor');
    await b3.getByText('Ödemen alındı!').waitFor({ timeout: 15000 });
    dogru((await b3.innerText()).includes('U-43'), 'kart: ödeme gelince sipariş kodu görünür');
    await s3.ctx.close();

    // ---------- Havale: dekont imzalı adrese, sonra urun_kaydet ----------
    const s4 = await siteAc(tarayici);
    await s4.page.goto(`${SITE}/e/7`);
    const b4 = s4.page.locator('section.fe-urunler');
    await b4.getByRole('heading', { name: 'Etkinliğe özel ürünler' }).waitFor({ timeout: 10000 });
    await b4.getByRole('button', { name: 'Yelpaze 2 adedini arttır' }).click();
    await bilgileriDoldur(b4, /Havale \/ EFT/);
    await b4.getByRole('button', { name: /Siparişi ver · 2\.000 TL/ }).click();
    await b4.getByText('IBAN', { exact: false }).first().waitFor({ timeout: 8000 });
    await b4.locator('input[type="file"]').setInputFiles(PDF);
    await b4.getByRole('button', { name: 'Dekontu gönder' }).click();
    await b4.getByText('Dekontun bize ulaştı', { exact: false }).waitFor({ timeout: 8000 });
    const k = s4.formlar.find((x) => x.tur === 'urun_kaydet');
    dogru(s4.yuklemeler.some((y) => y.endsWith('/dekontlar/yeni/1730000000000-abcdef0123456789')) && k && k.veri.id === 42 && !k.jeton,
      'havale: dekont yüklendi, sipariş kaydedildi');
    await s4.ctx.close();

    // ---------- Yönetim: Ürünler sekmesi, etkinlikte ürün seçimi, siparişler ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
    v.tablolar.urunler = [{ id: 1, ad: 'Yelpaze 1', fiyat: 1500, foto: null, aktif: true }, { id: 2, ad: 'Yelpaze 2', fiyat: 2000, foto: null, aktif: true }];
    v.tablolar.etkinlik_urunleri = [{ etkinlik_id: 10, urun_id: 2 }];
    v.tablolar.urun_siparisleri = [
      { id: 41, etkinlik_id: 10, ad: 'Nakit Kişi', eposta: 'n@posta.test', tel: '05320000000', kalemler: [{ urun_id: 1, ad: 'Yelpaze 1', adet: 2, birim: 1500, tutar: 3000 }],
        tutar: 3000, odeme_yolu: 'nakit', dosya: null, yuklendi: true, durum: 'bekliyor', sonuc: null, created_at: new Date().toISOString() },
      { id: 40, etkinlik_id: 10, ad: 'Kart Kişi', eposta: 'k@posta.test', tel: '05320000001', kalemler: [{ urun_id: 2, ad: 'Yelpaze 2', adet: 1, birim: 2000, tutar: 2000 }],
        tutar: 2000, odeme_yolu: 'kart', dosya: null, yuklendi: true, durum: 'onaylandi', sonuc: null, created_at: new Date().toISOString() },
    ];
    v.rpc.urun_karar = (gv) => { v.rpcler.push(['urun_karar', gv]); return [200, { durum: gv.p_onay ? 'onaylandi' : 'reddedildi' }]; };
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await sekme(y.page, 'Ürünler');
    const ub = y.page.locator('section.fc-urunler');
    await ub.getByText('Yelpaze 2').first().waitFor({ timeout: 5000 });
    await ub.getByLabel('Ürün adı').fill('Yelpaze 3');
    await ub.getByLabel('Fiyat (TL)').fill('2500');
    await ub.getByRole('button', { name: 'Ürünü ekle' }).click();
    await ub.getByText('Yelpaze 3 eklendi', { exact: false }).waitFor({ timeout: 5000 });
    const ekle = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/urunler');
    dogru(ekle && ekle.govde.ad === 'Yelpaze 3' && ekle.govde.fiyat === 2500, `ürün eklendi (${JSON.stringify(ekle && ekle.govde)})`);
    await ub.locator('.fc-urun-satir').filter({ hasText: 'Yelpaze 1' }).getByRole('button', { name: 'Satışa kapat' }).click();
    await y.page.waitForTimeout(300);
    const kapa = y.istekler.find((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/urunler');
    dogru(kapa && kapa.govde.aktif === false && /id=eq\.1/.test(kapa.ara), 'ürün satışa kapatıldı');
    // Siparişler: bekleyen nakit → Ödendi; kartla ödenmiş listede
    const sp = y.page.locator('section.fc-urun-siparis');
    dogru((await sp.innerText()).includes('U-41') && (await sp.innerText()).includes('Breakfast Club') && (await sp.innerText()).includes('U-40'), 'siparişler etkinliğe göre listelenir');
    await sp.getByRole('button', { name: 'Ödendi' }).click();
    await y.page.waitForTimeout(500);
    const karar = v.rpcler.find((x) => x[0] === 'urun_karar');
    dogru(karar && karar[1].p_id === 41 && karar[1].p_onay === true, 'nakit sipariş "Ödendi" işaretlendi');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
    await y.ctx.close();

    // Etkinlik düzenleme: ürün seçimi kaydedilir
    const v2 = yonetimVerisi();
    v2.tablolar.uyeler = v2.tablolar.uyeler.slice(0, 5);
    v2.tablolar.urunler = [{ id: 1, ad: 'Yelpaze 1', fiyat: 1500, foto: null, aktif: true }, { id: 2, ad: 'Yelpaze 2', fiyat: 2000, foto: null, aktif: true }];
    v2.tablolar.etkinlik_urunleri = [{ etkinlik_id: 10, urun_id: 2 }];
    const y2 = await sayfaAc(tarayici, v2, oturum('yon-1', 'yonetici@posta.test'));
    await y2.page.goto(`${SITE}/yonetim/`);
    await y2.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await sekme(y2.page, 'Etkinlikler');
    await y2.page.locator('article').filter({ hasText: 'Breakfast Club' }).getByRole('button', { name: 'Düzenle', exact: true }).click();
    await y2.page.getByText('Etkinliği düzenle').waitFor({ timeout: 3000 });
    dogru(await y2.page.getByRole('checkbox', { name: /Yelpaze 2/ }).isChecked() && !(await y2.page.getByRole('checkbox', { name: /Yelpaze 1/ }).isChecked()), 'düzenle: etkinliğin ürünleri işaretli');
    await y2.page.getByRole('checkbox', { name: /Yelpaze 1/ }).check();
    await y2.page.getByRole('button', { name: 'Etkinliği kaydet' }).click();
    await y2.page.getByText('“Breakfast Club” güncellendi.').waitFor({ timeout: 5000 });
    const sil = y2.istekler.find((x) => x.yontem === 'DELETE' && x.yol === '/rest/v1/etkinlik_urunleri');
    const ekl = y2.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/etkinlik_urunleri');
    dogru(sil && /etkinlik_id=eq\.10/.test(sil.ara) && ekl && JSON.stringify(ekl.govde) === JSON.stringify([{ etkinlik_id: 10, urun_id: 1 }, { etkinlik_id: 10, urun_id: 2 }]),
      `etkinliğin ürünleri kaydedildi (${JSON.stringify(ekl && ekl.govde)})`);
    await y2.ctx.close();
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 3).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
