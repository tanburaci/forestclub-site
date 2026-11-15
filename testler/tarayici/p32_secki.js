// Seçki (/secki, 15.11.2026): etkinlikten bağımsız ürün satışı, gizli test sürümü. Liste sunucudan (secki_listesi);
// sade fiyat ("1.500 ₺"), az stok "Bu seriden 2 adet kaldı", tükenen "Bu seri tamamlandı"; ödeme kart (Shopier) ya da
// havale (nakit yok); teslim bir sonraki buluşmada elden. Sayfanın hiçbir menüde bağlantısı yok ve arama motorlarına kapalı.
// Yönetim: ürün formunda "Seçki'de satışta" ve açıklama; Seçki siparişleri ayrı grupta.
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const PDF = { name: 'dekont.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 dekont') };
const URUNLER = [{ id: 1, ad: 'Yelpaze', aciklama: 'Urla\'da elde yapıldı.', fiyat: 1500, foto: null, kalan: 2 },
  { id: 2, ad: 'Yelpaze 2', aciklama: null, fiyat: 2000, foto: null, kalan: 6 }, { id: 3, ad: 'Bitti', aciklama: null, fiyat: 900, foto: null, kalan: 0 }];

async function seckiAc(tarayici, { urunler = URUNLER, kart = true, boy = { width: 1280, height: 860 } } = {}) {
  let sor = 0;
  const v = { tablolar: { ayarlar: [{ anahtar: 'kart_odeme', deger: kart }], uyeler: [] },
    rpc: { secki_listesi: () => [200, urunler], sayac_artir: () => [200, null],
      urun_siparis_durum: (g) => [200, (++sor >= 2 && g.p_id === 53) ? 'onaylandi' : 'bekliyor'] } };
  const s = await sayfaAc(tarayici, v);
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
      : yol === 'kart' ? { id: 53, kod: 'U-53', tutar: 1500, yol, sayfa: 'https://shopier.test/urun/53' }
        : { id: 52, kod: 'U-52', tutar: 3500, yol, dosya: 'yeni/1730000000000-secki0123456789', jeton: 'imza-jetonu' };
    r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ sonuc }) }).catch(() => {});
  });
  await s.page.route(`${SB}/storage/v1/object/upload/sign/**`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    yuklemeler.push(new URL(r.request().url()).pathname);
    r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ Key: 'dekontlar/yeni/x' }) });
  });
  await s.ctx.route('https://shopier.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Shopier</title>' }).catch(() => {}));
  return { ...s, formlar, yuklemeler };
}

async function bilgileriDoldur(b, yolAdi) {
  await b.getByLabel('Ad Soyad *').fill('Misafir Kişi');
  await b.getByLabel('E-posta *').fill('misafir@posta.test');
  await b.getByLabel('Telefon *').fill('0532 000 00 00');
  await b.getByRole('radio', { name: yolAdi }).click();
  await b.getByRole('checkbox', { name: /KVKK/ }).check();
}

