// iyzico imzası resmi iyzipay SDK'sının ürettiğiyle birebir aynı olmalı. Çalıştırma: deno test supabase/functions/_ortak/
import { assertEquals } from 'jsr:@std/assert@1.0.8';
import sdk from 'npm:iyzipay@2.0.71/lib/utils.js';
import { fiyat, yetkiBasligi } from './iyzico.ts';

Deno.test('IYZWSv2 başlığı SDK ile aynı', async () => {
  const yol = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
  const govde = { locale: 'tr', conversationId: 'abc', price: '3000.0', basketItems: [{ id: 'aidat', name: 'Üyelik · 30 gün', price: '3000.0' }] };
  for (const rastgele of ['123456789', '1730000000000123']) {
    assertEquals(await yetkiBasligi('api-anahtari', 'gizli', yol, JSON.stringify(govde), rastgele),
      sdk.generateAuthorizationHeaderV2('IYZWSv2', 'api-anahtari', ':', 'gizli', yol, govde, rastgele));
  }
});

Deno.test('fiyat biçimi', () => {
  assertEquals([fiyat(3000), fiyat(2999.9), fiyat(12.5)], ['3000.0', '2999.9', '12.5']);
});
