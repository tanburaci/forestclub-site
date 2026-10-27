// Forest Club Urla · tasarım sayfalarının (deneme-site/sayfalar/*.dc.html) betiğini ayrı bir .dc.js dosyasına çıkarır.
// Tarayıcı betiği böylece dosyadan yükler; dc.js'te new Function (CSP 'unsafe-eval') gerekmez.
// Kullanım: node araclar/dc_derle.mjs            → .dc.js dosyalarını yazar
//           node araclar/dc_derle.mjs --denetle  → güncel değilse hata verir (CI)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KLASOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../deneme-site/sayfalar');
const denetle = process.argv.includes('--denetle');
let eski = 0;

for (const ad of fs.readdirSync(KLASOR).filter((d) => d.endsWith('.dc.html')).sort()) {
  const html = fs.readFileSync(path.join(KLASOR, ad), 'utf8');
  // dc.js'teki eski okuma ile aynı: data-dc-script etiketinden ilk </script>'e kadar
  const etiket = /<script type="text\/x-dc"[^>]*data-dc-script[^>]*>/.exec(html);
  if (!etiket) throw new Error(`${ad}: data-dc-script betiği yok`);
  const betik = html.slice(etiket.index + etiket[0].length).split('</script>')[0];
  if (!/\bclass Component\b/.test(betik)) throw new Error(`${ad}: betikte "class Component" yok`);
  const cikti = `// OTOMATİK ÜRETİLİR (araclar/dc_derle.mjs): sayfalar/${ad} içindeki betik. Elle değiştirmeyin; .dc.html'i
// değiştirip \`node araclar/dc_derle.mjs\` çalıştırın.
window.DC.sinif('/sayfalar/${ad}', function (DCLogic) {
${betik.replace(/^\n/, '').replace(/\s*$/, '')}
return Component;
});
`;
  const hedef = path.join(KLASOR, ad.replace(/\.html$/, '.js'));
  const simdiki = fs.existsSync(hedef) ? fs.readFileSync(hedef, 'utf8') : null;
  if (simdiki === cikti) continue;
  if (denetle) { console.error(`güncel değil: sayfalar/${path.basename(hedef)}`); eski++; continue; }
  fs.writeFileSync(hedef, cikti);
  console.log(`yazıldı: sayfalar/${path.basename(hedef)}`);
}
if (eski) { console.error('`node araclar/dc_derle.mjs` çalıştırıp sonucu ekleyin.'); process.exit(1); }
