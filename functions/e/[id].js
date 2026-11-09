// Forest Club Urla · etkinliğin kendi sayfası (/e/<id>): ana sayfanın HTML'i bu adreste sunulur, başlık ve önizleme
// etiketleri (og:title, og:description, og:image = afiş) o etkinliğe göre yazılır; sayfadaki bileşen (site.js FCS.tek)
// yalnız o etkinliği çizer. Önizleme botları betik çalıştırmadığı için etiketler sunucuda (Cloudflare Pages Function).
// Ana sayfa alınamazsa eski davranış: kısa önizleme sayfası + ana sayfadaki karta (/#etkinlik-<id>) yönlendirme.
// Veri herkese açık etkinlik listesinden (anon anahtar, taslaklar görünmez).
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGFicW5hemtzdHN5YWZ6ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDg4MzUsImV4cCI6MjEwODYyNDgzNX0.bcPcUPsLdtZlYfL5ryRxcIGOzHa7GDEKyCkB1KH5upo';
// deneme-site/_headers Functions yanıtlarına uygulanmaz: aynı güvenlik başlıkları burada (test ikisini karşılaştırır)
export const GUVENLIK = {
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://gflabqnazkstsyafzdmn.supabase.co wss://gflabqnazkstsyafzdmn.supabase.co https://api.open-meteo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
const LOGO = '/_blob/1446f01d4f1e77e517c2b5c1ed9e8882.png';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const kacir = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kisalt = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t; };

export function tarihYaz(tarih, saat) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tarih || '');
  if (!m) return '';
  const gun = GUNLER[new Date(`${tarih}T12:00:00Z`).getUTCDay()];
  return `${Number(m[3])} ${AYLAR[Number(m[2]) - 1]} ${gun}${saat ? ` · ${saat}` : ''}`;
}

