// Etkinlik ayrıntıları: yönetimde "Düzenle" (tarih ve ad kilitli) ve afiş yükleme; üye panelinde kart tıklanınca afiş ve
// açıklama açılır; "Randevu oluştur" etiketi, "Takvime ekle" yok.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const AFIS = `${SB}/storage/v1/object/public/afisler/ornek.png`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetim: düzenle + afiş ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    const yuklenen = [];
    await y.page.route(`${SB}/storage/v1/object/afisler/**`, (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      yuklenen.push(new URL(r.request().url()).pathname);
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ Key: 'afisler/x.png' }) });
    });
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
    await y.page.locator('article').filter({ hasText: 'Breakfast Club' }).getByRole('button', { name: 'Düzenle', exact: true }).click();
    await y.page.getByText('Etkinliği düzenle').waitFor({ timeout: 3000 });
    dogru(await y.page.locator('input[type="date"]').first().isDisabled() && await y.page.getByLabel('Etkinlik adı *').inputValue() === 'Breakfast Club', 'düzenle: form dolu, tarih kilitli');
    await y.page.getByLabel('Saat').fill('09.30–11.30');
    await y.page.getByLabel('Açıklama').fill('Ağaçların altında kahvaltı; çay ve kahve bizden.');
    await y.page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: 'afis.png', mimeType: 'image/png', buffer: PNG });
    await y.page.getByText('Afiş yüklendi ✓', { exact: false }).waitFor({ timeout: 5000 });
    await y.page.getByRole('button', { name: 'Etkinliği kaydet' }).click();
    await y.page.getByText('“Breakfast Club” güncellendi.').waitFor({ timeout: 5000 });
    const g = y.istekler.find((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/etkinlikler');
    dogru(yuklenen.length === 1 && g && g.govde.saat === '09.30–11.30' && g.govde.aciklama.startsWith('Ağaçların altında') && /\/afisler\/.+\.png$/.test(g.govde.afis) && !('tarih' in g.govde) && !('ad' in g.govde),
      `düzenleme ve afiş kaydedildi (${JSON.stringify(g && g.govde)})`);
    dogru(await y.page.getByRole('link', { name: 'Üye paneli' }).getAttribute('href') === '/uye', 'yönetim: tek tuşla üye paneline geçiş');
    // Yöneticinin kendi üyeliğini hesabına bağlaması
    await y.page.locator('button').filter({ hasText: /^Üyeler$/ }).first().click();
    await y.page.locator('table.fc-tablo tbody tr').filter({ hasText: 'Üye 4' }).getByRole('button', { name: 'Profil' }).click();
    await y.page.getByRole('button', { name: 'Bu üyelik benim (hesabıma bağla)' }).click();
    await y.page.getByText('Bağlandı ✓', { exact: false }).waitFor({ timeout: 4000 });
    const bag = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/uyeler' && 'user_id' in x.govde);
    dogru(bag.length === 2 && bag[0].govde.user_id === null && bag[1].govde.user_id === 'yon-1' && /id=eq\.4/.test(bag[1].ara), `üyelik yönetici hesabına bağlandı (${bag.map((x) => x.ara).join(' | ')})`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    // ---------- İki adımlı kod: bu cihazda 30 günde bir ----------
    const y3 = await sayfaAc(tarayici, yonetimVerisi(), oturum('yon-1', 'yonetici@posta.test'));
    await y3.ctx.addInitScript(() => { localStorage.setItem('fc_mfa_son', String(Date.now() - 2 * 24 * 3600 * 1000)); });
    await y3.page.goto(`${SITE}/yonetim/`);
    await y3.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    dogru(true, '2 gün önce kod girilmiş oturum: panel kodsuz açılır');
    const y4 = await sayfaAc(tarayici, yonetimVerisi(), oturum('yon-1', 'yonetici@posta.test'));
    await y4.ctx.addInitScript(() => { if (!sessionStorage.getItem('ilk')) { sessionStorage.setItem('ilk', '1'); localStorage.setItem('fc_mfa_son', String(Date.now() - 31 * 24 * 3600 * 1000)); } });
    await y4.page.goto(`${SITE}/yonetim/`);
    await y4.page.waitForTimeout(2500);
    dogru(y4.istekler.filter((x) => x.yol === '/auth/v1/logout').length === 1, '31 gün önce kod girilmiş oturum bir kez kapanır (giriş ve kod yeniden istenir)');

    // Minimum kişi onayı: 6 saat sonra başlayan, minimumu 8 olan, kimsenin kayıtlı olmadığı etkinlik
    const ist = new Date(Date.now() + 6 * 3600 * 1000 + 3 * 3600 * 1000).toISOString();
    const v2 = yonetimVerisi();
    v2.tablolar.uyeler = v2.tablolar.uyeler.slice(0, 5);
    v2.tablolar.etkinlikler = [...v2.tablolar.etkinlikler, { ...v2.tablolar.etkinlikler[0], id: 11, ad: 'Yakın Yoga', tarih: ist.slice(0, 10), saat: `${ist.slice(11, 13)}.${ist.slice(14, 16)}`, min_kisi: 8 }];
    const y2 = await sayfaAc(tarayici, v2, oturum('yon-1', 'yonetici@posta.test'));
    await y2.page.goto(`${SITE}/yonetim/`);
    await y2.page.getByText('Onayınızı bekliyor: minimum kişiye ulaşılamadı').waitFor({ timeout: 15000 });
    const kutu = y2.page.locator('section[role="alert"]').filter({ hasText: 'Yakın Yoga' });
    dogru((await kutu.innerText()).includes('0 kişi / minimum 8') && !(await kutu.innerText()).includes('Breakfast Club'), 'onay kutusu: yalnız 24 saat içindeki ve minimumun altındaki etkinlik');
    await kutu.getByRole('button', { name: 'İptal et' }).click();
    await y2.page.getByText('Duyur', { exact: false }).first().waitFor({ timeout: 3000 }).catch(() => {});
    dogru(await y2.page.locator('select').filter({ has: y2.page.locator('option[value="Yeterli katılım yok"]') }).first().inputValue() === 'Yeterli katılım yok', 'İptal et: iptal paneli "Yeterli katılım yok" nedeniyle açıldı');
    await y2.page.locator('button').filter({ hasText: /^Ana sayfa$/ }).first().click();
    await y2.page.locator('section[role="alert"]').filter({ hasText: 'Yakın Yoga' }).getByRole('button', { name: 'Devam et' }).click();
    dogru(await y2.page.getByText('Onayınızı bekliyor: minimum kişiye ulaşılamadı').count() === 0, '"Devam et" onay kutusunu kapatır');

    // ---------- Üye paneli: açılır kart ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: null, bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const etk = { id: 3, tarih: gun(4), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: 'DJ Orman', kontenjan: 20, bilet_fiyati: null, uyelere: null,
      satilan_bilet: 0, durum: 'yayinda', aciklama: 'Ağaçların altında kahvaltı.', afis: AFIS };
    const uv = { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [etk], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [], yoneticiler: [{ ad: 'Deniz', user_id: 'uye-1' }] },
      rpc: { etkinlik_doluluk: () => [200, []] } };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await u.page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));
    await u.page.route(AFIS, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    dogru(await u.page.getByRole('link', { name: 'Yönetim paneli' }).getAttribute('href') === '/yonetim', 'üye: yönetici olan üyede yönetim paneline geçiş');
    await u.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
    dogru(await u.page.getByRole('img', { name: 'Breakfast Club afişi' }).count() === 0, 'üye: afiş kapalı kartta görünmüyor');
    await u.page.getByRole('button', { name: /Ayrıntılar ▼/ }).click();
    await u.page.getByRole('img', { name: 'Breakfast Club afişi' }).waitFor({ timeout: 3000 });
    dogru(await u.page.getByText('Ağaçların altında kahvaltı.').count() === 1 && await u.page.getByText('DJ Orman').count() === 1, 'üye: kart açılınca afiş, kim ve açıklama');
    dogru(await u.page.getByRole('button', { name: 'Randevu oluştur' }).count() === 1 && await u.page.getByText('Takvime ekle').count() === 0
      && await u.page.getByText('Bilet satışı yok').count() === 0, 'üye: "Randevu oluştur" var; "Takvime ekle" ve boş bilet düğmesi yok');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
