// Etkinlik envanteri: Muhasebe › Gider ekle'de "ürünü envantere de ekle" (gider bir kez yazılır, envantere satın alındı
// olarak girer); Envanter'de "Hasarlı / kullanılamaz" ile düşüm (adet azalır, envanter_dusumleri kaydı, fazlası düşülemez).
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
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 3);
    v.tablolar.envanter = [{ id: 7, ad: 'Yoga matı', kategori: 'Yoga / hareket', adet: 6, birim: 'adet', giris: 'satin', tarih: '2026-10-01', tutar: 4800, kasa: 'banka', firma: null, karsilik: null, kaynak: null, konum: 'Depo', notlar: null, created_at: '2026-10-01T10:00:00Z' }];
    v.tablolar.envanter_dusumleri = [];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    const p = y.page;
    await p.goto(`${SITE}/yonetim/`);
    await p.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });

    // Muhasebe › Gider ekle → envantere de ekle
    await p.locator('nav.fc-menu button', { hasText: /^Muhasebe$/ }).click();
    await p.getByRole('button', { name: 'Gider ekle' }).first().click();
    await p.getByLabel('Tutar (TL) *').fill('900');
    await p.getByLabel('Açıklama').first().fill('Pilates topu');
    await p.getByLabel('Ödeme yapılan ürünü envantere de ekle').check();
    dogru(await p.getByLabel('Ne? *').inputValue() === 'Pilates topu', 'gider: envanter adı açıklamadan dolar');
    await p.getByLabel('Miktar *').fill('3');
    await p.getByRole('button', { name: 'Kaydet' }).first().click();
    await p.getByText('“Pilates topu” (3 adet) envantere eklendi.', { exact: false }).waitFor({ timeout: 4000 });
    await p.waitForTimeout(800);
    const hEkle = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/muhasebe_hareketleri');
    const eEkle = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/envanter');
    dogru(hEkle.length === 1 && hEkle[0].govde.tutar === 900, 'gider: muhasebeye bir kez yazıldı');
    dogru(eEkle.length === 1 && eEkle[0].govde.ad === 'Pilates topu' && eEkle[0].govde.adet === 3 && eEkle[0].govde.giris === 'satin' && eEkle[0].govde.tutar === 900,
      `gider: envantere satın alındı olarak girdi (${JSON.stringify(eEkle[0] && eEkle[0].govde)})`);

    // Envanter › Hasarlı / kullanılamaz
    await p.locator('nav.fc-menu button', { hasText: /^Envanter$/ }).click();
    await p.getByRole('button', { name: 'Yoga matı: hasarlı / kullanılamaz düş' }).click();
    await p.getByLabel('Kaç tane? *').fill('10');
    await p.getByRole('button', { name: 'Envanterden düş' }).click();
    dogru(await p.getByText('Envanterde 6 adet var; en çok o kadar düşülebilir.').count() === 1, 'düşüm: mevcuttan fazlası düşülemez');
    await p.getByLabel('Kaç tane? *').fill('2');
    await p.getByLabel('Neden?').selectOption('kullanilamaz');
    await p.getByRole('button', { name: 'Envanterden düş' }).click();
    await p.getByText('“Yoga matı”: 2 adet kullanılamaz olarak envanterden düşüldü.').waitFor({ timeout: 4000 });
    await p.waitForTimeout(800);
    const dk = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/envanter_dusumleri');
    dogru(dk && dk.govde.envanter_id === 7 && dk.govde.adet === 2 && dk.govde.neden === 'kullanilamaz', `düşüm: kayıt yazıldı (${JSON.stringify(dk && dk.govde)})`);
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/envanter' && x.govde.adet === 4), 'düşüm: adet 6 → 4');
    dogru((await p.locator('tr', { hasText: 'Yoga matı' }).innerText()).includes('2 adet düşüldü'), 'düşüm: satırda düşülen miktar görünür');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