// Afişin paylaşım için küçültülmüş kopyası (yönetim panelinde afisler/paylas/<ad>.jpg olarak üretilir); WhatsApp gibi
// uygulamalar büyük resmi göstermeyip site simgesine (logo) düşüyor
export function paylasAdresi(afis) {
  const m = /^(https:\/\/[^/]+\/storage\/v1\/object\/public\/afisler\/)([^/?#]+?)\.[a-z]+$/i.exec(afis || '');
  return m ? `${m[1]}paylas/${m[2]}.jpg` : null;
}

const YER = 'Pinya, Urla, İzmir';

// Google'ın etkinlik kartı için schema.org Event (JSON-LD). Saat "18.00" / "18:00" biçiminde; yoksa yalnız tarih.
// Türkiye saati sabit +03:00. Bilet fiyatı varsa teklif (TRY), kontenjan dolduysa "tükendi".
export function olaySemasi(kok, id, e) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.tarih || '')) return '';
  const s = /^(\d{1,2})[.:](\d{2})/.exec(e.saat || '');
  const bas = s ? `${e.tarih}T${s[1].padStart(2, '0')}:${s[2]}:00+03:00` : e.tarih;
  const adres = `${kok}/e/${id}`;
  const resim = /^https:\/\//.test(e.afis || '') ? e.afis : `${kok}${LOGO}`;
  const durum = { iptal: 'EventCancelled', ertelendi: 'EventPostponed' }[e.durum] || 'EventScheduled';
  const o = {
    '@context': 'https://schema.org', '@type': 'Event', name: e.ad, startDate: bas,
    eventStatus: `https://schema.org/${durum}`, eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: 'Forest Club Urla', address: { '@type': 'PostalAddress', streetAddress: 'Pinya', addressLocality: 'Urla', addressRegion: 'İzmir', addressCountry: 'TR' } },
    image: [resim], description: kisalt(e.aciklama || e.kim || `${e.ad} · Forest Club Urla, ${YER}`, 300), url: adres,
    organizer: { '@type': 'Organization', name: 'Forest Club Urla', url: `${kok}/` },
  };
  if (e.kim) o.performer = { '@type': 'PerformingGroup', name: kisalt(e.kim, 120) };
  if (e.bilet_fiyati != null && Number(e.bilet_fiyati) >= 0) {
    const dolu = e.kontenjan && e.satilan_bilet >= e.kontenjan;
    o.offers = { '@type': 'Offer', price: String(Number(e.bilet_fiyati)), priceCurrency: 'TRY', url: adres,
      availability: `https://schema.org/${dolu ? 'SoldOut' : 'InStock'}` };
  }
  // </script> kaçışı: JSON içindeki < karakteri \u003c yazılır
  return `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
}

// Ana sayfa HTML'ine etkinliğin başlık ve önizleme etiketlerini yazar
export function etiketle(html, kok, id, e) {
  const baslik = `${e.ad} · Forest Club Urla`;
  const aciklama = kisalt([tarihYaz(e.tarih, e.saat), YER, e.aciklama || e.kim].filter(Boolean).join(' · '), 200);
  const resim = /^https:\/\//.test(e.paylasResim || e.afis || '') ? (e.paylasResim || e.afis) : `${kok}${LOGO}`;
  const adres = `${kok}/e/${id}`;
  const deg = (h, re, yeni) => (re.test(h) ? h.replace(re, yeni) : h);
  let h = html;
  h = deg(h, /<title>[^<]*<\/title>/, `<title>${kacir(baslik)}</title>`);
  h = deg(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${kacir(aciklama)}">`);
  h = deg(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${kacir(adres)}">`);
  h = deg(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${kacir(baslik)}">`);
  h = deg(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${kacir(aciklama)}">`);
  h = deg(h, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${kacir(adres)}">`);
  h = deg(h, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${kacir(resim)}">\n<meta property="og:image:alt" content="${kacir(`${e.ad} afişi`)}">\n<meta name="twitter:card" content="summary_large_image">`);
  // Ana sayfanın kuruluş şeması etkinlik sayfasında yerine etkinlik şeması
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '');
  h = h.replace('</head>', `${olaySemasi(kok, id, e)}\n</head>`);
  return h;
}

export function sayfa(kok, id, e) {
  const hedef = id && e ? `/#etkinlik-${id}` : '/#etkinlikler';
  const baslik = e ? `${e.ad} · Forest Club Urla` : 'Forest Club Urla · Gatherings in Nature';
  const aciklama = e ? kisalt([tarihYaz(e.tarih, e.saat), YER, e.aciklama || e.kim].filter(Boolean).join(' · '), 200)
    : "Urla, İzmir'de ağaçların altında buluşmalar: kahvaltı, gün batımı, yoga, atölyeler, müzik.";
  const resim = e && /^https:\/\//.test(e.paylasResim || e.afis || '') ? (e.paylasResim || e.afis) : `${kok}${LOGO}`;
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kacir(baslik)}</title>
<meta name="description" content="${kacir(aciklama)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Forest Club Urla">
<meta property="og:title" content="${kacir(baslik)}">
<meta property="og:description" content="${kacir(aciklama)}">
<meta property="og:url" content="${kacir(`${kok}/e/${id || ''}`)}">
<meta property="og:image" content="${kacir(resim)}">
<meta property="og:image:alt" content="${kacir(e ? `${e.ad} afişi` : 'Forest Club Urla')}">
<meta property="og:locale" content="tr_TR">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${kacir(hedef)}">
<link rel="canonical" href="${kacir(`${kok}/`)}">
<link rel="icon" href="${LOGO}">
</head>
<body style="font:16px sans-serif;padding:24px">
<p><a href="${kacir(hedef)}">${kacir(e ? e.ad : 'Forest Club Urla')} · etkinliği aç</a></p>
</body>
</html>
`;
}

// anaSayfa: ana sayfa HTML'ini getiren işlev (Cloudflare'de env.ASSETS; testte sahte)
export async function yanitla(istek, anaSayfa) {
  const url = new URL(istek.url);
  const id = (/^\/e\/(\d{1,12})\/?$/.exec(url.pathname) || [])[1] || null;
  let e = null;
  if (id) {
    try {
      const r = await fetch(`${SB}/rest/v1/etkinlikler?id=eq.${id}&durum=neq.taslak&select=ad,tarih,saat,aciklama,kim,afis,bilet_fiyati,kontenjan,satilan_bilet,durum`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      if (r.ok) e = (await r.json())[0] || null;
      const kucuk = e && paylasAdresi(e.afis);
      if (kucuk && (await fetch(kucuk, { method: 'HEAD' })).ok) e.paylasResim = kucuk;
    } catch (h) { /* veri okunamazsa genel önizleme */ }
  }
  // Etkinlik varsa: ana sayfa HTML'i etiketlenip bu adreste sunulur (sayfa bileşeni yalnız o etkinliği çizer)
  if (e) {
    try {
      const ana = await anaSayfa(url);
      const html = ana.ok ? await ana.text() : '';
      if (/<html[\s>]/i.test(html) && html.includes('site.js')) {
        return new Response(etiketle(html, url.origin, id, e), {
          headers: { ...GUVENLIK, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
        });
      }
    } catch (h) { /* ana sayfa alınamadı: kısa önizleme sayfası */ }
  }
  return new Response(sayfa(url.origin, id, e), {
    headers: { ...GUVENLIK, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' },
  });
}

// Cloudflare Pages: /e/<id> (dosya adı [id] yolu belirler). Ana sayfa statik dosyalardan ("/" = index.html)
export const onRequestGet = ({ request, env }) => yanitla(request, (url) => env.ASSETS.fetch(new URL('/', url.origin)));
// HEAD istekleri (bağlantı denetleyicileri) de aynı yanıtı alır
export const onRequestHead = onRequestGet;
