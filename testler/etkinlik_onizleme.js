// Etkinlik sayfası önizleme: canlı etkinlikler (yalnız okunur) sahte veritabanına kopyalanır, /e/<id> yerelde
// ana sayfa HTML'iyle açılır (canlıda Edge Function aynısını yapar). Canlıya hiçbir şey yazılmaz.
// cd testler && node etkinlik_onizleme.js [etkinlik-no]   ·   TELEFON=1 telefon görünümü   ·   EKRAN=klasör ekran görüntüsü
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, oturum, SITE } = require('./tarayici/yardim.js');
const DENEME = path.join(__dirname, '../deneme-site');
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const ANAHTAR = /supabaseAnahtar:\s*'([^']+)'/.exec(fs.readFileSync(path.join(DENEME, 'js/ayar.js'), 'utf8'))[1];
(async () => {
  const al = async (yol) => (await fetch(`${SB}/rest/v1/${yol}`, { headers: { apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}` } })).json();
  const etkinlikler = await al('etkinlikler?durum=eq.yayinda&select=*&order=tarih');
  const ayarlar = await al('ayarlar?select=anahtar,deger');
  const id = process.argv[2] || (etkinlikler.find((e) => e.afis && e.tarih >= new Date().toISOString().slice(0, 10)) || etkinlikler[0]).id;
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const ekran = process.env.EKRAN;
  const telefon = !!process.env.TELEFON;
  const tarayici = await chromium.launch({ headless: !!ekran, args: [telefon ? '--window-size=430,960' : '--window-size=1280,900'] });
  const kapat = () => { sunucu.kill(); process.exit(0); };
  tarayici.on('disconnected', kapat);
  const s = await sayfaAc(tarayici, { tablolar: { etkinlikler, ayarlar }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null], tanisma_etkinlikleri: () => [200, []] } },
    process.env.UYE ? oturum('uye-1', 'deniz@posta.test') : null);
  await s.page.unroute('https://fonts.googleapis.com/**');
  await s.page.route(`${SB}/storage/**`, (r) => r.continue());  // afişler gerçek depodan (yalnız okunur)
  const html = fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8');
  await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await s.page.setViewportSize(telefon ? { width: 390, height: 844 } : { width: 1280, height: 820 });
  await s.page.goto(`${SITE}/e/${id}`);
  await s.page.waitForTimeout(2500);
  if (!ekran) { console.log(`Pencere açık: ${SITE}/e/${id} (etkinlik ${id}). Kapatmak için pencereyi kapatın.`); return; }
  const H = await s.page.evaluate(() => document.documentElement.scrollHeight);
  const adim = telefon ? 760 : 820;
  for (let i = 0; i * adim < H; i++) {
    await s.page.evaluate((y) => scrollTo(0, y), i * adim); await s.page.waitForTimeout(400);
    await s.page.screenshot({ path: `${ekran}/etk_${telefon ? 'tel' : 'masa'}_${i}.png` });
  }
  console.log('hatalar', s.konsol.filter((x) => /pageerror/.test(x)), 'yükseklik', H);
  await tarayici.close(); sunucu.kill();
})().catch((h) => { console.error('Açılamadı:', h.message); process.exit(1); });
