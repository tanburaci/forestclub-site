// "Destek ol": sol alttaki düğme, destek penceresi (hazır / elle tutar, kartla öde, IBAN kopyala), Shopier ayrı
// pencerede ve ödeme gelince teşekkür; "Biz Kimiz?" bölümünde WhatsApp'tan yaz (kişi seçimi). Kapak dururken düğme görünmez.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const SHOPIER = 'https://shopier.test/destek/1';

const veri = (ayarlar, kapak = false) => ({
  kapak,
  tablolar: { ayarlar, etkinlikler: [{ id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30,
    bilet_fiyati: 600, uyelere: 'ucretsiz', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null }] },
  rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] },
});

// Turnstile taklidi ve form-gonder ("destek" → Shopier ödeme sayfası adresi)
async function sahteSunucu(page) {
  const formlar = [];
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
  await page.route(`${SB}/functions/v1/form-gonder`, (r) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    const g = JSON.parse(r.request().postData());
    formlar.push(g);
    r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc: { sayfa: SHOPIER, id: 'd-1' } }) });
  });
  await page.context().route('https://shopier.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Shopier ödeme</p>' }));
  return formlar;
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Kart kapalı: IBAN ----------
    const s1 = await sayfaAc(tarayici, veri([{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: false }]), null);
    await s1.page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
    const formlar1 = await sahteSunucu(s1.page);
    await s1.page.goto(`${SITE}/`);
    const dugme = s1.page.locator('.fs-destek');
    await dugme.waitFor({ timeout: 15000 });
    const kutu = await dugme.boundingBox();
    const vp = s1.page.viewportSize();
    dogru(kutu && kutu.x < 60 && kutu.y + kutu.height > vp.height - 60, `"Destek ol" sol altta (${kutu && Math.round(kutu.x)}, ${kutu && Math.round(kutu.y)})`);
    dogru(await s1.page.locator('.fs-wa').count() === 0, 'sol alttaki WhatsApp düğmesi kalktı');
    await dugme.click();
    const pencere = s1.page.getByRole('dialog', { name: 'Topluluğumuza destek ol' });
    await pencere.waitFor({ timeout: 3000 });
    dogru(await pencere.getByText('Küçük ya da büyük, her katkı bu alanı birlikte yeşertmemize yardım ediyor.').isVisible(), 'destek metni görünüyor');
    const tutarlar = await pencere.locator('.fs-tutar').allInnerTexts();
    dogru(JSON.stringify(tutarlar) === JSON.stringify(['1.000 TL', '2.500 TL', '5.000 TL', 'Başka tutar']), `hazır tutarlar (${tutarlar})`);
    dogru(await pencere.getByText('Kartla ödeme çok yakında; şimdilik IBAN ile gönderebilirsin.').count() >= 1, 'kart kapalı notu');
    const kart = pencere.getByRole('button', { name: 'Kartla öde' });
    dogru(await kart.getAttribute('aria-disabled') === 'true', 'kart kapalıyken "Kartla öde" pasif');
    await kart.click({ force: true });
    dogru(formlar1.length === 0, 'kart kapalıyken sunucuya istek gitmedi');
    dogru(await pencere.getByText('Pelin Küçükali').isVisible() && await pencere.getByText('TR59 0015 7000 0000 0205 1344 62').isVisible(), 'alıcı ve IBAN görünüyor');
    await pencere.getByRole('button', { name: "IBAN'ı kopyala" }).click();
    await pencere.getByText('Kopyalandı ✓').waitFor({ timeout: 3000 });
    dogru(await s1.page.evaluate(() => navigator.clipboard.readText()) === 'TR590015700000000205134462', 'IBAN boşluksuz kopyalandı');
    await pencere.getByRole('button', { name: 'Alıcı adını kopyala' }).click();
    dogru(await s1.page.evaluate(() => navigator.clipboard.readText()) === 'Pelin Küçükali', 'alıcı adı kopyalandı');
    await pencere.getByRole('button', { name: 'Kapat' }).first().click();
    dogru(await pencere.count() === 0, 'pencere kapandı');

    // WhatsApp numaraları sitede hiçbir yerde yok (Pelin / Ezgi)
    const html = await s1.page.content();
    dogru(!/wa\.me/.test(html) && await s1.page.getByRole('button', { name: "WhatsApp'tan yaz" }).count() === 0, 'sitede WhatsApp numarası ve "WhatsApp\'tan yaz" yok');
    dogru(!s1.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), 'kart kapalı: sayfa / CSP hatası yok');

    // ---------- Kart açık: Shopier ayrı pencerede, site yerinde; ödeme gelince "Desteğin bize ulaştı" ----------
    let sor = 0;
    const v2 = veri([{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: true }]);
    v2.rpc.destek_durum = (g) => [200, (++sor >= 2 && g.p_id === 'd-1') ? 'odendi' : 'basladi'];
    const s2 = await sayfaAc(tarayici, v2, null);
    const formlar2 = await sahteSunucu(s2.page);
    await s2.page.goto(`${SITE}/`);
    await s2.page.locator('.fs-destek').click();
    const p2 = s2.page.getByRole('dialog', { name: 'Topluluğumuza destek ol' });
    await p2.getByRole('button', { name: 'Başka tutar' }).click();
    await p2.getByPlaceholder('Örn. 1500').fill('40');
    await p2.getByRole('button', { name: /Kartla öde/ }).click();
    dogru(await p2.getByText('En az 50 TL yaz.').count() === 1 && formlar2.length === 0, 'elle 40 TL: en az 50 TL uyarısı');
    await p2.getByRole('button', { name: '2.500 TL' }).click();
    dogru(await p2.getByRole('button', { name: 'Kartla öde · 2.500 TL' }).count() === 1, 'düğmede seçilen tutar');
    const pencereSoz = s2.ctx.waitForEvent('page');
    await p2.getByRole('button', { name: 'Kartla öde · 2.500 TL' }).click();
    const spencere = await pencereSoz;
    await spencere.waitForURL(SHOPIER, { timeout: 8000 });
    dogru(formlar2.length === 1 && formlar2[0].tur === 'destek' && formlar2[0].veri.tutar === 2500 && /^jeton-/.test(formlar2[0].jeton) && s2.page.url() === `${SITE}/`,
      `destek: Shopier ayrı pencerede, 2500 TL, Turnstile'lı, site yerinde (${JSON.stringify(formlar2[0])})`);
    await s2.page.getByText('Desteğin bize ulaştı.').first().waitFor({ timeout: 15000 });
    dogru(sor >= 2, 'destek: ödeme gelince teşekkür penceresi');

    // ---------- Kapak dururken düğme yok ----------
    const s4 = await sayfaAc(tarayici, veri([{ anahtar: 'yakinda', deger: true }], true), null);
    await s4.page.goto(`${SITE}/`);
    await s4.page.waitForFunction(() => document.querySelectorAll('#kok *').length > 100, null, { timeout: 15000 });
    dogru(!(await s4.page.locator('.fs-destek').isVisible()), 'kapak dururken "Destek ol" görünmüyor');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
