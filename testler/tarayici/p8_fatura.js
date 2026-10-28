// Fatura takibi: Yönetim › Muhasebe'de gelirlerin yanında "Kesildi" (fatura no ile) / "Gerekmez"; "Faturası kesilecek"
// süzgeci ay sınırı olmadan kesilmemiş gelirleri gösterir. İşaret muhasebe_hareketleri'ne yazılır.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

const satir = (id, tarih, tur, tutar, aciklama, ek = {}) => ({ id, tarih, tur, tutar, kasa: 'banka', hedef_kasa: null, kategori: tur === 'gelir' ? 'Aidat' : 'İkram',
  etkinlik_id: null, aciklama, belge: null, otomatik: tur === 'gelir', odeme: null, fatura_durum: null, fatura_no: null, fatura_tarih: null, ...ek });

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const v = yonetimVerisi();
    v.tablolar.muhasebe_hareketleri = [
      satir(1, gun(0), 'gelir', 3000, 'Aidat · Ezgi'),
      satir(2, gun(-40), 'gelir', 2500, 'Kartla destek · ödeme 1'),          // geçen ay: süzgeçte yine görünür
      satir(3, gun(0), 'gelir', 3000, 'Aidat · Oya', { fatura_durum: 'kesildi', fatura_no: 'GIB2026000001', fatura_tarih: gun(0) }),
      satir(4, gun(0), 'gider', 800, 'Kahvaltı malzemesi'),
    ];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Muhasebe$/ }).first().click();
    const suzgec = y.page.getByRole('button', { name: 'Faturası kesilecek (2)' });
    dogru(await suzgec.count() === 1, 'süzgeçte kesilecek fatura sayısı (2)');
    dogru(await y.page.getByText('Kesildi ✓ · GIB2026000001').count() === 1, 'kesilmiş fatura no ile görünüyor');
    await suzgec.click();
    const satirlar = y.page.locator('table.fc-tablo tbody tr');
    const metin = await satirlar.allInnerTexts();
    dogru(metin.length === 2 && metin.some((x) => x.includes('Aidat · Ezgi')) && metin.some((x) => x.includes('Kartla destek')),
      `süzgeç: yalnız kesilmemiş gelirler, ay sınırı yok (${metin.length})`);

    dogru(await y.page.getByText('Fatura nasıl kesilir? (GİB e-Arşiv portalı, ücretsiz)').isVisible()
      && await y.page.getByRole('link', { name: 'earsivportal.efatura.gov.tr' }).getAttribute('href') === 'https://earsivportal.efatura.gov.tr', 'süzgeçte fatura kesme rehberi görünüyor');
    await y.page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
    await satirlar.filter({ hasText: 'Aidat · Ezgi' }).getByRole('button', { name: 'Bilgileri kopyala' }).click();
    await satirlar.filter({ hasText: 'Aidat · Ezgi' }).getByRole('button', { name: 'Kopyalandı ✓' }).waitFor({ timeout: 3000 });
    const pano = await y.page.evaluate(() => navigator.clipboard.readText());
    dogru(/^Alıcı: Ezgi\nTCKN: 11111111111\nAdres: Urla \/ İzmir\nHizmet: Forest Club Urla üyeliği – 30 gün\nMiktar: 1\nToplam \(KDV dahil\): 3000 TL/.test(pano), `fatura bilgileri panoya kopyalandı (${JSON.stringify(pano)})`);
    y.page.once('dialog', (d) => d.accept('GIB2026000002'));
    await satirlar.filter({ hasText: 'Aidat · Ezgi' }).getByRole('button', { name: 'Kesildi' }).click();
    await y.page.getByRole('button', { name: 'Faturası kesilecek (1)' }).waitFor({ timeout: 3000 });
    await satirlar.filter({ hasText: 'Kartla destek' }).getByRole('button', { name: 'Gerekmez' }).click();
    await y.page.getByText('Faturası kesilecek gelir yok ✓').waitFor({ timeout: 3000 });
    await y.page.waitForTimeout(600);
    const yazilan = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/muhasebe_hareketleri');
    const p1 = yazilan.find((x) => /id=eq\.1\b/.test(x.ara));
    const p2 = yazilan.find((x) => /id=eq\.2\b/.test(x.ara));
    dogru(p1 && p1.govde.fatura_durum === 'kesildi' && p1.govde.fatura_no === 'GIB2026000002' && p1.govde.fatura_tarih === gun(0),
      `"Kesildi" fatura no ve bugünün tarihiyle yazıldı (${JSON.stringify(p1 && p1.govde)})`);
    dogru(p2 && p2.govde.fatura_durum === 'gerekmez' && p2.govde.fatura_no === null, '"Gerekmez" yazıldı');

    // Geri al: kesilecekler listesine döner
    await y.page.getByRole('button', { name: 'Tümü' }).click();
    await satirlar.filter({ hasText: 'Aidat · Ezgi' }).getByRole('button', { name: 'Fatura işaretini geri al' }).click();
    await y.page.getByRole('button', { name: 'Faturası kesilecek (1)' }).waitFor({ timeout: 3000 });
    dogru(await satirlar.filter({ hasText: 'Kahvaltı malzemesi' }).getByRole('button', { name: 'Kesildi' }).count() === 0, 'giderde fatura düğmesi yok');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
