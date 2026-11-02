// Forest Club Urla · Shopier bildirimi (webhook, order.created). İmza (Shopier-Signature) doğrulanır, sipariş Shopier
// API'sinden yeniden okunur; ödendiyse siparişteki ödeme ürününe göre:
//   bilet isteği (bilet_istekleri.shopier_urun) → bilet_kart_odendi: biletler kesinleşir, e-postayla gider
//   üyelik ödemesi (odeme_istekleri.token = ürün numarası) → odeme_tamamla: üyelik 30 gün uzar
// Shopier yalnız 2xx'i başarılı sayar; işlenemeyen bildirimde 500 döner ki Shopier yeniden denesin.
// Secrets: SHOPIER_PAT, SHOPIER_WEBHOOK_TOKEN
import { servisIstemcisi } from '../_ortak/ortak.ts';
import { imzaDogru, siparisOku } from '../_ortak/shopier.ts';

const yanit = (durum: number, metin: string) => new Response(metin, { status: durum, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async (istek) => {
  if (istek.method !== 'POST') return yanit(405, 'yalnız POST');
  const govde = await istek.text();
  if (!(await imzaDogru(govde, istek.headers.get('shopier-signature') || ''))) return yanit(401, 'imza geçersiz');
  let olay: any;
  try { olay = JSON.parse(govde); } catch { return yanit(400, 'gövde okunamadı'); }
  const d = olay && (olay.data || olay);
  const siparis = String(d && (d.orderId ?? d.order_id ?? d.id ?? '') || '');
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(siparis)) return yanit(200, 'sipariş numarası yok; yok sayıldı');
  try {
    const s = await siparisOku(siparis);
    if (!s.odendi || s.iade) return yanit(200, 'ödenmemiş ya da iade; işlem yok');
    const sb = servisIstemcisi();
    for (const urun of s.urunler) {
      const { data: b } = await sb.from('bilet_istekleri').select('id, tutar').eq('shopier_urun', urun).maybeSingle();
      if (b) {
        const { error } = await sb.rpc('bilet_kart_odendi', { p_id: b.id, p_siparis: siparis, p_tutar: s.tutar });
        if (error) { console.error('bilet_kart_odendi', error); return yanit(500, 'bilet işlenemedi'); }
        return yanit(200, 'bilet tamam');
      }
      const { data: o } = await sb.from('odeme_istekleri').select('id').eq('token', urun).maybeSingle();
      if (o) {
        const { error } = await sb.rpc('odeme_tamamla', { p_token: urun, p_odeme_no: siparis, p_odenen: s.tutar, p_komisyon: 0 });
        if (error) { console.error('odeme_tamamla', error); return yanit(500, 'üyelik işlenemedi'); }
        return yanit(200, 'üyelik tamam');
      }
    }
    return yanit(200, 'bu siparişte bizim ödeme ürünümüz yok');
  } catch (h) {
    console.error('shopier-bildirim', h);
    return yanit(500, 'geçici hata');
  }
});
