// Son denetim düzeltmeleri: Muhasebe'de yeni gider kaydından sonra sahte "Kaydedilemedi" uyarısı ve geçici numarayla
// silme isteği çıkmaz; Türkçe sayı okuma ("1.250" = 1250, "12,5" = 12,5, "1250.50" = 1250,5); indirim kodu "geçersiz"
// yanıtı sepette doğru mesajla görünür.
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const v = yonetimVerisi();
    v.tablolar.muhasebe_hareketleri = [];
    // Gerçek sunucu gibi: yeni satıra numara verir; olmayan numarayı silmek boş döner (yaz() "kayıt bulunamadı" der)
    let sonId = 500;
    v.yaz = (yontem, tablo) => {
      if (tablo !== 'muhasebe_hareketleri') return null;
      if (yontem === 'POST') return [201, { id: ++sonId }];
      if (yontem === 'DELETE') return [200, []];
      return null;
    };
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });

    // Türkçe sayı okuma
    const sonuc = await y.page.evaluate(() => ['1.250', '1.250,50', '12,5', '12.5', '1250.50', '1250', '1.25.0', '', '3.000 TL'].map((x) => window.FCSayi(x)));
    dogru(JSON.stringify(sonuc) === JSON.stringify([1250, 1250.5, 12.5, 12.5, 1250.5, 1250, null, null, 3000]),
      `Türkçe sayı okuma (${JSON.stringify(sonuc)})`);

    await y.page.locator('button').filter({ hasText: /^Muhasebe$/ }).first().click();
    await y.page.getByRole('button', { name: 'Gider ekle' }).first().click();
    await y.page.getByPlaceholder('Örn. 1.250').fill('1.250');
    await y.page.getByPlaceholder('Örn. Kahvaltı malzemeleri').fill('Denetim gideri');
    await y.page.getByRole('button', { name: 'Kaydet', exact: true }).click();
    await y.page.getByText('Muhasebeye kaydedildi ✓').waitFor({ timeout: 5000 });
    await y.page.waitForTimeout(800);
    const post = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/muhasebe_hareketleri');
    dogru(post && Number(post.govde.tutar) === 1250, `"1.250" gider 1250 TL yazıldı (${post && post.govde.tutar})`);
    const sil = y.istekler.filter((x) => x.yontem === 'DELETE' && x.yol === '/rest/v1/muhasebe_hareketleri');
    dogru(sil.length === 0, `yeni kayıttan sonra silme isteği gitmedi (${sil.map((x) => x.ara).join(' ')})`);
    dogru(await y.page.getByText(/Kaydedilemedi/).count() === 0, 'sahte "Kaydedilemedi" uyarısı yok');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message); kalan++;
  } finally {
    await tarayici.close();
    sunucu.kill();
    console.log(kalan ? `${kalan} kontrol kaldı` : 'Hepsi geçti');
    process.exit(kalan ? 1 : 0);
  }
})();
