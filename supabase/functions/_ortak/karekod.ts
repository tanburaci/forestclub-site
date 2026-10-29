// Forest Club Urla · maildeki giriş karekodu: resim yerine HTML tablo (Gmail / Outlook resimleri engellese de görünür).
// Bilet (FC-B-…) ve tanışma rezervasyonu (FC-T-…) kodları mail metninden bulunur, her biri için karekod eklenir.
import qrcode from 'npm:qrcode-generator@1.4.4';

export function karekodTablo(kod: string, hucre = 5): string {
  const qr = qrcode(0, 'M');
  qr.addData(kod);
  qr.make();
  const n = qr.getModuleCount();
  const kenar = 4;
  // Yan yana aynı renkteki hücreler tek hücrede (colspan): mail küçük kalır (Gmail 102 KB'ta keser)
  const satirlar: string[] = [];
  const dolu = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c);
  for (let r = -kenar; r < n + kenar; r++) {
    let tr = '';
    for (let c = -kenar; c < n + kenar;) {
      const d = dolu(r, c);
      let say = 1;
      while (c + say < n + kenar && dolu(r, c + say) === d) say++;
      tr += `<td${say > 1 ? ` colspan="${say}"` : ''} height="${hucre}" style="height:${hucre}px;padding:0${d ? ';background:#111' : ''}"${d ? ' bgcolor="#111111"' : ''}></td>`;
      c += say;
    }
    satirlar.push(`<tr>${tr}</tr>`);
  }
  const genislik = (n + 2 * kenar) * hucre;
  const kolon = `<colgroup>${'<col width="' + hucre + '">'.repeat(n + 2 * kenar)}</colgroup>`;
  return `<table role="img" aria-label="Giriş karekodu ${kod}" width="${genislik}" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="border-collapse:collapse;table-layout:fixed;width:${genislik}px;margin:0 auto;background:#FFFFFF">${kolon}${satirlar.join('')}</table>`;
}

/** Mail HTML'inin sonuna metindeki her bilet / tanışma kodu için karekod ekler. */
export function karekodlariEkle(html: string, metin: string): string {
  const kodlar = [...new Set(String(metin).match(/FC-[BT]-[A-Z0-9]{6}/g) || [])].slice(0, 10);
  if (!kodlar.length) return html;
  const bloklar = kodlar.map((k) => '<div style="text-align:center;margin:18px 0 6px">' + karekodTablo(k)
    + `<div style="font:700 15px Helvetica,Arial,sans-serif;letter-spacing:.06em;margin-top:6px">${k}</div></div>`).join('');
  const not = '<p style="margin:14px 0 0;font-size:14px;color:#3A3A3A;text-align:center">Girişte karekodu okut; okunmazsa kodu söylemen yeterli. Karekodların üye panelinde “Randevularım”da da var.</p>';
  return html.replace(/<\/div><\/body><\/html>$/, `${bloklar}${not}</div></body></html>`);
}
