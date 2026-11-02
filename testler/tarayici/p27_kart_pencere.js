// Kartla ödeme: Shopier ayrı pencerede açılır, site sayfası kapanmaz; sepet "Ödemen bekleniyor" der, ödeme gelince
// (bilet_istek_durum = onaylandi) kendiliğinden "Ödemen alındı" olur. EKRAN=<klasör> verilirse ekran görüntüsü alınır.
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, gun, SITE } = require('./yardim.js');
const DENEME = path.join(__dirname, '../../deneme-site');
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'yoga', ad: 'Yoga Sabahı', kim: null, kontenjan: 12, bilet_fiyati: 1000, uyelere: 'yuzde50',
  satilan_bilet: 0, durum: 'yayinda', aciklama: 'Yoga', link: null };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  const S = process.env.EKRAN;
  try {
    for (const [ad, boy] of [['bilgisayar', { width: 1280, height: 860 }], ['telefon', { width: 390, height: 844 }]]) {
      let sor = 0;
      const v = { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: true }] },
        rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null], bilet_istek_durum: (g) => [200, (++sor >= 2 && g.p_id === 55 && g.p_eposta === 'misafir@posta.test') ? 'onaylandi' : 'bekliyor'] } };
      const s = await sayfaAc(tarayici, v);
      await s.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
      await s.page.setViewportSize(boy);
      await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
        body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
      await s.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
        r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ sonuc: { id: 55, tutar: 2000, yol: 'kart', sayfa: 'https://shopier.test/odeme/123' } }) });
      });
      await s.ctx.route('https://shopier.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Shopier</title><h1>Shopier ödeme</h1>' }));
      await s.page.goto(`${SITE}/`);
      await s.page.getByRole('button', { name: 'Randevu oluştur' }).first().click();
      await s.page.getByRole('button', { name: /Randevuda 1 kişi/ }).first().click();
      await s.page.locator('.fs-sepet-dugme').click();
      const m = s.page.locator('.fs-modal');
      await m.getByRole('button', { name: 'Devam et' }).click();
      await m.getByLabel('Ad Soyad *').fill('Misafir Kişi');
      await m.getByLabel(/E-posta \*/).fill('misafir@posta.test');
      await m.getByLabel('Telefon *').fill('0532 000 00 00');
      await m.locator('input[type="checkbox"]').first().check();
      const pencereSoz = s.ctx.waitForEvent('page');
      await m.getByRole('button', { name: /Kartla öde/ }).click();
      const pencere = await pencereSoz;
      await pencere.waitForURL('https://shopier.test/odeme/123', { timeout: 8000 });
      dogru(true, `${ad}: Shopier ayrı pencerede açıldı`);
      await m.getByText('Ödemen bekleniyor…').waitFor({ timeout: 5000 });
      dogru(s.page.url() === `${SITE}/`, `${ad}: site sayfası yerinde kaldı`);
      if (S) await s.page.screenshot({ path: `${S}/kart_${ad}_1_bekliyor.png` });
      await m.getByText('Ödemen alındı! 🎟️').waitFor({ timeout: 15000 });
      dogru(sor >= 2, `${ad}: ödeme gelince sepet kendiliğinden "Ödemen alındı" oldu`);
      if (S) await s.page.screenshot({ path: `${S}/kart_${ad}_2_alindi.png` });
      dogru(!s.konsol.some((x) => /pageerror/.test(x)), `${ad}: sayfa hatası yok`);
      await s.ctx.close();
    }
    // ---------- Yeni üye başvurusu: kartla aidat (Shopier ayrı pencerede), ödeme gelince üyelik başladı ----------
    for (const [ad, boy] of [['bilgisayar', { width: 1280, height: 860 }], ['telefon', { width: 390, height: 844 }]]) {
      let sor = 0;
      const v = { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: true }] },
        rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null], uyelik_odeme_durum: (g) => [200, (++sor >= 2 && g.p_id === 'u-1' && g.p_eposta === 'yeni@posta.test') ? 'odendi' : 'basladi'] } };
      const s = await sayfaAc(tarayici, v);
      await s.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
      await s.page.setViewportSize(boy);
      const gelen = [];
      await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
        body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
      await s.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
        const g = JSON.parse(r.request().postData()); gelen.push(g);
        const sonuc = g.tur === 'uyelik_kart' ? { id: 'u-1', tutar: 3000, sayfa: 'https://shopier.test/uyelik/1' } : 'tamam';
        r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ sonuc }) });
      });
      await s.ctx.route('https://shopier.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Shopier</title><h1>Shopier ödeme</h1>' }));
      await s.page.goto(`${SITE}/`);
      const b = s.page.locator('#basvuru');
      await b.scrollIntoViewIfNeeded();
      await b.locator('input[autocomplete="name"]').fill('Yeni Üye');
      await b.locator('input[type="tel"]').fill('0532 111 22 33');
      await b.locator('input[type="email"]').fill('yeni@posta.test');
      const kutular = b.locator('input[type="checkbox"]');
      for (let i = 0; i < 3; i++) await kutular.nth(i).check();
      await b.getByRole('button', { name: 'Aramıza katıl' }).click();
      const kart = b.getByRole('button', { name: /Kartla öde/ });
      await kart.waitFor({ timeout: 8000 });
      dogru(await b.getByText('ya da havale / EFT ile').count() === 1, `${ad} üyelik: kartla öde + havale seçeneği`);
      const pencereSoz = s.ctx.waitForEvent('page');
      await kart.click();
      const pencere = await pencereSoz;
      await pencere.waitForURL('https://shopier.test/uyelik/1', { timeout: 8000 });
      await b.getByText('Ödemen bekleniyor…').waitFor({ timeout: 5000 });
      dogru(s.page.url() === `${SITE}/` && gelen.some((g) => g.tur === 'uyelik_kart' && g.veri.eposta === 'yeni@posta.test' && g.jeton),
        `${ad} üyelik: Shopier ayrı pencerede, istek Turnstile'lı, site yerinde`);
      if (S) await s.page.screenshot({ path: `${S}/uyelik_kart_${ad}_1_bekliyor.png` });
      await b.getByText('Aramıza hoş geldin! 🌲').waitFor({ timeout: 15000 });
      dogru(await b.getByText(/Ödemen alındı, üyeliğin başladı!/).count() === 1, `${ad} üyelik: ödeme gelince "üyeliğin başladı"`);
      if (S) await s.page.screenshot({ path: `${S}/uyelik_kart_${ad}_2_basladi.png` });
      dogru(!s.konsol.some((x) => /pageerror/.test(x)), `${ad} üyelik: sayfa hatası yok`);
      await s.ctx.close();
    }
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 3).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
