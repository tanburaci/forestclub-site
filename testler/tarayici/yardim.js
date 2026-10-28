// Deneme sitesinin tarayıcı testi: Supabase yerine sahte bir sunucu (Playwright route), Netlify başlıkları (CSP dahil)
// yerel sunucunun yanıtlarına eklenir, supabase-js npm paketinden SRI ile yüklenir.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const DENEME = path.join(__dirname, '../../deneme-site');  // statik site klasörü
const SITE = 'http://127.0.0.1:8090';
const SB = 'https://gflabqnazkstsyafzdmn.supabase.co';
const NPM = path.join(path.dirname(require.resolve('@supabase/supabase-js/package.json')), 'dist/umd');
const toml = fs.readFileSync(path.join(DENEME, 'netlify.toml'), 'utf8');
const BASLIK = {};
toml.split('\n').forEach((l) => { const m = /^\s+([A-Za-z-]+) = "(.*)"$/.exec(l); if (m) BASLIK[m[1]] = m[2]; });

const gun = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
let hatalar = 0;
const dogru = (k, ad) => { console.log(`${k ? 'GEÇTİ' : 'KALDI'}  ${ad}`); if (!k) hatalar += 1; };

// Oturum: imzası sahte ama çözülebilir bir JWT (supabase-js MFA seviyesini bundan okur). aal2 = iki adımlı giriş yapılmış
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (id, email, aal) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, email, aal, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 })}.imza`;
function oturum(id, email, aal = 'aal2', faktorler = aal === 'aal2' ? [{ id: 'faktor-1', factor_type: 'totp', status: 'verified', friendly_name: 'Forest Club yönetim' }] : []) {
  return JSON.stringify({ access_token: jwt(id, email, aal), refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id, email, aud: 'authenticated', role: 'authenticated', factors: faktorler } });
}

// Ana sayfadaki "Yakında" kapağı (index.html) siteyi tıklanamaz yapar; site testleri kapağın altındaki sayfayı dener
const KAPAKSIZ = () => document.addEventListener('DOMContentLoaded', () => {
  const k = document.getElementById('fc-yakinda');
  if (k) k.remove();
  const kok = document.getElementById('kok');
  if (kok) kok.removeAttribute('inert');
});

async function sayfaAc(tarayici, veri, oturumJson) {
  const ctx = await tarayici.newContext();
  if (!veri.kapak) await ctx.addInitScript(KAPAKSIZ);  // veri.kapak: kapağın kendisini denemek için
  const page = await ctx.newPage();
  const istekler = [];
  const konsol = [];
  page.on('console', (m) => konsol.push(m.text()));
  page.on('pageerror', (e) => konsol.push(`pageerror: ${e.message}`));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/**', (r) => {
    const ad = r.request().url().split('/').pop();
    r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(path.join(NPM, ad)) });
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route(`${SITE}/**`, async (r) => {
    const yanit = await r.fetch().catch(() => null);
    if (!yanit) return r.abort().catch(() => {});
    const tur = yanit.headers()['content-type'] || '';
    r.fulfill({ response: yanit, headers: { ...yanit.headers(), ...(tur.includes('text/html') ? BASLIK : {}) } });
  });
  await page.route(`${SB}/**`, async (r) => {
    const q = r.request();
    const u = new URL(q.url());
    const govde = q.postData() ? JSON.parse(q.postData()) : null;
    istekler.push({ yontem: q.method(), yol: u.pathname, ara: u.search, govde });
    const json = (status, body, basliklar = {}) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...basliklar }, body: JSON.stringify(body) });
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.pathname.startsWith('/auth/v1/')) return json(200, {});
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = u.pathname.split('/').pop();
      const f = veri.rpc[fn];
      if (!f) return json(404, { message: `rpc yok: ${fn}` });
      const [status, body] = f(govde);
      return json(status, body);
    }
    const tablo = u.pathname.split('/').pop();
    if (q.method() !== 'GET') return json(201, q.headers()['accept'].includes('vnd.pgrst.object') ? { id: 999 } : [{ id: 999 }]);
    if (veri.hata && veri.hata[tablo]) return json(500, { message: 'sunucu hatası' });
    let satirlar = typeof veri.tablolar[tablo] === 'function' ? veri.tablolar[tablo]() : (veri.tablolar[tablo] || []);
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'offset', 'limit'].includes(k)) continue;
      if (v.startsWith('eq.')) satirlar = satirlar.filter((x) => String(x[k]) === v.slice(3));
    }
    const bas = Number(u.searchParams.get('offset') || 0);
    const adet = Math.min(Number(u.searchParams.get('limit') || 1000), 1000);  // max_rows = 1000
    const toplam = (veri.sahteToplam && veri.sahteToplam[tablo]) || satirlar.length;
    const sayfa = satirlar.slice(bas, bas + adet);
    const cr = { 'content-range': `${bas}-${bas + sayfa.length - 1}/${(q.headers()['prefer'] || '').includes('count=exact') ? toplam : '*'}` };
    if ((q.headers()['accept'] || '').includes('vnd.pgrst.object')) {
      return sayfa.length === 1 ? json(200, sayfa[0], cr) : json(406, { code: 'PGRST116', message: 'yok', details: 'The result contains 0 rows' });
    }
    return json(200, sayfa, cr);
  });
  if (oturumJson) await ctx.addInitScript((s) => { localStorage.setItem('sb-gflabqnazkstsyafzdmn-auth-token', s); }, oturumJson);
  return { page, istekler, konsol, ctx };
}

function yonetimVerisi() {
  const uyeler = [];
  for (let i = 1; i <= 1500; i += 1) {
    uyeler.push({ id: i, kod: `FC-U-${String(i).padStart(4, '0')}`, ad: i === 2 || i === 3 ? 'Elif Kaya' : `Üye ${i}`, eposta: `u${i}@ornek.com`,
      tel: '05320000000', durum: 'aktif', basvuru_tarihi: gun(-40), baslangic: gun(-30), bitis: gun(i % 2 ? 5 : -5), dogum_gunu: null,
      ozel_gunler: [], ilgi_alanlari: [], kutlama_izni: false, foto_izni: false, nereden_duydu: 'Instagram', yonetici_notu: i === 2 ? 'eski not' : null, user_id: null });
  }
  const etk = { id: 10, tarih: gun(10), saat: '10.00–12.00', tur: 'bulusma', ad: 'Breakfast Club', kim: null, kontenjan: 30, bilet_fiyati: null,
    uyelere: null, satilan_bilet: 0, anket_sayisi: 0, anket_ortalama: null, durum: 'yayinda', aciklama: null, link: null, eski_tarih: null };
  const rpcler = [];
  return {
    rpcler,
    tablolar: {
      yoneticiler: [{ ad: 'Yönetici', user_id: 'yon-1' }], uyeler, odemeler: [], etkinlikler: [etk],
      eposta_sablonlari: [{ id: 'basvuru', ad: 'Başvuru', ne_zaman: 'x', acik: true, gun: null, konu: 'k', metin: 'm', alanlar: ['ad'] }],
      etkinlik_kayitlari: [{ etkinlik_id: 10, uye_id: 2, durum: 'kayitli', geldi: false, sira: null }, { etkinlik_id: 10, uye_id: 5, durum: 'kayitli', geldi: false, sira: null }],
    },
    rpc: {
      elden_odeme: (g) => { rpcler.push(['elden_odeme', g]); return [200, { bitis: gun(35), odeme_id: 1, hareket_id: 501, ref: 'elden:abc', tekrar: false, ad: 'Elif Kaya', kod: 'FC-U-0003' }]; },
      giris_kaydet: (g) => { rpcler.push(['giris_kaydet', g]); return [200, { ad: 'Üye 5', uye_id: 5, zaten: false }]; },
      etkinlik_durum_degistir: (g) => { rpcler.push(['etkinlik_durum_degistir', g]); return [200, { durum: 'iptal', tarih: gun(10), eski_tarih: null, kisi: 2 }]; },
    },
  };
}


module.exports = { KAPAKSIZ, sayfaAc, yonetimVerisi, oturum, jwt, gun, dogru: (...a) => dogru(...a), hatalar: () => hatalar, SITE };
