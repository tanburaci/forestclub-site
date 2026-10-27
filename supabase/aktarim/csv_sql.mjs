// Forest Club Urla · Google Sheets aktarımı, 1. adım: CSV dosyalarını aktarım tablosuna yükleyen SQL'e çevirir.
//
//   node supabase/aktarim/csv_sql.mjs <csv-klasörü>
//
// Klasördeki dosyalar adlarına göre tanınır (Sheets'te Dosya → İndir → CSV, her sayfa ayrı):
//   …uyeler… / …üyeler…            Üyeler
//   …dekont…                         Dekontlar
//   …cagri… / …çağrı…                Açık Çağrı Başvuruları
// Çıktı: supabase/aktarim/cikti/01_ham_veri.sql (gerçek kişisel veri içerir; .gitignore'da, depoya girmez).
// Sütun adları küçük harfe ve ASCII'ye çevrilir ("Ödeme onay tarihi" → odeme_onay_tarihi); hangi sütunun nereye
// gideceğini 02_aktar.sql belirler. Bağımlılık yok (Node 18+).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SAYFALAR = [
  { sayfa: 'uyeler', desen: /uyeler/, beklenen: ['ad_soyad', 'telefon', 'e_posta', 'basvuru_tarihi', 'odeme_onay_tarihi', 'uyelik_bitisi', 'durum', 'son_hatirlatma', 'fotograf_video_izinleri'] },
  { sayfa: 'dekontlar', desen: /dekont/, beklenen: [] },
  { sayfa: 'acik_cagri', desen: /cagri/, beklenen: [] },
];

export function sade(s) {
  return String(s || '').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// RFC 4180 CSV: tırnaklı alan, alan içinde satır sonu ve "" kaçışı. Ayırıcı başlık satırından seçilir (, ; sekme).
export function csvOku(metin) {
  metin = metin.replace(/^﻿/, '');
  const ilkSatir = metin.split(/\r?\n/, 1)[0];
  const ayirici = [',', ';', '\t'].map((a) => [a, ilkSatir.split(a).length]).sort((x, y) => y[1] - x[1])[0][0];
  const satirlar = [];
  let satir = [];
  let alan = '';
  let tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) {
      if (c === '"' && metin[i + 1] === '"') { alan += '"'; i++; } else if (c === '"') tirnak = false; else alan += c;
    } else if (c === '"' && alan === '') tirnak = true;
    else if (c === ayirici) { satir.push(alan); alan = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && metin[i + 1] === '\n') i++;
      satir.push(alan); satirlar.push(satir); satir = []; alan = '';
    } else alan += c;
  }
  if (alan !== '' || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar;
}

export function kayitlar(metin) {
  const [baslik = [], ...govde] = csvOku(metin);
  const anahtarlar = [];
  baslik.forEach((b) => {
    let k = sade(b) || 'sutun';
    while (anahtarlar.includes(k)) k += '_2';
    anahtarlar.push(k);
  });
  const sonuc = [];
  govde.forEach((h, i) => {
    if (!h.some((x) => x.trim() !== '')) return;  // boş satır
    sonuc.push({ satir: i + 2, veri: Object.fromEntries(anahtarlar.map((k, j) => [k, (h[j] ?? '').trim()])) });
  });
  return { anahtarlar, sonuc };
}

function main() {
  const klasor = process.argv[2];
  if (!klasor || !fs.existsSync(klasor)) {
    console.error('Kullanım: node supabase/aktarim/csv_sql.mjs <csv-klasörü>');
    process.exit(1);
  }
  const dosyalar = fs.readdirSync(klasor).filter((d) => d.toLowerCase().endsWith('.csv'));
  const etiket = `$fc${crypto.randomBytes(4).toString('hex')}$`;
  const parcalar = [
    '-- Forest Club Urla · Sheets aktarımı ham verisi (üretildi: ' + new Date().toISOString() + '). GERÇEK KİŞİSEL VERİ: paylaşmayın.',
    'create schema if not exists aktarim;',
    'create table if not exists aktarim.ham (sayfa text not null, satir int not null, veri jsonb not null, primary key (sayfa, satir));',
    'truncate aktarim.ham;',
  ];
  let hata = false;
  for (const s of SAYFALAR) {
    const dosya = dosyalar.find((d) => s.desen.test(sade(d)));
    if (!dosya) {
      console.log(`${s.sayfa}: CSV bulunamadı${s.sayfa === 'uyeler' ? ' (ZORUNLU)' : ' (atlandı)'}`);
      if (s.sayfa === 'uyeler') hata = true;
      continue;
    }
    const { anahtarlar, sonuc } = kayitlar(fs.readFileSync(path.join(klasor, dosya), 'utf8'));
    const eksik = s.beklenen.filter((k) => !anahtarlar.includes(k));
    console.log(`${s.sayfa}: ${dosya} · ${sonuc.length} satır · sütunlar: ${anahtarlar.join(', ')}`);
    if (eksik.length) console.log(`  UYARI: beklenen sütun yok: ${eksik.join(', ')} (02_aktar.sql'deki eş adlara bakın)`);
    for (const r of sonuc) {
      const j = JSON.stringify(r.veri);
      if (j.includes(etiket)) throw new Error('Beklenmeyen içerik');
      parcalar.push(`insert into aktarim.ham values ('${s.sayfa}', ${r.satir}, ${etiket}${j}${etiket}::jsonb);`);
    }
  }
  if (hata) process.exit(1);
  const cikti = path.join(path.dirname(new URL(import.meta.url).pathname), 'cikti');
  fs.mkdirSync(cikti, { recursive: true });
  fs.writeFileSync(path.join(cikti, '01_ham_veri.sql'), parcalar.join('\n') + '\n');
  console.log(`Yazıldı: ${path.join(cikti, '01_ham_veri.sql')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
