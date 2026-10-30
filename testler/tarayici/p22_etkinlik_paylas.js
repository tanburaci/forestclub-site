// Tek etkinliği paylaşma: kartta "Paylaş" (bilgisayarda bağlantı panoya kopyalanır), /#etkinlik-<id> bağlantısı açılınca
// kart açık gelir ve ekrana kaydırılır (geçmiş etkinlikte de); Yönetim › Etkinlikler'de "Paylaşım bağlantısı".
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const e = (id, g, ad) => ({ id, tarih: gun(g), saat: '10.00', tur: 'bulusma', ad, kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: 'ucretsiz',
  satilan_bilet: 0, durum: 'yayinda', aciklama: `${ad} açıklaması. `.repeat(20), link: null, afis: null });
const veri = { tablolar: { etkinlikler: [e(7, 6, 'Breakfast Club'), e(8, 12, 'Sunset Club'), e(3, -20, 'Eski Buluşma'), e(4, -15, 'A1'), e(5, -10, 'A2'), e(6, -5, 'A3')],
  ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // Bağlantıyla gelen: kart açık, ekranda
    const s = await sayfaAc(tarayici, veri, null);
    await s.page.setViewportSize({ width: 1280, height: 800 });
    await s.page.goto(`${SITE}/#etkinlik-8`);
    const kart = s.page.locator('#etkinlik-8');
    await kart.waitFor({ timeout: 15000 });
    await s.page.waitForTimeout(900);
    dogru(await kart.getAttribute('aria-expanded') === 'true' && (await kart.innerText()).includes('Sunset Club'), 'bağlantı: paylaşılan etkinliğin kartı açık');
    dogru(await kart.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'bağlantı: kart ekranda (kaydırıldı)');
    dogru(await s.page.locator('#etkinlik-7').getAttribute('aria-expanded') === 'false', 'bağlantı: diğer kartlar kapalı');

    // Geçmiş (listede ilk 3'te olmayan) etkinlik de açılır
    await s.page.goto(`${SITE}/#etkinlik-3`);
    await s.page.locator('#etkinlik-3').waitFor({ timeout: 8000 });
    dogru(await s.page.locator('#etkinlik-3').getAttribute('aria-expanded') === 'true', 'bağlantı: eski geçmiş etkinlik de açılır');

    // Paylaş: bilgisayarda panoya kopyalanır
    await s.page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
    await s.page.locator('#etkinlik-7').getByRole('button', { name: 'Breakfast Club etkinliğini paylaş' }).click();
    await s.page.locator('#etkinlik-7').getByText('Bağlantı kopyalandı ✓').waitFor({ timeout: 4000 });
    const pano = await s.page.evaluate(() => navigator.clipboard.readText());
    dogru(pano === `${SITE}/#etkinlik-7`, `paylaş: bağlantı panoya kopyalandı (${pano})`);
    dogru(await s.page.locator('#etkinlik-7').getAttribute('aria-expanded') === 'false', 'paylaş: düğme kartı açıp kapatmaz');
    dogru(!s.konsol.some((x) => /pageerror|Content Security/.test(x)), 'sayfa / CSP hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
