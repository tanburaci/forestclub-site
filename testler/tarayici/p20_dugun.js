// Düğün organizasyonu: /dugun/ sayfası (katalog, 6 adımlı sihirbaz, menü isteğe bağlı, talep form-gonder'e "dugun"
// olarak gider), telefonda taşma yok; Yönetim › Düğün (talepler: durum ve not; katalog: ekleme, gizleme).
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const KATALOG = [
  { id: 1, tur: 'mekan', ad: 'Pinya, Urla', aciklama: 'Zeytin ağaçları ve çam gölgesinde.', resim: '/dugun/cizim/mekan.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 2, tur: 'bolum', ad: 'Nikah töreni', aciklama: null, resim: '/dugun/cizim/kemer.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 3, tur: 'bolum', ad: 'Kokteyl', aciklama: null, resim: '/dugun/cizim/kokteyl.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 2, acik: true },
  { id: 4, tur: 'konsept', ad: 'Kır sofrası', aciklama: 'Keten, kır çiçekleri.', resim: '/dugun/cizim/konsept-kir.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 5, tur: 'konsept', ad: 'Işıklı gece', aciklama: 'Mumlar ve ampuller.', resim: '/dugun/cizim/konsept-gece.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 2, acik: true },
  { id: 6, tur: 'urun', ad: 'Doğal keten', aciklama: null, resim: '/dugun/cizim/ortu.svg', grup: 'Örtü', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 7, tur: 'urun', ad: 'Kır çiçekleri', aciklama: null, resim: '/dugun/cizim/cicek.svg', grup: 'Çiçek', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 10, tur: 'urun', ad: 'Jüt yol halısı', aciklama: null, resim: null, grup: 'Nikah alanı', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 11, tur: 'urun', ad: 'Altın peçete halkası', aciklama: null, resim: null, grup: 'Peçete', mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 20, tur: 'palet', ad: 'Lavanta bahçesi', aciklama: 'Lila ve yeşil.', resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: ['#a99bc7', '#d9d0ea', '#7f8c6a'], sira: 1, acik: true },
  { id: 21, tur: 'palet', ad: 'Ege mavisi', aciklama: 'Mavi ve beyaz.', resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: ['#2f5d8a', '#ffffff'], sira: 2, acik: true },
  { id: 22, tur: 'his', ad: 'Doğal', aciklama: null, resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: null, sira: 1, acik: true },
  { id: 23, tur: 'his', ad: 'Romantik', aciklama: null, resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: null, sira: 2, acik: true },
  { id: 24, tur: 'his', ad: 'Bohem', aciklama: null, resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: null, sira: 3, acik: true },
  { id: 25, tur: 'his', ad: 'Zarif', aciklama: null, resim: null, grup: null, mekan_id: null, yemek_mekandan: true, renkler: null, sira: 4, acik: true },
  { id: 8, tur: 'ekstra', ad: 'Fotoğraf ve video', aciklama: null, resim: '/dugun/cizim/foto.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 1, acik: true },
  { id: 9, tur: 'ekstra', ad: 'Düğün pastası', aciklama: null, resim: '/dugun/cizim/pasta.svg', grup: null, mekan_id: null, yemek_mekandan: true, sira: 2, acik: true },
];

async function dugunAc(tarayici, genislik, adres = '/dugun/') {
  const s = await sayfaAc(tarayici, { tablolar: { dugun_katalog: KATALOG },
    rpc: { dugun_davet_bilgi: (b) => [200, b.p_anahtar === 'a1b2c3' ? [{ ad: 'Selin ve Mert' }] : []] } });
  if (genislik) await s.page.setViewportSize({ width: genislik, height: 860 });
  s.gonderilen = [];
  await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
    body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
  await s.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
    s.gonderilen.push(JSON.parse(r.request().postData()));
    r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc: 'tamam' }) });
  });
  await s.page.goto(`${SITE}${adres}`);
  await s.page.getByRole('heading', { name: adres === '/dugun/' ? /Doğanın içinde/ : /Merhaba|Bağlantı geçersiz/ }).waitFor({ timeout: 15000 });
  return s;
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Müşteri sayfası ----------
    const d = await dugunAc(tarayici, 1280);
    const p = d.page;
    dogru(await p.locator('#konseptler article').count() === 2, 'konsept vitrini katalogdan');
    const katIstek = d.istekler.find((x) => x.yol === '/rest/v1/dugun_katalog');
    dogru(katIstek && !/fiyat/.test(katIstek.ara) && /select=id/.test(katIstek.ara), 'katalog fiyatsız sütunlarla okunuyor');
    if (process.env.EKRAN) await p.screenshot({ path: process.env.EKRAN + '/dugun-ust.png', fullPage: true });

    const ileri = () => p.locator('#tasarla').getByRole('button', { name: /Devam|Atla|Teklif isteyin/ }).click();
    await ileri();
    dogru(await p.getByText('Bir tarih seçin', { exact: false }).count() === 1, 'adım 1: tarih yoksa uyarı');
    await p.getByLabel('Tarih henüz belli değil').check();
    await p.getByRole('radio', { name: '50–100' }).click();
    await ileri();
    await p.getByRole('heading', { name: 'Mekan ve akış' }).waitFor({ timeout: 3000 });
    dogru(await p.locator('button.dg-sec.secili', { hasText: 'Pinya, Urla' }).count() === 1, 'adım 2: tek mekan kendiliğinden seçili');
    await p.locator('button.dg-sec', { hasText: 'Nikah töreni' }).click();
    await ileri();
    await p.getByRole('heading', { name: 'Renkler ve his' }).waitFor({ timeout: 3000 });
    await p.locator('button.dg-sec', { hasText: 'Lavanta bahçesi' }).click();
    await p.getByRole('button', { name: '+ Renk ekle' }).click();
    await p.getByLabel('Renk 1', { exact: true }).evaluate((e) => { e.value = '#ff8800'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    for (const h of ['Doğal', 'Romantik', 'Bohem']) await p.locator('#tasarla button.dg-hap', { hasText: h }).click();
    await p.locator('#tasarla button.dg-hap', { hasText: 'Zarif' }).click();
    dogru(await p.getByText('En çok 3 his seçebilirsiniz.').count() === 1 && await p.locator('#tasarla button.dg-hap.secili').count() === 3, 'renk adımı: en çok 3 his');
    await ileri();
    await p.getByRole('heading', { name: 'Menü tercihi' }).waitFor({ timeout: 3000 });
    dogru(await p.locator('#tasarla').getByRole('button', { name: 'Atla →' }).count() === 1 && await p.locator('#tasarla').getByText('Yemek mekanın mutfağından gelir', { exact: false }).count() === 1,
      'adım 3: menü isteğe bağlı (Atla), yemek mekandan');
    await ileri();
    await p.locator('button.dg-sec', { hasText: 'Işıklı gece' }).click();
    dogru(await p.locator('button.dg-hap', { hasText: 'Kır çiçekleri' }).count() === 0, 'adım 4: ürün grupları kapalı gelir');
    const gruplar = await p.locator('.dg-grup-bas').allInnerTexts();
    dogru(gruplar.length === 3 && gruplar[0].startsWith('Örtü') && gruplar[1].startsWith('Peçete') && gruplar[2].startsWith('Çiçek'), `adım 4: masa grupları sırayla (${gruplar.join(' | ')})`);
    await p.locator('.dg-grup-bas', { hasText: 'Çiçek' }).click();
    await p.locator('button.dg-hap', { hasText: 'Kır çiçekleri' }).click();
    await p.locator('.dg-grup-bas', { hasText: 'Peçete' }).click();
    await p.locator('button.dg-hap', { hasText: 'Altın peçete halkası' }).click();
    dogru((await p.locator('.dg-grup-bas', { hasText: 'Çiçek' }).innerText()).includes('1 seçili'), 'adım 4: grupta seçili sayısı');
    await ileri();
    await p.getByRole('heading', { name: 'Alan ve dekor' }).waitFor({ timeout: 3000 });
    await p.locator('.dg-grup-bas', { hasText: 'Nikah alanı' }).click();
    await p.locator('button.dg-hap', { hasText: 'Jüt yol halısı' }).click();
    await ileri();
    await p.locator('button.dg-sec', { hasText: 'Düğün pastası' }).click();
    await ileri();
    await p.getByRole('heading', { name: 'Son adım' }).waitFor({ timeout: 3000 });
    const ozet = await p.locator('#tasarla').innerText();
    const mood = p.locator('.dg-mood');
    if (process.env.EKRAN) await p.locator('#tasarla').screenshot({ path: process.env.EKRAN + '/dugun-mood.png' });
    dogru(await mood.isVisible() && (await mood.innerText()).includes('Lavanta bahçesi + kendi renkleriniz') && (await mood.innerText()).includes('Romantik')
      && await mood.locator('.dg-serit span').count() === 4 && await mood.locator('.dg-mood-kucuk img').count() >= 2 && (await mood.locator('.dg-mood-ana').getAttribute('src')).includes('konsept-gece'),
      'son adım: mood board (konsept, palet + kendi rengi, his, detaylar)');
    dogru(ozet.includes('Henüz belli değil') && ozet.includes('Nikah töreni') && ozet.includes('Işıklı gece') && ozet.includes('Çiçek: Kır çiçekleri') && ozet.includes('Nikah alanı: Jüt yol halısı') && ozet.includes('Düğün pastası'),
      'adım 7: özet seçimleri gruplarıyla gösteriyor');
    dogru(!/\d+\s*(TL|₺)/.test(await p.locator('body').innerText()), 'sayfada fiyat yok');
    await p.getByLabel('Adınız ve soyadınız *').fill('Ayşe ve Can');
    await p.getByLabel('E-posta *').fill('Cift@Posta.test');
    await p.getByLabel('Telefon *').fill('0532 000 00 00');
    await ileri();
    dogru(await p.getByText('KVKK metnini onaylayın', { exact: false }).count() === 1, 'KVKK onayı olmadan gönderilmez');
    await p.locator('#tasarla input[type=checkbox]').last().check();
    await ileri();
    await p.getByRole('heading', { name: /Teşekkür ederiz/ }).waitFor({ timeout: 5000 });
    const g = d.gonderilen[0] || {};
    dogru(d.gonderilen.length === 1 && g.tur === 'dugun' && g.jeton && g.veri.eposta === 'cift@posta.test' && g.veri.kisi === '50_100' && g.veri.tarih_esnek === true
      && JSON.stringify(g.veri.secimler) === JSON.stringify({ mekan: 1, bolumler: [2], palet: 20, renkler: ['#ff8800'], his: [22, 23, 24], menu: null, konsept: 5, urunler: [7, 11, 10], ekstralar: [9] }) && g.veri.kvkk === true,
      `talep form-gonder'e "dugun" olarak gitti (${JSON.stringify(g.veri)})`);
    dogru(!d.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), 'düğün sayfası: sayfa / CSP hatası yok');

    // Özel davet bağlantısı: tanıtım yok, çift adıyla selamlanır, talep "davet" anahtarıyla gider
    const dv = await dugunAc(tarayici, 1280, '/dugun/?k=a1b2c3');
    dogru(await dv.page.getByRole('heading', { name: 'Merhaba Selin ve Mert 🤍' }).count() === 1 && await dv.page.locator('#konseptler').count() === 0 && await dv.page.getByText('Sık sorulanlar').count() === 0,
      'davet: yalnız form, çift adıyla selamlama');
    const dp = dv.page;
    const dIleri = () => dp.locator('#tasarla').getByRole('button', { name: /Devam|Atla|Teklif isteyin/ }).click();
    await dp.getByLabel('Tarih henüz belli değil').check();
    await dp.getByRole('radio', { name: 'Henüz bilmiyorum' }).click();
    for (let i = 0; i < 7; i++) await dIleri();
    dogru(await dp.getByLabel('Adınız ve soyadınız *').inputValue() === 'Selin ve Mert', 'davet: ad alanı çiftin adıyla dolu');
    await dp.getByLabel('E-posta *').fill('selin@posta.test');
    await dp.getByLabel('Telefon *').fill('0532 000 00 09');
    await dp.locator('#tasarla input[type=checkbox]').last().check();
    await dIleri();
    await dp.getByRole('heading', { name: /Teşekkür ederiz/ }).waitFor({ timeout: 5000 });
    dogru(dv.gonderilen.length === 1 && dv.gonderilen[0].veri.davet === 'a1b2c3', 'davet: talep davet anahtarıyla gitti');
    const yanlis = await dugunAc(tarayici, 1280, '/dugun/?k=yanlis');
    dogru(await yanlis.page.getByRole('heading', { name: 'Bağlantı geçersiz' }).count() === 1 && await yanlis.page.locator('#tasarla').count() === 0, 'davet: yanlış bağlantıda form yok, uyarı var');

    // Telefon: yatay taşma yok
    const t = await dugunAc(tarayici, 375);
    dogru(await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'telefon: yatay taşma yok');
    if (process.env.EKRAN) await t.page.screenshot({ path: process.env.EKRAN + '/dugun-tel.png', fullPage: true });

    // ---------- Yönetim › Düğün ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 3);
    v.tablolar.dugun_katalog = KATALOG;
    v.tablolar.dugun_talepleri = [{ id: 11, ad: 'Ayşe ve Can', eposta: 'cift@posta.test', tel: '0532 000 00 00', tarih: '2027-06-12', tarih_esnek: false, kisi: '50_100',
      secimler: { mekan: 'Pinya, Urla', bolumler: ['Nikah töreni'], konsept: 'Işıklı gece', urunler: [{ grup: 'Çiçek', ad: 'Kır çiçekleri' }], ekstralar: ['Düğün pastası'] },
      notlar: 'Gün batımında nikah', durum: 'yeni', yonetici_notu: null, created_at: '2026-11-02T10:00:00Z', updated_at: '2026-11-02T10:00:00Z' },
    { id: 12, ad: 'Eski Çift', eposta: 'eski@posta.test', tel: '0532 000 00 01', tarih: null, tarih_esnek: true, kisi: 'bilmiyorum', secimler: {}, notlar: null,
      durum: 'tamamlandi', yonetici_notu: null, created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z' }];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('nav.fc-menu button', { hasText: /^Düğün$/ }).click();
    await y.page.getByText('Ayşe ve Can').waitFor({ timeout: 8000 });
    await y.page.getByRole('button', { name: '+ Yeni bağlantı' }).click();
    await y.page.getByLabel('Çiftin adı').fill('Selin ve Mert');
    await y.page.getByRole('button', { name: 'Bağlantı oluştur' }).click();
    await y.page.getByText('Bağlantı hazır (Selin ve Mert)', { exact: false }).waitFor({ timeout: 4000 });
    const dEkle = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/dugun_davetleri');
    dogru(dEkle && dEkle.govde.ad === 'Selin ve Mert', 'yönetim: özel davet bağlantısı oluşturuldu');
    dogru(await y.page.getByText('Eski Çift').count() === 0, 'talepler: varsayılan "Açık" filtresi tamamlananları gizler');
    await y.page.getByText('Ayşe ve Can').click();
    const detay = await y.page.locator('#fc-dugun article').first().innerText();
    dogru(detay.includes('Işıklı gece') && detay.includes('Çiçek: Kır çiçekleri') && detay.includes('Gün batımında nikah') && detay.includes('cift@posta.test'), 'talep ayrıntısı: seçimler, not, iletişim');
    await y.page.locator('#fc-dugun select').first().selectOption('gorusuldu');
    await y.page.getByText('Ayşe ve Can: Görüşüldü').waitFor({ timeout: 4000 });
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/dugun_talepleri' && x.govde.durum === 'gorusuldu'), 'durum değişikliği kaydedildi');
    await y.page.getByLabel('Yönetici notu (yalnız yönetim görür)').fill('Cumartesi arandı');
    await y.page.getByRole('button', { name: 'Notu kaydet' }).click();
    await y.page.getByText('Not kaydedildi.').waitFor({ timeout: 4000 });
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/dugun_talepleri' && x.govde.yonetici_notu === 'Cumartesi arandı'), 'yönetici notu kaydedildi');
    // Başka sekmeye geçip dönünce Düğün bölümü yerinde
    await y.page.locator('nav.fc-menu button', { hasText: /^Formlar$/ }).click();
    dogru(!(await y.page.locator('#fc-dugun').isVisible()), 'başka sekmede Düğün bölümü gizli');
    await y.page.locator('nav.fc-menu button', { hasText: /^Düğün$/ }).click();
    dogru(await y.page.locator('#fc-dugun').getByText('Ayşe ve Can').isVisible() && await y.page.getByRole('heading', { name: 'Formlar' }).count() === 0, 'geri dönünce Düğün bölümü yerinde, Formlar karışmıyor');
    // Katalog
    await y.page.locator('#fc-dugun button', { hasText: /^Katalog$/ }).click();
    const gece = y.page.locator('#fc-dugun .dy-satir', { hasText: 'Işıklı gece' });
    await gece.getByRole('button', { name: 'Gizle' }).click();
    await y.page.getByText('“Işıklı gece” sitede gizlendi.').waitFor({ timeout: 4000 });
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/dugun_katalog' && x.govde.acik === false), 'katalog: kalem gizlendi');
    await y.page.locator('#fc-dugun section', { hasText: 'Masa konseptleri' }).getByRole('button', { name: '+ Ekle' }).click();
    await y.page.getByLabel('Ad *').fill('Lavanta');
    await y.page.locator('#fc-dugun').getByRole('button', { name: 'Kaydet' }).click();
    await y.page.getByText('“Lavanta” kaydedildi.').waitFor({ timeout: 4000 });
    const ekle = y.istekler.find((x) => x.yontem === 'POST' && x.yol === '/rest/v1/dugun_katalog');
    dogru(ekle && ekle.govde.tur === 'konsept' && ekle.govde.ad === 'Lavanta', `katalog: yeni konsept eklendi (${JSON.stringify(ekle && ekle.govde)})`);
    // Hızlı ekle: her satıra bir ürün, grupla; zaten olan atlanır
    const urunler = y.page.locator('#fc-dugun section', { hasText: 'Ürünler' });
    dogru((await urunler.innerText()).includes('PEÇETE') || (await urunler.innerText()).includes('Peçete'), 'katalog: ürünler grup başlıklarıyla');
    dogru(await urunler.locator('.dy-satir', { hasText: 'Altın peçete halkası' }).getByText('Fotoğraf', { exact: true }).count() === 1 && (await urunler.locator('.dy-satir', { hasText: 'Altın peçete halkası' }).innerText()).includes('fotoğraf yok'),
      'katalog: satırda doğrudan "Fotoğraf" yükleme, fotoğrafsız olan belli');
    await urunler.getByRole('button', { name: 'Hızlı ekle' }).click();
    await y.page.getByLabel('Grup *').fill('Peçete');
    await y.page.getByLabel('Kalemler (her satıra bir tane)').fill('Keten peçete\nAltın peçete halkası\n\nPeçetede lavanta dalı');
    const once = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/dugun_katalog').length;
    await y.page.getByRole('button', { name: 'Hepsini ekle' }).click();
    await y.page.getByText('2 kalem eklendi (zaten olan 1 kalem atlandı).').waitFor({ timeout: 5000 });
    const toplu = y.istekler.filter((x) => x.yontem === 'POST' && x.yol === '/rest/v1/dugun_katalog').slice(once);
    dogru(toplu.length === 2 && toplu.every((x) => x.govde.tur === 'urun' && x.govde.grup === 'Peçete') && toplu.map((x) => x.govde.ad).join('|') === 'Keten peçete|Peçetede lavanta dalı',
      `katalog: hızlı ekle iki ürünü Peçete grubuna ekledi (${toplu.map((x) => x.govde.ad).join(', ')})`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
    if (process.env.EKRAN) await y.page.screenshot({ path: process.env.EKRAN + '/dugun-yonetim.png', fullPage: true });
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
