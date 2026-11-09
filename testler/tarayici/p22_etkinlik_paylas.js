// Tek etkinliği paylaşma: kartta "Paylaş" (bilgisayarda bağlantı panoya kopyalanır), /#etkinlik-<id> bağlantısı açılınca
// kart açık gelir ve ekrana kaydırılır (geçmiş etkinlikte de); /e/<id> sunucu sayfası (Cloudflare Pages Function) önizlemede
// etkinliğin adını, tarihini ve afişini verir, ziyaretçiyi karta yönlendirir.
const { sayfaAc, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const e = (id, g, ad) => ({ id, tarih: gun(g), saat: '10.00', tur: 'bulusma', ad, kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: 'ucretsiz',
  satilan_bilet: 0, durum: 'yayinda', aciklama: `${ad} açıklaması. `.repeat(20), link: null, afis: null });
const veri = { tablolar: { etkinlikler: [e(7, 6, 'Breakfast Club'), e(8, 12, 'Sunset Club'), e(3, -20, 'Eski Buluşma'), e(4, -15, 'A1'), e(5, -10, 'A2'), e(6, -5, 'A3')],
  ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // /e/<id> önizleme sayfası (Edge Function; fetch sahte)
    const kaynak = require('fs').readFileSync(path.join(DENEME, '../functions/e/[id].js'), 'utf8');
    const ef = await import(`data:text/javascript,${encodeURIComponent(kaynak)}`);
    const eskiFetch = global.fetch;
    let sorgu = '';
    let kucukVar = false;
    let anaHtml = false;  // ana sayfa HTML'i alınabiliyor mu (alınamazsa kısa önizleme + yönlendirme)
    const ANA_HTML = require('fs').readFileSync(path.join(DENEME, 'index.html'), 'utf8');  // afisler/paylas/<ad>.jpg (küçük paylaşım kopyası) var mı
    global.fetch = async (u, o) => {
      if (o && o.method === 'HEAD') return new Response(null, { status: kucukVar && /\/afisler\/paylas\/a\.jpg$/.test(String(u)) ? 200 : 404 });
      if (/\/index\.html$/.test(String(u))) return new Response(anaHtml ? ANA_HTML : 'yok', { status: anaHtml ? 200 : 404 });
      sorgu = String(u); return new Response(JSON.stringify(/id=eq\.12&/.test(sorgu) ? [{ ad: 'Sunset <Club>', tarih: '2026-11-14', saat: '18.00', aciklama: 'Gün batımında müzik.', bilet_fiyati: '250.00', kontenjan: 30, satilan_bilet: 30, durum: 'yayinda', afis: 'https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/a.jpg' }] : []), { status: 200 }); };
    const yanit = await ef.yanitla(new Request('https://www.forestcluburla.com/e/12'), (u) => fetch(new URL('/index.html', u.origin)));
    const html = await yanit.text();
    dogru(yanit.headers.get('content-type').startsWith('text/html') && html.includes('<meta property="og:image" content="https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/a.jpg">'),
      'önizleme: og:image etkinliğin afişi');
    dogru(html.includes('og:title" content="Sunset &lt;Club&gt; · Forest Club Urla"') && html.includes('14 Kasım Cumartesi · 18.00 · Pinya, Urla, İzmir · Gün batımında müzik.'), 'önizleme: başlık (kaçışlı) ve tarih');
    dogru(html.includes('http-equiv="refresh" content="0; url=/#etkinlik-12"') && /durum=neq\.taslak/.test(sorgu), 'önizleme: karta yönlendirir, taslak gösterilmez');
    kucukVar = true;
    const kucukHtml = await (await ef.yanitla(new Request('https://www.forestcluburla.com/e/12'), (u) => fetch(new URL('/index.html', u.origin)))).text();
    dogru(kucukHtml.includes('og:image" content="https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/paylas/a.jpg"'),
      'önizleme: küçük paylaşım kopyası varsa o kullanılır (WhatsApp büyük resmi göstermiyor)');
    kucukVar = false;
    anaHtml = true;
    const tam = await (await ef.yanitla(new Request('https://www.forestcluburla.com/e/12'), (u) => fetch(new URL('/index.html', u.origin)))).text();
    dogru(tam.includes('site.js') && tam.includes('<title>Sunset &lt;Club&gt; · Forest Club Urla</title>') && tam.includes('og:url" content="https://www.forestcluburla.com/e/12"')
      && tam.includes('og:image" content="https://gflabqnazkstsyafzdmn.supabase.co/storage/v1/object/public/afisler/a.jpg"') && !tam.includes('http-equiv="refresh"'),
      'etkinlik sayfası: ana sayfa bu adreste, başlık ve önizleme etiketleri etkinliğin');
    // Google etkinlik kartı: schema.org Event (ana sayfanın kuruluş şeması yerine)
    const ld = [...tam.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const olay = ld[0] || {};
    dogru(ld.length === 1 && olay['@type'] === 'Event' && olay.name === 'Sunset <Club>' && olay.startDate === '2026-11-14T18:00:00+03:00'
      && olay.location.address.addressLocality === 'Urla' && olay.location.address.addressRegion === 'İzmir' && olay.url === 'https://www.forestcluburla.com/e/12'
      && olay.offers.price === '250' && olay.offers.priceCurrency === 'TRY' && /SoldOut$/.test(olay.offers.availability) && /EventScheduled$/.test(olay.eventStatus)
      && !/<\/?Club>/.test(tam.split('ld+json')[1]), `etkinlik sayfası: Google etkinlik şeması (tarih, Urla/İzmir, fiyat, tükendi; < kaçışlı) ${JSON.stringify(olay).slice(0, 120)}`);
    dogru(ef.olaySemasi('https://x', 1, { ad: 'A', tarih: '2026-12-01', saat: null, durum: 'iptal', bilet_fiyati: null }).includes('"startDate":"2026-12-01"')
      && ef.olaySemasi('https://x', 1, { ad: 'A', tarih: '2026-12-01', durum: 'iptal' }).includes('EventCancelled')
      && !ef.olaySemasi('https://x', 1, { ad: 'A', tarih: '2026-12-01' }).includes('offers'), 'etkinlik şeması: saatsiz tarih, iptal, ücretsizse teklif yok');
    // Site haritası: sabit sayfalar + yayınlanmış etkinlik sayfaları
    const sm = await import(`data:text/javascript,${encodeURIComponent(require('fs').readFileSync(path.join(DENEME, '../functions/sitemap.xml.js'), 'utf8'))}`);
    let smSorgu = '';
    global.fetch = async (u) => { smSorgu = String(u); return new Response(JSON.stringify([{ id: 12, created_at: '2026-11-01T10:00:00Z' }, { id: 'x' }]), { status: 200 }); };
    const smXml = await (await sm.yanitla(new Response(require('fs').readFileSync(path.join(DENEME, 'sitemap.xml'), 'utf8')))).text();
    dogru(smXml.includes('<loc>https://www.forestcluburla.com/</loc>') && smXml.includes('<url><loc>https://www.forestcluburla.com/e/12</loc><lastmod>2026-11-01</lastmod></url>')
      && !smXml.includes('/e/x') && /durum=in\.\(yayinda,ertelendi\)/.test(smSorgu) && typeof sm.onRequestGet === 'function', 'site haritası: etkinlik sayfaları eklenir, taslak/iptal yok');
    global.fetch = async () => { throw new Error('ağ yok'); };
    const smYedek = await (await sm.yanitla(new Response(require('fs').readFileSync(path.join(DENEME, 'sitemap.xml'), 'utf8')))).text();
    dogru(smYedek.includes('/hakkimizda/') && !smYedek.includes('/e/'), 'site haritası: veri okunamazsa sabit liste');
    anaHtml = false;
    const yok = await (await ef.yanitla(new Request('https://www.forestcluburla.com/e/99'), (u) => fetch(new URL('/index.html', u.origin)))).text();
    dogru(yok.includes('/_blob/1446f01d4f1e77e517c2b5c1ed9e8882.png') && yok.includes('url=/#etkinlikler'), 'önizleme: etkinlik yoksa logo ve etkinlikler bölümü');
    global.fetch = eskiFetch;
    dogru(typeof ef.onRequestGet === 'function', 'önizleme: Cloudflare /e/<id> işleyicisi var');
    // Functions yanıtına _headers uygulanmaz: güvenlik başlıkları işlevde de aynı olmalı
    const genel = {};
    /^\/\*\n([\s\S]*?)\n\n/m.exec(require('fs').readFileSync(path.join(DENEME, '_headers'), 'utf8'))[1].split('\n').forEach((l) => { const m = /^\s+([A-Za-z-]+): (.*)$/.exec(l); if (m) genel[m[1]] = m[2]; });
    dogru(JSON.stringify(genel) === JSON.stringify(ef.GUVENLIK), 'önizleme: güvenlik başlıkları (CSP) _headers ile aynı');

    // Bağlantıyla gelen: eski /#etkinlik-<id> bağlantısı etkinliğin kendi sayfasına gider
    const s = await sayfaAc(tarayici, veri, null);
    await s.page.setViewportSize({ width: 1280, height: 800 });
    // yerelde Edge Function yerine ana sayfa HTML'i
    await s.page.route(`${SITE}/e/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'deneme-site', 'index.html'), 'utf8') }));
    await s.page.goto(`${SITE}/#etkinlik-8`);
    await s.page.waitForURL(`${SITE}/e/8`, { timeout: 15000 });
    await s.page.locator('.fe-ana').waitFor({ timeout: 15000 });
    dogru((await s.page.locator('.fe-ana').innerText()).includes('Sunset Club'), 'bağlantı: eski #etkinlik bağlantısı /e/8 sayfasını açar');

    // Geçmiş (listede ilk 3'te olmayan) etkinliğin de sayfası açılır
    await s.page.goto(`${SITE}/e/3`);
    await s.page.locator('.fe-ana').waitFor({ timeout: 8000 });
    dogru(await s.page.locator('.fe-gecti').count() === 1, 'bağlantı: eski geçmiş etkinliğin sayfası açılır');

    // Paylaş: bilgisayarda panoya kopyalanır, sayfa değişmez
    await s.page.goto(`${SITE}/`);
    await s.page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
    await s.page.locator('#etkinlik-7').getByRole('button', { name: 'Breakfast Club etkinliğini paylaş' }).click();
    await s.page.locator('#etkinlik-7').getByText('Bağlantı kopyalandı ✓').waitFor({ timeout: 4000 });
    const pano = await s.page.evaluate(() => navigator.clipboard.readText());
    dogru(pano === `${SITE}/e/7`, `paylaş: bağlantı panoya kopyalandı (${pano})`);
    dogru(new URL(s.page.url()).pathname === '/', 'paylaş: düğme sayfayı değiştirmez');
    // Açık Çağrı: menüde Üyelik ile SSS arasında, form sayfada kendi bölümünde; telefonda menü 3'erli iki sıra
    const menu = await s.page.locator('nav[aria-label="Site menüsü"] a.fs-menu').allTextContents();
    dogru(menu.join('|') === 'Biz Kimiz?|Etkinlikler|Üyelik|Açık Çağrı|SSS|İletişim', `menü: Açık Çağrı Üyelik ile SSS arasında (${menu.join(', ')})`);
    dogru(await s.page.locator('nav[aria-label="Site menüsü"] a', { hasText: 'Açık Çağrı' }).getAttribute('href') === '/acik-cagri/' && await s.page.locator('#acik-cagri, .fs-cagri-form').count() === 0,
      'Açık Çağrı ana sayfada değil; menü /acik-cagri/ sayfasını açar');
    await s.page.setViewportSize({ width: 360, height: 780 });
    await s.page.waitForTimeout(300);
    const satir = await s.page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Site menüsü"] a.fs-menu')].map((a) => Math.round(a.getBoundingClientRect().top)));
    dogru(new Set(satir).size === 2 && satir.slice(0, 3).every((y) => y === satir[0]) && satir.slice(3).every((y) => y === satir[3])
      && await s.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'telefon: menü 3\'erli iki sıra, taşma yok');
    dogru(!s.konsol.some((x) => /pageerror|Content Security/.test(x)), 'sayfa / CSP hatası yok');

    // Açık Çağrı sayfası: yalnız form; gönderim form-gonder'e "cagri"
    const c = await sayfaAc(tarayici, veri, null);
    await c.page.setViewportSize({ width: 390, height: 800 });
    const cagrilar = [];
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    await c.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript',
      body: "window.turnstile = { n: 0, render(el, o) { setTimeout(() => o.callback('jeton-' + (++this.n)), 20); return this.n; }, remove() {} };" }));
    await c.page.route('https://gflabqnazkstsyafzdmn.supabase.co/functions/v1/form-gonder', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors });
      cagrilar.push(JSON.parse(r.request().postData()));
      r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ sonuc: 'tamam' }) });
    });
    await c.page.goto(`${SITE}/acik-cagri/`);
    await c.page.getByRole('heading', { name: 'Açık Çağrı' }).waitFor({ timeout: 15000 });
    await c.page.getByPlaceholder('Adın Soyadın').fill('Deniz Ses');
    await c.page.getByPlaceholder('ornek@mail.com ya da 05xx').fill('deniz@posta.test');
    await c.page.getByRole('button', { name: 'Evet', exact: true }).click();
    await c.page.getByPlaceholder('Örn. Ormanda ses banyosu').fill('Ses banyosu');
    await c.page.locator('textarea').first().fill('Gong');
    await c.page.locator('input[type=checkbox]').last().check();
    await c.page.getByRole('button', { name: 'Fikrimi gönder ✨' }).click();
    dogru(await c.page.getByText('Çalışmanın alanını seç (en az bir tane).').count() === 1 && !cagrilar.length, 'Açık Çağrı: eksik alan adıyla söylenir, gönderilmez');
    await c.page.getByRole('button', { name: 'Ses ve müzik' }).click();
    await c.page.getByRole('button', { name: 'Fikrimi gönder ✨' }).click();
    await c.page.getByText('Teşekkürler! 🌲').waitFor({ timeout: 5000 });
    dogru(cagrilar.length === 1 && cagrilar[0].tur === 'cagri' && cagrilar[0].veri.ad === 'Deniz Ses' && cagrilar[0].veri.alan === 'Ses ve müzik' && cagrilar[0].veri.baslik === 'Ses banyosu' && cagrilar[0].veri.anlat === 'Gong',
      `Açık Çağrı sayfası: form gönderildi (${JSON.stringify(cagrilar[0] && cagrilar[0].veri)})`);
    dogru(await c.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1) && !c.konsol.some((x) => /pageerror|Content Security/.test(x)), 'Açık Çağrı sayfası: telefonda taşma yok, hata yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
