// Forest Club Urla · yerel önizleme: siteyi bilgisayarda, canlı veritabanına HİÇ yazmadan açar.
// Canlı düğün kataloğu yalnız ziyaretçi anahtarıyla OKUNUR, kopyası sahte veritabanına konur; bekleyen göçlerin düğün
// değişiklikleri (yeni kalemler, fotoğraflar, başlangıç maliyetleri) göç dosyasından okunup bu kopyaya uygulanır.
// Yönetim paneli (sahte yönetici oturumu) ve /dugun/ sayfası görünür bir tarayıcıda açılır; kaydedilen her şey yalnız
// bu pencerede kalır, kapatınca silinir.
// Çalıştırma: cd testler && node yerel_onizleme.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { sayfaAc, yonetimVerisi, oturum, SITE } = require('./tarayici/yardim.js');

const KOK = path.join(__dirname, '..');
const DENEME = path.join(KOK, 'deneme-site');
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const ANAHTAR = /supabaseAnahtar:\s*'([^']+)'/.exec(fs.readFileSync(path.join(DENEME, 'js/ayar.js'), 'utf8'))[1];
const GOC = fs.readFileSync(path.join(KOK, 'supabase/migrations/20261202000000_dugun_maliyet.sql'), 'utf8');

// Göçteki VALUES bloklarını okur: "('a', 'b', 3)" → ['a', 'b', 3]
function degerler(baslangic) {
  const i = GOC.indexOf(baslangic);
  const blok = GOC.slice(i, GOC.indexOf(') as ', i));
  return [...blok.matchAll(/\(\s*('(?:[^']|'')*'(?:\s*,\s*(?:'(?:[^']|'')*'|null(?:::numeric)?|[\d.]+(?:::numeric)?))*)\s*\)/g)].map((m) =>
    [...m[1].matchAll(/'((?:[^']|'')*)'|(null)(?:::numeric)?|([\d.]+)(?:::numeric)?/g)].map((x) => (x[1] !== undefined ? x[1].replace(/''/g, "'") : x[2] ? null : Number(x[3]))));
}

async function canliKatalog() {
  const r = await fetch(`${SB}/rest/v1/dugun_katalog?select=*&order=tur,sira,id`, { headers: { apikey: ANAHTAR, Authorization: `Bearer ${ANAHTAR}` } });
  if (!r.ok) throw new Error(`Canlı katalog okunamadı (${r.status})`);
  return r.json();
}

