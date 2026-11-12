// Forest Club Urla · Shopier bildirimi (webhook, order.created). İmza (Shopier-Signature) doğrulanır, sipariş Shopier
// API'sinden yeniden okunur; ödendiyse siparişteki ödeme ürününe göre:
//   bilet isteği (bilet_istekleri.shopier_urun) → bilet_kart_odendi: biletler kesinleşir, e-postayla gider
//   ürün siparişi (urun_siparisleri.shopier_urun) → urun_kart_odendi: sipariş kesinleşir, muhasebe + e-posta
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
        // Komisyon yalnız bilet bu bildirimle kesinleştiyse (tekrar gelen bildirimde durum 'reddedildi' / 'onaylandi'
        // + zaten döner; iade edilecek siparişe gider yazılmaz). Aynı sipariş için ikinci kez yazılmaz (sunucuda tekil).
        if (data?.durum === 'onaylandi' && tutar !== null) await komisyon('bilet');
        return yanit(200, data?.durum === 'iade' ? `bilet verilemedi (${data.neden}); iade gerekli` : 'bilet tamam');
      }
      // Etkinliğe özel ürün siparişi: tutar tutmazsa işlev iade için işaretler (200)
      const u = await oku('urun_siparisleri', 'shopier_urun', urun);
      if (u) {
        const { data, error } = await sb.rpc('urun_kart_odendi', { p_id: u.id, p_siparis: siparis, p_tutar: tutar });
        if (error) { console.error('urun_kart_odendi', error); return yanit(500, 'ürün siparişi işlenemedi'); }
        if (data?.durum === 'onaylandi' && !data?.zaten && tutar !== null) await komisyon('ürün');
        return yanit(200, data?.durum === 'iade' ? `ürün siparişi kesinleşmedi (${data.neden}); iade gerekli` : 'ürün siparişi tamam');
      }
      if (tutar === null) {
        // Shopier yeniden dener; yönetici de haberdar olsun (sipariş başına bir kez)
        console.error('shopier-bildirim: tutar okunamadı', siparis);
        await sb.rpc('shopier_tanimsiz_odeme', { p_siparis: siparis, p_tutar: null }).then(() => {}, () => {});
        return yanit(500, 'tutar okunamadı');
      }
      const o = await oku('odeme_istekleri', 'token', urun);
      if (o) {
        const { data, error } = await sb.rpc('odeme_tamamla', { p_token: urun, p_odeme_no: siparis, p_odenen: s.tutar, p_komisyon: 0 });
        if (error) { console.error('odeme_tamamla', error); return yanit(500, 'üyelik işlenemedi'); }
        // Eksik tutar: üyelik uzamaz, yöneticiye iade uyarısı gider (sunucuda); komisyon yazılmaz, Shopier yeniden denemez
        if (data?.durum === 'eksik') return yanit(200, 'üyelik tutarı eksik; iade gerekli');
        await komisyon('üyelik');
        return yanit(200, 'üyelik tamam');
      }
    }
    for (const urun of s.urunler) {
      const d = await oku('destekler', 'token', urun);
      if (d) {
        const { data, error } = await servisIstemcisi().rpc('destek_tamamla', { p_token: urun, p_odeme_no: siparis, p_odenen: s.tutar, p_komisyon: 0 });
        if (error) { console.error('destek_tamamla', error); return yanit(500, 'destek işlenemedi'); }
        if (data?.durum === 'eksik') return yanit(200, 'destek tutarı eksik; iade gerekli');
        await komisyon('destek');
        return yanit(200, 'destek tamam');
      }
    }
    // Ödenmiş ama hiçbir isteğimizle eşleşmeyen sipariş: para kaybolmasın, yöneticiye uyarı (sipariş başına bir kez)
    const { error: uyariHata } = await sb.rpc('shopier_tanimsiz_odeme', { p_siparis: siparis, p_tutar: tutar });
    if (uyariHata) { console.error('shopier_tanimsiz_odeme', uyariHata); return yanit(500, 'uyarı yazılamadı'); }
    return yanit(200, 'bu siparişte bizim ödeme ürünümüz yok; yöneticiye bildirildi');
  } catch (h) {
    console.error('shopier-bildirim', h);
    return yanit(500, 'geçici hata');
  }
});
