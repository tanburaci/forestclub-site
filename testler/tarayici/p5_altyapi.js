// PR 5 tarayıcı testleri: yönetici iki adımlı giriş (kurulum ve kod), üye listesinde sayfalama, eval'siz CSP.
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { sayfaAc, yonetimVerisi, oturum, jwt, SITE } = require('./yardim.js');
const fs = require('fs');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// Auth uçları: kullanıcı (faktörleriyle), faktör kurma / silme, kod isteme / doğrulama
async function authTaklit(page, durum) {
  await page.route(`${SB}/auth/v1/**`, async (r) => {
    const q = r.request();
    const u = new URL(q.url());
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: CORS });
    durum.istekler.push(`${q.method()} ${u.pathname}`);
    if (u.pathname === '/auth/v1/user') return json(200, { id: 'yon-1', email: 'yonetici@posta.test', aud: 'authenticated', factors: durum.faktorler });
    if (u.pathname === '/auth/v1/factors' && q.method() === 'POST') {
      durum.faktorler.push({ id: 'f-yeni', factor_type: 'totp', status: 'unverified' });
      return json(200, { id: 'f-yeni', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', secret: 'GIZLIANAHTAR234', uri: 'otpauth://x' } });
    }
    let m;
    if ((m = /^\/auth\/v1\/factors\/([\w-]+)$/.exec(u.pathname)) && q.method() === 'DELETE') {
      durum.faktorler = durum.faktorler.filter((f) => f.id !== m[1]);
      return json(200, { id: m[1] });
    }
    if ((m = /^\/auth\/v1\/factors\/([\w-]+)\/challenge$/.exec(u.pathname))) return json(200, { id: `ch-${m[1]}`, expires_at: Math.floor(Date.now() / 1000) + 300 });
    if ((m = /^\/auth\/v1\/factors\/([\w-]+)\/verify$/.exec(u.pathname))) {
      const g = JSON.parse(q.postData());
      durum.dogrulama.push({ faktor: m[1], ...g });
      if (g.code !== '123456') return json(422, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered', message: 'Invalid TOTP code entered' });
      durum.faktorler = durum.faktorler.map((f) => (f.id === m[1] ? { ...f, status: 'verified' } : f));
      return json(200, { access_token: jwt('yon-1', 'yonetici@posta.test', 'aal2'), refresh_token: 'r2', token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'yon-1', email: 'yonetici@posta.test', aud: 'authenticated', factors: durum.faktorler } });
    }
    if (u.pathname === '/auth/v1/logout') return r.fulfill({ status: 204, headers: CORS });
    return json(200, {});
  });
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    const toml = fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8');
    dogru(/Content-Security-Policy = "[^"]*script-src 'self' https/.test(toml) && !/unsafe-eval/.test(toml), "CSP: script-src'te 'unsafe-eval' yok");

    // ---------- İlk giriş: iki adımlı giriş kurulur ----------
    const v = yonetimVerisi();
    const d1 = { faktorler: [{ id: 'f-yarim', factor_type: 'totp', status: 'unverified' }], istekler: [], dogrulama: [] };
    const y1 = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test', 'aal1', d1.faktorler));
    await authTaklit(y1.page, d1);
    y1.page.on('pageerror', (e) => console.log('YIGIN', e.stack));
    await y1.page.goto(`${SITE}/yonetim/`);
    await y1.page.getByText('İki adımlı girişi kur').waitFor({ timeout: 15000 });
    dogru(d1.istekler.includes('DELETE /auth/v1/factors/f-yarim') && d1.istekler.includes('POST /auth/v1/factors'), 'yarım kalmış kurulum silindi, yeni kurulum açıldı');
    dogru(await y1.page.locator('img[alt="İki adımlı giriş karekodu"]').getAttribute('src').then((x) => x.startsWith('data:image/svg+xml')), 'karekod görünüyor');
    dogru(await y1.page.getByText(/GIZLIANAHTAR234/).count() === 1, 'elle girilecek anahtar görünüyor');
    dogru(!y1.istekler.some((x) => x.yol === '/rest/v1/uyeler'), 'kod girilmeden üye verisi istenmedi');
    const kutu = y1.page.getByLabel('6 haneli kod');
    await kutu.fill('12');
    await y1.page.getByRole('button', { name: 'Kur ve gir' }).click();
    await y1.page.getByText('Kod 6 haneli olmalı.').waitFor({ timeout: 3000 });
    await kutu.fill('654321');
    await y1.page.getByRole('button', { name: 'Kur ve gir' }).click();
    await y1.page.getByText('Kod tutmadı; uygulamadaki güncel kodu yaz.').waitFor({ timeout: 5000 }).catch(async (h) => {
      console.log('ekran:', await y1.page.locator('[role=status]').allTextContents(), d1.istekler.slice(-4), y1.konsol.slice(-3)); throw h;
    });
    await kutu.fill('123456');
    await y1.page.getByRole('button', { name: 'Kur ve gir' }).click();
    await y1.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    dogru(d1.dogrulama.length === 2 && d1.dogrulama.every((x) => x.faktor === 'f-yeni' && x.challenge_id === 'ch-f-yeni'), 'kod yeni faktörle doğrulandı');
    const sonra = y1.istekler.find((x) => x.yol === '/rest/v1/uyeler');
    dogru(!!sonra, 'doğrulamadan sonra panel verisi yüklendi');
    dogru(!y1.konsol.some((x) => /pageerror|Content Security Policy/.test(x)), `kurulum: sayfa / CSP hatası yok ${y1.konsol.filter((x) => /pageerror|Content Security/.test(x)).join(' | ')}`);

    // ---------- Sonraki girişler: kod istenir ----------
    const d2 = { faktorler: [{ id: 'f-1', factor_type: 'totp', status: 'verified' }], istekler: [], dogrulama: [] };
    const y2 = await sayfaAc(tarayici, yonetimVerisi(), oturum('yon-1', 'yonetici@posta.test', 'aal1', d2.faktorler));
    await authTaklit(y2.page, d2);
    await y2.page.goto(`${SITE}/yonetim/`);
    await y2.page.getByText('Doğrulama kodu').waitFor({ timeout: 15000 });
    dogru(await y2.page.locator('img[alt="İki adımlı giriş karekodu"]').count() === 0 && !d2.istekler.includes('POST /auth/v1/factors'), 'kurulu hesapta yeni kurulum açılmadı');
    await y2.page.getByLabel('6 haneli kod').fill('123 456');
    await y2.page.getByRole('button', { name: 'Doğrula' }).click();
    await y2.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    dogru(d2.dogrulama.length === 1 && d2.dogrulama[0].faktor === 'f-1' && d2.dogrulama[0].code === '123456', 'kayıtlı faktörle doğrulandı (boşluklar atıldı)');

    // Çıkış
    const d3 = { faktorler: [{ id: 'f-1', factor_type: 'totp', status: 'verified' }], istekler: [], dogrulama: [] };
    const y3 = await sayfaAc(tarayici, yonetimVerisi(), oturum('yon-1', 'yonetici@posta.test', 'aal1', d3.faktorler));
    await authTaklit(y3.page, d3);
    await y3.page.goto(`${SITE}/yonetim/`);
    await y3.page.getByText('Doğrulama kodu').waitFor({ timeout: 15000 });
    await y3.page.getByRole('button', { name: 'Çıkış yap' }).click();
    await y3.page.waitForTimeout(800);
    dogru(d3.istekler.includes('POST /auth/v1/logout'), 'kod ekranından çıkış yapılabiliyor');

    // ---------- aal2 oturumda doğrudan panel; üye listesi sayfalı ----------
    const y4 = await sayfaAc(tarayici, yonetimVerisi(), oturum('yon-1', 'yonetici@posta.test'));
    await y4.page.goto(`${SITE}/yonetim/`);
    await y4.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await y4.page.locator('button').filter({ hasText: /^Üyeler$/ }).first().click();
    await y4.page.getByRole('button', { name: /kişi daha göster/ }).waitFor({ timeout: 5000 });
    dogru(await y4.page.locator('table.fc-tablo tbody tr').count() === 100, 'üye listesi ilk 100 satır');
    dogru(await y4.page.getByRole('button', { name: '100 / 1500 kişi gösteriliyor · 100 kişi daha göster' }).count() === 1, '"daha fazla göster" yazısı');
    await y4.page.getByRole('button', { name: /kişi daha göster/ }).click();
    await y4.page.waitForTimeout(300);
    dogru(await y4.page.locator('table.fc-tablo tbody tr').count() === 200, 'bir tıkla 200 satır');
    await y4.page.locator('input[type=search]').fill('Üye 1499');
    await y4.page.waitForTimeout(300);
    dogru(await y4.page.locator('table.fc-tablo tbody tr').count() === 1 && await y4.page.getByRole('button', { name: /kişi daha göster/ }).count() === 0, 'arama: tek sonuç, düğme yok');
    await y4.page.locator('input[type=search]').fill('');
    await y4.page.waitForTimeout(300);
    dogru(await y4.page.locator('table.fc-tablo tbody tr').count() === 100, 'arama değişince liste yeniden 100 satırdan başlar');
    // Sıralama: aktifler bitişe göre, aynı bitişte ada göre (Türkçe)
    const adlar = await y4.page.locator('table.fc-tablo tbody tr td:first-child').allTextContents();
    dogru(adlar[0] === 'Elif Kaya' && adlar[1] === 'Üye 1' && adlar[2] === 'Üye 1001', `sıralama: aktif, bitiş, ad (${adlar.slice(0, 3).join(', ')})`);
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
