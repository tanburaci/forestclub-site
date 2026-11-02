// İndirim kodu ekran görüntüleri (telefon + bilgisayar): sitede sepet (kod uygulanmış) ve Yönetim › Etkinlikler › İndirim kodları.
// Canlıya dokunmaz (sahte veri). EKRAN=<klasör> node indirim_ekran.js
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, yonetimVerisi, oturum, gun, SITE } = require('./tarayici/yardim.js');
const S = process.env.EKRAN;
const etk = { id: 7, tarih: gun(6), saat: '10.00', tur: 'yoga', ad: 'Yoga Sabahı', kim: 'Pelin', kontenjan: 12, bilet_fiyati: 1000,
  uyelere: 'yuzde50', satilan_bilet: 0, durum: 'yayinda', aciklama: 'Ağaçların altında sabah yogası.', link: null };
const kodlar = () => [
  { kod: 'FOREST20', tur: 'yuzde', deger: 20, son_tarih: gun(25), sinir: 50, kullanilan: 7, aktif: true, aciklama: 'Instagram reklamı', created_at: '2026-11-02T10:00:00Z' },
  { kod: 'YOGA500', tur: 'tl', deger: 500, son_tarih: null, sinir: null, kullanilan: 3, aktif: true, aciklama: 'Yoga grubu', created_at: '2026-11-01T10:00:00Z' },
  { kod: 'EKIM10', tur: 'yuzde', deger: 10, son_tarih: gun(-2), sinir: null, kullanilan: 12, aktif: false, aciklama: null, created_at: '2026-10-01T10:00:00Z' },
];
const dogru = (k, ad) => console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`);

(async () => {
  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: path.join(__dirname, '../deneme-site'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch();
  try {
    for (const [ad, boyut] of [['tel', { width: 390, height: 844 }], ['pc', { width: 1280, height: 860 }]]) {
      // ---------- Site: sepet, kod uygulanmış ----------
      const sv = { tablolar: { etkinlikler: [etk], ayarlar: [{ anahtar: 'yakinda', deger: false }] }, rpc: { etkinlik_doluluk: () => [200, []], sayac_artir: () => [200, null],
        indirim_kodu_bak: (g) => (g.p_kod === 'FOREST20' ? [200, { kod: 'FOREST20', tur: 'yuzde', deger: 20 }] : [400, { code: 'P0001', message: 'Bu indirim kodu geçerli değil.' }]) } };
      const s = await sayfaAc(tarayici, sv);
      await s.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
      await s.page.setViewportSize(boyut);
      await s.page.goto(`${SITE}/`);
      await s.page.getByRole('button', { name: 'Randevu oluştur' }).first().click();
      await s.page.getByRole('button', { name: /Randevuda 1 kişi/ }).first().click();
      await s.page.locator('.fs-sepet-dugme').click();
      const m = s.page.locator('.fs-modal');
      await m.getByRole('button', { name: 'Devam et' }).click();
      await m.getByLabel('Ad Soyad *').fill('Ayşe Yılmaz');
      await m.getByLabel(/E-posta \*/).fill('ayse@posta.test');
      await m.getByLabel('Telefon *').fill('0532 000 00 00');
      await m.locator('input[type="checkbox"]').check();
      await m.getByLabel('İndirim kodun var mı?').fill('forest20');
      await m.locator('.fs-kod').scrollIntoViewIfNeeded();
      await s.page.waitForTimeout(400);
      await s.page.screenshot({ path: `${S}/kod_${ad}_1_yazildi.png` });
      await m.getByRole('button', { name: 'Uygula' }).click();
      await m.getByText('FOREST20 uygulandı · %20 indirim').waitFor({ timeout: 5000 });
      await m.getByRole('radio', { name: /Havale \/ EFT/ }).click();
      await m.getByRole('button', { name: 'Devam · havale / EFT' }).scrollIntoViewIfNeeded();
      await s.page.waitForTimeout(400);
      await s.page.screenshot({ path: `${S}/kod_${ad}_2_uygulandi.png` });
      dogru(await m.locator('span', { hasText: /^1.600 TL$/ }).count() >= 1, `${ad}: sitede 2000 → 1600 TL`);
      dogru(!s.konsol.some((x) => /pageerror/.test(x)), `${ad}: site sayfa hatası yok`);
      await s.ctx.close();

      // ---------- Yönetim: İndirim kodları ----------
      const v = yonetimVerisi();
      v.tablolar.uyeler = v.tablolar.uyeler.slice(0, 5);
      v.tablolar.indirim_kodlari = kodlar();
      const yazilan = [];
      v.yaz = (yontem, tablo, u, govde) => {
        if (tablo !== 'indirim_kodlari') return null;
        yazilan.push([yontem, govde]);
        return [yontem === 'POST' ? 201 : 200, { kullanilan: 0, aktif: true, created_at: new Date().toISOString(), ...(typeof govde === 'string' ? JSON.parse(govde) : govde), kod: (u.searchParams.get('kod') || '').replace('eq.', '') || (typeof govde === 'string' ? JSON.parse(govde) : govde).kod }];
      };
      const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
      await y.page.unroute('https://fonts.googleapis.com/**').catch(() => {});
      await y.page.setViewportSize(boyut);
      await y.page.goto(`${SITE}/yonetim/`);
      await y.page.locator('button').filter({ hasText: /^Etkinlikler$/ }).first().click();
      const b = y.page.locator('.fc-kodlar');
      await b.getByText('FOREST20').waitFor({ timeout: 15000 });
      await b.getByLabel('Kod', { exact: true }).fill('yilbasi25');
      await b.getByLabel('İndirim (%)').fill('25');
      await b.getByLabel('Not (kimin için)').fill('Yılbaşı');
      await b.getByRole('button', { name: 'Kodu ekle' }).click();
      await b.getByText('YILBASI25 eklendi ✓').waitFor({ timeout: 5000 });
      const ekle = yazilan.find((x) => x[0] === 'POST');
      const g = ekle && (typeof ekle[1] === 'string' ? JSON.parse(ekle[1]) : ekle[1]);
      dogru(g && g.kod === 'YILBASI25' && g.tur === 'yuzde' && g.deger === 25, `${ad}: yönetimde kod eklendi (${JSON.stringify(g)})`);
      await b.scrollIntoViewIfNeeded();
      await y.page.waitForTimeout(400);
      await b.screenshot({ path: `${S}/kod_${ad}_3_yonetim.png` });
      dogru(!y.konsol.some((x) => /pageerror/.test(x)), `${ad}: yönetim sayfa hatası yok`);
      await y.ctx.close();
    }
  } finally {
    await tarayici.close();
    sunucu.kill();
  }
})();
