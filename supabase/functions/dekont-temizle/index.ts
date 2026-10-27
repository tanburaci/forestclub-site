// Forest Club Urla · 24 saatten eski, hiçbir dekont kaydına bağlanmamış dosyaları "dekontlar" deposundan siler
// (dekont_artiklari). pg_cron saatte bir çağırır (x-zamanlayici başlığıyla). Silme Storage API ile yapılır:
// storage.objects satırını SQL'le silmek dosyanın kendisini depoda bırakır.
//
// Secrets: ZAMANLAYICI_ANAHTARI
import { json, servisIstemcisi, zamanlayiciMi } from '../_ortak/ortak.ts';

Deno.serve(async (istek) => {
  if (!zamanlayiciMi(istek)) return json(401, { hata: 'Yetkisiz.' });
  const sb = servisIstemcisi();
  const { data, error } = await sb.rpc('dekont_artiklari', { p_adet: 500 });
  if (error) { console.error('dekont_artiklari', error); return json(500, { hata: 'Liste alınamadı.' }); }
  const yollar = (data || []) as string[];
  let silinen = 0;
  for (let i = 0; i < yollar.length; i += 100) {
    const parca = yollar.slice(i, i + 100);
    const { error: sHata } = await sb.storage.from('dekontlar').remove(parca);
    if (sHata) { console.error('dekont silme', sHata); break; }
    silinen += parca.length;
  }
  return json(200, { silinen });
});
