// Forest Club Urla · Shopier REST API v1 (kartla ödeme). Her ödeme için tek kullanımlık bir "ödeme ürünü" açılır, kişi
// Shopier'in güvenli ödeme sayfasına gider. Ödeme olunca Shopier shopier-bildirim'e imzalı bildirim (webhook) gönderir;
// bildirimdeki veriye güvenilmez, sipariş Shopier API'sinden yeniden okunup tutar ve durum orada doğrulanır.
// Secrets: SHOPIER_PAT (Personal Access Token: ürün yazma + sipariş okuma), SHOPIER_WEBHOOK_TOKEN (bildirim imza
// anahtarı), SITE_ADRESI. İsteğe bağlı SHOPIER_API (varsayılan https://api.shopier.com/v1).
//
// DİKKAT (02.11.2026): Shopier'in resmi API belgesine henüz erişilemedi; uç noktalar ve alan adları topluluk
// örneklerinden (REST v1, PAT, Shopier-Signature HMAC-SHA256). Hesap onaylanınca Shopier panelindeki belgeyle
// doğrulanacak; o zamana kadar kart ödemesi yönetimde (ayarlar.kart_odeme) kapalı tutulur.
const API = () => (Deno.env.get('SHOPIER_API') || 'https://api.shopier.com/v1').replace(/\/$/, '');

export function shopierHazir(): boolean {
  return (Deno.env.get('SHOPIER_PAT') || '').length > 20;
}

async function cagir(yol: string, secenek: RequestInit = {}): Promise<any> {
  const r = await fetch(`${API()}${yol}`, {
    ...secenek,
    headers: { Authorization: `Bearer ${Deno.env.get('SHOPIER_PAT')}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(secenek.headers || {}) },
  });
  const metin = await r.text();
  let veri: any = null;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = { ham: metin }; }
  if (!r.ok) throw new Error(`Shopier ${r.status}: ${(veri && (veri.message || veri.error)) || metin.slice(0, 200)}`);
  return veri;
}

// Tek kullanımlık ödeme ürünü açar; dönüş { urun, sayfa } (ürün numarası ve ödeme sayfası adresi)
export async function odemeUrunuAc(p: { baslik: string; tutar: number; ref: string; donus: string }): Promise<{ urun: string; sayfa: string }> {
  const veri = await cagir('/products', {
    method: 'POST',
    body: JSON.stringify({
      title: p.baslik.slice(0, 120),
      type: 'digital',
      priceData: { currency: 'TRY', price: p.tutar.toFixed(2) },
      stockQuantity: 1,
      shippingPayer: 'sellerPays',
      description: `Forest Club Urla · ${p.ref}`,
      customNote: p.ref,
      successUrl: p.donus,
    }),
  });
  const d = veri && (veri.data || veri);
  const urun = String(d && (d.id ?? d.productId ?? '') || '');
  const sayfa = String(d && (d.url ?? d.paymentUrl ?? d.link ?? '') || '');
  if (!urun || !/^https:\/\//.test(sayfa)) throw new Error('Shopier ödeme ürünü yanıtı beklenmedik biçimde');
  return { urun, sayfa };
}

// Siparişi Shopier'den okur: { durum, tutar, urunler } (bildirimdeki veriye güvenilmez)
export async function siparisOku(siparis: string): Promise<{ odendi: boolean; iade: boolean; tutar: number; urunler: string[] }> {
  const veri = await cagir(`/orders/${encodeURIComponent(siparis)}`);
  const d = veri && (veri.data || veri);
  const odeme = String(d && (d.paymentStatus ?? d.payment_status ?? d.status ?? '') || '').toLowerCase();
  const durum = String(d && (d.status ?? '') || '').toLowerCase();
  const kalemler: any[] = (d && (d.lineItems || d.items || d.products)) || [];
  const tutar = Number((d && (d.totals?.total ?? d.total ?? d.totalPrice ?? d.amount)) ?? NaN);
  return {
    odendi: odeme === 'paid',
    iade: /refund|cancel|iptal|iade/.test(`${odeme} ${durum}`),
    tutar,
    urunler: kalemler.map((k) => String(k.productId ?? k.product_id ?? k.id ?? '')).filter(Boolean),
  };
}

// Bildirim imzası: gövdenin SHOPIER_WEBHOOK_TOKEN ile HMAC-SHA256'sı (onaltılık ya da base64) — sabit süreli karşılaştırma
export async function imzaDogru(govde: string, imza: string): Promise<boolean> {
  const anahtar = Deno.env.get('SHOPIER_WEBHOOK_TOKEN') || '';
  if (anahtar.length < 16 || !imza) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(anahtar), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ham = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(govde)));
  const hex = Array.from(ham, (b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = btoa(String.fromCharCode(...ham));
  const gelen = imza.trim().replace(/^sha256=/i, '');
  const esit = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    let f = 0;
    for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return f === 0;
  };
  return esit(gelen.toLowerCase(), hex) || esit(gelen, b64);
}
