// Ana sayfadaki "Yakında yayındayız" kapağı: site arkada görünür ve kaydırılır, ama hiçbir yeri tıklanmaz ve
// klavyeyle ulaşılmaz. Üye ve yönetim paneli kapaktan etkilenmez.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

const veri = {
  kapak: true,
  tablolar: { etkinlikler: [{ id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null,
    uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null }] },
  rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] },
};

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    for (const [ad, w, h] of [['masaüstü', 1280, 800], ['telefon', 390, 844]]) {
      const { page, konsol } = await sayfaAc(tarayici, veri, null);
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${SITE}/`);
      await page.getByText('Breakfast Club').first().waitFor({ timeout: 15000 });
      dogru(await page.getByRole('heading', { name: /Yakında yayındayız/ }).isVisible(), `${ad}: kapak görünüyor`);
      dogru(await page.getByText('Ağaçların altında').first().count() > 0 || await page.locator('#kok *').count() > 50, `${ad}: site arkada çizildi`);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(400);
      dogru(await page.evaluate(() => scrollY) > 0, `${ad}: sayfa kaydırılabiliyor`);
      // Kaydırdıktan sonra her köşe ve orta kapakta
      const noktalar = [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10], [w / 2, h - 60]];
      const hepsiKapakta = await page.evaluate((ns) => ns.every(([x, y]) => document.getElementById('fc-yakinda').contains(document.elementFromPoint(x, y))), noktalar);
      dogru(hepsiKapakta, `${ad}: ekranın her yeri kapakta (tıklama siteye gitmez)`);
      // Kapakta bağlantı yok; Tab ile siteye ulaşılamaz
      dogru(await page.locator('#fc-yakinda a, #fc-yakinda button').count() === 0, `${ad}: kapakta tıklanacak bir şey yok`);
      for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
      dogru(await page.evaluate(() => !document.getElementById('kok').contains(document.activeElement)), `${ad}: Tab ile siteye odaklanılamıyor`);
      dogru(await page.evaluate(() => document.getElementById('kok').hasAttribute('inert')), `${ad}: site inert kaldı (çizimden sonra da)`);
      dogru(!konsol.some((x) => /pageerror|Content Security Policy/.test(x)), `${ad}: sayfa / CSP hatası yok`);
    }
    // Paneller etkilenmiyor
    const { page } = await sayfaAc(tarayici, veri, null);
    await page.goto(`${SITE}/uye/`);
    await page.getByText('E-postana gelen giriş bağlantısıyla ya da şifrenle gir.').waitFor({ timeout: 15000 });
    dogru(await page.locator('#fc-yakinda').count() === 0, 'üye paneli: kapak yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
