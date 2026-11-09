// Forest Club Urla · site haritası (/sitemap.xml, Cloudflare Pages Function): sabit sayfalar deneme-site/sitemap.xml'den gelir, sonuna her
// yayınlanmış etkinliğin kendi sayfası (/e/<id>) eklenir; Google etkinlik sayfalarını bu listeden bulur.
// Taslak ve iptal etkinlikler girmez. Veri okunamazsa yalnız sabit liste sunulur.
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGFicW5hemtzdHN5YWZ6ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDg4MzUsImV4cCI6MjEwODYyNDgzNX0.bcPcUPsLdtZlYfL5ryRxcIGOzHa7GDEKyCkB1KH5upo';
const KOK = 'https://www.forestcluburla.com';

export function etkinlikleriEkle(xml, etkinlikler) {
  const satirlar = (etkinlikler || [])
    .filter((e) => /^\d{1,12}$/.test(String(e.id)))
    .map((e) => `  <url><loc>${KOK}/e/${e.id}</loc>${/^\d{4}-\d{2}-\d{2}/.test(e.created_at || '') ? `<lastmod>${e.created_at.slice(0, 10)}</lastmod>` : ''}</url>`);
  if (!satirlar.length || !xml.includes('</urlset>')) return xml;
  return xml.replace('</urlset>', `${satirlar.join('\n')}\n</urlset>`);
}

// sabit: deneme-site/sitemap.xml yanıtı ya da sözü (Cloudflare'de env.ASSETS; testte sahte)
export async function yanitla(sabit) {
  const xml = await (await sabit).text();
  let etkinlikler = [];
  try {
    const r = await fetch(`${SB}/rest/v1/etkinlikler?durum=in.(yayinda,ertelendi)&select=id,created_at&order=tarih.desc&limit=1000`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (r.ok) etkinlikler = await r.json();
  } catch (h) { /* yalnız sabit liste */ }
  return new Response(etkinlikleriEkle(xml, etkinlikler), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}

// Statik dosya aynı adreste: env.ASSETS Functions'ı atlayıp doğrudan dosyayı verir
export const onRequestGet = ({ request, env }) => yanitla(env.ASSETS.fetch(request.url));
// HEAD istekleri (bağlantı denetleyicileri) de aynı yanıtı alır
export const onRequestHead = onRequestGet;
