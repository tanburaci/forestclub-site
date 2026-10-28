// PR 3 tarayıcı testleri: yönetici paneli (aynı adlı etkinlik, kontenjan ve yoklama sunucuda, iptal duyurusu, mail
// geçmişi ve sağlık, deneme maili, şablon sıfırlama, CSV, dekont reddi) ve üye paneli (ödeme etiketi, şifre akışı,
// canlıda önizleme öğeleri).
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./yardim.js');
const fs = require('fs');
const { chromium } = require('playwright');
let kalan = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) kalan++; };
const sekme = (page, ad) => page.locator('button').filter({ hasText: new RegExp(`^${ad}$`) }).first().click();

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    // ---------- Yönetici ----------
    const v = yonetimVerisi();
    v.tablolar.uyeler[9].ad = '=1+1';
    v.tablolar.eposta_sablonlari = [
      { id: 'basvuru', ad: 'Başvuru alındı', ne_zaman: 'x', acik: true, gun: null, konu: 'Konu', metin: 'Değişmiş metin', varsayilan_konu: 'Konu', varsayilan_metin: 'İLK METİN', alanlar: ['ad'] },
      { id: 'duyuru', ad: 'Etkinlik duyurusu', ne_zaman: 'x', acik: true, gun: null, konu: 'Duyuru', metin: 'd', varsayilan_konu: 'Duyuru', varsayilan_metin: 'd', alanlar: ['ad'] },
    ];
    v.tablolar.eposta_kuyrugu = [
      { id: 2, sablon: 'basvuru', alici: 'a@posta.test', durum: 'hata', deneme: 5, son_hata: 'Resend 500', created_at: new Date().toISOString(), gonderim_at: null },
      { id: 1, sablon: 'basvuru', alici: 'b@posta.test', durum: 'gonderildi', deneme: 1, son_hata: null, created_at: new Date().toISOString(), gonderim_at: new Date().toISOString() },
    ];
    v.tablolar.muhasebe_hareketleri = [{ id: 7, tarih: gun(-1), tur: 'gelir', tutar: 3000, kasa: 'banka', hedef_kasa: null, kategori: 'Aidat', etkinlik_id: null, aciklama: 'Aidat · Üye 4', belge: 'dekont:1', otomatik: true, odeme: 'havale' }];
    v.tablolar.dekontlar = [{ id: 31, uye_id: 4, eposta: 'u4@ornek.com', ad: 'Üye 4', odeme_tarihi: gun(0), tutar: 3000, dosya: 'yeni/x.pdf', durum: 'bekliyor', created_at: new Date().toISOString() }];
    const liste = (kontenjan, gelen = []) => ({ kontenjan, kayitli: [2, 5, 7], bekleme: [], gelen });
    Object.assign(v.rpc, {
      saglik_ozeti: () => [200, { sorun: true, satirlar: ['1 mail gönderilemedi (kalıcı hata).'] }],
      kontenjan_degistir: (g) => { v.rpcler.push(['kontenjan_degistir', g]); return [200, liste(g.p_kontenjan)]; },
      yoklama_isaretle: (g) => { v.rpcler.push(['yoklama_isaretle', g]); return [200, liste(30, g.p_geldi ? [g.p_uye] : [])]; },
      etkinlik_durum_degistir: (g) => { v.rpcler.push(['etkinlik_durum_degistir', g]); return [200, { durum: 'iptal', tarih: gun(10), eski_tarih: null, kisi: 2, mail: 2 }]; },
      eposta_yeniden_dene: (g) => { v.rpcler.push(['eposta_yeniden_dene', g]); return [200, null]; },
      eposta_deneme: (g) => { v.rpcler.push(['eposta_deneme', g]); return [200, 9]; },
      dekont_karar: (g) => { v.rpcler.push(['dekont_karar', g]); return [200, { durum: 'reddedildi' }]; },
    });
    const { page, istekler, konsol } = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
    page.on('dialog', (d) => d.accept('Tutar eksik.'));
    await page.goto(`${SITE}/yonetim/`);
    await page.getByText('Üyelik ödemeleri').waitFor({ timeout: 15000 });
    dogru(await page.getByText('Havale · dekont').count() > 0, 'son ödemelerde havale "Havale · dekont" görünüyor');

    await sekme(page, 'Etkinlikler');
    await page.getByRole('button', { name: 'Yeni etkinlik' }).last().click();
    await page.locator('input[type=date]').first().fill(gun(10));
    await page.locator('input[placeholder="Örn. Sunset Club"]').fill('Breakfast Club');
    await page.getByRole('button', { name: 'Etkinliği kaydet' }).click();
    await page.getByText('Bu tarihte aynı adla bir etkinlik zaten var').waitFor({ timeout: 3000 });
    dogru(!istekler.some((x) => x.yol === '/rest/v1/etkinlikler' && x.yontem === 'POST'), 'aynı gün aynı adla etkinlik reddedildi, veritabanına gitmedi');
    await page.getByRole('button', { name: 'Vazgeç' }).first().click().catch(() => {});
    await page.locator('input[type=number][min="1"]').first().fill('35');
    await page.waitForTimeout(1300);
    const kont = v.rpcler.filter((x) => x[0] === 'kontenjan_degistir');
    dogru(kont.length === 1 && kont[0][1].p_kontenjan === 35 && kont[0][1].p_etkinlik === 10, `kontenjan sunucuda (${JSON.stringify(kont)})`);
    dogru(!istekler.some((x) => x.yol === '/rest/v1/etkinlik_kayitlari' && x.yontem !== 'GET'), 'kayıt tablosuna doğrudan yazılmadı');
    dogru(await page.getByText('3 üye · 32 yer var').count() === 1, 'sunucunun döndürdüğü liste panelde (3 üye)');

    await page.getByRole('button', { name: 'Katılımcılar · yoklama' }).first().click();
    await page.getByRole('button', { name: 'Gelmedi' }).first().click();
    await page.waitForTimeout(500);
    const yok = v.rpcler.find((x) => x[0] === 'yoklama_isaretle');
    dogru(yok && yok[1].p_geldi === true && yok[1].p_etkinlik === 10, `yoklama sunucuda (${JSON.stringify(yok && yok[1])})`);

    await page.getByRole('button', { name: 'İptal / ertele' }).first().click();
    await page.getByRole('button', { name: 'İptal et' }).click();
    await page.getByRole('button', { name: 'Duyur', exact: true }).click();
    await page.getByText(/ve 2 kişiye maille gidiyor/).waitFor({ timeout: 5000 });
    const ip = v.rpcler.find((x) => x[0] === 'etkinlik_durum_degistir');
    dogru(ip && /iptal edildi/.test(ip[1].p_duyuru), `iptal duyuru metni sunucuya gitti (${ip && ip[1].p_duyuru})`);
    await page.getByRole('button', { name: 'Duyuruyu düzenle' }).first().click();
    dogru(await page.locator('input[value="Duyuru"]').count() === 1 || (await page.locator('input.fc-input').evaluateAll((x) => x.map((i) => i.value))).includes('Duyuru'), '"Duyuruyu düzenle" duyuru şablonunu açtı');

    await sekme(page, 'Etkinlikler');
    await page.getByRole('button', { name: 'Yeni etkinlik' }).last().click();
    await page.locator('input[type=date]').first().fill(gun(10));
    await page.locator('input[placeholder="Örn. Sunset Club"]').fill('Sunset Club');
    await page.locator('textarea[placeholder^="Ne olacak"]').fill('Gün batımı buluşması.');
    await page.locator('input[placeholder^="https://www.instagram.com"]').fill('https://www.instagram.com/p/abc/');
    await page.getByRole('button', { name: 'Etkinliği kaydet' }).click();
    await page.waitForTimeout(700);
    const ekle = istekler.find((x) => x.yol === '/rest/v1/etkinlikler' && x.yontem === 'POST');
    dogru(ekle && ekle.govde.aciklama === 'Gün batımı buluşması.' && ekle.govde.link === 'https://www.instagram.com/p/abc/', `yeni etkinliğin açıklaması ve bağlantısı yazıldı (${JSON.stringify(ekle && ekle.govde)})`);

    await sekme(page, 'E-postalar');
    dogru(await page.getByText('Otomatik işlerde sorun var (son 24 saat)').count() === 1 && await page.getByText('1 mail gönderilemedi (kalıcı hata).').count() === 1, 'sağlık uyarısı görünüyor');
    dogru(await page.getByText('Son 2 mail: 1 gönderildi · 0 sırada · 1 hata · 0 atlandı').count() === 1, 'gönderim geçmişi özeti');
    await page.getByRole('button', { name: 'Yeniden dene' }).click();
    await page.waitForTimeout(400);
    dogru(v.rpcler.some((x) => x[0] === 'eposta_yeniden_dene' && x[1].p_id === 2) && await page.getByRole('button', { name: 'Yeniden dene' }).count() === 0, 'hatalı mail yeniden sıraya alındı');
    await page.locator('nav[aria-label="Şablonlar"] button').filter({ hasText: 'Başvuru alındı' }).click();
    await page.getByRole('button', { name: 'İlk hâline döndür' }).click();
    dogru(await page.locator('textarea').evaluateAll((t) => t.some((x) => x.value === 'İLK METİN')), 'şablon veritabanındaki ilk metne döndü');
    await page.getByRole('button', { name: 'Bana deneme maili gönder' }).click();
    await page.getByText(/Deneme maili yonetici@posta.test adresine sıraya alındı/).waitFor({ timeout: 4000 });
    const kayit = istekler.find((x) => x.yontem === 'PATCH' && x.yol === '/rest/v1/eposta_sablonlari');
    dogru(kayit && kayit.govde.metin === 'İLK METİN' && v.rpcler.some((x) => x[0] === 'eposta_deneme' && x[1].p_sablon === 'basvuru'), 'deneme maili: önce şablon kaydedildi, sonra gerçek gönderim');

    await sekme(page, 'Üyeler');
    const [indirme] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Listeyi indir (CSV)' }).click()]);
    const csv = fs.readFileSync(await indirme.path(), 'utf8');
    const satir = csv.split('\r\n');
    dogru(csv.charCodeAt(0) === 0xFEFF && satir[0].startsWith('﻿Kod;Ad Soyad;E-posta') && satir.length === 1502, `CSV: BOM, başlık ve 1500 satır (${satir.length})`);
    dogru(csv.includes(";'=1+1;"), 'CSV: formül gibi başlayan hücre metne çevrildi');

    await sekme(page, 'Başvurular');
    await page.getByRole('button', { name: /Reddet/ }).first().click();
    await page.waitForTimeout(500);
    const red = v.rpcler.find((x) => x[0] === 'dekont_karar');
    dogru(red && red[1].p_onay === false && red[1].p_not === 'Tutar eksik.', `dekont reddi gerekçeyle (${JSON.stringify(red && red[1])})`);
    dogru(!konsol.some((x) => /pageerror/.test(x)), `yönetici: sayfa hatası yok ${konsol.filter((x) => /pageerror/.test(x)).join(' | ')}`);

    // ---------- Üye ----------
    const uye = { id: 1, kod: 'FC-U-0001', ad: 'Deniz Yılmaz', eposta: 'deniz@posta.test', tel: null, bitis: gun(5), baslangic: gun(-25), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, user_id: 'uye-1' };
    const etk = { id: 3, tarih: gun(4), saat: '10.00', tur: 'bulusma', ad: 'Yoga', kontenjan: 20, bilet_fiyati: 400, uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda' };
    const gecmisEtk = { id: 2, tarih: gun(-3), saat: '10.00', tur: 'bulusma', ad: 'Eski', kontenjan: 20, bilet_fiyati: null, uyelere: null, satilan_bilet: 0, durum: 'yayinda' };
    const uv = { tablolar: { uyeler: [uye], odemeler: [{ id: 1, uye_id: 1, tarih: gun(-25), tutar: 2500, yol: 'havale' }], etkinlik_kayitlari: [{ etkinlik_id: 2, uye_id: 1, durum: 'kayitli', geldi: true }], etkinlikler: [gecmisEtk, etk] },
      rpc: { etkinlik_doluluk: () => [200, []] } };
    const u = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await u.page.route('https://gflabqnazkstsyafzdmn.supabase.co/auth/v1/user', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }));
    await u.page.goto(`${SITE}/uye/`);
    await u.page.getByText('Merhaba Deniz').waitFor({ timeout: 15000 });
    await sekme(u.page, 'Etkinlikler');
    dogru(await u.page.getByRole('button', { name: 'Bilet satışı yakında' }).first().isDisabled(), 'canlıda bilet sepeti kapalı');
    await sekme(u.page, 'Katıldıklarım');
    dogru(await u.page.getByText('Eski').count() > 0 && await u.page.getByRole('button', { name: 'Fotoğraflar' }).count() === 0, 'canlıda galeri yer tutucusu yok');
    await sekme(u.page, 'Üyeliğim');
    dogru(await u.page.getByText(/Havale · dekont/).count() === 1 && await u.page.getByText('2.500 TL').count() === 1, 'ödeme geçmişi: havale ve gerçek tutar');
    await sekme(u.page, 'Profilim');
    await sekme(u.page, 'Üyeliğim');
    await u.page.getByRole('button', { name: 'Yenile · havale / EFT' }).click();
    await u.page.waitForURL(/\/dekont$/, { timeout: 5000 });
    dogru(true, 'canlıda yenileme havale + dekont sayfasına götürdü');

    // Şifre sıfırlama bağlantısıyla gelen üye yeni şifresini belirler
    const s2 = await sayfaAc(tarayici, uv, oturum('uye-1', 'deniz@posta.test'));
    await s2.page.route('https://gflabqnazkstsyafzdmn.supabase.co/auth/v1/user', (r) => { s2.istekler.push({ yol: 'user', yontem: r.request().method(), govde: r.request().postDataJSON() }); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'uye-1', email: 'deniz@posta.test', aud: 'authenticated' }) }); });
    await s2.page.goto(`${SITE}/uye/#type=recovery`);
    await s2.page.getByText('Yeni şifreni belirle.').waitFor({ timeout: 15000 });
    await s2.page.locator('input[autocomplete="new-password"]').nth(0).fill('kisa');
    await s2.page.locator('input[autocomplete="new-password"]').nth(1).fill('kisa');
    await s2.page.getByRole('button', { name: 'Şifremi kaydet' }).click();
    await s2.page.getByText('Şifre en az 8 karakter').waitFor({ timeout: 3000 });
    await s2.page.locator('input[autocomplete="new-password"]').nth(0).fill('ormanda2026');
    await s2.page.locator('input[autocomplete="new-password"]').nth(1).fill('ormanda2026');
    await s2.page.getByRole('button', { name: 'Şifremi kaydet' }).click();
    await s2.page.waitForTimeout(1200);
    dogru(s2.istekler.some((x) => x.yol === 'user' && x.yontem === 'PUT' && x.govde.password === 'ormanda2026'), 'sıfırlama bağlantısıyla yeni şifre kaydedildi');

    // Deneme hesapları: yayında (deneme: false) gizli; yalnız deneme: true iken görünür
    const g1 = await sayfaAc(tarayici, uv, null);
    await g1.page.goto(`${SITE}/uye/`);
    await g1.page.getByText('E-postana gelen giriş bağlantısıyla ya da şifrenle gir.').waitFor({ timeout: 15000 });
    dogru(await g1.page.getByText('Deneme hesapları').count() === 0, 'yayında deneme hesapları gizli');
    const g2 = await sayfaAc(tarayici, uv, null);
    await g2.page.route(`${SITE}/js/ayar.js**`, async (r) => { const y = await r.fetch(); r.fulfill({ response: y, body: (await y.text()).replace('deneme: false', 'deneme: true') }); });
    await g2.page.goto(`${SITE}/uye/`);
    await g2.page.getByText('E-postana gelen giriş bağlantısıyla ya da şifrenle gir.').waitFor({ timeout: 15000 });
    dogru(await g2.page.getByText('Deneme hesapları').count() === 1, 'deneme: true iken deneme hesapları görünüyor');
  } catch (h) {
    console.log('HATA', h.message.split('\n').slice(0, 4).join(' | ')); kalan++;
  } finally {
    await tarayici.close(); sunucu.kill();
  }
  console.log(kalan ? `${kalan} test kaldı` : 'Hepsi geçti');
  process.exit(kalan ? 1 : 0);
})();
