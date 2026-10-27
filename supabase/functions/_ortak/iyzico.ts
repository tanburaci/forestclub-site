// Forest Club Urla · iyzico API çağrısı (IYZWSv2 imzası, resmi iyzipay SDK'sıyla aynı):
//   imza = hex(HMAC-SHA256(gizli anahtar, rastgele + yol + JSON gövde))
//   Authorization: "IYZWSv2 " + base64("apiKey:<anahtar>&randomKey:<rastgele>&signature:<imza>"), x-iyzi-rnd: <rastgele>
// Secrets: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_ADRES (varsayılan sandbox: https://sandbox-api.iyzipay.com)

export async function imza(gizli: string, metin: string): Promise<string> {
  const anahtar = await crypto.subtle.importKey('raw', new TextEncoder().encode(gizli), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sonuc = new Uint8Array(await crypto.subtle.sign('HMAC', anahtar, new TextEncoder().encode(metin)));
  return Array.from(sonuc, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function yetkiBasligi(apiKey: string, gizli: string, yol: string, govde: string, rastgele: string): Promise<string> {
  const s = await imza(gizli, rastgele + yol + govde);
  return `IYZWSv2 ${btoa(`apiKey:${apiKey}&randomKey:${rastgele}&signature:${s}`)}`;
}

// iyzico fiyat biçimi: "3000.0", "2999.9"
export const fiyat = (n: number): string => { const s = String(parseFloat(String(n))); return s.includes('.') ? s : `${s}.0`; };

// deno-lint-ignore no-explicit-any
export async function iyzico(yol: string, govde: Record<string, unknown>): Promise<any> {
  const apiKey = Deno.env.get('IYZICO_API_KEY');
  const gizli = Deno.env.get('IYZICO_SECRET_KEY');
  if (!apiKey || !gizli) throw new Error('IYZICO_API_KEY ve IYZICO_SECRET_KEY gerekli.');
  const adres = (Deno.env.get('IYZICO_ADRES') || 'https://sandbox-api.iyzipay.com').replace(/\/$/, '');
  const metin = JSON.stringify(govde);
  const rastgele = `${Date.now()}${crypto.getRandomValues(new Uint32Array(1))[0]}`;
  const yanit = await fetch(adres + yol, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-iyzi-rnd': rastgele,
      Authorization: await yetkiBasligi(apiKey, gizli, yol, metin, rastgele) },
    body: metin,
    signal: AbortSignal.timeout(20_000),
  });
  return yanit.json();
}
