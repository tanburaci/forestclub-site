// Üye formları: Yönetim › Formlar (kurma, açma, cevaplar, CSV), /form/?id=N (üye doldurur, form_yanitla), üye
// panelinde açık formlar; özel form (panelde görünmez, yalnız /form/?k=<anahtar> bağlantısıyla).
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const FORM = { id: 5, baslik: 'Kasım ayı önerileri', aciklama: 'Fikirlerini merak ediyoruz.', acik: true, created_at: new Date().toISOString(), sorular: [
  { id: 's1', metin: 'Hangi gün uygun?', tur: 'tek', secenekler: ['Cumartesi', 'Pazar'], zorunlu: true },
  { id: 's2', metin: 'Hangi buluşmalar?', tur: 'coklu', secenekler: ['Yoga', 'Müzik'], zorunlu: false },
  { id: 's3', metin: 'Önerin', tur: 'kisa', zorunlu: true },
] };
const OZEL = { id: 6, baslik: 'Gizli davet', aciklama: null, acik: true, ozel: true, anahtar: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', created_at: new Date().toISOString(), sorular: [
  { id: 's1', metin: 'Geliyor musun?', tur: 'tek', secenekler: ['Evet', 'Hayır'], zorunlu: true },
] };
const kullanici = (page) => page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetim ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
    v.tablolar.formlar = [FORM, OZEL];
    v.tablolar.form_yanitlari = [{ form_id: 5, uye_id: 2, cevaplar: { s1: 'Pazar', s2: ['Yoga', 'Müzik'], s3: 'Seramik; çömlek' }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Formlar$/ }).first().click();
    await y.page.getByText('3 soru · 1 cevap').waitFor({ timeout: 4000 });
    await y.page.locator('article').filter({ hasText: 'Kasım ayı önerileri' }).getByRole('button', { name: 'Cevaplar' }).click();
    const tablo = await y.page.locator('table.fc-tablo').last().innerText();
    dogru(tablo.includes('Elif Kaya') && tablo.includes('Pazar') && tablo.includes('Yoga, Müzik') && tablo.includes('Seramik; çömlek'), 'cevaplar üye adıyla tabloda');
    const [indirme] = await Promise.all([y.page.waitForEvent('download'), y.page.getByRole('button', { name: 'CSV indir' }).click()]);
    const csv = fs.readFileSync(await indirme.path(), 'utf8');
    dogru(csv.startsWith('﻿Üye;Tarih;Hangi gün uygun?;Hangi buluşmalar?;Önerin') && csv.includes('"Seramik; çömlek"'), 'cevaplar CSV olarak iniyor');

    await y.page.getByRole('button', { name: 'Yeni form' }).click();
    await y.page.getByLabel('Başlık *').fill('Aralık anketi');
    await y.page.getByLabel('Soru 1').fill('En sevdiğin buluşma?');
    await y.page.locator('select').filter({ has: y.page.locator('option[value="coklu"]') }).first().selectOption('tek');
    await y.page.getByLabel('Seçenekler (her satıra bir tane)').fill('Breakfast Club\nSunset Club\n');
    await y.page.getByRole('button', { name: 'Soru ekle' }).click();
    await y.page.getByLabel('Soru 2').fill('Not');
    await y.page.getByRole('button', { name: 'Formu kaydet' }).click();
    await y.page.getByText('“Aralık anketi” kaydedildi', { exact: false }).waitFor({ timeout: 4000 });
    const ekle = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/formlar');
    dogru(ekle && ekle.govde.baslik === 'Aralık anketi' && ekle.govde.sorular.length === 2 && ekle.govde.sorular[0].tur === 'tek'
      && JSON.stringify(ekle.govde.sorular[0].secenekler) === JSON.stringify(['Breakfast Club', 'Sunset Club']) && ekle.govde.sorular[1].tur === 'kisa',
      `yeni form kaydedildi (${JSON.stringify(ekle && ekle.govde)})`);
    await y.page.locator('article').filter({ hasText: 'Aralık anketi' }).getByRole('button', { name: 'Aç' }).click();
    await y.page.getByText('“Aralık anketi” açıldı', { exact: false }).waitFor({ timeout: 4000 });
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/formlar' && x.govde.acik === true), 'form açıldı (acik = true)');
    // Özel form: kartta gizli bağlantı, duyuru rozetinin form listesinde yok; yeni özel form ozel = true kaydedilir
    const ozelKart = y.page.locator('article').filter({ hasText: 'Gizli davet' });
    dogru((await ozelKart.innerText()).includes('Özel · Açık') && await ozelKart.getByLabel('Özel form bağlantısı').inputValue() === `${SITE}/form/?k=${OZEL.anahtar}`,
      'özel form: kartta /form/?k= bağlantısı görünüyor');
    dogru(await y.page.locator('select[aria-label="Form"] option', { hasText: 'Gizli davet' }).count() === 0, 'özel form: aylık duyuruda seçilemez');
    await y.page.getByRole('button', { name: 'Yeni form' }).click();
    await y.page.getByLabel('Başlık *').fill('Yönetim daveti');
    await y.page.getByLabel('Soru 1').fill('Katılır mısın?');
    await y.page.getByRole('checkbox', { name: /Özel form/ }).check();
    await y.page.getByRole('button', { name: 'Formu kaydet' }).click();
    await y.page.getByText('“Yönetim daveti”', { exact: false }).waitFor({ timeout: 4000 });  // sahte sunucu aynı id'yi döndürebilir
    const ozelEkle = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/formlar').pop();
    dogru(ozelEkle && ozelEkle.govde.ozel === true, 'özel form: ozel = true kaydedildi');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    // ---------- Form sayfası: oturumsuz ----------
    const g = await sayfaAc(tarayici, { tablolar: { formlar: [FORM] }, rpc: {} });
    await g.page.goto(`${SITE}/form/?id=5`);
    await g.page.getByText('Önce üye girişi').waitFor({ timeout: 10000 });
    dogru(true, 'form: oturum yoksa üye girişine yönlendirir');

    // ---------- Form sayfası: üye doldurur ----------
    const yazilan = [];
    const uv = { tablolar: { formlar: [FORM], form_yanitlari: [] }, rpc: { form_yanitla: (b) => { yazilan.push(b); return [200, b.p_cevaplar]; } } };
    const f = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await kullanici(f.page);
    await f.page.goto(`${SITE}/form/?id=5`);
    await f.page.getByRole('heading', { name: 'Kasım ayı önerileri' }).waitFor({ timeout: 10000 });
    await f.page.getByRole('button', { name: 'Gönder' }).click();
    dogru(await f.page.getByText('"Hangi gün uygun?" sorusunu cevapla.').count() === 1, 'form: zorunlu soru boşsa uyarı');
    await f.page.getByLabel('Pazar').check();
    await f.page.getByLabel('Yoga').check();
    await f.page.getByLabel('Müzik').check();
    await f.page.getByLabel('Müzik').uncheck();
    await f.page.getByRole('textbox', { name: 'Önerin' }).fill('Gün batımında yoga');
    await f.page.getByRole('button', { name: 'Gönder' }).click();
    await f.page.getByText('Teşekkürler! 🌲').waitFor({ timeout: 5000 });
    dogru(yazilan.length === 1 && yazilan[0].p_form === 5 && JSON.stringify(yazilan[0].p_cevaplar) === JSON.stringify({ s1: 'Pazar', s2: ['Yoga'], s3: 'Gün batımında yoga' }),
      `form: cevap form_yanitla ile gitti (${JSON.stringify(yazilan[0])})`);
    dogru(!f.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), 'form: sayfa / CSP hatası yok');

    // ---------- Özel form: anahtarlı bağlantıyla açılır, cevap anahtarla gider ----------
    const oy = [];
    const ov = { tablolar: { formlar: [], form_yanitlari: [] }, rpc: {
      ozel_form: (b) => [200, b.p_anahtar === OZEL.anahtar ? [{ id: 6, baslik: OZEL.baslik, aciklama: null, sorular: OZEL.sorular }] : []],
      form_yanitla: (b) => { oy.push(b); return [200, b.p_cevaplar]; } } };
    const o = await sayfaAc(tarayici, ov, oturum('uye-1', 'deniz@posta.test'));
    await kullanici(o.page);
    await o.page.goto(`${SITE}/form/?k=${OZEL.anahtar}`);
    await o.page.getByRole('heading', { name: 'Gizli davet' }).waitFor({ timeout: 10000 });
    await o.page.getByLabel('Evet').check();
    await o.page.getByRole('button', { name: 'Gönder' }).click();
    await o.page.getByText('Teşekkürler! 🌲').waitFor({ timeout: 5000 });
    dogru(oy.length === 1 && oy[0].p_form === 6 && oy[0].p_anahtar === OZEL.anahtar, `özel form: cevap anahtarla gitti (${JSON.stringify(oy[0])})`);
    await o.page.goto(`${SITE}/form/?k=yanlis`);
    await o.page.waitForTimeout(1500);
    dogru(await o.page.getByRole('heading', { name: 'Gizli davet' }).count() === 0, 'özel form: yanlış anahtarla açılmaz');

    // ---------- Üye paneli: açık formlar ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: null, bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const pv = { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [], formlar: [FORM, OZEL], form_yanitlari: [] },
      rpc: { etkinlik_doluluk: () => [200, []] } };
    const u = await sayfaAc(tarayici, pv, oturum('uye-1', 'deniz@posta.test'));
    await kullanici(u.page);
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    dogru(await u.page.getByRole('link', { name: 'Doldur' }).getAttribute('href') === '/form/?id=5', 'üye paneli: açık form "Doldur" bağlantısıyla');
    dogru(!(await u.page.locator('body').innerText()).includes('Gizli davet'), 'üye paneli: özel form görünmez');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
