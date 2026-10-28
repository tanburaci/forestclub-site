// "Yakında" modu, site duyurusu ve arama motoru ayarları: sitede şerit, başvuru / tanışma / bilet kapalı, duyuru
// yalnız yönetim panelinden; yönetim › İletişim › Site durumu.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';

const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: 600,
  uyelere: 'ucretsiz', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null };
const siteVerisi = (ayarlar) => ({ tablolar: { etkinlikler: [etk], ayarlar }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } });

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Arama motorları ----------
    const toml = fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8');
    const ana = fs.readFileSync(path.join(DENEME, 'index.html'), 'utf8');
    const robots = fs.readFileSync(path.join(DENEME, 'robots.txt'), 'utf8');
    const genel = /for = "\/\*"\n  \[headers\.values\]\n([\s\S]*?)\n\n/.exec(toml)[1];
    dogru(!/X-Robots-Tag/.test(genel) && !/name="robots"/.test(ana), 'ana sayfa arama motorlarına açık');
    dogru(['/uye', '/uye/*', '/yonetim', '/yonetim/*', '/dekont', '/dekont/*', '/sayfalar/*'].every((y) => toml.includes(`for = "${y}"\n  [headers.values]\n    X-Robots-Tag = "noindex, nofollow"`)),
      'paneller, dekont ve sayfalar/ noindex');
    dogru(['uye', 'yonetim', 'dekont'].every((d) => fs.readFileSync(path.join(DENEME, d, 'index.html'), 'utf8').includes('<meta name="robots" content="noindex, nofollow">')), 'panel sayfalarında noindex etiketi');
    dogru(/Allow: \//.test(robots) && !/Disallow: \/\s*$/m.test(robots) && /Sitemap: https:\/\/www\.forestcluburla\.com\/sitemap\.xml/.test(robots), 'robots.txt açık, site haritası var');
    dogru(ana.includes('<link rel="canonical" href="https://www.forestcluburla.com/">') && /<meta name="description" content="[^"]{60,}">/.test(ana), 'kanonik adres ve açıklama');

    // ---------- Yakında açık ----------
    const s1 = await sayfaAc(tarayici, siteVerisi([{ anahtar: 'yakinda', deger: true }, { anahtar: 'site_duyurusu', deger: '' },
      { anahtar: 'dondurma', deger: { gunler: [10, 20], yillik: 3 } }, { anahtar: 'aidat', deger: 3500 }]), null);
    const formlar = [];
    await s1.page.route(`${SB}/functions/v1/form-gonder`, (r) => { formlar.push(r.request().postData()); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"sonuc":"tamam"}' }); });
    await s1.page.goto(`${SITE}/`);
    await s1.page.getByText('Yakında açılıyoruz 🌲').waitFor({ timeout: 15000 });
    dogru(await s1.page.getByText('Üyelik başvuruları ve tanışma biletleri açılışla birlikte başlıyor.').count() === 1, 'yakında şeridi görünüyor');
    dogru(await s1.page.getByText(/Örnek duyuru/).count() === 0, 'canlıda örnek duyuru yok');
    dogru(await s1.page.getByRole('button', { name: 'Tanışma biletini al' }).count() === 0, 'yakında: tanışma bileti bandı yok');
    const bilet = s1.page.getByRole('button', { name: 'Açılışta satışta' }).first();
    dogru(await bilet.count() === 1 && await bilet.isDisabled(), 'yakında: bilet satışı kapalı');
    await s1.page.getByRole('button', { name: 'Ödemeye geç' }).click();
    await s1.page.getByText('Üyelik başvuruları açılışla birlikte başlıyor. Instagram\'dan takipte kal!').waitFor({ timeout: 3000 });
    dogru(formlar.length === 0, 'yakında: başvuru sunucuya gönderilmedi');
    // İçerik: hazır olmayanlar görünmez, SSS ayarlardan
    const metin = await s1.page.locator('body').innerText();
    dogru(!/\[(Fotoğraf|Reels|KULÜBÜN|DONDURMA)/.test(await s1.page.locator('body').textContent()) && !metin.includes('Ağaçların altından'), 'boş galeri ve cevapsız SSS görünmüyor');
    dogru(await s1.page.getByRole('link', { name: 'KVKK aydınlatma metni' }).count() === 0, 'boş metin bağlantıları görünmüyor');
    const tumMetin = await s1.page.locator('body').textContent();  // SSS cevapları kapalı <details> içinde
    dogru(tumMetin.includes('Bir seferde 10 ya da 20 gün dondurabilirsin, yılda en çok 3 kez'), 'SSS: dondurma kuralı ayarlardan');
    dogru(tumMetin.includes('30 günlük üyelik 3.500 TL. Havale / EFT ile ödersin') && !tumMetin.includes('Kartla ödersin'), 'SSS: kart kapalıyken havale / EFT, aidat ayarlardan');
    dogru(!s1.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), `site: sayfa / CSP hatası yok ${s1.konsol.filter((x) => /pageerror|Content Security/.test(x)).join(' | ')}`);

    // ---------- Açılış: yakında kapalı, duyuru var ----------
    const s2 = await sayfaAc(tarayici, siteVerisi([{ anahtar: 'yakinda', deger: false }, { anahtar: 'site_duyurusu', deger: 'Yağmur nedeniyle pazar buluşması ertelendi.' }]), null);
    await s2.page.goto(`${SITE}/`);
    await s2.page.getByText('Yağmur nedeniyle pazar buluşması ertelendi.').waitFor({ timeout: 15000 });
    dogru(await s2.page.getByText('Yakında açılıyoruz 🌲').count() === 0, 'açılışta şerit yok');
    dogru(await s2.page.getByRole('button', { name: 'Tanışma biletini al' }).count() === 1 && await s2.page.getByRole('button', { name: 'Sepete ekle' }).count() === 1,
      'açılışta tanışma bileti ve bilet satışı açık');
    await s2.page.getByRole('button', { name: 'Tamam' }).first().click();
    dogru(await s2.page.getByText('Yağmur nedeniyle pazar buluşması ertelendi.').count() === 0, 'duyuru "Tamam" ile kapanıyor');

    // Veri gelmezse de örnek duyuru çıkmaz
    const v3 = siteVerisi([]);
    v3.hata = { etkinlikler: true };
    const s3 = await sayfaAc(tarayici, v3, null);
    await s3.page.goto(`${SITE}/`);
    await s3.page.getByText(/Etkinlikler şu an yüklenemiyor/).first().waitFor({ timeout: 15000 });
    dogru(await s3.page.getByText(/Örnek duyuru/).count() === 0, 'veri gelmediğinde örnek duyuru yok');

    // ---------- Yönetim › İletişim › Site durumu ----------
    const v = yonetimVerisi();
    v.tablolar.ayarlar = [{ anahtar: 'yakinda', deger: true }, { anahtar: 'site_duyurusu', deger: '' }];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^İletişim$/ }).first().click();
    const kutu = y.page.locator('label').filter({ hasText: '“Yakında açılıyoruz” modu' }).locator('input');
    dogru(await kutu.isChecked() && await y.page.getByText(/Açık: sitede “Yakında açılıyoruz” şeridi var/).count() === 1, 'yakında modu açık görünüyor');
    await kutu.click();
    await y.page.getByText(/Kapalı: site tam açık/).waitFor({ timeout: 3000 });
    await y.page.waitForTimeout(600);  // ekran hemen değişir; kayıt isteği arkadan gider
    const ay = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/ayarlar');
    dogru(ay.length === 1 && ay[0].govde.deger === false && /anahtar=eq.yakinda/.test(ay[0].ara), 'açılış: yakında modu tek tıkla kapandı');
    await y.page.locator('textarea[placeholder^="Örn. Yağmur"]').fill('Bu pazar buluşma 10.00 yerine 11.00\'de.');
    await y.page.getByRole('button', { name: 'Duyuruyu yayınla' }).click();
    await y.page.getByText('Yayında ✓ Sitenin en üstünde görünüyor.').waitFor({ timeout: 3000 });
    await y.page.getByRole('button', { name: 'Duyuruyu kaldır' }).click();
    await y.page.getByText('Duyuru kaldırıldı ✓').waitFor({ timeout: 3000 });
    const dy = y.istekler.filter((x) => x.yontem === 'PATCH' && /anahtar=eq.site_duyurusu/.test(x.ara)).map((x) => x.govde.deger);
    dogru(JSON.stringify(dy) === JSON.stringify(['Bu pazar buluşma 10.00 yerine 11.00\'de.', '']), `duyuru yayınlandı ve kaldırıldı (${JSON.stringify(dy)})`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
