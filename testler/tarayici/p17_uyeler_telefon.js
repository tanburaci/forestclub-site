// Yönetim › Üyeler telefonda: tabloda yalnız ad soyad ve telefon; satıra dokununca profil açılır ve ekrana gelir,
// ayrıntılar (e-posta, başvuru, bitiş, ödeme) ve "Elden ödeme" profilde.
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 30);
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.setViewportSize({ width: 390, height: 844 });
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Üyeler$/ }).first().click();
    const satir = y.page.locator('table.fc-uye-tablo tbody tr').filter({ hasText: 'Üye 20' }).first();
    await satir.waitFor({ timeout: 5000 });
    const gorunen = await y.page.locator('table.fc-uye-tablo thead th').evaluateAll((ths) => ths.filter((t) => getComputedStyle(t).display !== 'none').map((t) => t.textContent.trim()));
    dogru(JSON.stringify(gorunen) === JSON.stringify(['Ad soyad', 'Telefon']), `telefonda yalnız ad soyad ve telefon (${gorunen.join(', ')})`);
    dogru(await y.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'telefonda yana taşma yok');
    await satir.locator('td').first().click();
    const profil = y.page.locator('section[aria-label="Üye profili"]');
    await profil.waitFor({ timeout: 3000 });
    await y.page.waitForTimeout(700);
    const p = await profil.innerText();
    dogru(p.includes('Üye 20') && p.includes('u20@ornek.com') && p.includes('Başvuru') && p.includes('Üyelik bitişi') && p.includes('Ödeme sayısı'), 'satıra dokununca profil açıldı, ayrıntılar profilde');
    dogru(await profil.evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'profil ekrana kaydırıldı');
    await profil.getByRole('button', { name: 'Elden ödeme' }).click();
    await y.page.waitForTimeout(400);
    const degerler = await y.page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value));
    dogru(degerler.some((d) => d.includes('Üye 20') && d.includes('FC-U-0020')), 'profildeki "Elden ödeme" ödeme formunu üyeyle açtı');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
