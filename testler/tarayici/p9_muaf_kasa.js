// Aidattan muaf üyeler ve kasa: Yönetim › Üyeler › Profil'de "Aidattan muaf" işareti uyeler.aidat_muaf'a yazılır,
// muaf üye listede "Süresiz · Aidattan muaf" görünür; üye panelinde ödeme / dondurma istenmez. Muhasebe'de canlıda
// örnek açılış bakiyesi yok: banka ve nakit yalnız kayıtlı hareketlerden.
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const QG = require('fs').readFileSync(require.resolve('qrcode-generator/qrcode.js'));
const aidat = (id, ad) => ({ id, tarih: gun(-id), tur: 'gelir', tutar: 3000, kasa: 'banka', hedef_kasa: null, kategori: 'Aidat', etkinlik_id: null,
  aciklama: `Aidat · ${ad}`, belge: null, otomatik: true, odeme: null, fatura_durum: null, fatura_no: null, fatura_tarih: null });

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetim ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 6);
    Object.assign(v.tablolar.uyeler[3], { ad: 'Pelin Muaf', aidat_muaf: true, bitis: '2099-12-31' });
    v.tablolar.muhasebe_hareketleri = [aidat(1, 'Ezgi'), aidat(2, 'Oya'), aidat(3, 'Can')];
    const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    await y.page.goto(`${SITE}/yonetim/`);
    await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    // Ana sayfadaki "Başvurular" düğmesi Başvurular sekmesini açar (eskiden boş bağlantıydı)
    await y.page.locator('button.fc-btn', { hasText: /^Başvurular$/ }).click();
    dogru(await y.page.getByText('Havale dekontları ve Açık Çağrı başvuruları').isVisible({ timeout: 3000 }).catch(() => false), 'ana sayfa "Başvurular" düğmesi sekmeyi açıyor');

    await sekme(y.page, 'Muhasebe');
    await y.page.getByText('Aidatların geldiği hesap').waitFor({ timeout: 5000 });
    const kart = (alt) => y.page.getByText(alt, { exact: true }).locator('..').innerText();
    const banka = await kart('Aidatların geldiği hesap');
    const nakit = await kart('Kasada duran para');
    dogru(banka.includes('9.000 TL'), `banka yalnız kayıtlı aidatlar: 3 × 3.000 = 9.000 TL (${banka.replace(/\s+/g, ' ')})`);
    dogru(nakit.includes('0 TL') && !nakit.includes('1.000'), `nakit örnek açılış bakiyesi yok (${nakit.replace(/\s+/g, ' ')})`);

    await sekme(y.page, 'Üyeler');
    const satirlar = y.page.locator('table.fc-tablo tbody tr');
    const pelin = satirlar.filter({ hasText: 'Pelin Muaf' });
    await pelin.waitFor({ timeout: 5000 });
    const pm = await pelin.innerText();
    dogru(pm.includes('Süresiz') && pm.includes('Aidattan muaf') && !pm.includes('2099'), `muaf üye listede süresiz (${pm.replace(/\s+/g, ' ')})`);

    // Üye 5'i muaf yap, Pelin'in muafiyetini kaldır
    await satirlar.filter({ hasText: 'Üye 5' }).getByRole('button', { name: 'Profil' }).click();
    const kutu = y.page.getByRole('checkbox', { name: /Aidattan muaf/ });
    dogru(!(await kutu.isChecked()), 'muaf olmayan üyede işaret boş');
    await kutu.check();
    await satirlar.filter({ hasText: 'Üye 5' }).filter({ hasText: 'Aidattan muaf' }).waitFor({ timeout: 3000 });
    await y.page.getByRole('button', { name: 'Kapat' }).click();
    await pelin.getByRole('button', { name: 'Profil' }).click();
    dogru(await kutu.isChecked(), 'muaf üyede işaret dolu');
    await kutu.uncheck();
    await y.page.waitForTimeout(600);
    const pm2 = await pelin.innerText();
    dogru(!pm2.includes('Aidattan muaf') && !pm2.includes('2099') && pm2.includes('Aktif'), `muafiyet kalkınca 30 gün aktif (${pm2.replace(/\s+/g, ' ')})`);
    const yazilan = y.istekler.filter((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/uyeler');
    const p5 = yazilan.find((x) => /id=eq\.5\b/.test(x.ara));
    const p4 = yazilan.find((x) => /id=eq\.4\b/.test(x.ara));
    dogru(p5 && p5.govde.aidat_muaf === true, `Üye 5 aidat_muaf = true yazıldı (${JSON.stringify(p5 && p5.govde)})`);
    dogru(p4 && p4.govde.aidat_muaf === false, `Pelin aidat_muaf = false yazıldı (${JSON.stringify(p4 && p4.govde)})`);
    dogru(!y.konsol.some((x) => /pageerror/.test(x)), 'yönetim: sayfa hatası yok');

    // ---------- Üye paneli: muaf üye ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Ezgi Muaf', eposta: 'ezgi@posta.test', tel: null, bitis: '2099-12-31', baslangic: gun(-10), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1', aidat_muaf: true };
    const uv = {
      tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [],
        ayarlar: [{ anahtar: 'kart_odeme', deger: true }] },
      rpc: { etkinlik_doluluk: () => [200, []] },
    };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'ezgi@posta.test'));
    await u.page.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: QG }));
    await u.page.route(`${SB}/auth/v1/user`, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'ezgi@posta.test', aud: 'authenticated' }) }));
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Ezgi').waitFor({ timeout: 15000 });
    dogru(await u.page.getByText('Üyeliğin aktif · aidattan muafsın').count() === 1, 'ana sayfa: aidattan muaf');
    await sekme(u.page, 'Üyeliğim');
    await u.page.getByText('aidattan muafsın', { exact: false }).first().waitFor({ timeout: 3000 });
    const govde = await u.page.evaluate(() => document.body.innerText);
    dogru(!/Kartla yenile|Üye ol · 3\.000|Yenile · havale/.test(govde), 'muaf üyeye ödeme düğmesi yok');
    dogru(!govde.includes('gün kaldı') && !govde.includes('2099'), 'kalan gün / 2099 görünmüyor');
    dogru(!govde.includes('Üyeliğimi dondur'), 'dondurma önerilmiyor');
    dogru(!u.konsol.some((x) => /pageerror/.test(x)), 'üye: sayfa hatası yok');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
