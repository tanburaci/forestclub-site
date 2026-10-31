// Ana sayfa gökyüzü: gündüz / gece ve hava sınıfları (deneme için FC_GOK_TEST), gece ay ve yıldızlar, gündüz balonlar,
// gece parti ışıkları ve yazılar beyaz, adada "Forest Club" ve "Urla" bayrakları; Open-Meteo CSP'de izinli.
const { sayfaAc, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const veri = { tablolar: { etkinlikler: [], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } };
const gorunur = (page, sec) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0.5 && e.getClientRects().length > 0; }, sec);

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    dogru(/connect-src[^;]*https:\/\/api\.open-meteo\.com/.test(fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8')), 'CSP: hava durumu servisi izinli');
    const ac = async (durum) => {
      const s = await sayfaAc(tarayici, veri, null);
      await s.page.setViewportSize({ width: 1440, height: 900 });
      await s.page.addInitScript((d) => { window.FC_GOK_TEST = d; }, durum);
      await s.page.goto(`${SITE}/`);
      await s.page.waitForSelector('#kok .fs-gok');
      await s.page.waitForTimeout(2300);  // geçişler (opacity 2 sn)
      return s;
    };
    const g = await ac('gunduz,acik');
    dogru(await g.page.evaluate(() => document.documentElement.classList.contains('gok-gunduz') && document.documentElement.classList.contains('hava-acik')), 'gündüz: sınıflar');
    dogru(await gorunur(g.page, '.fs-ucan-balon') && !(await gorunur(g.page, '.fs-gece-gok')) && !(await gorunur(g.page, '.fs-yagmur')), 'gündüz: balonlar var, ay ve yağmur yok');
    const bayrak = await g.page.locator('.fs-mekan text').allTextContents();
    dogru(bayrak.includes('Forest Club') && bayrak.includes('Urla'), `adada bayraklar (${bayrak.join(', ')})`);
    dogru(await g.page.evaluate(() => getComputedStyle(document.querySelector('#ust h1')).color) === 'rgb(17, 17, 17)', 'gündüz: başlık siyah');
    dogru(await g.page.evaluate(() => [...document.querySelectorAll('.fs-parti')].length === 3 && [...document.querySelectorAll('.fs-parti')].every((e) => getComputedStyle(e).opacity === '0')), 'gündüz: parti yapan üç karakter gizli');
    dogru(!g.konsol.some((x) => /pageerror|Content Security/.test(x)), 'gündüz: sayfa / CSP hatası yok');

    const n = await ac('gece,kar');
    dogru(await gorunur(n.page, '.fs-gece-gok') && await gorunur(n.page, '.fs-ay') && await gorunur(n.page, '.fs-kar') && await n.page.locator('.fs-yildiz').count() >= 15, 'gece: ay, yıldızlar ve kar');
    dogru(!(await gorunur(n.page, '.fs-ucan-balon')) && await gorunur(n.page, '.fs-ucan-orta') && await gorunur(n.page, '.fs-ucan-yakin'), 'gece: balonlar yok; ipli ve pervaneli sticker var');
    dogru(await n.page.evaluate(() => getComputedStyle(document.querySelector('.fs-gece-sahne')).opacity === '1' && getComputedStyle(document.querySelector('.fs-ucan-orta')).filter.includes('drop-shadow')), 'gece: parti ışıkları açık, ay ışığı ipli sticker\'da');
    dogru(await n.page.evaluate(() => getComputedStyle(document.querySelector('#ust h1')).color) === 'rgb(255, 255, 255)', 'gece: başlık beyaz');
    dogru(await n.page.evaluate(() => [...document.querySelectorAll('.fs-parti')].every((e) => getComputedStyle(e).opacity === '1')), 'gece: parti yapan üç karakter görünür');
    const y = await ac('gunduz,yagmur');
    dogru(await gorunur(y.page, '.fs-yagmur') && await gorunur(y.page, '.fs-bulut-ek'), 'yağmur: damlalar ve ek bulutlar');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
