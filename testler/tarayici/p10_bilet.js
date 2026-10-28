// Etkinlik bileti havale + dekontla: sitede ve üye panelinde sepet → form-gonder "bilet_adres" (tutar sunucudan) →
// dekont imzalı adrese yüklenir → "bilet_kaydet". Yönetim › Başvurular'da bilet dekontu onaylanır (bilet_karar).
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const PDF = { name: 'dekont.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 dekont') };
const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'yoga', ad: 'Yoga Sabahı', kim: null, kontenjan: 12, bilet_fiyati: 1000,
  uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Yoga', link: null };

// form-gonder ve imzalı yükleme sahte; Turnstile her zaman jeton verir
async function biletSahte(page, tutar) {
  const formlar = [];
  const yuklemeler = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
  await page.route(`${SB}/functions/v1/form-gonder`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    const g = JSON.parse(r.request().postData());
    formlar.push(g);
    const sonuc = g.tur === 'bilet_adres' ? { id: 55, tutar, yol: 'yeni/1730000000000-abcdef0123456789', jeton: 'imza-jetonu' } : 'tamam';
    r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc }) });
  });
  await page.route(`${SB}/storage/v1/object/upload/sign/**`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    yuklemeler.push({ yontem: r.request().method(), yol: new URL(r.request().url()).pathname });
    r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ Key: 'dekontlar/yeni/x' }) });
  });
  return { formlar, yuklemeler };
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Site (açılıştan sonra): misafir ----------
    const sv = { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } };
    const s = await sayfaAc(tarayici, sv);
    const sf = await biletSahte(s.page, 2000);
    await s.page.goto(`${SITE}/`);
    await s.page.getByRole('button', { name: 'Sepete ekle' }).first().click();
    await s.page.getByRole('button', { name: 'Sepete ekle' }).first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    await s.page.getByRole('button', { name: /Sepette 1/ }).first().click();
    await s.page.locator('.fs-sepet-dugme').click();
    const modal = s.page.locator('.fs-modal');
    await modal.getByRole('button', { name: 'Devam et' }).click();
    await modal.getByLabel('Ad Soyad *').fill('Misafir Kişi');
    await modal.getByLabel(/E-posta \*/).fill('misafir@posta.test');
    await modal.getByLabel('Telefon *').fill('0532 000 00 00');
    await modal.locator('input[type="checkbox"]').check();
    await modal.getByRole('button', { name: 'Ödemeye geç · havale / EFT' }).click();
    await modal.getByRole('button', { name: 'Dekontu gönder' }).waitFor({ timeout: 5000 });
    dogru(await modal.locator('span', { hasText: /^2.000 TL$/ }).count() >= 1, 'site: sunucunun tutarı görünüyor');
    const ac = sf.formlar.find((f) => f.tur === 'bilet_adres');
    dogru(ac && JSON.stringify(ac.veri.kalemler) === JSON.stringify([{ etkinlik: 7, adet: 2 }]) && ac.veri.oturum === null && ac.jeton,
      `site: istek sunucuya (2 bilet, oturumsuz, Turnstile'lı) (${JSON.stringify(ac && ac.veri)})`);
    dogru(await modal.getByText('TR59 0015 7000 0000 0205 1344 62').count() === 1, 'site: IBAN görünüyor');
    await modal.locator('input[type="file"]').setInputFiles(PDF);
    await modal.getByRole('button', { name: 'Dekontu gönder' }).click();
    await modal.getByText('Teşekkürler! 🌲').waitFor({ timeout: 5000 });
    const kayit = sf.formlar.find((f) => f.tur === 'bilet_kaydet');
    dogru(sf.yuklemeler.some((y) => y.yontem === 'PUT' && y.yol.endsWith('/dekontlar/yeni/1730000000000-abcdef0123456789'))
      && kayit && kayit.veri.id === 55 && kayit.veri.eposta === 'misafir@posta.test' && kayit.jeton === null, 'site: dekont imzalı adrese yüklendi, istek kaydedildi');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');

    // ---------- Üye paneli ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: '05321112233', bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const uv = { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [etk], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [] },
      rpc: { etkinlik_doluluk: () => [200, []] } };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    const uf = await biletSahte(u.page, 500);
    await u.page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    await sekme(u.page, 'Etkinlikler');
    await u.page.getByRole('button', { name: 'Sepete ekle' }).first().click();
    await u.page.getByRole('button', { name: 'Ödemeye geç' }).click();
    await u.page.getByRole('button', { name: 'Devam · havale / EFT' }).click();
    await u.page.getByText('Ödenecek').waitFor({ timeout: 5000 });
    const uac = uf.formlar.find((f) => f.tur === 'bilet_adres');
    dogru(uac && uac.veri.eposta === 'deniz@posta.test' && /^eyJ/.test(uac.veri.oturum || '') && uac.veri.kalemler[0].etkinlik === 7,
      `üye: istek oturum anahtarıyla (üye fiyatını sunucu hesaplar) (${uac && uac.veri.eposta})`);
    dogru(await u.page.getByText('500 TL').count() > 0, 'üye: sunucunun tutarı görünüyor');
    await u.page.locator('input[type="file"]').setInputFiles(PDF);
    await u.page.getByRole('button', { name: 'Dekontu gönder' }).click();
    await u.page.getByText('Dekontun bize ulaştı 🌲').waitFor({ timeout: 5000 });
    dogru(uf.formlar.some((f) => f.tur === 'bilet_kaydet' && f.veri.id === 55), 'üye: dekont gönderildi');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');

    // ---------- Yönetim: bilet dekontu onayı ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
    v.tablolar.etkinlikler = [{ ...v.tablolar.etkinlikler[0] }, { ...etk, kim: null, bilet_fiyati: 1000, anket_sayisi: 0, anket_ortalama: null, eski_tarih: null }];
    v.tablolar.bilet_istekleri = [
      { id: 55, uye_id: null, ad: 'Misafir Kişi', eposta: 'misafir@posta.test', tel: '05320000000', kalemler: [{ etkinlik_id: 7, adet: 2, birim: 1000, indirim: 0, tutar: 2000 }],
        tutar: 2000, dosya: 'yeni/x', yuklendi: true, durum: 'bekliyor', sonuc: null, created_at: new Date().toISOString() },
      { id: 56, uye_id: null, ad: 'Yarım Kalan', eposta: 'y@posta.test', tel: null, kalemler: [{ etkinlik_id: 7, adet: 1, birim: 1000, indirim: 0, tutar: 1000 }],
        tutar: 1000, dosya: 'yeni/y', yuklendi: false, durum: 'bekliyor', sonuc: null, created_at: new Date().toISOString() },
    ];
    v.rpc.bilet_karar = (g) => { v.rpcler.push(['bilet_karar', g]); return [200, { durum: 'onaylandi', adet: 2 }]; };
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/#basvurular`);
    await y.page.getByText('Bilet dekontları · 1').waitFor({ timeout: 15000 });
    const satir = y.page.locator('div').filter({ hasText: 'Misafir Kişi' }).filter({ has: y.page.getByRole('button', { name: 'Onayla' }) }).last();
    dogru((await satir.innerText()).includes('Yoga Sabahı') && (await satir.innerText()).includes('2.000 TL'), 'yönetim: bilet dekontu etkinlik ve tutarla listede');
    dogru(await y.page.getByText('Yarım Kalan').count() === 0, 'yönetim: dekontu yüklenmemiş istek görünmüyor');
    await satir.getByRole('button', { name: 'Onayla' }).click();
    await y.page.waitForTimeout(400);
    dogru(v.rpcler.some(([f, g]) => f === 'bilet_karar' && g.p_id === 55 && g.p_onay === true), 'yönetim: bilet_karar onayla çağrıldı');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
