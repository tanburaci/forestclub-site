// Düğün maliyeti (01.11.2026): Yönetim › Düğün › Maliyet'te başlangıç maliyetleri görünür; kâr yüzdesi girilince müşteri
// fiyatı hesaplanır ve kaydedilir (dugun_maliyet_kaydet); grup için toplu kâr; https olmayan tedarikçi bağlantısı
// reddedilir. /dugun/ sayfası yalnız müşteri fiyatını (dugun_fiyatlari) okur, maliyet tablosunu hiç istemez; fiyatı
// olmayan üründe "teklif ile" yazar.
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };

const katalog = [
  { id: 1, tur: 'mekan', ad: 'Pinya, Urla', aciklama: null, resim: '/dugun/cizim/mekan.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 21, tur: 'urun', ad: 'Şeffaf Tiffany', aciklama: null, resim: '/dugun/foto/sandalye-seffaf-tiffany.jpg', grup: 'Sandalye', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 22, tur: 'urun', ad: 'Rattan', aciklama: null, resim: '/dugun/foto/sandalye-rattan.jpg', grup: 'Sandalye', mekan_id: null, yemek_mekandan: true, sira: 2, acik: true },
  { id: 30, tur: 'urun', ad: 'Kristal kadeh', aciklama: null, resim: '/dugun/foto/bardak-kristal-kadeh.jpg', grup: 'Bardak', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
];
const maliyetler = [
  { katalog_id: 21, alis: 3700, kira: 175, esas: 'kira', kar_yuzde: null, birim: 'adet', tedarikci: null, notlar: 'Kira 150–200 TL' },
  { katalog_id: 30, alis: 80, kira: null, esas: 'alis', kar_yuzde: null, birim: 'adet', tedarikci: null, notlar: 'Paşabahçe' },
];
const fiyatlar = [];

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const v = yonetimVerisi();
    Object.assign(v.tablolar, { dugun_katalog: katalog, dugun_maliyetler: () => maliyetler, dugun_fiyatlar: () => fiyatlar,
      dugun_talepleri: [], dugun_davetleri: [], dugun_envanter: [], dugun_envanter_hareketleri: [] });
    v.rpc.dugun_maliyet_kaydet = (g) => {
      v.rpcler.push(['dugun_maliyet_kaydet', g.p]);
      const p = g.p;
      const esas = p.esas === 'kira' ? p.kira : p.alis;
      const fiyat = esas != null && p.kar_yuzde != null ? Math.round(esas * (1 + p.kar_yuzde / 100)) : null;
      const j = fiyatlar.findIndex((x) => x.katalog_id === p.katalog_id);
      if (j >= 0) fiyatlar.splice(j, 1);
      if (fiyat != null) fiyatlar.push({ katalog_id: p.katalog_id, fiyat, birim: p.birim });
      return [200, { fiyat }];
    };
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    y.page.on('dialog', (d) => d.accept());
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Düğün$/ }).first().click();
    await y.page.locator('button').filter({ hasText: /^Maliyet$/ }).first().click();
    await y.page.getByText('Müşteri fiyatı', { exact: false }).first().waitFor({ timeout: 8000 });
    dogru(await y.page.getByLabel('Şeffaf Tiffany kira maliyeti').inputValue() === '175', 'başlangıç kira maliyeti görünüyor');
    dogru(await y.page.getByText('Kaynak: Kira 150–200 TL').count() === 1, 'maliyetin kaynağı görünüyor');
    dogru(await y.page.getByText('2 ürünün maliyeti bilinmiyor').count() === 0 && await y.page.getByText('1 ürünün maliyeti bilinmiyor').count() === 1, 'maliyeti bilinmeyen sayısı (Rattan)');

    // Tek ürün: kâr %40 → 175 × 1,4 = 245 TL
    await y.page.getByLabel('Şeffaf Tiffany kâr yüzdesi').fill('40');
    dogru(await y.page.getByText('245 TL / adet').count() === 1, 'müşteri fiyatı yazarken hesaplanıyor (245 TL / adet)');
    await y.page.locator('.dy-mal').filter({ hasText: 'Şeffaf Tiffany' }).getByRole('button', { name: 'Kaydet' }).click();
    await y.page.getByText('Kaydedildi ✓').first().waitFor({ timeout: 4000 });
    const k1 = v.rpcler.filter((x) => x[0] === 'dugun_maliyet_kaydet').pop();
    dogru(k1 && k1[1].katalog_id === 21 && k1[1].kira === 175 && k1[1].kar_yuzde === 40 && k1[1].esas === 'kira', `kayıt: ${JSON.stringify(k1 && k1[1])}`);

    // Türkçe rakam yazımı ve esas değişimi: alış 1.250,50 esas alış
    await y.page.getByLabel('Kristal kadeh alış maliyeti').fill('1.250,50');
    await y.page.getByLabel('Kristal kadeh kâr yüzdesi').fill('10');
    dogru(await y.page.getByText('1.376 TL / adet').count() === 1, 'Türkçe yazılmış rakam: 1.250,50 × 1,1 = 1.376 TL');

    // https olmayan tedarikçi
    await y.page.locator('.dy-mal').filter({ hasText: 'Kristal kadeh' }).locator('input[type=url]').fill('http://tedarikci.example');
    await y.page.locator('.dy-mal').filter({ hasText: 'Kristal kadeh' }).getByRole('button', { name: 'Kaydet' }).click();
    await y.page.getByText('Tedarikçi bağlantısı https:// ile başlamalı.').waitFor({ timeout: 3000 });
    dogru(true, 'https olmayan tedarikçi bağlantısı reddedildi');

    // Grup için toplu kâr: Sandalye %50 → Tiffany 263 TL; Rattan maliyetsiz → fiyat yok
    const grup = y.page.locator('section.dy-kart').filter({ has: y.page.locator('h3', { hasText: /^Sandalye$/ }) });
    await grup.getByPlaceholder('Örn. 40').fill('50');
    await grup.getByRole('button', { name: 'Hepsine uygula' }).click();
    await y.page.getByText('Sandalye: kâr %50 uygulandı.').waitFor({ timeout: 5000 });
    dogru(fiyatlar.find((f) => f.katalog_id === 21).fiyat === 263 && !fiyatlar.find((f) => f.katalog_id === 22), 'toplu kâr: Tiffany 263 TL, maliyetsiz Rattan fiyatsız');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), `yönetim: sayfa hatası yok ${y.konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);

    // Müşteri sayfası
    const dv = { tablolar: { dugun_katalog: katalog }, rpc: { dugun_fiyatlari: () => [200, fiyatlar], dugun_davet_bilgi: () => [200, []] } };
    const d = await sayfaAc(tarayici, dv, null);
    await d.page.goto(`${SITE}/dugun/`);
    await d.page.getByRole('heading', { name: /Doğanın içinde/ }).waitFor({ timeout: 15000 });
    const html = await d.page.content();
    dogru(!d.istekler.some((x) => /dugun_maliyetler/.test(x.yol)), 'düğün sayfası maliyet tablosunu hiç istemiyor');
    dogru(d.istekler.some((x) => x.yol === '/rest/v1/rpc/dugun_fiyatlari'), 'düğün sayfası yalnız müşteri fiyatlarını okuyor');
    const fiyatYazisi = await d.page.evaluate(() => window.FCD && window.FCD.fiyatlar.length);
    dogru(fiyatYazisi === 1, `müşteri fiyatı sayfaya geldi (${fiyatYazisi})`);
    dogru(!/3700|3\.700|maliyet/i.test(html), 'sayfada maliyet ya da alış rakamı yok');
    dogru(!d.konsol.some((x) => /pageerror/.test(x)), `düğün: sayfa hatası yok ${d.konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
