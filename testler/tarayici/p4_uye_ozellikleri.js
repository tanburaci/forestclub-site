// PR 4 tarayıcı testleri: üye paneli (gerçek karekod, dondurma, anket, KVKK, kartla ödeme), ana site (ayarlardan
// iletişim, tanışma bandı ve bilet ekranı) ve yönetici paneli (ayarlar, kamerayla kapıda okutma, tanışma doluluğu,
// KVKK silme).
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const QG = fs.readFileSync(require.resolve('qrcode-generator/qrcode.js'));
const JQ = fs.readFileSync(require.resolve('jsqr/dist/jsQR.js'));
const cdn = async (page) => {
  let jsqr = 0;
  await page.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: QG }));
  await page.route('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', (r) => { jsqr++; r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: JQ }); });
  return () => jsqr;
};
const kullanici = (page, id, email) => page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id, email, aud: 'authenticated' }) }));

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Üye ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: null, bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const etk = { id: 3, tarih: gun(4), saat: '10.00', tur: 'bulusma', ad: 'Yoga', kontenjan: 20, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda' };
    const gecmisEtk = { id: 2, tarih: gun(-3), saat: '10.00', tur: 'bulusma', ad: 'Eski Buluşma', kontenjan: 20, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda' };
    const rpcler = [];
    const uv = {
      tablolar: {
        uyeler: [uye], odemeler: [], etkinlikler: [gecmisEtk, etk],
        etkinlik_kayitlari: [{ etkinlik_id: 2, uye_id: 1, durum: 'kayitli', geldi: true }, { etkinlik_id: 3, uye_id: 1, durum: 'kayitli', geldi: false }],
        anket_yanitlari: [], uyelik_dondurmalari: [],
        ayarlar: [{ anahtar: 'dondurma', deger: { gunler: [10, 20], yillik: 3 } }, { anahtar: 'kart_odeme', deger: true }],
      },
      rpc: {
        etkinlik_doluluk: () => [200, [{ etkinlik_id: 3, kayitli: 1 }]],
        uyelik_dondur: (g) => { rpcler.push(['uyelik_dondur', g]); return [200, { bitis: gun(30), bas: gun(0), gun: g.p_gun }]; },
        dondurma_bitir: (g) => { rpcler.push(['dondurma_bitir', g]); return [200, { bitis: gun(20) }]; },
        anket_gonder: (g) => { rpcler.push(['anket_gonder', g]); return [200, { tamam: true }]; },
        veri_kopyasi: (g) => { rpcler.push(['veri_kopyasi', g]); return [200, { uye: { ad: 'Deniz Yılmaz' }, odemeler: [] }]; },
        veri_talebi_ac: (g) => { rpcler.push(['veri_talebi_ac', g]); return [200, 'tamam'] ; },
      },
    };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await cdn(u.page);
    await kullanici(u.page, 'uye-1', 'deniz@posta.test');
    let odemeBaslat = null;
    await u.page.route(`${SB}/functions/v1/odeme-baslat`, (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      odemeBaslat = r.request().headers();
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ sayfa: `${SITE}/robots.txt?iyzico` }) });
    });
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });

    // Gerçek karekod: ekrandaki hücreler tuvale çizilip jsQR ile okunur
    await u.page.getByRole('button', { name: 'Etkinlik seç' }).click();  // liste dokununca açılır
    await u.page.getByRole('button', { name: /Yoga/ }).first().click();
    await u.page.getByRole('button', { name: 'Karekod oluştur' }).click();
    await u.page.locator('[aria-label="Giriş karekodu"]').waitFor({ timeout: 4000 });
    await u.page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' });
    const okunan = await u.page.evaluate(() => {
      const kutu = document.querySelector('[aria-label="Giriş karekodu"]');
      const h = [...kutu.children].map((c) => getComputedStyle(c).backgroundColor === 'rgb(17, 17, 17)');
      const n = Math.round(Math.sqrt(h.length));
      const B = 6; const K = 4; const W = (n + 2 * K) * B;
      const tv = document.createElement('canvas'); tv.width = W; tv.height = W;
      const c = tv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, W, W); c.fillStyle = '#000';
      h.forEach((d, i) => { if (d) c.fillRect((K + (i % n)) * B, (K + Math.floor(i / n)) * B, B, B); });
      const r = window.jsQR(c.getImageData(0, 0, W, W).data, W, W);
      return { n, veri: r ? r.data : null };
    });
    const [, ay, gg] = gun(4).split('-');
    dogru(okunan.veri === `FC-U-0001-${ay}${gg}`, `karekod gerçek ve okunuyor (${okunan.n}×${okunan.n}: ${okunan.veri})`);
    dogru(await u.page.getByText('Önizleme: desen örnektir').count() === 0, 'karekod altında "önizleme" notu yok');

    // Anket (yalnız gelinen etkinlik)
    await sekme(u.page, 'Katıldıklarım');
    await u.page.getByRole('button', { name: '4 puan' }).first().click();
    await u.page.getByRole('button', { name: 'Gönder' }).first().click();
    await u.page.getByText('Teşekkürler! Puanın: 4 / 5').waitFor({ timeout: 4000 });
    const an = rpcler.find((x) => x[0] === 'anket_gonder');
    dogru(an && an[1].p_etkinlik === 2 && an[1].p_puan === 4, `anket sunucuya yazıldı (${JSON.stringify(an && an[1])})`);

    // Dondurma: kural ayarlardan
    await sekme(u.page, 'Üyeliğim');
    await u.page.getByRole('button', { name: 'Tatile mi gidiyorsun? Üyeliğimi dondur' }).click();
    dogru(await u.page.getByRole('button', { name: '10 gün' }).count() === 1 && await u.page.getByText(/Yılda en çok 3 kez/).count() === 1, 'dondurma seçenekleri ve kuralı ayarlardan');
    await u.page.getByRole('button', { name: '10 gün' }).click();
    await u.page.getByText('Üyeliğin donduruldu').waitFor({ timeout: 4000 });
    dogru(rpcler.some((x) => x[0] === 'uyelik_dondur' && x[1].p_gun === 10), 'uyelik_dondur(10)');
    await u.page.getByRole('button', { name: 'Erken dön' }).click();
    await u.page.getByText('Tatile mi gidiyorsun? Üyeliğimi dondur').waitFor({ timeout: 4000 });
    dogru(rpcler.some((x) => x[0] === 'dondurma_bitir'), 'erken dönüş sunucuda');

    // KVKK
    await sekme(u.page, 'Verilerim');
    const [indirme] = await Promise.all([u.page.waitForEvent('download'), u.page.getByRole('button', { name: 'Verilerimin kopyasını iste' }).click()]);
    const kopya = JSON.parse(fs.readFileSync(await indirme.path(), 'utf8'));
    dogru(kopya.uye.ad === 'Deniz Yılmaz' && /^forest-club-verilerim-/.test(indirme.suggestedFilename()), 'veri kopyası JSON indi');
    await u.page.getByRole('button', { name: 'Hesabımı sil' }).click();
    await u.page.getByRole('button', { name: 'Evet, silme talebi gönder' }).click();
    await u.page.getByText(/Silme talebin alındı/).waitFor({ timeout: 4000 });
    dogru(rpcler.some((x) => x[0] === 'veri_talebi_ac' && x[1].p_tur === 'silme'), 'silme talebi kaydedildi');

    // Kartla ödeme (kart_odeme açık): iyzico sayfasına gider
    await sekme(u.page, 'Üyeliğim');
    await u.page.getByRole('button', { name: 'Kartla yenile · 3.000 TL' }).click();
    await u.page.getByRole('button', { name: 'Kartla öde · 3.000 TL' }).click();
    await u.page.waitForURL(/robots\.txt\?iyzico$/, { timeout: 5000 });
    dogru(odemeBaslat && /^Bearer eyJ[\w-]+\.[\w-]+\.imza$/.test(odemeBaslat.authorization), 'odeme-baslat oturum anahtarıyla çağrıldı, iyzico sayfasına gidildi');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), `üye: sayfa hatası yok ${u.konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);

    // iyzico dönüşü
    const d1 = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await cdn(d1.page);
    await kullanici(d1.page, 'uye-1', 'deniz@posta.test');
    await d1.page.goto(`${SITE}/uye/#odeme-tamam`);
    await d1.page.getByText('Ödemen alındı, üyeliğin aktif').waitFor({ timeout: 15000 });
    dogru(!(await d1.page.evaluate(() => location.hash)), 'dönüş: başarılı ekranı, adres temizlendi');
    const d2 = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await cdn(d2.page);
    await kullanici(d2.page, 'uye-1', 'deniz@posta.test');
    await d2.page.goto(`${SITE}/uye/#odeme-hata`);
    await d2.page.getByText('Ödeme tamamlanamadı').waitFor({ timeout: 15000 });
    dogru(true, 'dönüş: hata ekranı');

    // Kartla ödeme kapalıysa havale + dekont
    const uv2 = { ...uv, tablolar: { ...uv.tablolar, ayarlar: [] } };
    const d3 = await sayfaAc(tarayici, uv2, oturum('uye-1', 'deniz@posta.test'));
    await cdn(d3.page);
    await kullanici(d3.page, 'uye-1', 'deniz@posta.test');
    await d3.page.goto(`${SITE}/uye/`);
    await d3.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    await sekme(d3.page, 'Üyeliğim');
    dogru(await d3.page.getByRole('button', { name: 'Yenile · havale / EFT' }).count() === 1, 'kart_odeme kapalı: havale / EFT');

    // ---------- Ana site ----------
    const sv = { tablolar: { etkinlikler: [{ ...etk, id: 7, aciklama: 'x', link: null }],
      ayarlar: [{ anahtar: 'tanisma_acik', deger: false }, { anahtar: 'iletisim', deger: { eposta: 'merhaba@posta.test', alan: 'Zeytinlik, Urla', whatsapp: '0532 111 22 33', topluluk: 'https://chat.whatsapp.com/abc', instagram: '@forestcluburla' } }] },
    rpc: { etkinlik_doluluk: () => [200, []] } };
    const s1 = await sayfaAc(tarayici, sv, null);
    await s1.page.goto(`${SITE}/`);
    await s1.page.getByText('Yoga').first().waitFor({ timeout: 15000 });
    dogru(await s1.page.getByRole('button', { name: 'Tanışma biletimle rezervasyon oluştur' }).count() === 0, 'tanışma kapalıysa sitede bant yok');
    dogru(await s1.page.locator('a[href="mailto:merhaba@posta.test"]').count() === 1 && await s1.page.getByText('Zeytinlik, Urla').count() === 1, 'iletişim e-postası ve alan ayarlardan');
    dogru(await s1.page.locator('a[href="https://www.instagram.com/forestcluburla/"]').count() === 1 && await s1.page.locator('a[href="https://chat.whatsapp.com/abc"]').count() === 1, 'Instagram ve WhatsApp topluluğu bağlantıları');
    dogru(await s1.page.locator('a[href*="wa.me"]').count() === 0 && !(await s1.page.content()).includes('5321112233'), 'ayarda numara olsa da sitede WhatsApp numarası gösterilmez');

    const sv2 = { ...sv, tablolar: { ...sv.tablolar, ayarlar: [] }, rpc: { ...sv.rpc, tanisma_etkinlikleri: () => [200, sv.tablolar.etkinlikler.map((e) => ({ etkinlik_id: e.id }))] } };
    const s2 = await sayfaAc(tarayici, sv2, null);
    await s2.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: "window.turnstile = { render(el, o) { setTimeout(() => o.callback('jeton'), 10); return 1; }, remove() {} };" }));
    await s2.page.route(`${SB}/functions/v1/form-gonder`, (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ sonuc: 'verildi' }) });
    });
    await s2.page.goto(`${SITE}/`);
    await s2.page.getByRole('button', { name: 'Tanışma biletimle rezervasyon oluştur' }).click();
    await s2.page.getByRole('group', { name: 'Hangi etkinliğe geleceksin?' }).getByRole('button').first().click();
    const tForm = s2.page.getByRole('dialog', { name: 'Tanışma biletimle rezervasyon' });
    await tForm.getByLabel('Bileti veren kişi (referans) · ad soyad *').fill('Pelin Küçükali');
    await tForm.getByLabel('Ad Soyad *', { exact: true }).fill('Misafir Kişi');
    await tForm.getByLabel('Tanışma bileti numarası *').fill('FC-0042');
    await tForm.getByLabel('Telefon *').fill('0532 000 00 00');
    await tForm.getByLabel('E-posta *').fill('misafir@posta.test');
    await tForm.locator('input[type=checkbox]').check();
    await s2.page.getByRole('button', { name: 'Rezervasyonu oluştur' }).click();
    await s2.page.getByText('Rezervasyonun hazır!').waitFor({ timeout: 6000 }).catch(async (h) => {
      console.log('tanışma ekranı:', (await s2.page.locator('[role=alert]').allTextContents()).join(' | '));
      throw h;
    });
    dogru(await s2.page.getByText('FC-T-4821').count() === 0 && await s2.page.getByText('E-POSTANDA').count() === 1, 'tanışma: sahte kod yok, kod e-postada');

    // ---------- Yönetici ----------
    const v = yonetimVerisi();
    v.tablolar.tanisma_biletleri = [{ id: 7, ad: 'Misafir', eposta: 'm@posta.test', alinis: gun(-1), etkinlik_id: 10, durum: 'bekliyor', kod: 'FC-T-ABC234' }];
    v.tablolar.ayarlar = [{ anahtar: 'tanisma_acik', deger: true }, { anahtar: 'kart_odeme', deger: false },
      { anahtar: 'iletisim', deger: { eposta: 'forestcluburla@gmail.com', alan: 'Pinya, Urla', whatsapp: '', topluluk: '', instagram: 'forestcluburla' } }];
    v.tablolar.veri_talepleri = [{ id: 1, uye_id: 4, ad: 'Üye 4', eposta: 'u4@ornek.com', tur: 'silme', durum: 'bekliyor', created_at: new Date().toISOString(), tamam_at: null }];
    Object.assign(v.rpc, {
      giris_kaydet: (g) => { v.rpcler.push(['giris_kaydet', g]); return [200, { ad: 'Misafir', bilet_id: 7, tanisma: true, zaten: false }]; },
      veri_kopyasi: (g) => { v.rpcler.push(['veri_kopyasi', g]); return [200, { uye: { ad: 'Üye 4' } }]; },
      uye_anonimlestir: (g) => { v.rpcler.push(['uye_anonimlestir', g]); return [200, ['yeni/x.pdf', 'https://drive.google.com/abc']]; },
    });
    // Sahte kamera: tuvalde tanışma biletinin karekodu (BarcodeDetector yok sayılır → jsQR yüklenir)
    const qrcode = (() => { const m = { exports: {} }; new Function('module', 'exports', QG.toString())(m, m.exports); return m.exports; })();
    const qr = qrcode(0, 'M'); qr.addData('FC-T-ABC234'); qr.make();
    const n = qr.getModuleCount();
    const hucre = []; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) hucre.push(qr.isDark(r, c) ? 1 : 0);
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    const jsqrSay = await cdn(y.page);
    await y.ctx.addInitScript(({ hucre, n }) => {
      delete window.BarcodeDetector;
      navigator.mediaDevices.getUserMedia = async () => {
        const B = 8; const K = 4; const W = (n + 2 * K) * B;
        const tv = document.createElement('canvas'); tv.width = W; tv.height = W;
        const c = tv.getContext('2d');
        const ciz = () => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, W); c.fillStyle = '#000'; hucre.forEach((d, i) => { if (d) c.fillRect((K + (i % n)) * B, (K + Math.floor(i / n)) * B, B, B); }); };
        ciz(); setInterval(ciz, 100);
        window.__kameraAcildi = (window.__kameraAcildi || 0) + 1;
        return tv.captureStream(10);
      };
    }, { hucre, n });
    y.page.on('dialog', (d) => d.accept());
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });

    await sekme(y.page, 'Etkinlikler');
    dogru(await y.page.getByText('2 üye + 1 tanışma · 27 yer var').count() === 1, 'tanışma biletleri doluluğa sayılıyor');
    const tanismaKutu = y.page.locator('label').filter({ hasText: 'Tanışma rezervasyonu açık' }).locator('input');
    dogru(await tanismaKutu.isEnabled() && await tanismaKutu.isChecked(), 'tanışma ayarı açık ve değiştirilebilir');
    await tanismaKutu.click();
    await y.page.waitForTimeout(500);
    const ay1 = y.istekler.find((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/ayarlar');
    dogru(ay1 && ay1.govde.deger === false && /anahtar=eq.tanisma_acik/.test(ay1.ara), `tanışma ayarı kaydedildi (${JSON.stringify(ay1 && ay1.govde)})`);

    // Kapıda kamera
    await y.page.getByRole('button', { name: 'Katılımcılar · yoklama' }).first().click();
    await y.page.getByRole('button', { name: 'Kamerayla okut' }).click();
    await y.page.getByText('Hoş geldin Misafir! Giriş işlendi. (tanışma bileti)').waitFor({ timeout: 10000 });
    const gk = v.rpcler.find((x) => x[0] === 'giris_kaydet');
    dogru(gk && gk[1].p_kod === 'FC-T-ABC234' && gk[1].p_etkinlik === 10, `kamera kodu okudu, giris_kaydet çağrıldı (${JSON.stringify(gk && gk[1])})`);
    dogru(jsqrSay() === 1, 'BarcodeDetector yokken jsQR bir kez yüklendi');
    await y.page.waitForTimeout(600);
    dogru(!y.istekler.some((x) => x.yol === '/rest/v1/tanisma_biletleri' && x.yontem === 'PATCH'), 'kapıda okutulan bilet ikinci kez yazılmadı');
    dogru(await y.page.locator('tr').filter({ hasText: 'm@posta.test' }).getByText('Geldi').count() === 1, 'bilet listesinde "Geldi"');
    await y.page.getByRole('button', { name: 'Kamerayı kapat' }).click();
    dogru(await y.page.locator('video#fc-kamera').count() === 0, 'kamera kapandı');

    // Muhasebe: kartla ödeme anahtarı, komisyon notu
    await sekme(y.page, 'Muhasebe');
    dogru(await y.page.getByText(/iyzico komisyonu her kart ödemesinde muhasebeye kendiliğinden/).count() === 1, 'komisyon notu: iyzico kendiliğinden');
    await y.page.locator('label').filter({ hasText: 'Üyeler aidatı kartla ödeyebilsin' }).locator('input').click();
    await y.page.waitForTimeout(500);
    const ay2 = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/ayarlar').pop();
    dogru(ay2 && ay2.govde.deger === true && /kart_odeme/.test(ay2.ara), 'kartla ödeme açıldı');

    // İletişim
    await sekme(y.page, 'İletişim');
    dogru(await y.page.locator('input[type=tel]').count() === 0, 'iletişim ayarlarında WhatsApp numarası alanı yok');
    await y.page.locator('input[type=url]').fill('http://kotu');
    await y.page.getByRole('button', { name: 'Kaydet' }).click();
    await y.page.getByText('WhatsApp topluluğu bağlantısı https:// ile başlamalı.').waitFor({ timeout: 3000 });
    await y.page.locator('input[type=url]').fill('https://chat.whatsapp.com/x');
    await y.page.getByRole('button', { name: 'Kaydet' }).click();
    await y.page.getByText(/Kaydedildi ✓/).waitFor({ timeout: 3000 });
    const ay3 = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/ayarlar').pop();
    dogru(ay3 && !('whatsapp' in ay3.govde.deger) && ay3.govde.deger.instagram === 'forestcluburla' && /iletisim/.test(ay3.ara), `iletişim kaydedildi (${JSON.stringify(ay3 && ay3.govde)})`);

    // KVKK silme
    await sekme(y.page, 'Üyeler');
    await y.page.getByText('Veri talepleri (KVKK)').waitFor({ timeout: 3000 });
    const [ind] = await Promise.all([y.page.waitForEvent('download'), y.page.getByRole('button', { name: 'Kopyasını indir' }).click()]);
    dogru(JSON.parse(fs.readFileSync(await ind.path(), 'utf8')).uye.ad === 'Üye 4', 'yönetici veri kopyasını indirdi');
    await y.page.getByRole('button', { name: 'Verilerini sil' }).click();
    await y.page.waitForTimeout(800);
    const an2 = v.rpcler.find((x) => x[0] === 'uye_anonimlestir');
    const sil = y.istekler.find((x) => x.yontem === 'DELETE' && x.yol === '/storage/v1/object/dekontlar');
    dogru(an2 && an2[1].p_uye === 4, 'uye_anonimlestir(4)');
    dogru(sil && JSON.stringify(sil.govde.prefixes) === '["yeni/x.pdf"]', `depodaki dekont silindi, Drive bağlantısı atlandı (${JSON.stringify(sil && sil.govde)})`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), `yönetici: sayfa hatası yok ${y.konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
