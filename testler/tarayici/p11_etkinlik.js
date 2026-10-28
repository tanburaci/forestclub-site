// Etkinlikler: aylık dosya (CSV) yükleme önizlemesi ve ekleme, minimum kişi alanı ve uyarısı; sitede bilet satılmayan
// etkinlik "Üyelere ücretsiz".
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const trT = (t) => t.split('-').reverse().join('.');

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 6);
    v.tablolar.etkinlikler[0].min_kisi = 8;  // Breakfast Club: 2 kayıtlı
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
    dogru(await y.page.getByText('Minimum 8 kişi · 6 kişi eksik').count() === 1, 'kartta minimum kişi uyarısı');

    const csv = ['tarih;saat;tur;ad;kim;kontenjan;bilet_fiyati;uyelere;tanisma_kontenjan;aciklama;link;min_kisi',
      `${trT(gun(12))};10.00–11.30;yoga;Yoga Sabahı;Ece;12;1000;ucretsiz;2;"Matını getir; yedek mat var.";;6`,
      `${trT(gun(14))};10.00;bulusma;Breakfast Club Kasım;;35;;;;Kahvaltı;https://www.instagram.com/forestcluburla/;`,
      `${trT(gun(15))};10.00;dans;Yanlış Tür;;10;;;;;;`].join('\n');
    await y.page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({ name: 'kasim.csv', mimeType: 'text/csv', buffer: Buffer.from(`﻿${csv}`) });
    await y.page.getByText('Dosyadan 3 satır · 2 etkinlik eklenmeye hazır').waitFor({ timeout: 4000 });
    dogru(await y.page.getByText(/Eklenmeyecek: Tür şunlardan biri olmalı/).count() === 1, 'hatalı satır önizlemede, eklenmeyecek');
    await y.page.getByRole('button', { name: '2 etkinliği ekle' }).click();
    await y.page.getByText('2 etkinlik eklendi', { exact: false }).waitFor({ timeout: 3000 });
    await y.page.waitForTimeout(800);
    const ekle = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/etkinlikler').map((x) => x.govde);
    const yoga = ekle.find((g) => g.ad === 'Yoga Sabahı');
    const kahvalti = ekle.find((g) => g.ad === 'Breakfast Club Kasım');
    dogru(ekle.length === 2 && yoga && yoga.tarih === gun(12) && yoga.min_kisi === 6 && yoga.tanisma_kontenjan === 2 && yoga.bilet_fiyati === 1000
      && yoga.uyelere === 'ucretsiz' && yoga.aciklama === 'Matını getir; yedek mat var.',
      `CSV'den yoga eklendi (${JSON.stringify(yoga)})`);
    dogru(kahvalti && kahvalti.bilet_fiyati === null && kahvalti.min_kisi === null && kahvalti.link === 'https://www.instagram.com/forestcluburla/', 'CSV\'den biletsiz etkinlik eklendi');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    // Site: bilet satılmayan etkinlik üyelere ücretsiz
    const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null,
      uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null };
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } });
    await s.page.goto(`${SITE}/`);
    await s.page.getByText('Üyelere ücretsiz').first().waitFor({ timeout: 10000 });
    dogru(await s.page.getByRole('button', { name: 'Yalnız üyeler' }).count() === 1, 'site: biletsiz etkinlik "Üyelere ücretsiz · Yalnız üyeler"');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
