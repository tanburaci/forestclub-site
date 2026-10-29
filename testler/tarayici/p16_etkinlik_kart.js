// Etkinlik kartları (site ve üye paneli): önce kısa özet; karta dokununca açılır (Ayrıntılar yazısına değil, kartın
// herhangi bir yerine), afiş görünür ve afişe dokununca tam ekran açılır, dokununca / Esc ile kapanır. Dekont
// sayfasındaki aidat tutarı yönetimdeki ayardan gelir.
const { sayfaAc, gun, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const QG = require('fs').readFileSync(require.resolve('qrcode-generator/qrcode.js'));
const AFIS = 'https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/test.png';
const UZUN = 'Ağaçların altında uzun bir kahvaltı buluşması. '.repeat(12).trim();
const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: 'Pelin', kontenjan: 30, bilet_fiyati: 600,
  uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda', aciklama: UZUN, link: null, afis: AFIS };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Site (telefon) ----------
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }] },
      rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    await s.page.setViewportSize({ width: 390, height: 844 });
    await s.page.goto(`${SITE}/`);
    const kart = s.page.locator('li.fs-urun').filter({ hasText: 'Breakfast Club' });
    await kart.waitFor({ timeout: 15000 });
    const metin = kart.locator('.fs-ozet');
    dogru(await metin.count() === 1 && (await metin.evaluate((e) => e.scrollHeight > e.clientHeight + 4)), 'site: kart önce kısa özet (açıklama kısaltılmış)');
    dogru(await kart.locator('.fs-afis-ac').count() === 0, 'site: kapalı kartta afiş yok');
    await kart.locator('h3').click();
    dogru(await kart.locator('.fs-ozet').count() === 0 && await kart.locator('.fs-afis-ac').count() === 1, 'site: kartın başlığına dokununca açıldı, afiş göründü');
    await kart.locator('.fs-afis-ac').click();
    const tam = s.page.locator('.fs-tam');
    dogru(await tam.isVisible() && (await tam.locator('img').getAttribute('src')) === AFIS, 'site: afiş tam ekran açıldı');
    await tam.click({ position: { x: 10, y: 10 } });
    dogru(await tam.count() === 0, 'site: tam ekran dokununca kapandı');
    await kart.locator('.fs-afis-ac').click();
    await s.page.keyboard.press('Escape');
    dogru(await s.page.locator('.fs-tam').count() === 0, 'site: tam ekran Esc ile kapandı');
    await kart.getByRole('button', { name: 'Randevu oluştur' }).click();
    dogru(await kart.locator('.fs-afis-ac').count() === 1, 'site: düğmeye basmak kartı kapatmaz');
    await kart.locator('div').filter({ hasText: /^10\.00 · Pinya, Urla$/ }).click();
    dogru(await kart.locator('.fs-ozet').count() === 1, 'site: karta yeniden dokununca kapandı');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');

    // ---------- Üye paneli ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Deneme', eposta: 'deniz@posta.test', tel: null, bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1', aidat_muaf: false };
    const u = await sayfaAc(tarayici, { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [etk], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [] },
      rpc: { etkinlik_doluluk: () => [200, []], dekont_bekliyor: () => [200, false] } }, oturum('uye-1', 'deniz@posta.test'));
    await u.page.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: QG }));
    await u.page.setViewportSize({ width: 390, height: 844 });
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    await u.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
    const uk = u.page.locator('article.fu-kart').filter({ hasText: 'Breakfast Club' });
    await uk.waitFor({ timeout: 5000 });
    dogru(await uk.getByRole('button', { name: 'Afişi tam ekran aç' }).count() === 0, 'üye: kapalı kartta afiş yok');
    await uk.getByText('Normal fiyat 600 TL', { exact: false }).click();  // başlık değil, kartın altındaki fiyat yazısı
    dogru(await uk.getByRole('button', { name: 'Afişi tam ekran aç' }).count() === 1, 'üye: kartın herhangi bir yerine dokununca açıldı');
    await uk.getByRole('button', { name: 'Afişi tam ekran aç' }).click();
    const ut = u.page.getByRole('dialog', { name: 'Breakfast Club afişi' });
    dogru(await ut.isVisible(), 'üye: afiş tam ekran açıldı');
    await ut.click({ position: { x: 10, y: 10 } });
    dogru(await ut.count() === 0, 'üye: tam ekran dokununca kapandı');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');

    // ---------- Aylık duyuru: yönetimden ayarlanır, sitede rozet + şerit ----------
    const { yonetimVerisi } = require('./yardim.js');
    const yv = yonetimVerisi();
    yv.tablolar.formlar = [{ id: 5, baslik: 'Aralık önerileri', aciklama: null, sorular: [], acik: true, created_at: '2026-10-01T00:00:00Z' }];
    const y = await sayfaAc(tarayici, yv, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
    const bolum = y.page.locator('section').filter({ hasText: 'Aylık duyuru (sitedeki sarı rozet)' });
    await bolum.waitFor({ timeout: 5000 });
    await bolum.getByLabel('Ay', { exact: true }).selectOption('Aralık');
    await bolum.getByLabel('Üst yazı', { exact: true }).fill('{ay} programı');
    await bolum.getByLabel('Büyük yazı', { exact: true }).fill('YAYINDA!!');
    await bolum.getByLabel('Tıklayınca', { exact: true }).selectOption('form');
    await bolum.getByLabel('Form', { exact: true }).selectOption('5');
    await bolum.getByRole('button', { name: 'Kaydet' }).click();
    await bolum.getByText('Kaydedildi ✓').waitFor({ timeout: 3000 });
    const kayit = y.istekler.filter((x) => x.yontem === 'PATCH' && /anahtar=eq\.aylik_duyuru/.test(x.ara)).pop();
    dogru(kayit && kayit.govde.deger.ay === 'Aralık' && kayit.govde.deger.ust === '{ay} programı' && kayit.govde.deger.tur === 'form' && kayit.govde.deger.formId === '5',
      `yönetim: aylık duyuru kaydedildi (${JSON.stringify(kayit && kayit.govde.deger)})`);
    dogru(await bolum.getByText('Aralık programı').count() === 1, 'yönetim: rozet önizlemesinde {ay} = Aralık');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    const aylikSite = (deger) => sayfaAc(tarayici, { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'aylik_duyuru', deger }] },
      rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    const a1 = await aylikSite({ goster: true, ay: 'Aralık', ust: '{ay} programı', ana: 'YAYINDA!!', alt: 'Tıkla, gör', tur: 'resim', resim: AFIS });
    await a1.page.goto(`${SITE}/`);
    const rozet = a1.page.locator('.fs-cagri-rozet');
    await rozet.waitFor({ timeout: 15000 });
    dogru((await rozet.innerText()).replace(/\s+/g, ' ').includes('Aralık programı YAYINDA!!'), 'site: rozet yönetimdeki yazıyla ({ay} = Aralık)');
    dogru(await a1.page.locator('#bulusmalar button').filter({ hasText: 'YAYINDA!!' }).count() === 1, 'site: etkinliklerin üstünde aynı duyuru şeridi');
    await rozet.click({ force: true });  // rozet sürekli sallanıyor (animasyon)
    dogru((await a1.page.locator('.fs-tam img').getAttribute('src')) === AFIS, 'site: resim seçiliyse tıklayınca tam ekran');
    const a2 = await aylikSite({ goster: true, ay: 'Aralık', ust: '{ay} programı için', ana: 'AÇIK ÇAĞRI!', alt: '', tur: 'form', formId: '5' });
    await a2.page.goto(`${SITE}/`);
    await a2.page.locator('.fs-cagri-rozet').click({ force: true });
    await a2.page.waitForURL(/\/form\/\?id=5$/, { timeout: 5000 }).then(() => dogru(true, 'site: form seçiliyse /form/?id=5 açılır'), () => dogru(false, 'site: form seçiliyse /form/?id=5 açılır'));
    const a3 = await aylikSite({ goster: false });
    await a3.page.goto(`${SITE}/`);
    await a3.page.getByText('Breakfast Club').first().waitFor({ timeout: 15000 });
    dogru(await a3.page.locator('.fs-cagri-rozet').count() === 0, 'site: "Sitede göster" kapalıysa rozet yok');

    // ---------- Dekont sayfası: aidat ayardan ----------
    const d = await sayfaAc(tarayici, { tablolar: { ayarlar: [{ anahtar: 'aidat', deger: 3500 }] }, rpc: {} }, null);
    await d.page.goto(`${SITE}/dekont/`);
    await d.page.getByText('Tutar:').first().waitFor({ timeout: 15000 });
    dogru(/3\.500 TL/.test(await d.page.evaluate(() => document.body.innerText)), 'dekont: aidat ayardan (3.500 TL)');
    dogru(!d.konsol.some((x) => /pageerror/.test(x)), 'dekont: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
