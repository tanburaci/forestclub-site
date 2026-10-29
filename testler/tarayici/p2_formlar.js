// Tarayıcı: spam korumalı formlar. Turnstile betiği taklit (her zaman jeton verir), form-gonder ve Storage sahte;
// sayfalar Netlify başlıklarıyla (CSP) sunulur.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const SITE = 'http://127.0.0.1:8089';
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const NPM = path.join(path.dirname(require.resolve('@supabase/supabase-js/package.json')), 'dist/umd');
const BASLIK = {};
fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8').split('\n').forEach((l) => { const m = /^\s+([A-Za-z-]+) = "(.*)"$/.exec(l); if (m) BASLIK[m[1]] = m[2]; });
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8089', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const ctx = await tarayici.newContext();
    await ctx.addInitScript(require('./yardim.js').KAPAKSIZ);
    const page = await ctx.newPage();
    const konsol = [];
    const formlar = [];
    const yuklemeler = [];
    let turnstileYuklendi = 0;
    page.on('console', (m) => konsol.push(m.text()));
    page.on('pageerror', (e) => konsol.push(`pageerror: ${e.message}`));
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(NPM, r.request().url().split('/').pop())) }));
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => {
      turnstileYuklendi++;
      r.fulfill({ status: 200, contentType: 'application/javascript', body: "window.turnstile = { n: 0, render(el, o) { this.son = o; setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" });
    });
    await page.route(`${SITE}/**`, async (r) => {
      const y = await r.fetch().catch(() => null);
      if (!y) return r.abort().catch(() => {});
      r.fulfill({ response: y, headers: { ...y.headers(), ...((y.headers()['content-type'] || '').includes('text/html') ? BASLIK : {}) } });
    });
    await page.route(`${SB}/**`, async (r) => {
      const q = r.request();
      const u = new URL(q.url());
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      const json = (d, b) => r.fulfill({ status: d, contentType: 'application/json', headers: cors, body: JSON.stringify(b) });
      if (q.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
      if (u.pathname === '/functions/v1/form-gonder') {
        const g = JSON.parse(q.postData());
        formlar.push(g);
        if (g.tur === 'dekont_adres') return json(200, { sonuc: { yol: 'yeni/123-abcdef0123456789.pdf', jeton: 'imza-jetonu', tur: 'application/pdf' } });
        if (g.veri && g.veri.eposta === 'cok@posta.test') return json(429, { hata: 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.' });
        return json(200, { sonuc: g.tur === 'tanisma' ? 'verildi' : 'tamam' });
      }
      if (u.pathname.startsWith('/storage/v1/object/upload/sign/')) {
        yuklemeler.push({ yontem: q.method(), yol: u.pathname, jeton: u.searchParams.get('token') });
        return json(200, { Key: u.pathname.replace('/storage/v1/object/upload/sign/', '') });
      }
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = u.pathname.split('/').pop();
        if (['basvuru_yap', 'tanisma_bileti_al', 'cagri_gonder', 'dekont_kaydet'].includes(fn)) formlar.push({ dogrudan: fn });
        return json(200, fn === 'etkinlik_doluluk' ? [] : null);
      }
      if (u.pathname === '/rest/v1/etkinlikler') {
        const g = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
        return json(200, [{ id: 7, tarih: g, saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'x', link: null }]);
      }
      if (q.method() === 'POST' && u.pathname.startsWith('/storage/v1/object/dekontlar')) { formlar.push({ dogrudan: 'storage.upload' }); return json(200, {}); }
      return json(200, []);
    });

    // Site: başvuru, tanışma, Açık Çağrı veri katmanı
    await page.goto(`${SITE}/`);
    await page.getByText('Breakfast Club').first().waitFor({ timeout: 15000 });
    dogru(turnstileYuklendi === 0, 'Turnstile sayfa açılışında yüklenmiyor (yalnız gönderimde)');
    const b = await page.evaluate(() => window.FCSBasvuru('Gerçek Kişi', 'gercek@posta.test', '05321112233', true, true, true, false));
    const t = await page.evaluate((k) => window.FCSTanisma('Misafir', 'misafir@posta.test', k), Object.keys(await page.evaluate(() => window.FCS.anahtar))[0]);
    await page.evaluate(() => window.FCSCagri({ ad: 'Deniz', iletisim: '0532', uyeOl: false }));
    const hata = await page.evaluate(() => window.FCSBasvuru('Ç', 'cok@posta.test', '05321112233', true, true, true, false).then(() => '', (h) => h.message));
    dogru(b === 'tamam' && t === 'verildi', `başvuru ve tanışma form-gonder'den döndü (${b}, ${t})`);
    await page.waitForTimeout(100);
    dogru(await page.evaluate(() => ((k) => k.length > 0 && k.every((e) => e.style.display === 'none'))([...document.body.children].filter((e) => e.style.position === 'fixed' && e.style.bottom === '16px'))), 'doğrulama bitince Turnstile kutusu ekrandan kalkıyor');
    dogru(formlar[0].tur === 'basvuru' && formlar[0].jeton === 'jeton-1' && formlar[0].veri.eposta === 'gercek@posta.test' && formlar[0].veri.kvkk === true,
      `başvuru gövdesi ve Turnstile jetonu (${JSON.stringify(formlar[0])})`);
    dogru(formlar[1].tur === 'tanisma' && formlar[1].veri.etkinlik === 7 && formlar[1].jeton === 'jeton-2', 'tanışma: etkinlik numarası ve yeni jeton');
    dogru(formlar[2].tur === 'cagri' && formlar[2].veri.ad === 'Deniz', 'Açık Çağrı form-gonder ile');
    dogru(/Çok fazla deneme/.test(hata), `sunucu hatası kullanıcıya iletilir (${hata})`);
    dogru(turnstileYuklendi === 1, 'Turnstile betiği bir kez yüklendi');
    dogru(!formlar.some((f) => f.dogrudan), `SQL işlevleri tarayıcıdan doğrudan çağrılmadı (${JSON.stringify(formlar.filter((f) => f.dogrudan))})`);
    dogru(!konsol.some((x) => /Content Security Policy|Refused|integrity/i.test(x)), `CSP / SRI ihlali yok ${konsol.filter((x) => /Content Security|Refused/i.test(x)).join(' | ')}`);

    // Dekont sayfası: arayüzden
    formlar.length = 0;
    await page.goto(`${SITE}/dekont`);
    await page.locator('input[type=email]').waitFor({ timeout: 15000 });
    await page.locator('input[type=email]').fill('Gercek@Posta.test');
    await page.locator('input[type=file]').setInputFiles({ name: 'dekont.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await page.getByRole('button', { name: 'Dekontu gönder' }).click();
    await page.waitForTimeout(1500);
    const govdeMetin = await page.evaluate(() => document.body.innerText);
    dogru(formlar.length === 2 && formlar[0].tur === 'dekont_adres' && formlar[0].veri.eposta === 'gercek@posta.test' && formlar[0].veri.uzanti === '.pdf' && !!formlar[0].jeton,
      `dekont: önce yükleme hakkı (${JSON.stringify(formlar[0])})`);
    dogru(yuklemeler.length === 1 && yuklemeler[0].yontem === 'PUT' && yuklemeler[0].yol === '/storage/v1/object/upload/sign/dekontlar/yeni/123-abcdef0123456789.pdf' && yuklemeler[0].jeton === 'imza-jetonu',
      `dosya imzalı adrese yüklendi (${JSON.stringify(yuklemeler)})`);
    dogru(formlar[1] && formlar[1].tur === 'dekont_kaydet' && formlar[1].jeton === null && formlar[1].veri.yol === 'yeni/123-abcdef0123456789.pdf', 'sonra kayıt (jetonsuz, aynı yol)');
    dogru(!formlar.some((f) => f.dogrudan), 'depoya doğrudan yükleme yok');
    dogru(!/Yükleniyor|hata|yüklenemedi/i.test(govdeMetin.split('Dekontu gönder')[0] || ''), 'sayfa başarı ekranına geçti');
    dogru(!konsol.some((x) => /pageerror|Content Security/i.test(x)), `sayfa hatası yok ${konsol.filter((x) => /pageerror|Content Security/.test(x)).join(' | ')}`);
  } catch (h) {
    console.log('HATA', h.message); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
