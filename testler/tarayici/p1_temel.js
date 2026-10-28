// Deneme sitesinin tarayıcı testi: Supabase yerine sahte bir sunucu (Playwright route), Netlify başlıkları (CSP dahil)
// yerel sunucunun yanıtlarına eklenir, supabase-js npm paketinden SRI ile yüklenir.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const SITE = 'http://127.0.0.1:8088';
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const NPM = path.join(path.dirname(require.resolve('@supabase/supabase-js/package.json')), 'dist/umd');
const toml = fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8');
const BASLIK = {};
toml.split('\n').forEach((l) => { const m = /^\s+([A-Za-z-]+) = "(.*)"$/.exec(l); if (m) BASLIK[m[1]] = m[2]; });

const { gun } = require('./yardim.js');
let hatalar = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) hatalar += 1; };

const { oturum } = require('./yardim.js');

const { KAPAKSIZ } = require('./yardim.js');

async function sayfaAc(tarayici, veri, oturumJson) {
  const ctx = await tarayici.newContext();
  await ctx.addInitScript(KAPAKSIZ);
  const page = await ctx.newPage();
  const istekler = [];
  const konsol = [];
  page.on('console', (m) => konsol.push(m.text()));
  page.on('pageerror', (e) => konsol.push(`pageerror: ${e.message}`));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/**', (r) => {
    const ad = r.request().url().split('/').pop();
    r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(NPM, ad)) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(`${SITE}/**`, async (r) => {
    const yanit = await r.fetch().catch(() => null);
    if (!yanit) return r.abort().catch(() => {});
    const tur = yanit.headers()['content-type'] || '';
    r.fulfill({ response: yanit, headers: { ...yanit.headers(), ...(tur.includes('text/html') ? BASLIK : {}) } });
  });
  await page.route(`${SB}/**`, async (r) => {
    const q = r.request();
    const u = new URL(q.url());
    const govde = q.postData() ? JSON.parse(q.postData()) : null;
    istekler.push({ yontem: q.method(), yol: u.pathname, ara: u.search, govde });
    const json = (status, body, basliklar = {}) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...basliklar }, body: JSON.stringify(body) });
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.pathname.startsWith('/auth/v1/')) return json(200, {});
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = u.pathname.split('/').pop();
      const f = veri.rpc[fn];
      if (!f) return json(404, { message: `rpc yok: ${fn}` });
      const [status, body] = f(govde);
      return json(status, body);
    }
    const tablo = u.pathname.split('/').pop();
    if (q.method() !== 'GET') return json(201, q.headers()['accept'].includes('vnd.pgrst.object') ? { id: 999 } : [{ id: 999 }]);
    if (veri.hata && veri.hata[tablo]) return json(500, { message: 'sunucu hatası' });
    let satirlar = typeof veri.tablolar[tablo] === 'function' ? veri.tablolar[tablo]() : (veri.tablolar[tablo] || []);
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'offset', 'limit'].includes(k)) continue;
      if (v.startsWith('eq.')) satirlar = satirlar.filter((x) => String(x[k]) === v.slice(3));
    }
    const bas = Number(u.searchParams.get('offset') || 0);
    const adet = Math.min(Number(u.searchParams.get('limit') || 1000), 1000);  // max_rows = 1000
    const toplam = (veri.sahteToplam && veri.sahteToplam[tablo]) || satirlar.length;
    const sayfa = satirlar.slice(bas, bas + adet);
    const cr = { 'content-range': `${bas}-${bas + sayfa.length - 1}/${(q.headers()['prefer'] || '').includes('count=exact') ? toplam : '*'}` };
    if ((q.headers()['accept'] || '').includes('vnd.pgrst.object')) {
      return sayfa.length === 1 ? json(200, sayfa[0], cr) : json(406, { code: 'PGRST116', message: 'yok', details: 'The result contains 0 rows' });
    }
    return json(200, sayfa, cr);
  });
  if (oturumJson) await ctx.addInitScript((s) => { localStorage.setItem('sb-gflabqnazkstsyafzdmn-auth-token', s); }, oturumJson);
  return { page, istekler, konsol, ctx };
}

function yonetimVerisi() {
  const uyeler = [];
  for (let i = 1; i <= 1500; i += 1) {
    uyeler.push({ id: i, kod: `FC-U-${String(i).padStart(4, '0')}`, ad: i === 2 || i === 3 ? 'Elif Kaya' : `Üye ${i}`, eposta: `u${i}@ornek.com`,
      tel: '05320000000', durum: 'aktif', basvuru_tarihi: gun(-40), baslangic: gun(-30), bitis: gun(i % 2 ? 5 : -5), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, nereden_duydu: 'Instagram', yonetici_notu: i === 2 ? 'eski not' : null, user_id: null });
  }
  const etk = { id: 10, tarih: gun(10), saat: '10.00–12.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null,
    uyelere: null, satilan_bilet: 0, anket_sayisi: 0, anket_ortalama: null, durum: 'yayinda', aciklama: null, link: null, eski_tarih: null };
  const rpcler = [];
  return {
    rpcler,
    tablolar: {
      yoneticiler: [{ ad: 'Yönetici', user_id: 'yon-1' }], uyeler, odemeler: [], etkinlikler: [etk],
      eposta_sablonlari: [{ id: 'basvuru', ad: 'Başvuru', ne_zaman: 'x', acik: true, gun: null, konu: 'k', metin: 'm', alanlar: ['ad'] }],
      etkinlik_kayitlari: [{ etkinlik_id: 10, uye_id: 2, durum: 'kayitli', geldi: false, sira: null }, { etkinlik_id: 10, uye_id: 5, durum: 'kayitli', geldi: false, sira: null }],
    },
    rpc: {
      elden_odeme: (g) => { rpcler.push(['elden_odeme', g]); return [200, { bitis: gun(35), odeme_id: 1, hareket_id: 501, ref: 'elden:abc', tekrar: false, ad: 'Elif Kaya', kod: 'FC-U-0003' }]; },
      giris_kaydet: (g) => { rpcler.push(['giris_kaydet', g]); return [200, { ad: 'Üye 5', uye_id: 5, zaten: false }]; },
      etkinlik_durum_degistir: (g) => { rpcler.push(['etkinlik_durum_degistir', g]); return [200, { durum: 'iptal', tarih: gun(10), eski_tarih: null, kisi: 2, mail: 2 }]; },
    },
  };
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8088', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetici paneli ----------
    {
      const v = yonetimVerisi();
      const { page, istekler, konsol } = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@ornek.com'));
      await page.goto(`${SITE}/yonetim/`);
      await page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 }).catch(async (h) => {
        console.log(konsol.join('\n')); console.log((await page.evaluate(() => document.body.innerText)).slice(0, 500));
        console.log(istekler.map((x) => `${x.yontem} ${x.yol}${x.ara}`).join('\n')); throw h;
      });
      const uyeIstek = istekler.filter((x) => x.yol === '/rest/v1/uyeler' && x.yontem === 'GET');
      dogru(uyeIstek.length === 2 && /offset=1000/.test(uyeIstek[1].ara), `D1: üyeler iki sayfada çekildi (${uyeIstek.map((x) => x.ara.match(/offset=\d+/)).join(', ')})`);
      dogru(await page.evaluate(() => window.FC.DEMO.kisiler.length) === 1500, 'D1: 1500 üyenin hepsi panelde');
      dogru(!(await page.locator('#fc-kayit').isVisible().catch(() => false)) || !/eksik/.test(await page.locator('#fc-kayit').textContent()), 'D1: eksik yoksa uyarı yok');
      dogru(!konsol.some((x) => /Content Security Policy|Refused/i.test(x)), `G4: CSP ihlali yok (${konsol.filter((x) => /Content Security/i.test(x)).length})`);
      // Elden ödeme: aynı adlı iki üye → kodla seçim
      await page.getByRole('button', { name: 'Elden ödeme gir' }).click();
      const uyeKutu = page.locator('input[list="fc-uye-secim"]');
      dogru(await page.locator('#fc-uye-secim option').count() === 50, 'D3: aranabilir üye listesi (datalist) ilk 50 seçenek');
      await uyeKutu.fill('Üye 1499');
      await page.waitForTimeout(200);
      dogru(await page.locator('#fc-uye-secim option[value="Üye 1499 · FC-U-1499"]').count() === 1, 'D3: yazılana uyan üye (1499.) listede');
      await uyeKutu.fill('Elif Kaya');
      await page.getByRole('button', { name: 'Kaydet' }).first().click();
      await page.getByText('Bu adla birden çok üye var').waitFor({ timeout: 3000 });
      dogru(true, 'D3: aynı adlı iki üyede kodsuz seçim reddedildi');
      await uyeKutu.fill('Elif Kaya · FC-U-0003');
      await page.getByRole('button', { name: 'Kaydet' }).first().click();
      await page.getByText(/elden ödeme nakit kasaya yazıldı; üyelik .* tarihine kadar uzadı/).waitFor({ timeout: 5000 });
      const e = v.rpcler.find((x) => x[0] === 'elden_odeme');
      dogru(e && e[1].p_uye === 3 && e[1].p_tutar === 3000 && e[1].p_tarih === gun(0), `D4: elden_odeme sunucuda, uye_id=3 (${JSON.stringify(e && e[1])})`);
      await page.waitForTimeout(500);
      dogru(!istekler.some((x) => x.yol.endsWith('/muhasebe_hareketleri') && x.yontem === 'POST') && !istekler.some((x) => x.yol.endsWith('/odemeler') && x.yontem !== 'GET'),
        'D4: tarayıcı muhasebe / ödeme / üye satırını kendisi yazmadı');
      dogru(await page.evaluate(() => window.FC.DEMO.kisiler[2].durum === 'aktif' && window.FC.DEMO.kisiler[1].odemeler.length === 0), 'D3: ödeme yalnız seçilen üyeye (id 3) işlendi');
      // Etkinlikler: yoklama (karekod) ve iptal
      await page.locator('nav button, button').filter({ hasText: /^Etkinlikler$/ }).first().click();
      await page.getByRole('button', { name: 'Katılımcılar · yoklama' }).first().click();
      dogru(await page.getByText('FC-U-0005', { exact: true }).count() === 1, 'D2: yoklama listesinde gerçek üye kodu');
      await page.locator('input[placeholder="FC-U-0001"]').fill('fc-u-0005-1106');
      await page.getByRole('button', { name: 'Giriş yaptı' }).click();
      await page.getByText('Hoş geldin Üye 5! Giriş işlendi.').waitFor({ timeout: 5000 });
      const g = v.rpcler.find((x) => x[0] === 'giris_kaydet');
      dogru(g && g[1].p_etkinlik === 10 && g[1].p_kod === 'fc-u-0005-1106', `D2: giris_kaydet çağrıldı (${JSON.stringify(g && g[1])})`);
      await page.getByRole('button', { name: 'İptal / ertele' }).first().click();
      await page.getByRole('button', { name: 'İptal et' }).click();
      await page.getByRole('button', { name: 'Duyur', exact: true }).click();
      await page.getByText(/İptal edildi: etkinlik sitedeki listeden kalktı\. Duyuru sitenin en üstünde yayında .* ve 2 kişiye maille gidiyor/).waitFor({ timeout: 5000 });
      const d = v.rpcler.find((x) => x[0] === 'etkinlik_durum_degistir');
      dogru(d && d[1].p_id === 10 && d[1].p_durum === 'iptal', `D5: etkinlik_durum_degistir (${JSON.stringify(d && d[1])})`);
      dogru(!(await page.content()).includes('mail gitti'), 'D5: "mail gitti" yazısı yok');
      dogru(await page.locator('input[type=checkbox]').filter({ has: page.locator('xpath=..') }).first().isEnabled(), 'D5: "Sitede sunulsun" (tanışma) artık ayarlardan, açılabilir');
      // Profil notu: üye numarasıyla
      await page.locator('nav button, button').filter({ hasText: /^Üyeler$/ }).first().click();
      await page.locator('input[type=search]').fill('u2@ornek.com');
      await page.getByRole('button', { name: 'Profil' }).first().click();
      await page.locator('textarea').first().fill('yeni not');
      await page.waitForTimeout(1200);
      const not = istekler.find((x) => x.yontem === 'PATCH' && x.yol.endsWith('/uyeler'));
      dogru(not && /id=eq\.2/.test(not.ara) && not.govde.yonetici_notu === 'yeni not', `D3: not uye_id ile yazıldı (${not && not.ara})`);
      await page.locator('nav button, button').filter({ hasText: /^Muhasebe$/ }).first().click();
      dogru(await page.locator('input[placeholder="örn. 2,99"]').isDisabled(), 'D5: komisyon oranı kutusu kapalı');
      dogru(!konsol.some((x) => /pageerror/.test(x)), `sayfa hatası yok ${konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);
    }
    // ---------- Eksik satır uyarısı ----------
    {
      const v = yonetimVerisi();
      v.sahteToplam = { uyeler: 1600 };
      const { page } = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@ornek.com'));
      await page.goto(`${SITE}/yonetim/`);
      await page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      const t = await page.locator('#fc-kayit').textContent().catch(() => '');
      dogru(/eksik yüklendi \(uyeler 1500\/1600\)/.test(t), `D1: eksik satır uyarısı (${t})`);
    }
    // ---------- Üye paneli ----------
    {
      const v = { tablolar: {}, rpc: {} };
      const { page, istekler } = await sayfaAc(tarayici, v, null);
      await page.goto(`${SITE}/uye/`);
      await page.getByRole('button', { name: /Şifresiz gir/ }).waitFor({ timeout: 15000 });
      await page.locator('input[type=email]').fill('Deniz@Posta.test');
      await page.getByRole('button', { name: /Şifresiz gir/ }).click();
      await page.getByText('deniz@posta.test adresine giriş bağlantısı gönderdik').waitFor({ timeout: 5000 });
      const otp = istekler.find((x) => x.yol === '/auth/v1/otp');
      dogru(otp && otp.govde.email === 'deniz@posta.test', `D6: signInWithOtp isteği (${JSON.stringify(otp && otp.govde)})`);
      dogru(otp && /redirect_to=http:\/\/127\.0\.0\.1:8088\/uye$/.test(decodeURIComponent(otp.ara)), `D6: dönüş adresi üye sayfası (${otp && decodeURIComponent(otp.ara)})`);
    }
    {
      let bagli = false;
      const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@ornek.com', tel: null, bitis: gun(5), baslangic: gun(-25), dogum_gunu: null,
        ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
      const v = {
        tablolar: { uyeler: () => (bagli ? [uye] : []), odemeler: [], etkinlik_kayitlari: [], etkinlikler: [] },
        rpc: { uye_bagla: () => { bagli = true; return [200, 'FC-U-0001']; }, etkinlik_doluluk: () => [200, []] },
      };
      const { page, istekler } = await sayfaAc(tarayici, v, oturum('uye-1', 'deniz@ornek.com'));
      await page.goto(`${SITE}/uye/`);
      await page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
      dogru(istekler.some((x) => x.yol === '/rest/v1/rpc/uye_bagla'), 'D6: ilk girişte uye_bagla çağrıldı, panel açıldı');
      await page.locator('button').filter({ hasText: /^Üyeliğim$/ }).click();
      dogru(!(await page.evaluate(() => Object.keys(localStorage))).includes('fc_uye'), 'G12: fc_uye yazılmadı');
      await page.getByRole('button', { name: /Yenile · havale/ }).click();
      await page.waitForURL(/\/dekont$/, { timeout: 5000 });
      dogru(true, 'D5: canlıda kartla ödeme yerine havale + dekont sayfası (sahte başarı yok)');
    }
    // ---------- Site ----------
    {
      const v = {
        tablolar: { etkinlikler: [
          { id: 1, tarih: gun(3), saat: '10.00', tur: 'bulusma', ad: 'Kötü Bağlantı', kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'x', link: 'javascript:alert(1)' },
          { id: 2, tarih: gun(4), saat: '10.00', tur: 'bulusma', ad: 'İyi Bağlantı', kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'y', link: 'https://www.instagram.com/p/x/' },
        ] },
        rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] },
      };
      const { page, konsol } = await sayfaAc(tarayici, v, null);
      await page.goto(`${SITE}/`);
      await page.getByText('Kötü Bağlantı').first().waitFor({ timeout: 15000 });
      const hrefler = await page.locator('a', { hasText: "Instagram'da gör" }).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      dogru(hrefler.includes('#') && hrefler.includes('https://www.instagram.com/p/x/') && !hrefler.some((h) => /javascript/i.test(h)), `G5: javascript: bağlantısı # oldu (${hrefler.join(', ')})`);
      dogru(!konsol.some((x) => /Content Security Policy|integrity/i.test(x)), 'G4: SRI ve CSP ile site yüklendi');
    }
    {
      const v = { tablolar: {}, hata: { etkinlikler: true }, rpc: { etkinlik_doluluk: () => [200, []] } };
      const { page } = await sayfaAc(tarayici, v, null);
      await page.goto(`${SITE}/`);
      await page.getByText('Etkinlikler şu an yüklenemiyor').first().waitFor({ timeout: 15000 });
      dogru(!(await page.content()).includes('Örnek etkinlik (demo)'), 'D11: veri gelmeyince demo etkinlikler yok, uyarı var');
    }
  } catch (h) {
    console.log('HATA', h.message);
    hatalar += 1;
  } finally {
    await tarayici.close();
    sunucu.kill();
  }
  console.log(hatalar ? `${hatalar} test kaldı` : 'Hepsi geçti');
  process.exit(hatalar ? 1 : 0);
})();
