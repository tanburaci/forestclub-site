// Forest Club Urla · e-posta şablonunu doldurur: {ad}, {bitis}, {etkinlik} … alanları verideki değerlerle değişir.
// Düz metin ve HTML sürümü üretilir; HTML'de değerler kaçırılır, https bağlantıları tıklanır olur.
// Saf işlevler (Deno'ya bağlı değil): yerelde node ile de denenir.

// Demo verisindeki uydurma adresler (site, SQL ve gönderici aynı kuralı kullanır)
export const demoAdresMi = (e: string): boolean => /@(ornek\.com|example\.(com|org|net))$/i.test(String(e || '').trim());

export function doldur(metin: string, veri: Record<string, unknown>): string {
  return String(metin || '').replace(/\{([A-Za-z]+)\}/g, (tamami, ad) => (veri[ad] == null ? tamami : String(veri[ad])));
}

const kacir = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function htmlYap(metin: string): string {
  const paragraflar = String(metin || '').split(/\n{2,}/).map((p) => {
    const ic = kacir(p).replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#111111">${u}</a>`).replace(/\n/g, '<br>');
    return `<p style="margin:0 0 14px">${ic}</p>`;
  });
  return '<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#FFFFFF">'
    + '<div style="max-width:560px;margin:0 auto;font:16px/1.55 Helvetica,Arial,sans-serif;color:#111111">'
    + paragraflar.join('') + '</div></body></html>';
}

export interface Ileti { konu: string; metin: string; html: string }

export function iletiYap(konu: string, metin: string, veri: Record<string, unknown>): Ileti {
  const doluMetin = doldur(metin, veri);
  return { konu: doldur(konu, veri).replace(/[\r\n]+/g, ' ').trim(), metin: doluMetin, html: htmlYap(doluMetin) };
}
