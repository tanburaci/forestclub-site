// Kapıda kamera (01.11.2026 düzeltmesi): satın alınan biletin karekodu (FC-B-…) da okunur; tarayıcıda BarcodeDetector
// var görünüp karekod okuyamıyorsa (masaüstü Chrome vb.) jsQR'a geçilir. Önceden ikisi de sessizce okunmuyordu.
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const QG = fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'));
const JQ = fs.readFileSync(require.resolve('jsqr/dist/jsQR.js'));
const qrcode = (() => { const m = { exports: {} }; new Function('module', 'exports', QG.toString())(m, m.exports); return m.exports; })();

function hucreler(metin) {
  const qr = qrcode(0, 'M'); qr.addData(metin); qr.make();
  const n = qr.getModuleCount();
  const h = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) h.push(qr.isDark(r, c) ? 1 : 0);
  return { hucre: h, n };
}

// Sahte kamera: tuvalde verilen karekod. bozukOkuyucu: BarcodeDetector var, karekodu destekliyor görünür ama okurken hata verir
async function dene(tarayici, metin, bozukOkuyucu) {
  const v = yonetimVerisi();
  v.rpc.giris_kaydet = (g) => { v.rpcler.push(['giris_kaydet', g]); return [200, { ad: 'Ezgi', uye_id: 2, bilet: true, zaten: false }]; };
  const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
  await y.page.route('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: JQ }));
  await y.ctx.addInitScript(({ hucre, n, bozukOkuyucu }) => {
    if (bozukOkuyucu) {
      window.BarcodeDetector = class { static async getSupportedFormats() { return ['qr_code']; } async detect() { throw new Error('desteklenmiyor'); } };
    } else {
      delete window.BarcodeDetector;
    }
    navigator.mediaDevices.getUserMedia = async () => {
      const B = 8; const K = 4; const W = (n + 2 * K) * B;
      const tv = document.createElement('canvas'); tv.width = W; tv.height = W;
      const c = tv.getContext('2d');
      const ciz = () => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, W); c.fillStyle = '#000'; hucre.forEach((d, i) => { if (d) c.fillRect((K + (i % n)) * B, (K + Math.floor(i / n)) * B, B, B); }); };
      ciz(); setInterval(ciz, 100);
      return tv.captureStream(10);
    };
  }, { ...hucreler(metin), bozukOkuyucu });
  await y.page.goto(`${SITE}/yonetim/`);
  await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
  await y.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
  await y.page.getByRole('button', { name: 'Katılımcılar · yoklama' }).first().click();
  await y.page.getByRole('button', { name: 'Kamerayla okut' }).click();
  await y.page.getByText('Hoş geldin Ezgi! Giriş işlendi. (bilet)').waitFor({ timeout: 10000 }).catch(() => {});
  const gk = v.rpcler.find((x) => x[0] === 'giris_kaydet');
  await y.ctx.close();
  return gk ? gk[1].p_kod : null;
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const bilet = await dene(tarayici, 'FC-B-7KQ2MX', false);
    dogru(bilet === 'FC-B-7KQ2MX', `bilet karekodu okundu (${bilet})`);
    const uye = await dene(tarayici, 'FC-U-0003-1101', true);
    dogru(uye === 'FC-U-0003', `okuyucu hata verince jsQR'a geçildi, üye kodu okundu (${uye})`);
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
