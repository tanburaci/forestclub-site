// Forest Club Urla · kartla aidat ödemesini başlatır. Giriş yapmış üye çağırır; tutar sunucuda (ayarlar.aidat).
// Shopier ödeme ürünü açılır; bildirim shopier-bildirim'e gelir, odeme_tamamla üyeliği uzatır. Dönüş: {sayfa}.
// Secrets: SHOPIER_PAT, SITE_ADRESI
import { CORS, json, servisIstemcisi } from '../_ortak/ortak.ts';
import { odemeUrunuAc, shopierHazir } from '../_ortak/shopier.ts';

Deno.serve(async (istek) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (istek.method !== 'POST') return json(405, { hata: 'Yalnız POST.' });
  try {
    const sb = servisIstemcisi();
    const jwt = (istek.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: oturum } = await sb.auth.getUser(jwt);
    if (!oturum || !oturum.user) return json(401, { hata: 'Önce giriş yap.' });
    if (!shopierHazir()) return json(503, { hata: 'Kartla ödeme şu an kapalı; havale / EFT ile ödeyebilirsin.' });
    const { data: uye } = await sb.from('uyeler').select('id').eq('user_id', oturum.user.id).maybeSingle();
    if (!uye) return json(403, { hata: 'Üye kaydı bulunamadı.' });
    const { data: o, error } = await sb.rpc('odeme_istegi_ac', { p_uye: uye.id });
    if (error) return json(error.code === 'P0001' ? 400 : 500, { hata: error.code === 'P0001' ? error.message : 'Ödeme başlatılamadı.' });

    const site = (Deno.env.get('SITE_ADRESI') || 'https://www.forestcluburla.com').replace(/\/$/, '');
    const { urun, sayfa } = await odemeUrunuAc({ baslik: 'Forest Club Urla üyelik · 30 gün', tutar: Number(o.tutar), ref: `FC-UYELIK-${o.kod}`, donus: `${site}/uye/#odeme-tamam`,
      gorsel: `${site}/_blob/shopier/uyelik.jpg` });  // maskot (Hello humans)
    // Ürün numarası kaydedilemezse ödeme sayfası verilmez: aksi halde ödeme gelince hangi üyeye ait olduğu bulunamaz
    const { error: kayitHata } = await sb.rpc('odeme_istegi_token', { p_id: o.id, p_token: urun });
    if (kayitHata) {
      console.error('odeme_istegi_token', kayitHata);
      return json(500, { hata: 'Ödeme başlatılamadı; biraz sonra tekrar dene.' });
    }
    return json(200, { sayfa });
  } catch (h) {
    console.error('odeme-baslat', h);
    return json(500, { hata: 'Ödeme başlatılamadı; biraz sonra tekrar dene.' });
  }
});
