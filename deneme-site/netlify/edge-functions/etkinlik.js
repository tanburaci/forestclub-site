// Forest Club Urla · etkinliğin kendi sayfası (/e/<id>): ana sayfanın HTML'i bu adreste sunulur, başlık ve önizleme
// etiketleri (og:title, og:description, og:image = afiş) o etkinliğe göre yazılır; sayfadaki bileşen (site.js FCS.tek)
// yalnız o etkinliği çizer. Önizleme botları betik çalıştırmadığı için etiketler sunucuda (Netlify Edge Function).
// Ana sayfa alınamazsa eski davranış: kısa önizleme sayfası + ana sayfadaki karta (/#etkinlik-<id>) yönlendirme.
// Veri herkese açık etkinlik listesinden (anon anahtar, taslaklar görünmez).
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGFicW5hemtzdHN5YWZ6ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDg4MzUsImV4cCI6MjEwODYyNDgzNX0.bcPcUPsLdtZlYfL5ryRxcIGOzHa7GDEKyCkB1KH5upo';
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

// Ana sayfa HTML'ine etkinliğin başlık ve önizleme etiketlerini yazar
export function etiketle(html, kok, id, e) {
  const baslik = `${e.ad} · Forest Club Urla`;
  const aciklama = kisalt([tarihYaz(e.tarih, e.saat), 'Pinya, Urla', e.aciklama || e.kim].filter(Boolean).join(' · '), 200);
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
  return h;
}

export function sayfa(kok, id, e) {
  const hedef = id && e ? `/#etkinlik-${id}` : '/#etkinlikler';
  const baslik = e ? `${e.ad} · Forest Club Urla` : 'Forest Club Urla · Gatherings in Nature';
  const aciklama = e ? kisalt([tarihYaz(e.tarih, e.saat), 'Pinya, Urla', e.aciklama || e.kim].filter(Boolean).join(' · '), 200)
    : "Urla'da ağaçların altında buluşmalar: kahvaltı, gün batımı, yoga, atölyeler, müzik.";
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

export default async (istek) => {
  const url = new URL(istek.url);
  const id = (/^\/e\/(\d{1,12})\/?$/.exec(url.pathname) || [])[1] || null;
  let e = null;
  if (id) {
    try {
      const r = await fetch(`${SB}/rest/v1/etkinlikler?id=eq.${id}&durum=neq.taslak&select=ad,tarih,saat,aciklama,kim,afis`, {
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
      const ana = await fetch(new URL('/index.html', url.origin));
      const html = ana.ok ? await ana.text() : '';
      if (/<html[\s>]/i.test(html) && html.includes('site.js')) {
        return new Response(etiketle(html, url.origin, id, e), {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
        });
      }
    } catch (h) { /* ana sayfa alınamadı: kısa önizleme sayfası */ }
  }
  return new Response(sayfa(url.origin, id, e), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' },
  });
};

export const config = { path: '/e/*' };