(async () => {
  const katalog = await canliKatalog();
  let yeniId = Math.max(0, ...katalog.map((k) => k.id)) + 1;
  for (const [grup, ad, sira] of degerler("insert into public.dugun_katalog (tur, grup, ad, sira)")) {
    if (!katalog.some((k) => k.tur === 'urun' && k.grup === grup && k.ad === ad)) {
      katalog.push({ id: yeniId++, tur: 'urun', grup, ad, sira, aciklama: null, resim: null, mekan_id: null, yemek_mekandan: true, renkler: null, acik: true });
    }
  }
  for (const [grup, ad, dosya] of degerler("update public.dugun_katalog k set resim")) {
    const k = katalog.find((x) => x.tur === 'urun' && x.grup === grup && x.ad === ad);
    if (k && (!k.resim || k.resim.startsWith('/dugun/cizim/'))) k.resim = `/dugun/foto/${dosya}`;
  }
  const maliyetler = [];
  for (const [grup, ad, alis, kira, esas, birim, notlar] of degerler("insert into public.dugun_maliyetler (katalog_id")) {
    const k = katalog.find((x) => x.tur === 'urun' && x.grup === grup && x.ad === ad);
    if (k) maliyetler.push({ katalog_id: k.id, alis, kira, esas, kar_yuzde: null, birim, tedarikci: null, notlar });
  }
  const fiyatlar = [];
  // ORNEK_KAR=40 node yerel_onizleme.js → maliyeti bilinen ürünlere örnek kâr (yalnız bu pencerede)
  const ornekKar = Number(process.env.ORNEK_KAR);
  if (ornekKar >= 0) {
    for (const m of maliyetler) {
      const esas = m.esas === 'kira' ? m.kira : m.alis;
      if (esas == null) continue;
      m.kar_yuzde = ornekKar;
      fiyatlar.push({ katalog_id: m.katalog_id, fiyat: Math.round(esas * (1 + ornekKar / 100)), birim: m.birim });
    }
    console.log(`Örnek kâr %${ornekKar}: ${fiyatlar.length} üründe fiyat.`);
  }
  console.log(`Canlı katalog kopyası: ${katalog.length} kalem, ${maliyetler.length} başlangıç maliyeti. Canlıya hiçbir şey yazılmaz.`);

  const v = yonetimVerisi();
  Object.assign(v.tablolar, { dugun_katalog: () => katalog, dugun_maliyetler: () => maliyetler, dugun_fiyatlar: () => fiyatlar,
    dugun_talepleri: [], dugun_davetleri: [], dugun_envanter: [], dugun_envanter_hareketleri: [] });
  Object.assign(v.rpc, {
    dugun_fiyatlari: () => [200, fiyatlar.filter((f) => (katalog.find((k) => k.id === f.katalog_id) || {}).acik)],
    dugun_davet_bilgi: () => [200, []],
    sayac_artir: () => [200, null],
    etkinlik_doluluk: () => [200, []],
    // Sunucudaki dugun_maliyet_kaydet ile aynı kural
    dugun_maliyet_kaydet: ({ p }) => {
      const m = { katalog_id: p.katalog_id, alis: p.alis, kira: p.kira, esas: p.esas || 'kira', kar_yuzde: p.kar_yuzde, birim: p.birim || 'adet',
        tedarikci: p.tedarikci || null, notlar: p.notlar || null };
      const i = maliyetler.findIndex((x) => x.katalog_id === m.katalog_id);
      if (i >= 0) maliyetler[i] = m; else maliyetler.push(m);
      const esas = m.esas === 'kira' ? m.kira : m.alis;
      const j = fiyatlar.findIndex((x) => x.katalog_id === m.katalog_id);
      if (j >= 0) fiyatlar.splice(j, 1);
      if (esas != null && m.kar_yuzde != null) {
        const fiyat = Math.round(esas * (1 + m.kar_yuzde / 100));
        fiyatlar.push({ katalog_id: m.katalog_id, fiyat, birim: m.birim });
        return [200, { fiyat }];
      }
      return [200, { fiyat: null }];
    },
  });
  v.yaz = (yontem, tablo, u, govde) => {
    if (tablo !== 'dugun_katalog') return null;
    const id = Number((/id=eq\.(\d+)/.exec(u.search) || [])[1]);
    if (yontem === 'PATCH') { const k = katalog.find((x) => x.id === id); Object.assign(k, govde); return [200, k]; }
    if (yontem === 'POST') { const k = { id: yeniId++, ...govde }; katalog.push(k); return [201, k]; }
    if (yontem === 'DELETE') { katalog.splice(katalog.findIndex((x) => x.id === id), 1); return [200, { id }]; }
    return null;
  };

  const sunucu = require('child_process').spawn('python3', ['-m', 'http.server', '8090', '--bind', '127.0.0.1'], { cwd: DENEME, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const tarayici = await chromium.launch({ headless: false, args: ['--window-size=1280,900'] });
  const kapat = () => { sunucu.kill(); process.exit(0); };
  tarayici.on('disconnected', kapat);
  process.on('SIGINT', () => tarayici.close().finally(kapat));

  const y = await sayfaAc(tarayici, v, oturum('yon-1', 'yonetici@posta.test'));
  await y.page.setViewportSize({ width: 1280, height: 860 });
  await y.page.goto(`${SITE}/yonetim/`);
  await y.page.getByText('Üyelik ödemeleri').waitFor({ timeout: 20000 });
  await y.page.locator('button').filter({ hasText: /^Düğün$/ }).first().click().catch(() => {});
  await y.page.waitForTimeout(800);
  await y.page.locator('button').filter({ hasText: /^Maliyet$/ }).first().click().catch(() => {});

  const d = await sayfaAc(tarayici, v, null);  // aynı sahte veritabanı: yönetimde kaydedilen fiyat burada görünür
  await d.page.goto(`${SITE}/dugun/`);
  await d.page.bringToFront();
  console.log('Pencere açık: önde /dugun/ (müşteri), diğer pencerede yönetim › Düğün › Maliyet. Yönetimde kaydedilen fiyatı görmek için düğün sayfasını yenileyin.');
  console.log('Kapatmak için tarayıcı penceresini kapatın.');
})().catch((h) => { console.error('Önizleme açılamadı:', h.message); process.exit(1); });
