// Ödeme adımlarının ekran görüntüleri (etkinlik sayfası → sepet → bilgiler + ödeme yöntemi → nakit / havale / kart).
// form-gonder sahte; canlıya hiçbir şey gitmez. cd testler && EKRAN=klasör [KART=1] node odeme_ekran.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, gun, SITE } = require('./tarayici/yardim.js');
const DENEME = path.join(__dirname, '../deneme-site');
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
(async () => {
  const S = process.env.EKRAN;
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const etk = [{ id: 31, tarih: gun(1), saat: '10.00', tur: 'hareket', ad: 'Morning Flow', kim: 'Elif Eren', kontenjan: 12, bilet_fiyati: 1000, uyelere: 'ucretsiz', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Güne biraz hareket, biraz nefes.', link: null,
    afis: 'https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/1793314715155-lyzwwwe9.jpg' }];
  const ayar = [{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: !!process.env.KART }];
  for (const [ad, en, boy] of [['tel', 390, 844], ['pc', 1280, 860]]) {
    const s = await sayfaAc(b, { tablolar: { etkinlikler: etk, ayarlar: ayar }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null], tanisma_etkinlikleri: () => [200, []] } }, null);
    await s.page.unroute('https://fonts.googleapis.com/**');
    await s.page.route(`${SB}/storage/**`, (r) => r.continue());
    const html = fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8');
    await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
      body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    await s.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
      const g = JSON.parse(r.request().postData());
      const yol = g.veri && g.veri.yol;
      r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc: yol === 'nakit' ? { id: 5, tutar: 1000, yol: 'nakit' } : { id: 5, tutar: 1000, yol: 'havale', jeton: 'x' } }) });
    });
    await s.page.setViewportSize({ width: en, height: boy });
    await s.page.goto(`${SITE}/e/31`);
    await s.page.waitForTimeout(2500);
    await s.page.screenshot({ path: `${S}/od_${ad}_1_sayfa.png` });
    await (ad === 'tel' ? s.page.locator('.fe-cubuk .fs-btn') : s.page.locator('.fe-satis .fs-btn').first()).click();
    await s.page.waitForTimeout(600);
    await s.page.screenshot({ path: `${S}/od_${ad}_2_sepet.png` });
    await s.page.getByRole('button', { name: 'Devam et' }).click();
    await s.page.waitForTimeout(500);
    await s.page.getByLabel('Ad Soyad *').fill('Deniz Deneme');
    await s.page.getByLabel(/E-posta \*/).fill('deniz@posta.test');
    await s.page.getByLabel('Telefon *').fill('05320000000');
    await s.page.locator('.fs-modal input[type="checkbox"]').first().check();
    const yontem = s.page.locator('fieldset');
    await yontem.scrollIntoViewIfNeeded();
    await s.page.waitForTimeout(300);
    await s.page.screenshot({ path: `${S}/od_${ad}_3_yontem.png` });
    await s.page.getByRole('radio', { name: /Havale \/ EFT/ }).click();
    await s.page.waitForTimeout(300);
    await s.page.locator('.fs-modal .fs-btn').filter({ hasText: /Devam · havale/ }).first().scrollIntoViewIfNeeded();
    await s.page.screenshot({ path: `${S}/od_${ad}_4_havale_secili.png` });
    await s.page.locator('.fs-modal .fs-btn').filter({ hasText: 'Devam · havale' }).click();
    await s.page.waitForTimeout(1500);
    await s.page.screenshot({ path: `${S}/od_${ad}_5_havale_dekont.png` });
    console.log(ad, 'hatalar', s.konsol.filter((x) => /pageerror/.test(x)));
    await s.ctx.close();
  }
  await b.close(); sunucu.kill();
})().catch((h) => { console.error('Hata:', h.message); process.exit(1); });
