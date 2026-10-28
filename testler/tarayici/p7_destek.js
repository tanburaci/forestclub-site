// "Destek ol": sol alttaki düğme, destek penceresi (hazır / elle tutar, kartla öde, IBAN kopyala), iyzico'ya
// yönlendirme ve dönüş; "Biz Kimiz?" bölümünde WhatsApp'tan yaz (kişi seçimi). Kapak dururken düğme görünmez.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const IYZICO = 'https://sandbox-cpp.iyzipay.com/?token=destek-tok';

const veri = (ayarlar, kapak = false) => ({
  kapak,
  tablolar: { ayarlar, etkinlikler: [{ id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30,
    bilet_fiyati: 600, uyelere: 'ucretsiz', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null }] },
  rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] },
});

// Turnstile taklidi ve form-gonder ("destek" → iyzico adresi); iyzico sayfası da taklit
async function sahteSunucu(page) {
  const formlar = [];
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
  await page.route(`${SB}/functions/v1/form-gonder`, (r) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    const g = JSON.parse(r.request().postData());
    formlar.push(g);
    r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc: { sayfa: IYZICO } }) });
  });
  await page.route('https://sandbox-cpp.iyzipay.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>iyzico ödeme</p>' }));
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

    // Biz Kimiz? › WhatsApp'tan yaz
    await s1.page.getByRole('button', { name: "WhatsApp'tan yaz" }).click();
    const kisiler = s1.page.locator('.fs-wa-sec a');
    const linkler = await kisiler.evaluateAll((l) => l.map((a) => `${[...a.children].map((c) => c.textContent.trim()).join(' ')}|${a.href}|${a.target}`));
    dogru(JSON.stringify(linkler) === JSON.stringify(['Pelin 0543 592 66 54|https://wa.me/905435926654|_blank', 'Ezgi 0535 035 91 46|https://wa.me/905350359146|_blank']),
      `WhatsApp: Pelin ve Ezgi seçilebiliyor (${linkler})`);
    dogru(!s1.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), 'kart kapalı: sayfa / CSP hatası yok');

    // ---------- Kart açık: iyzico'ya gider ----------
    const s2 = await sayfaAc(tarayici, veri([{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: true }]), null);
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
    await Promise.all([s2.page.waitForURL(IYZICO, { timeout: 10000 }), p2.getByRole('button', { name: 'Kartla öde · 2.500 TL' }).click()]);
    dogru(formlar2.length === 1 && formlar2[0].tur === 'destek' && formlar2[0].veri.tutar === 2500 && /^jeton-/.test(formlar2[0].jeton),
      `form-gonder "destek" 2500 TL, Turnstile jetonlu (${JSON.stringify(formlar2[0])})`);
    dogru(s2.page.url() === IYZICO, 'iyzico ödeme sayfasına gidildi');

    // ---------- Dönüş ----------
    for (const [hash, metin, ad] of [['#destek-tamam', 'Desteğin bize ulaştı.', 'başarılı'], ['#destek-hata', 'Ödeme tamamlanamadı', 'başarısız']]) {
      const s3 = await sayfaAc(tarayici, veri([{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: true }]), null);
      await s3.page.goto(`${SITE}/${hash}`);
      await s3.page.getByText(metin).first().waitFor({ timeout: 15000 });
      dogru(!(await s3.page.evaluate(() => location.hash)), `dönüş (${ad}): pencere açıldı, adres temizlendi`);
    }

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