(async () => {
  // ---------- Gizli: hiçbir menüde / sayfada /secki bağlantısı yok; arama motorlarına kapalı ----------
  const kaynaklar = ['index.html', 'sayfalar/site.dc.html', 'sayfalar/uye.dc.html', 'sayfalar/yonetim.dc.html', 'sitemap.xml', 'uye/index.html', 'yonetim/index.html']
    .filter((d) => fs.existsSync(path.join(DENEME, d)));
  const baglanti = kaynaklar.filter((d) => /href="\/secki/.test(fs.readFileSync(path.join(DENEME, d), 'utf8')));
  dogru(!baglanti.length, `site, üye ve yönetimde /secki bağlantısı yok${baglanti.length ? ` (${baglanti.join(', ')})` : ''}`);
  const basliklar = fs.readFileSync(path.join(DENEME, '_headers'), 'utf8');
  dogru(/\n\/secki\n\s+X-Robots-Tag: noindex/.test(basliklar) && /name="robots" content="noindex/.test(fs.readFileSync(path.join(DENEME, 'secki/index.html'), 'utf8')),
    'Seçki arama motorlarına kapalı (noindex)');

  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Liste + havale ----------
    const s = await seckiAc(tarayici);
    await s.page.goto(`${SITE}/secki/`);
    await s.page.getByRole('heading', { name: 'Seçki', exact: true }).waitFor({ timeout: 10000 });
    const metin = await s.page.locator('main').innerText();
    dogru(metin.includes('1.500 ₺') && metin.includes('2.000 ₺') && !/TL|,\d\d\b/.test(metin.split('Siparişin')[0]), 'fiyat sade: "1.500 ₺" (TL, kuruş yok)');
    dogru(metin.includes('Urla\'da elde yapıldı.'), 'açıklama görünür');
    dogru(metin.includes('Bu seriden 2 adet kaldı.') && metin.includes('Bu seri tamamlandı.') && !/Son \d|Tükendi/.test(metin), 'az stok ve tükenen sakin dille');
    dogru(!(await s.page.getByRole('button', { name: 'Bitti adedini arttır' }).count()), 'tükenen ürün seçilemez');
    dogru(!(await s.page.getByRole('radio', { name: /nakit/i }).count()), 'nakit seçeneği yok');
    dogru(metin.includes('bir sonraki buluşmada, Pinya\'da elden'), 'teslim: bir sonraki buluşmada elden');
    const art = s.page.getByRole('button', { name: 'Yelpaze adedini arttır' });
    await art.click(); await art.click();
    dogru(await art.isDisabled(), 'en çok kalan stok kadar seçilir');
    await s.page.getByRole('button', { name: 'Yelpaze 2 adedini arttır' }).click();
    const form = s.page.locator('section.sk-form');
    await bilgileriDoldur(form, /Havale \/ EFT/);
    await form.getByRole('button', { name: /Siparişi ver · 5\.000 ₺/ }).click();
    await s.page.getByRole('button', { name: 'Dekontu gönder' }).waitFor({ timeout: 8000 });
    const g = s.formlar.find((x) => x.tur === 'urun_siparis');
    dogru(g && g.jeton && g.veri.secki === true && g.veri.etkinlik === undefined && g.veri.yol === 'havale' && g.veri.kvkk === true
      && JSON.stringify(g.veri.kalemler) === JSON.stringify([{ urun: 1, adet: 2 }, { urun: 2, adet: 1 }]), `Seçki siparişi form-gonder'e gitti (${JSON.stringify(g && g.veri)})`);
    await s.page.locator('input[type="file"]').setInputFiles(PDF);
    await s.page.getByRole('button', { name: 'Dekontu gönder' }).click();
    await s.page.getByText('Dekontun bize ulaştı', { exact: false }).waitFor({ timeout: 8000 });
    const k = s.formlar.find((x) => x.tur === 'urun_kaydet');
    dogru(s.yuklemeler.some((y) => y.endsWith('/dekontlar/yeni/1730000000000-secki0123456789')) && k && k.veri.id === 52, 'havale: dekont yüklendi, sipariş kaydedildi');
    dogru((await s.page.locator('.sk-kod').innerText()) === 'U-52', 'sipariş kodu görünür');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'sayfa hatası yok');
    await s.ctx.close();

    // ---------- Kart (telefon): Shopier ayrı pencerede, ödeme gelince kod ----------
    const s2 = await seckiAc(tarayici, { boy: { width: 390, height: 844 } });
    await s2.page.goto(`${SITE}/secki/`);
    await s2.page.getByRole('heading', { name: 'Seçki', exact: true }).waitFor({ timeout: 10000 });
    dogru(await s2.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'telefon: yatay kaydırma yok');
    await s2.page.getByRole('button', { name: 'Yelpaze adedini arttır' }).click();
    const f2 = s2.page.locator('section.sk-form');
    dogru(await f2.getByRole('radio', { name: /Kredi \/ banka kartı/ }).getAttribute('aria-checked') === 'true', 'kart açıkken varsayılan kart');
    await bilgileriDoldur(f2, /Kredi \/ banka kartı/);
    const pencereSoz = s2.ctx.waitForEvent('page');
    await f2.getByRole('button', { name: /Siparişi ver · 1\.500 ₺/ }).click();
    const pencere = await pencereSoz;
    await pencere.waitForURL('https://shopier.test/urun/53', { timeout: 8000 });
    await s2.page.getByText('Ödemen bekleniyor…').waitFor({ timeout: 5000 });
    await s2.page.getByText('Ödemen alındı', { exact: false }).waitFor({ timeout: 15000 });
    dogru((await s2.page.locator('.sk-kod').innerText()) === 'U-53', 'kart: ödeme gelince sipariş kodu görünür');
    await s2.ctx.close();

    // ---------- Boş liste ----------
    const s3 = await seckiAc(tarayici, { urunler: [] });
    await s3.page.goto(`${SITE}/secki/`);
    await s3.page.getByText('Seçki şu an hazırlanıyor.').waitFor({ timeout: 10000 });
    dogru(!(await s3.page.locator('section.sk-form').count()), 'ürün yokken form yok');
    await s3.ctx.close();

    // ---------- Yönetim: Seçki anahtarı, açıklama, Seçki siparişleri ayrı grupta ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
    v.tablolar.urunler = [{ id: 1, ad: 'Yelpaze 1', fiyat: 1500, foto: null, aktif: true, secki: true, aciklama: 'Eski açıklama', envanter_id: null }];
    v.tablolar.urun_siparisleri = [{ id: 61, etkinlik_id: null, ad: 'Seçki Kişi', eposta: 's@posta.test', tel: '05320000000',
      kalemler: [{ urun_id: 1, ad: 'Yelpaze 1', adet: 1, birim: 1500, tutar: 1500 }], tutar: 1500, odeme_yolu: 'havale', dosya: 'yeni/x', yuklendi: true,
      durum: 'bekliyor', sonuc: null, created_at: new Date().toISOString() }];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    dogru(!(await y.page.locator('a[href^="/secki"]').count()), 'yönetim: menüde Seçki bağlantısı yok');
    await y.page.locator('button').filter({ hasText: /^Ürünler$/ }).first().click();
    const ub = y.page.locator('section.fc-urunler');
    const satir = ub.locator('.fc-urun-satir').filter({ hasText: 'Yelpaze 1' });
    await satir.waitFor({ timeout: 5000 });
    dogru((await satir.innerText()).includes('Seçki'), 'listede "Seçki" rozeti');
    await satir.getByRole('button', { name: 'Düzenle' }).click();
    const kutu = ub.getByRole('checkbox', { name: /Seçki'de satışta/ });
    dogru(await kutu.isChecked(), 'düzenlemede Seçki işareti dolu gelir');
    await ub.getByLabel(/Kısa açıklama/).fill('Yeni açıklama');
    await kutu.uncheck();
    await ub.getByRole('button', { name: 'Ürünü kaydet' }).click();
    await y.page.waitForTimeout(400);
    const kayit = y.istekler.find((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/urunler');
    dogru(kayit && kayit.govde.secki === false && kayit.govde.aciklama === 'Yeni açıklama', `ürün Seçki ve açıklamayla kaydedildi (${JSON.stringify(kayit && kayit.govde)})`);
    const sip = y.page.locator('section.fc-urun-siparis');
    dogru((await sip.innerText()).includes('Seçki · teslim bir sonraki buluşmada') && (await sip.innerText()).includes('U-61'), 'Seçki siparişleri ayrı grupta');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
    await y.ctx.close();
  } finally {
    await tarayici.close();
    sunucu.kill();
  }
  if (kalan) { console.log(`${kalan} test kaldı`); process.exit(1); }
})().catch((h) => { console.error(h); process.exit(1); });
