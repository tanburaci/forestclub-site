// Yönetim › İletişim › Üyelere duyuru maili: hedef seç, konu + metin, kaç kişiye gideceği, onayla → uye_duyurusu_gonder
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const DENEME = path.join(__dirname, '../../deneme-site');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  const S = process.env.EKRAN;
  try {
    for (const [ad, boy] of [['bilgisayar', { width: 1280, height: 900 }], ['telefon', { width: 390, height: 844 }]]) {
      const v = yonetimVerisi(); v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
      v.rpc.uye_duyurusu_sayi = (g) => { v.rpcler.push(['sayi', g]); return [200, g.p_hedef === 'pasif' ? 42 : 7]; };
      v.rpc.uye_duyurusu_gonder = (g) => { v.rpcler.push(['gonder', g]); return [200, { id: 1, alici: 42 }]; };
      const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
      await y.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
      await y.page.setViewportSize(boy);
      await y.page.goto(`${SITE}/yonetim/`);
      await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
      await y.page.locator('button').filter({ hasText: /^İletişim$/ }).first().click();
      const k = y.page.locator('.fc-uye-duyuru');
      await k.waitFor({ timeout: 5000 });
      await k.getByRole('radio', { name: 'Süresi dolmuş üyeler' }).click();
      await k.getByRole('button', { name: 'Gönder…' }).click();
      dogru(await k.getByText('Konuyu yaz.').count() === 1, `${ad}: konu boşsa uyarı`);
      await k.getByLabel('Konu').fill('Tai Chi Atölyesi · 7 Kasım · Üyelere %50');
      await k.getByLabel('Metin').fill('7 Kasım Cumartesi 16.00, Gizem Kara ile Tai Chi. Üyelere %50 indirimli.');
      await k.getByRole('button', { name: 'Gönder…' }).click();
      await k.getByText('Süresi dolmuş üyeler: 42 kişiye gidecek. Emin misin?').waitFor({ timeout: 5000 });
      dogru(!v.rpcler.some((x) => x[0] === 'gonder'), `${ad}: sayım gösterildi, henüz gönderilmedi`);
      await k.scrollIntoViewIfNeeded();
      if (S) await k.screenshot({ path: `${S}/duyuru_${ad}.png` });
      await k.getByRole('button', { name: 'Evet, 42 kişiye gönder' }).click();
      await k.getByText('42 kişiye kuyruğa eklendi ✓ Mailler birkaç dakika içinde gider.').waitFor({ timeout: 5000 });
      const g = v.rpcler.find((x) => x[0] === 'gonder');
      dogru(g && g[1].p_hedef === 'pasif' && /Tai Chi/.test(g[1].p_konu) && /Gizem/.test(g[1].p_metin), `${ad}: uye_duyurusu_gonder pasif hedefe (${JSON.stringify(g && g[1].p_hedef)})`);
      dogru(!y.konsol.some((x) => /pageerror/.test(x)), `${ad}: sayfa hatası yok`);
      await y.ctx.close();
    }
  } catch (h) { console.log('HATA', h.message.split('\n').slice(0, 3).join(' | ')); kalan++; }
  finally { await tarayici.close(); sunucu.kill(); }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
