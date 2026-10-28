// Ana sayfadaki "Yakında yayındayız" kapağı: site arkada görünür ve kaydırılır, ama hiçbir yeri tıklanmaz ve
// klavyeyle ulaşılmaz. Üye ve yönetim paneli kapaktan etkilenmez. Yönetimde "Yakında" modu kapatılınca kapak kalkar;
// ayar okunamazsa kalır.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

const veri = {
  kapak: true,
  tablolar: { ayarlar: [{ anahtar: 'yakinda', deger: true }], etkinlikler: [{ id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Kahvaltı Testi', kim: null, kontenjan: 30, bilet_fiyati: 600,
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
      await page.waitForFunction(() => document.querySelectorAll('#kok *').length > 100, null, { timeout: 15000 });
      dogru(await page.getByRole('heading', { name: /Yakında yayındayız/ }).isVisible(), `${ad}: kapak görünüyor`);
      dogru(!(await page.getByText(/Örnek duyuru/).isVisible().catch(() => false)), `${ad}: sahte "Örnek duyuru" şeridi görünmüyor`);
      dogru(await page.getByText('Ağaçların altında').first().count() > 0 || await page.locator('#kok *').count() > 50, `${ad}: site arkada çizildi`);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(400);
      dogru(await page.evaluate(() => scrollY) > 0, `${ad}: sayfa kaydırılabiliyor`);
      // Kaydırdıktan sonra her köşe ve orta kapakta
      const noktalar = [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10], [w / 2, h - 60]];
      const hepsiKapakta = await page.evaluate((ns) => ns.every(([x, y]) => document.getElementById('fc-yakinda').contains(document.elementFromPoint(x, y))), noktalar);
      dogru(hepsiKapakta, `${ad}: ekranın her yeri kapakta (tıklama siteye gitmez)`);
      // Tıklananlar yalnız Instagram ve WhatsApp (Pelin, Ezgi) bağlantıları; Tab ile siteye ulaşılamaz
      const baglantilar = await page.locator('#fc-yakinda a, #fc-yakinda button').evaluateAll((l) => l.map((a) => `${a.getAttribute('href')}|${a.target}`));
      dogru(JSON.stringify(baglantilar) === JSON.stringify(['https://www.instagram.com/forestcluburla/|_blank', 'https://wa.me/905435926654|_blank', 'https://wa.me/905350359146|_blank']),
        `${ad}: kapakta yalnız Instagram ve WhatsApp bağlantıları var, yeni sekmede (${baglantilar})`);
      const ig = page.locator('#fc-yakinda a.ig');
      await page.context().route('https://www.instagram.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>instagram</p>' }));
      const [sekme] = await Promise.all([page.context().waitForEvent('page'), ig.click()]);
      await sekme.waitForLoadState();
      dogru(sekme.url().startsWith('https://www.instagram.com/forestcluburla'), `${ad}: Instagram bağlantısı açılıyor (${sekme.url()})`);
      await sekme.close();
      // Açılışa kadar yalnız ilk ekran ve "Biz Kimiz?" görünür
      const gorunen = await page.evaluate(() => document.body.innerText);
      // Etkinlik adı testte "Kahvaltı Testi" (Biz Kimiz? kartlarındaki "Breakfast Club" ile karışmasın)
      const yasak = ['Kahvaltı Testi', ' TL', 'Üyelik', 'SSS', 'İletişim', '%50', 'Üye girişi', 'Sık sorulan', 'Destek ol'].filter((x) => gorunen.includes(x));
      if (/Etkinlikler(?!i)/.test(gorunen)) yasak.push('Etkinlikler (menü)');  // ilk ekrandaki "Etkinlikleri gör" kalır
      dogru(gorunen.includes('Biz Kimiz?') && !yasak.length, `${ad}: etkinlikler, fiyatlar, üyelik, SSS, iletişim ve menüdeki diğer başlıklar görünmüyor (${yasak})`);
      for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
      dogru(await page.evaluate(() => !document.getElementById('kok').contains(document.activeElement)), `${ad}: Tab ile siteye odaklanılamıyor`);
      dogru(await page.evaluate(() => document.getElementById('kok').hasAttribute('inert')), `${ad}: site inert kaldı (çizimden sonra da)`);
      dogru(!konsol.some((x) => /pageerror|Content Security Policy/.test(x)), `${ad}: sayfa / CSP hatası yok`);
    }
    // Açılış: "Yakında" modu kapalı → kapak kalkar, site tıklanır, bölümler görünür
    const acik = { ...veri, tablolar: { ...veri.tablolar, ayarlar: [{ anahtar: 'yakinda', deger: false }] } };
    const s2 = await sayfaAc(tarayici, acik, null);
    await s2.page.goto(`${SITE}/`);
    await s2.page.getByText('Kahvaltı Testi').first().waitFor({ timeout: 15000 });
    dogru(await s2.page.locator('#fc-yakinda, #fc-yakinda-stil').count() === 0 && !(await s2.page.evaluate(() => document.getElementById('kok').hasAttribute('inert'))),
      'yakında kapalı: kapak kalktı, site inert değil');
    dogru(await s2.page.getByText('Kahvaltı Testi').first().isVisible() && await s2.page.getByRole('button', { name: 'Sepete ekle' }).first().isEnabled(),
      'yakında kapalı: etkinlikler görünüyor, bilet tıklanır');
    dogru(!s2.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), 'yakında kapalı: sayfa / CSP hatası yok');
    // Ayar okunamazsa (sunucu hatası) kapak kalır
    const hatali = { ...acik, hata: { ayarlar: true } };
    const s3 = await sayfaAc(tarayici, hatali, null);
    await s3.page.goto(`${SITE}/`);
    await s3.page.waitForFunction(() => document.querySelectorAll('#kok *').length > 100, null, { timeout: 15000 });
    await s3.page.waitForTimeout(500);
    dogru(await s3.page.getByRole('heading', { name: /Yakında yayındayız/ }).isVisible()
      && await s3.page.evaluate(() => document.getElementById('kok').hasAttribute('inert')), 'ayar okunamazsa kapak kalır');
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
