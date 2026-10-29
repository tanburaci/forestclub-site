// Yönetim ve üye düzenlemeleri: Aktif / Pasif, muhasebede etkinlik penceresi (ileri ayın etkinliği de), Başvurular kapalı
// başlıklar, form önizlemesi, Karekodum'da açılır etkinlik listesi, etkinlikler tarih sırasında; sitede "Aramıza katıl"
// metinleri, ücret ve haklar, "Gönüllü ol" formu.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const QG = require('fs').readFileSync(require.resolve('qrcode-generator/qrcode.js'));
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetim ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 8);
    v.tablolar.uyeler[2] = { ...v.tablolar.uyeler[2], baslangic: null, bitis: null, durum: 'basvuru' };
    v.tablolar.etkinlikler.push({ ...v.tablolar.etkinlikler[0], id: 11, tarih: gun(45), ad: 'Uzak Atölye' });
    v.tablolar.etkinlikler.push({ ...v.tablolar.etkinlikler[0], id: 12, tarih: gun(1), ad: 'Altın Tohum', bilet_fiyati: 1500, uyelere: 'yuzde50', satilan_bilet: 1 });
    v.tablolar.muhasebe_hareketleri = [{ id: 1, tarih: gun(0), tur: 'gelir', tutar: 750, kasa: 'banka', hedef_kasa: null, kategori: 'Etkinlik katılım ücreti', etkinlik_id: 12, aciklama: 'Bilet · Deniz · 1 kişi', belge: 'bilet:5', otomatik: true, odeme: 'havale', fatura_durum: null, fatura_no: null, fatura_tarih: null }];
    v.tablolar.bilet_istekleri = [{ id: 5, uye_id: 1, ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: null, kalemler: [{ etkinlik_id: 12, adet: 1, birim: 1500, indirim: 750, tutar: 750 }], tutar: 750, dosya: 'yeni/x', yuklendi: true, durum: 'onaylandi', created_at: '2026-10-29T10:00:00Z' }];
    v.tablolar.gonulluler = [{ id: 1, ad: 'Gönüllü Kişi', eposta: 'gonullu@posta.test', tel: null, alanlar: ['Karşılama'], notlar: null, durum: 'yeni', created_at: '2026-10-29T10:00:00Z' }];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await sekme(y.page, 'Üyeler');
    const tablo = await y.page.locator('table.fc-uye-tablo tbody').innerText();
    dogru(/Aktif/.test(tablo) && /Pasif/.test(tablo) && !/Süresi doldu|Hiç ödemedi|Aidattan muaf/.test(tablo), 'üyeler: durum yalnız Aktif / Pasif');
    dogru(await y.page.locator('button').filter({ hasText: /^Pasif · \d+$/ }).count() === 1, 'üyeler: Pasif süzgeci');
    dogru(await y.page.locator('table.fc-uye-tablo').getByRole('button', { name: 'Elden ödeme' }).count() === 0, 'üyeler: Elden ödeme satırda değil (profilde)');

    await sekme(y.page, 'Etkinlikler');
    const kart = y.page.locator('article').filter({ has: y.page.locator('h3', { hasText: 'Altın Tohum' }) });
    await kart.waitFor({ timeout: 5000 });
    dogru(/1 satıldı \(750 TL\)/.test(await kart.innerText()), 'etkinlik: satış tutarı üye indirimiyle (750 TL)');
    await kart.getByRole('button', { name: 'Katılımcılar · yoklama' }).click();
    const panel = y.page.locator('#etk-panel');
    await panel.waitFor({ timeout: 3000 });
    await y.page.waitForTimeout(500);
    dogru((await panel.innerText()).includes('Bilet alanlar') && (await panel.innerText()).includes('Deniz Yılmaz') && await panel.evaluate((e) => e.getBoundingClientRect().top < innerHeight), 'katılımcılar: bilet alanlar listede, panel ekranda');

    await sekme(y.page, 'Muhasebe');
    await y.page.getByRole('button', { name: 'Etkinlik seç…' }).first().click();
    const pencere = y.page.getByRole('dialog', { name: 'Etkinlik seç' });
    await pencere.waitFor({ timeout: 3000 });
    dogru(await pencere.getByText('Uzak Atölye').count() === 1 && await pencere.getByText('Breakfast Club').count() === 1, 'muhasebe: pencerede ileri tarihli bütün etkinlikler');
    await pencere.getByRole('button', { name: /Uzak Atölye/ }).click();
    dogru(await y.page.getByText('Uzak Atölye ·', { exact: false }).count() > 0 && await pencere.count() === 0, 'muhasebe: etkinlik seçildi, pencere kapandı');

    await sekme(y.page, 'Başvurular');
    dogru(await y.page.getByText('Henüz gönüllü başvurusu yok.').count() === 0 && await y.page.getByText('gonullu@posta.test').count() === 0, 'başvurular: bölümler kapalı başlıyor');
    await y.page.getByRole('button', { name: /Gönüllüler · 1/ }).click();
    dogru(await y.page.getByText('gonullu@posta.test').count() === 1, 'başvurular: başlığa tıklayınca gönüllüler açıldı');
    await y.page.getByRole('button', { name: 'İletişime geçildi' }).click();
    await y.page.waitForTimeout(400);
    dogru(y.istekler.some((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/gonulluler' && x.govde.durum === 'iletisim'), 'başvurular: gönüllü "iletişime geçildi" işaretlendi');

    await sekme(y.page, 'Formlar');
    await y.page.getByRole('button', { name: 'Yeni form' }).click();
    await y.page.locator('input[placeholder="Örn. Kasım ayı önerileri"]').fill('Aralık anketi');
    await y.page.getByLabel('Soru 1').fill('En sevdiğin buluşma?');
    await y.page.getByRole('button', { name: 'Önizleme' }).click();
    const oniz = y.page.getByRole('dialog', { name: 'Form önizlemesi' });
    dogru(await oniz.isVisible() && (await oniz.innerText()).includes('Aralık anketi') && (await oniz.innerText()).includes('En sevdiğin buluşma?'), 'formlar: önizleme formu üyenin göreceği gibi gösteriyor');
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    // ---------- Üye paneli ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Deneme', eposta: 'deniz@posta.test', tel: null, bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1', aidat_muaf: false };
    const e = (id, g, ad) => ({ id, tarih: gun(g), saat: '10.00', tur: 'bulusma', ad, kim: null, kontenjan: 30, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'x', link: null });
    const u = await sayfaAc(tarayici, { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [e(9, 3, 'Yakın Buluşma'), e(2, 20, 'Uzak Buluşma'), e(5, 10, 'Orta Buluşma')], etkinlik_kayitlari: [9, 2, 5].map((id) => ({ etkinlik_id: id, uye_id: 1, durum: 'kayitli', geldi: false })), anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [] },
      rpc: { etkinlik_doluluk: () => [200, []], dekont_bekliyor: () => [200, false] } }, oturum('uye-1', 'deniz@posta.test'));
    await u.page.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: QG }));
    await u.page.setViewportSize({ width: 390, height: 844 });
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    const rv = await u.page.locator('section').filter({ hasText: 'Randevularım' }).first().locator('strong').evaluateAll((x) => x.map((e) => e.textContent).filter((t) => /Buluşma/.test(t)));
    dogru(JSON.stringify(rv) === JSON.stringify(['Yakın Buluşma', 'Orta Buluşma', 'Uzak Buluşma']), `Randevularım: yeri ayrılanlar tarih sırasında (${rv.join(', ')})`);
    await sekme(u.page, 'Etkinlikler');
    const kartlar = await u.page.locator('article.fu-kart').evaluateAll((a) => a.map((x) => (x.innerText.match(/(Yakın|Orta|Uzak) Buluşma/) || [''])[0]));
    dogru(JSON.stringify(kartlar) === JSON.stringify(['Yakın Buluşma', 'Orta Buluşma', 'Uzak Buluşma']), `etkinlikler: yakından uzağa (${kartlar.join(', ')})`);
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');

    // ---------- Site ----------
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler: [], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'aidat', deger: 3000 }] },
      rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    const gonderilen = [];
    await s.page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: "window.turnstile = { render(el, o) { setTimeout(() => o.callback('jeton'), 10); return 1; }, remove() {} };" }));
    await s.page.route('https://gflabqnazkstsyafzdmn.supabase.co/functions/v1/form-gonder', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      gonderilen.push(JSON.parse(r.request().postData()));
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ sonuc: 'tamam' }) });
    });
    await s.page.goto(`${SITE}/`);
    await s.page.getByText('Aramıza katıl, kulübümüze üye ol.').waitFor({ timeout: 15000 });
    dogru(await s.page.locator('a.fs-menu', { hasText: 'Üyelik' }).getAttribute('href') === '#basvuru', 'site: menüdeki Üyelik başvuru bölümüne gider');
    dogru(await s.page.locator('#uyelik').count() === 0, 'site: ayrı Üyelik bölümü yok (Aramıza katıl yeterli)');
    const katil = await s.page.locator('#basvuru').innerText();
    dogru(katil.includes('3.000 TL') && katil.includes('Breakfast buluşması') && katil.includes('Sunset buluşması') && !katil.includes('Aylık Breakfast') && katil.includes('%50'), 'site: ücret ve üyelik hakları yazıyor');
    dogru(await s.page.locator('#basvuru').getByRole('button', { name: 'Aramıza katıl' }).count() === 1 && !katil.includes('Ödemeye geç'), 'site: düğme "Aramıza katıl"');
    // Tanışma: site bilet dağıtmaz; rezervasyon formu, açık etkinlik yoksa açıklama
    dogru(!/Tanışma biletini al|Biletimi al|İlk buluşman bizden/.test(await s.page.content()), 'tanışma: "bileti al" hiçbir yerde yok');
    await s.page.getByRole('button', { name: 'Tanışma biletimle rezervasyon oluştur' }).click();
    const td = s.page.getByRole('dialog', { name: 'Tanışma biletimle rezervasyon' });
    dogru(await td.getByText('Şu an tanışma rezervasyonuna açık etkinlik yok').count() === 1 && await td.getByRole('button', { name: 'Rezervasyonu oluştur' }).isDisabled(), 'tanışma: açık etkinlik yoksa açıklama, düğme pasif');
    await td.getByRole('button', { name: 'Kapat' }).click();
    const ilet = s.page.locator('#iletisim');
    dogru(await ilet.getByRole('link', { name: 'E-posta' }).count() === 1 && await ilet.locator('a[aria-label="E-posta"] svg').count() === 1, 'iletişim: e-posta simgesiyle');
    dogru(await ilet.getByText('Nasıl gelinir?').count() === 1 && await ilet.locator('a[href^="https://www.google.com/maps/"]').count() === 1 && await s.page.locator('#sss').getByText('Nasıl gelinir?').count() === 0, 'iletişim: Nasıl gelinir altta, Google Haritalar');
    const g = s.page.locator('#gonullu');
    dogru(await g.count() === 1 && await g.evaluate((x) => x.compareDocumentPosition(document.getElementById('basvuru')) & Node.DOCUMENT_POSITION_PRECEDING), 'site: Gönüllü ol, Aramıza katıl\'ın altında');
    await g.getByLabel('Ad Soyad').fill('Ayşe Gönüllü');
    await g.getByLabel('E-posta').fill('ayse@posta.test');
    await g.getByRole('button', { name: 'Karşılama' }).click();
    await g.getByRole('button', { name: 'Gönüllü olmak istiyorum' }).click();
    dogru(await g.getByText('KVKK metnini onayla').count() === 1, 'gönüllü: KVKK onayı isteniyor');
    await g.getByRole('checkbox').check();
    await g.getByRole('button', { name: 'Gönüllü olmak istiyorum' }).click();
    await g.getByText('Gönüllü başvurun bize ulaştı').waitFor({ timeout: 5000 });
    const gv = gonderilen.find((x) => x.tur === 'gonullu');
    dogru(gv && gv.veri.ad === 'Ayşe Gönüllü' && gv.veri.alanlar.includes('Karşılama') && gv.veri.kvkk === true, `gönüllü: form-gonder'e gitti (${JSON.stringify(gv && gv.veri)})`);
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
