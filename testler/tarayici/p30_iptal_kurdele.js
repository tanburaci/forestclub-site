// İptal kurdelesi (09.11.2026): iptal edilen etkinlik sitede tarihi geçene kadar listede ve kendi sayfasında görünür,
// köşede "İPTAL" kurdelesi + duyuru yazısı; satış kapalı, sitenin en üstünde duyuru yok. Geçmiş iptal listeden düşer.
// Ertelenen etkinlik yeni tarihinde sarı "ERTELENDİ" kurdelesiyle, satış açık.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const AFIS = 'https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/test.png';
const ortak = { tur: 'yoga', kim: null, kontenjan: 20, uyelere: 'tam', satilan_bilet: 0, link: null, aciklama: 'Doğada yoga.' };
const etkinlikler = [
  { ...ortak, id: 31, tarih: gun(4), saat: '10.00', ad: 'Yağmur Yogası', bilet_fiyati: 500, durum: 'iptal', durum_duyuru: 'Yağmur nedeniyle iptal. Biletler iade edilecek.', afis: AFIS },
  { ...ortak, id: 32, tarih: gun(5), saat: '10.00', ad: 'Normal Yoga', bilet_fiyati: 500, durum: 'yayinda', afis: null },
  { ...ortak, id: 33, tarih: gun(-3), saat: '10.00', ad: 'Eski İptal', bilet_fiyati: 500, durum: 'iptal', durum_duyuru: 'Eski.', afis: null },
  { ...ortak, id: 35, tarih: gun(12), eski_tarih: gun(2), saat: '10.00', ad: 'Ertelenen Yoga', bilet_fiyati: 500, durum: 'yayinda', durum_duyuru: 'Yağmur nedeniyle 12 güne ertelendi.', afis: null },
  { ...ortak, id: 34, tarih: gun(6), saat: '10.00', ad: 'Taslak Etkinlik', bilet_fiyati: 500, durum: 'taslak', afis: null },
];

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler, ayarlar: [{ anahtar: 'yakinda', deger: false }] },
      rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    await s.page.setViewportSize({ width: 390, height: 844 });
    await s.page.goto(`${SITE}/`);
    const iptal = s.page.locator('li.fs-urun').filter({ hasText: 'Yağmur Yogası' });
    await iptal.waitFor({ timeout: 15000 });
    dogru(await iptal.locator('.fs-iptal-kurdele').innerText() === 'İPTAL', 'liste: iptal edilen etkinlikte İPTAL kurdelesi');
    dogru((await iptal.locator('.fs-iptal-not').innerText()).includes('Yağmur nedeniyle iptal. Biletler iade edilecek.'), 'liste: duyuru yazısı kartta');
    const dugme = iptal.getByRole('button', { name: 'İptal edildi' });
    dogru(await dugme.count() === 1 && await dugme.isDisabled(), 'liste: satış kapalı, düğme "İptal edildi"');
    const normal = s.page.locator('li.fs-urun').filter({ hasText: 'Normal Yoga' });
    dogru(await normal.locator('.fs-iptal-kurdele').count() === 0 && await normal.getByRole('button', { name: 'Randevu oluştur' }).count() === 1, 'liste: normal etkinlik etkilenmedi');
    dogru(await s.page.locator('li.fs-urun').filter({ hasText: 'Eski İptal' }).count() === 0, 'liste: tarihi geçmiş iptal görünmez');
    dogru(await s.page.locator('li.fs-urun').filter({ hasText: 'Taslak Etkinlik' }).count() === 0, 'liste: taslak görünmez');
    dogru(await s.page.locator('.fs-duyuru, [role=alert]').filter({ hasText: 'Yağmur' }).count() === 0, 'site: en üstte iptal duyurusu yok');
    dogru(await s.page.evaluate(() => document.documentElement.scrollWidth <= 390), 'liste: telefonda yatay taşma yok');
    const ert = s.page.locator('li.fs-urun').filter({ hasText: 'Ertelenen Yoga' });
    dogru(await ert.locator('.fs-ertele-kurdele').innerText() === 'ERTELENDİ' && await ert.locator('.fs-ertele-kurdele').evaluate((e) => getComputedStyle(e).backgroundColor === 'rgb(246, 201, 69)'),
      'liste: ertelenen etkinlikte sarı ERTELENDİ kurdelesi');
    dogru((await ert.locator('.fs-ertele-not').innerText()).includes('Yağmur nedeniyle 12 güne ertelendi.'), 'liste: erteleme duyurusu kartta');
    dogru(await ert.getByRole('button', { name: 'Randevu oluştur' }).count() === 1 && await ert.locator('.fs-iptal-kurdele:not(.fs-ertele-kurdele)').count() === 0, 'liste: ertelenende satış açık, kırmızı kurdele yok');
    const kb = await ert.boundingBox(), nb = await ert.locator('.fs-ertele-not').boundingBox();
    dogru(kb && nb && nb.x + nb.width <= kb.x + kb.width - 60, 'liste: erteleme notu kurdelenin altında kalmıyor');
    const kutu = await iptal.boundingBox();
    const kurdele = await iptal.locator('.fs-iptal-not').boundingBox();
    dogru(kutu && kurdele && kurdele.x + kurdele.width <= kutu.x + kutu.width - 40, 'liste: not kurdelenin altında kalmıyor');

    // Etkinlik sayfası
    await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8') }));
    await s.page.goto(`${SITE}/e/31`);
    await s.page.locator('.fe-iptal').waitFor({ timeout: 15000 });
    dogru((await s.page.locator('.fe-iptal').innerText()).includes('Yağmur nedeniyle iptal.'), 'etkinlik sayfası: kurdele ve duyuru yazısı');
    dogru(await s.page.locator('.fe-satis').count() === 0 && await s.page.locator('.fe-cubuk').count() === 0, 'etkinlik sayfası: satış kutusu ve alt çubuk yok');
    dogru(await s.page.locator('.fe-iptal-afis').count() === 1, 'etkinlik sayfası: afiş gri');
    dogru(await s.page.getByText('Takvime ekle').count() === 0, 'etkinlik sayfası: takvime ekle yok');
    await s.page.goto(`${SITE}/e/35`);
    await s.page.locator('.fs-ertele-not').waitFor({ timeout: 15000 });
    dogru((await s.page.locator('.fe-iptal').innerText()).includes('ERTELENDİ') && await s.page.locator('.fe-satis').count() === 1, 'etkinlik sayfası: ertelenende sarı kurdele, satış açık');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
