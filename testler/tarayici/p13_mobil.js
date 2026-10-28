// Telefon görünümü (360×740, dokunmatik): ana sayfalar ve panel sekmeleri sayfayı yana kaydırmıyor, kökteki
// overflow:hidden yüzünden kırpılan (ekran dışına taşan) öğe yok; yatay kapakta kart kayabiliyor, form sorusu daralmıyor,
// üye sepeti ekranı kaplamıyor.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button:visible').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'yoga', ad: 'Yoga Sabahı ve uzun bir etkinlik adı', kim: 'Ece', kontenjan: 12, bilet_fiyati: 1000,
  uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Yoga matını getir.', link: null, tanisma_kontenjan: 3 };
const etk2 = { id: 8, tarih: gun(9), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null,
  uyelere: null, satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null };
const FORM = { id: 5, baslik: 'Kasım ayı önerileri', aciklama: 'Fikirlerini merak ediyoruz.', acik: true, created_at: new Date().toISOString(), sorular: [
  { id: 's1', metin: 'Hangi gün uygun?', tur: 'tek', secenekler: ['Cumartesi', 'Pazar'], zorunlu: true }, { id: 's2', metin: 'Önerin', tur: 'kisa', zorunlu: false }] };

// Sayfa yana kayıyor mu, görünür bir öğe ekranın dışına taşıyor mu (yatay kayan kendi sarmalı içindekiler hariç)?
const tasma = (page) => page.evaluate(() => {
  const iw = innerWidth;
  const gorunur = (e) => {
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const c = getComputedStyle(x);
      if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0 || x.getAttribute('aria-hidden') === 'true' || x.hasAttribute('inert')) return false;
    }
    return true;
  };
  const sarmalda = (e) => {
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) if (['auto', 'scroll'].includes(getComputedStyle(x).overflowX)) return true;
    return false;
  };
  const disari = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.right < -1000) continue;  // ekran okuyucu için saklananlar
    if (r.right <= iw + 1 && r.left >= -1) continue;
    const c = getComputedStyle(e);
    if (c.position === 'absolute' && c.pointerEvents === 'none') continue;  // süs resimleri
    if (!gorunur(e) || sarmalda(e)) continue;
    disari.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)}" [${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  return { sw: document.scrollingElement.scrollWidth, iw, disari: disari.slice(0, 5) };
});
const denetle = async (page, ad) => {
  await page.waitForTimeout(300);
  const t = await tasma(page);
  dogru(t.sw <= t.iw + 1 && t.disari.length === 0, `${ad}: yana taşma yok (sw=${t.sw}${t.disari.length ? `; dışarıda: ${t.disari.join(' | ')}` : ''})`);
};

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  const tel = (w = 360, h = 740) => ({ newContext: (o = {}) => tarayici.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, ...o }) });
  try {
    // ---------- Site: kapaklı (dik ve yatay) ----------
    const kapakVeri = { kapak: true, tablolar: { etkinlikler: [etk] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } };
    const k = await sayfaAc(tel(), kapakVeri);
    await k.page.goto(`${SITE}/`);
    await k.page.locator('#fc-yakinda').waitFor({ timeout: 10000 });
    await denetle(k.page, 'site (kapak)');
    const ky = await sayfaAc(tel(740, 360), kapakVeri);
    await ky.page.goto(`${SITE}/`);
    await ky.page.locator('#fc-yakinda').waitFor({ timeout: 10000 });
    const kapak = await ky.page.evaluate(() => { const e = document.getElementById('fc-yakinda'); const k = e.querySelector('.kart').getBoundingClientRect(); return { kayar: getComputedStyle(e).overflowY, sh: e.scrollHeight, ch: e.clientHeight, ust: k.top }; });
    dogru(kapak.sh <= kapak.ch || (kapak.kayar === 'auto' && kapak.ust >= 0), `yatay telefonda kapak kartı kayarak tam görülebiliyor (${JSON.stringify(kapak)})`);

    // ---------- Site: açılıştan sonra ----------
    const s = await sayfaAc(tel(), { tablolar: { etkinlikler: [etk, etk2], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } });
    await s.page.goto(`${SITE}/`);
    await s.page.getByRole('button', { name: 'Randevu oluştur' }).first().waitFor({ timeout: 10000 });
    await denetle(s.page, 'site');
    await s.page.getByRole('button', { name: 'Randevu oluştur' }).first().click();
    await s.page.locator('.fs-sepet-dugme').click();
    await s.page.locator('.fs-modal').getByRole('button', { name: 'Devam et' }).click();
    await denetle(s.page, 'site: randevu penceresi (bilgiler)');
    const modal = await s.page.locator('.fs-modal').evaluate((m) => ({ h: m.getBoundingClientRect().height, ih: innerHeight, oy: getComputedStyle(m).overflowY }));
    dogru(modal.h <= modal.ih && modal.oy === 'auto', `site: pencere ekrana sığıyor, içi kayıyor (${JSON.stringify(modal)})`);
    await s.page.locator('.fs-modal-kapat').click();
    await s.page.locator('.fs-destek').click();
    await denetle(s.page, 'site: destek penceresi');
    await s.page.locator('.fs-modal-kapat').click();
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');

    // ---------- Metin sayfaları, form, dekont ----------
    for (const yol of ['hakkimizda/', 'teslimat-iade/', 'gizlilik/', 'mesafeli-satis/', 'dekont/', 'form/?id=5', 'uye/', 'yonetim/']) {
      const m = await sayfaAc(tel(), { tablolar: { formlar: [FORM] }, rpc: {} });
      await m.page.goto(`${SITE}/${yol}`);
      await m.page.waitForTimeout(1200);
      await denetle(m.page, `/${yol}`);
    }

    // ---------- Üye paneli ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: '05321112233', bitis: gun(20), baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const u = await sayfaAc(tel(), { tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [etk, etk2], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [], ayarlar: [] },
      rpc: { etkinlik_doluluk: () => [200, []] } }, oturum('uye-1', 'deniz@posta.test'));
    await u.page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    await denetle(u.page, 'üye: Karekodum');
    for (const t of ['Etkinlikler', 'Katıldıklarım', 'Üyeliğim', 'Profilim', 'Verilerim']) { await sekme(u.page, t); await denetle(u.page, `üye: ${t}`); }
    await sekme(u.page, 'Etkinlikler');
    await u.page.getByRole('button', { name: 'Randevu oluştur' }).first().click();
    await u.page.getByRole('button', { name: 'Ödemeye geç' }).click();
    const sepet = await u.page.locator('.fu-sepet').evaluate((e) => ({ h: e.getBoundingClientRect().height, ih: innerHeight }));
    dogru(sepet.h <= sepet.ih * 0.71, `üye: yapışkan sepet ekranın en fazla %70'i (${JSON.stringify(sepet)})`);
    await denetle(u.page, 'üye: sepet');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');

    // ---------- Yönetim paneli ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 8);
    v.tablolar.formlar = [FORM];
    const y = await sayfaAc(tel(), v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    await denetle(y.page, 'yönetim: Ana sayfa');
    const menu = await y.page.locator('nav[aria-label="Ana menü"]').evaluate((e) => e.getBoundingClientRect().height);
    dogru(menu < 160, `yönetim: menü telefonda derli toplu (${Math.round(menu)}px)`);
    for (const t of ['Üyeler', 'Etkinlikler', 'Muhasebe', 'Envanter', 'E-postalar', 'Başvurular', 'Formlar', 'İletişim']) { await sekme(y.page, t); await denetle(y.page, `yönetim: ${t}`); }
    await sekme(y.page, 'Üyeler');
    await y.page.getByRole('button', { name: 'Profil' }).first().click();
    await denetle(y.page, 'yönetim: üye profili');
    await sekme(y.page, 'Etkinlikler');
    await y.page.getByRole('button', { name: 'Yeni etkinlik' }).first().click();
    await denetle(y.page, 'yönetim: yeni etkinlik formu');
    await sekme(y.page, 'Formlar');
    await y.page.getByRole('button', { name: 'Yeni form' }).click();
    await denetle(y.page, 'yönetim: form düzenleyici');
    const soru = await y.page.getByLabel('Soru 1').evaluate((e) => e.getBoundingClientRect().width);
    dogru(soru > 200, `yönetim: soru metni alanı daralmıyor (${Math.round(soru)}px)`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
