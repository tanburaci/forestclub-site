// Shopier bildirim imzası: gövdenin HMAC-SHA256'sı onaltılık ya da base64 kabul edilir, yanlış anahtar / boş imza reddedilir.
// Çalıştırma: deno test supabase/functions/_ortak/
import { imzaDogru } from './shopier.ts';

Deno.test('Shopier imzası', async () => {
  Deno.env.set('SHOPIER_WEBHOOK_TOKEN', 'deneme-anahtari-0123456789');
  const govde = '{"event":"order.created","data":{"orderId":"123"}}';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('deneme-anahtari-0123456789'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ham = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(govde)));
  const hex = Array.from(ham, (b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = btoa(String.fromCharCode(...ham));
  if (!(await imzaDogru(govde, hex))) throw new Error('onaltılık imza kabul edilmedi');
  if (!(await imzaDogru(govde, b64))) throw new Error('base64 imza kabul edilmedi');
  if (await imzaDogru(govde + ' ', hex)) throw new Error('değişmiş gövde kabul edildi');
  if (await imzaDogru(govde, '')) throw new Error('boş imza kabul edildi');
});
