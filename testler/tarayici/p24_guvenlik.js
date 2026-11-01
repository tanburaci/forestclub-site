// Güvenlik ve dayanıklılık (01.11.2026): veritabanından gelen kötü niyetli metin ve bağlantılar (XSS) site, üye paneli ve
// yönetim panelinde çalışmaz; "javascript:" / "//başka.site" adresleri bağlantıya dönüşmez; telefonda (390 px) yan kaydırma
// yok; CSP başlığı uygulanırken satır içi betik çalışmaz.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';

// Her biri çalışırsa window.__xss'e bir işaret yazar
const XSS = [
  '<img src=x onerror="window.__xss=(window.__xss||0)+1">',
  '<script>window.__xss=(window.__xss||0)+1</script>',
  '"><svg onload="window.__xss=(window.__xss||0)+1">',
  '{{ constructor.constructor("window.__xss=1")() }}',
];
const KOTU = XSS.join(' ');
const KOTU_ADRES = ['javascript:window.__xss=9', '//evil.example/x', 'data:text/html,<script>window.__xss=8</script>', ' JaVaScRiPt:window.__xss=7'];

async function denetle(page, ad) {
  await page.waitForTimeout(800);
  const sonuc = await page.evaluate(() => ({
    xss: window.__xss || 0,
    ekli: document.querySelectorAll('img[src="x"], svg[onload], script:not([src])').length,
    adres: Array.from(document.querySelectorAll('a[href], img[src], iframe[src], form[action]'))
      .map((e) => e.getAttribute('href') || e.getAttribute('src') || e.getAttribute('action'))
      .filter((h) => /^\s*(javascript|data):|^\s*\/\/evil/i.test(h)),
    yanKaydirma: document.documentElement.scrollWidth - window.innerWidth,
  }));
  dogru(sonuc.xss === 0, `${ad}: kötü niyetli metin çalışmadı (__xss=${sonuc.xss})`);
  dogru(sonuc.ekli === 0, `${ad}: metin HTML öğesine dönüşmedi (${sonuc.ekli})`);
  dogru(sonuc.adres.length === 0, `${ad}: javascript:/data:/başka site adresi bağlantı olmadı (${sonuc.adres.join(' | ')})`);
  return sonuc;
}

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Site (ziyaretçi, telefon) ----------
    const etkinlikler = KOTU_ADRES.map((link, i) => ({
      id: 30 + i, tarih: gun(3 + i), saat: '10.00', tur: 'bulusma', ad: `${XSS[i]} Etkinlik ${i}`, kim: KOTU, kontenjan: 30, bilet_fiyati: null,
      uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: KOTU, link, afis: link,
    }));
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler, ayarlar: [{ anahtar: 'yakinda', deger: false },
      { anahtar: 'site_duyurusu', deger: KOTU },
      { anahtar: 'iletisim', deger: { eposta: 'a@b.c"><img src=x onerror=window.__xss=5>', alan: KOTU, instagram: 'javascript:window.__xss=6', topluluk: 'javascript:window.__xss=4' } }] },
    rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    s.page.on('dialog', (d) => d.dismiss());
    await s.page.setViewportSize({ width: 390, height: 844 });
    await s.page.goto(`${SITE}/`);
    await s.page.getByText('Etkinlik 0').first().waitFor({ timeout: 15000 });
    for (const kart of await s.page.locator('li.fs-urun h3').all()) await kart.click().catch(() => {});
    const ss = await denetle(s.page, 'site');
    dogru(ss.yanKaydirma <= 1, `site: telefonda yan kaydırma yok (${ss.yanKaydirma}px)`);
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');

    // ---------- Yönetim paneli ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler[0].ad = KOTU;
    v.tablolar.uyeler[1].yonetici_notu = KOTU;
    v.tablolar.uyeler[2].eposta = '"><img src=x onerror=window.__xss=3>@x.y';
    v.tablolar.etkinlikler[0].ad = `${XSS[0]} Kahvaltı`;
    v.tablolar.etkinlikler[0].link = KOTU_ADRES[0];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    y.page.on('dialog', (d) => d.dismiss());
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    for (const sekme of ['Üyeler', 'Etkinlikler', 'Muhasebe', 'Başvurular']) {
      await y.page.locator('button').filter({ hasText: new RegExp(`^${sekme}`) }).first().click().catch(() => {});
      await y.page.waitForTimeout(300);
    }
    await denetle(y.page, 'yönetim');
    await y.page.setViewportSize({ width: 390, height: 844 });
    await y.page.locator('button').filter({ hasText: /^Üyeler/ }).first().click().catch(() => {});
    const yk = await y.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    dogru(yk <= 1, `yönetim: telefonda sayfa yana kaymıyor (tablolar kendi kutusunda kayar) (${yk}px)`);

    // ---------- Üye paneli ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: KOTU, eposta: 'deniz@posta.test', tel: '"><img src=x onerror=window.__xss=2>', bitis: gun(20),
      baslangic: gun(-10), dogum_gunu: null, ozel_gunler: [], ilgi_alanlari: [KOTU], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const uv = { tablolar: { uyeler: [uye], odemeler: [], etkinlikler, etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [], yoneticiler: [] },
      rpc: { etkinlik_doluluk: () => [200, []] } };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    u.page.on('dialog', (d) => d.dismiss());
    await u.page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));
    await u.page.setViewportSize({ width: 390, height: 844 });
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba').first().waitFor({ timeout: 15000 }).catch((h) => { console.log('üye konsol:', u.konsol.slice(-5).join(' | ')); throw h; });
    for (const sekme of ['Etkinlikler', 'Profil', 'Üyelik']) {
      await u.page.locator('button').filter({ hasText: new RegExp(`^${sekme}$`) }).first().click().catch(() => {});
      await u.page.waitForTimeout(300);
    }
    const us = await denetle(u.page, 'üye paneli');
    dogru(us.yanKaydirma <= 1, `üye paneli: telefonda yan kaydırma yok (${us.yanKaydirma}px)`);

    // ---------- CSP: sayfaya sonradan eklenen satır içi betik çalışmaz ----------
    const csp = await s.page.evaluate(() => {
      const b = document.createElement('script'); b.textContent = 'window.__csp = 1'; document.body.appendChild(b);
      return window.__csp || 0;
    });
    dogru(csp === 0, `CSP: satır içi betik engellendi (${csp})`);
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
