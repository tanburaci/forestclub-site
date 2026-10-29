// Açılış öncesi düzeltmeler: kart kapalıyken site ve üye paneli havale + dekont der, test düğmesi ve boş iletişim
// yer tutucuları canlıda görünmez, yüklenen dekont incelemedeyken üyeye yeniden ödeme önerilmez, aidat ayardan gelir.
const { sayfaAc, gun, oturum, SITE } = require('./yardim.js');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const QG = require('fs').readFileSync(require.resolve('qrcode-generator/qrcode.js'));

const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: 600,
  uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Kahvaltı', link: null };

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Site: açık, kart kapalı, iletişimde yalnız e-posta ----------
    const s = await sayfaAc(tarayici, { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }, { anahtar: 'kart_odeme', deger: false },
      { anahtar: 'iletisim', deger: { eposta: 'forestcluburla@gmail.com', alan: 'Pinya, Urla', whatsapp: '', topluluk: '', instagram: '' } }] },
    rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null] } }, null);
    await s.page.goto(`${SITE}/`);
    await s.page.getByText('Aramıza katıl').first().waitFor({ timeout: 15000 });
    const govde = await s.page.evaluate(() => document.body.innerText);
    dogru(/aidatı havale \/ EFT ile gönder ve dekontunu yükle/.test(govde) && /ödemen onaylandığında başlar/.test(govde), 'kart kapalı: üyelik metinleri havale + dekont diyor');
    dogru(!/kartla öde; üyeliğin hemen başlar|kartla ödemeni yaptığın anda/.test(govde), 'kart kapalı: "kartla öde, hemen başlar" yok');
    dogru(!/\[WHATSAPP NUMARASI\]|\[WhatsApp topluluğu\]|\[Instagram\]/.test(govde), 'boş iletişim bilgileri yer tutucu göstermiyor');
    dogru(/Randevu oluştur/.test(await s.page.evaluate(() => document.documentElement.innerHTML)) && !/“Geliyorum” de/.test(govde), 'SSS "Randevu oluştur" diyor');
    dogru(!(await s.page.content()).includes('Önizleme: başarısız ödemeyi göster'), 'canlıda test düğmesi yok');
    dogru(!s.konsol.some((x) => /pageerror/.test(x)), 'site: sayfa hatası yok');

    // ---------- Üye paneli: dekont incelemede, aidat ayardan ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Ezgi Deneme', eposta: 'ezgi@posta.test', tel: null, bitis: null, baslangic: null, dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1', aidat_muaf: false };
    const uv = (bekliyor) => ({
      tablolar: { uyeler: [uye], odemeler: [], etkinlikler: [], etkinlik_kayitlari: [], anket_yanitlari: [], uyelik_dondurmalari: [],
        ayarlar: [{ anahtar: 'kart_odeme', deger: false }, { anahtar: 'aidat', deger: 3500 }] },
      rpc: { etkinlik_doluluk: () => [200, []], dekont_bekliyor: () => [200, bekliyor] },
    });
    for (const bekliyor of [true, false]) {
      const u = await sayfaAc(tarayici, uv(bekliyor), oturum('uye-1', 'ezgi@posta.test'));
      await u.page.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: QG }));
      await u.page.goto(`${SITE}/uye/`);
      await u.page.getByText('Merhaba Ezgi').waitFor({ timeout: 15000 });
      const m = await u.page.evaluate(() => document.body.innerText);
      if (bekliyor) {
        dogru(/Dekontun inceleniyor/.test(m) && /Onaylanınca üyeliğin başlar/.test(m), 'dekont incelemede: üyeye bildiriliyor');
        dogru(!/Üye ol · /.test(m), 'dekont incelemede: yeniden ödeme düğmesi yok');
      } else {
        dogru(/Üye ol · 3\.500 TL/.test(m), `aidat ayardan geliyor (3.500 TL)`);
        dogru(/dekontunu yükle; onaylanınca üyeliğin başlar/.test(m) && !/üyeliğin hemen başlar/.test(m), 'kart kapalı: üye paneli havale + dekont diyor');
      }
      dogru(!u.konsol.some((x) => /pageerror/.test(x)), `üye (${bekliyor ? 'dekont bekliyor' : 'ödeme yok'}): sayfa hatası yok`);
    }
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
