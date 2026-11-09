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
    // Okuma hatası "ürün yok" sayılmaz (ödeme kaybolmasın): 500 → Shopier yeniden dener
    const oku = async (tablo: string, sutun: string, urun: string) => {
      const { data, error } = await sb.from(tablo).select('id').eq(sutun, urun).maybeSingle();
      if (error) throw error;
      return data as { id: number | string } | null;
    };
    // Kart komisyonu: ödeme işlendikten sonra muhasebeye gider (aylık dilim oranı + 0,49 TL). Yazılamazsa ödeme yine
    // tamamdır; 500 dönülmez ki Shopier bildirimi tekrarlayıp başka bir şeyi ikinci kez tetiklemesin.
    const komisyon = async (neden: string) => {
      const { error } = await sb.rpc('shopier_komisyon_yaz', { p_siparis: siparis, p_tutar: s.tutar, p_neden: neden });
      if (error) console.error('shopier_komisyon_yaz', siparis, error);
    };
    // Tutar okunamazsa null gider: bilet verilmez, iade uyarısı (tutar denetimi atlanmaz)
    const tutar = Number.isFinite(s.tutar) ? s.tutar : null;
    for (const urun of s.urunler) {
      const b = await oku('bilet_istekleri', 'shopier_urun', urun);
      if (b) {
        // Yer kalmadıysa / etkinlik iptalse / tutar tutmuyorsa işlev hata vermez, isteği iade için işaretler (200)
        const { data, error } = await sb.rpc('bilet_kart_odendi', { p_id: b.id, p_siparis: siparis, p_tutar: tutar });
        if (error) { console.error('bilet_kart_odendi', error); return yanit(500, 'bilet işlenemedi'); }
        if (data?.durum !== 'iade' && tutar !== null) await komisyon('bilet');
        return yanit(200, data?.durum === 'iade' ? `bilet verilemedi (${data.neden}); iade gerekli` : 'bilet tamam');
      }
      if (tutar === null) { console.error('shopier-bildirim: tutar okunamadı', siparis); return yanit(500, 'tutar okunamadı'); }
      const o = await oku('odeme_istekleri', 'token', urun);
      if (o) {
        const { error } = await sb.rpc('odeme_tamamla', { p_token: urun, p_odeme_no: siparis, p_odenen: s.tutar, p_komisyon: 0 });
        if (error) { console.error('odeme_tamamla', error); return yanit(500, 'üyelik işlenemedi'); }
        await komisyon('üyelik');
        return yanit(200, 'üyelik tamam');
      }
    }
    for (const urun of s.urunler) {
      const d = await oku('destekler', 'token', urun);
      if (d) {
        const { error } = await servisIstemcisi().rpc('destek_tamamla', { p_token: urun, p_odeme_no: siparis, p_odenen: s.tutar, p_komisyon: 0 });
        if (error) { console.error('destek_tamamla', error); return yanit(500, 'destek işlenemedi'); }
        await komisyon('destek');
        return yanit(200, 'destek tamam');
      }
    }
    return yanit(200, 'bu siparişte bizim ödeme ürünümüz yok');
  } catch (h) {
    console.error('shopier-bildirim', h);
    return yanit(500, 'geçici hata');
  }
});
