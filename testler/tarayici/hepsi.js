// Tarayıcı testlerinin hepsini sırayla çalıştırır (her biri kendi yerel sunucusunu açar). Biri kalırsa çıkış kodu 1.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dosyalar = fs.readdirSync(__dirname).filter((d) => /^p\d+_.*\.js$/.test(d)).sort();
const kalanlar = [];
for (const d of dosyalar) {
  console.log(`\n=== ${d}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, d)], { stdio: 'inherit' });
  if (r.status !== 0) kalanlar.push(d);
}
console.log(kalanlar.length ? `\nKalan: ${kalanlar.join(', ')}` : '\nBütün tarayıcı testleri geçti');
process.exit(kalanlar.length ? 1 : 0);
