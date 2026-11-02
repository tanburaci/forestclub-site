// Üyelik sayfası (/uyelik/): ana sayfadaki başvuru bölümünün ikizi; etkinlik sayfasındaki "Üye ol, dahil olsun" buraya gider,
// ana sayfadaki başvuru bölümü de yerinde kalır. Yerelde Netlify yönlendirmesi yerine ana sayfa HTML'i sunulur.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { sayfaAc, gun, SITE } = require('./yardim.js');
const DENEME = path.join(__dirname, '../../deneme-site');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const etk = { id: 7, tarih: gun(5), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: 1000, uyelere: 'ucretsiz',
  satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null };
const veri = () => ({ tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } });

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  const ana = fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8');
  try {
    const toml = fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8');
    dogru(/from = "\/uyelik\/"\s+to = "\/index.html"\s+status = 200/.test(toml), 'Netlify: /uyelik/ ana sayfa HTML\'ini sunar');
    for (const [ad, boy] of [['bilgisayar', { width: 1280, height: 860 }], ['telefon', { width: 390, height: 844 }]]) {
      const s = await sayfaAc(tarayici, veri());
      await s.page.setViewportSize(boy);
      await s.page.route(`${SITE}/uyelik/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: ana }));
      await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: ana }));
      await s.page.goto(`${SITE}/uyelik/`);
      await s.page.locator('#basvuru').waitFor({ timeout: 15000 });
      dogru(await s.page.locator('#bulusmalar, #sss, #gonullu').count() === 0 && await s.page.getByRole('link', { name: '← Ana sayfa' }).count() === 1,
        `${ad}: /uyelik/ yalnız başvuru bölümü ve ana sayfaya dönüş`);
      dogru(await s.page.title() === 'Üyelik · Forest Club Urla', `${ad}: sayfa başlığı`);
      dogru(await s.page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), `${ad}: yana taşma yok`);
      // Etkinlik sayfasından üyeliğe
      await s.page.goto(`${SITE}/e/7`);
      await s.page.locator('.fe-ana').waitFor({ timeout: 15000 });
      dogru(await s.page.locator('a', { hasText: 'Üye ol, dahil olsun' }).first().getAttribute('href') === '/uyelik/', `${ad}: etkinlik sayfasındaki "Üye ol" /uyelik/'e gider`);
      // Ana sayfadaki başvuru bölümü yerinde
      await s.page.goto(`${SITE}/`);
      await s.page.locator('#bulusmalar').waitFor({ timeout: 15000 });
      dogru(await s.page.locator('#basvuru').count() === 1, `${ad}: ana sayfadaki başvuru bölümü kaldı`);
      dogru(!s.konsol.some((x) => /pageerror/.test(x)), `${ad}: sayfa hatası yok`);
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
