// Forest Club Urla · kartla aidat ödemesini başlatır (iyzico Checkout Form). Giriş yapmış üye çağırır; tutar sunucuda
// (ayarlar.aidat) belirlenir. Dönüş: {sayfa} iyzico'nun ödeme sayfası; ödeme bitince iyzico odeme-donus'a döner.
// Secrets: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_ADRES, SITE_ADRESI; isteğe bağlı IYZICO_TCKN (alıcı kimlik no;
// boşsa iyzico'nun kabul ettiği 11111111111)
import { CORS, json, servisIstemcisi } from '../_ortak/ortak.ts';
import { fiyat, iyzico } from '../_ortak/iyzico.ts';

function telefon(t: string | null): string | undefined {
  const r = String(t || '').replace(/\D/g, '');
  if (/^5\d{9}$/.test(r)) return `+90${r}`;
  if (/^05\d{9}$/.test(r)) return `+9${r}`;
  if (/^905\d{9}$/.test(r)) return `+${r}`;
  return undefined;
}

Deno.serve(async (istek) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (istek.method !== 'POST') return json(405, { hata: 'Yalnız POST.' });
  try {
    const sb = servisIstemcisi();
    const jwt = (istek.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: oturum } = await sb.auth.getUser(jwt);
    if (!oturum || !oturum.user) return json(401, { hata: 'Önce giriş yap.' });
    const { data: uye } = await sb.from('uyeler').select('id').eq('user_id', oturum.user.id).maybeSingle();
    if (!uye) return json(403, { hata: 'Üye kaydı bulunamadı.' });
    const { data: o, error } = await sb.rpc('odeme_istegi_ac', { p_uye: uye.id });
    if (error) return json(error.code === 'P0001' ? 400 : 500, { hata: error.code === 'P0001' ? error.message : 'Ödeme başlatılamadı.' });

    const [ad, ...soyad] = String(o.ad).trim().split(/\s+/);
    const ip = istek.headers.get('cf-connecting-ip') || (istek.headers.get('x-forwarded-for') || '').split(',')[0].trim() || '85.34.78.112';
    const adres = { contactName: o.ad, city: 'Izmir', country: 'Turkey', address: 'Urla, İzmir' };
    const tutar = fiyat(Number(o.tutar));
    const govde = {
      locale: 'tr', conversationId: o.id, price: tutar, paidPrice: tutar, currency: 'TRY', basketId: o.id, paymentGroup: 'PRODUCT',
      callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/odeme-donus`, enabledInstallments: [1],
      buyer: {
        id: o.kod, name: ad, surname: soyad.join(' ') || ad, gsmNumber: telefon(o.tel), email: o.eposta,
        identityNumber: Deno.env.get('IYZICO_TCKN') || '11111111111', registrationAddress: adres.address, ip, city: adres.city, country: adres.country,
      },
      billingAddress: adres,
      basketItems: [{ id: 'aidat', name: 'Forest Club Urla üyelik · 30 gün', category1: 'Üyelik', itemType: 'VIRTUAL', price: tutar }],
    };
    const sonuc = await iyzico('/payment/iyzipos/checkoutform/initialize/auth/ecom', govde);
    if (sonuc.status !== 'success' || !sonuc.token || !sonuc.paymentPageUrl) {
      console.error('iyzico initialize', sonuc.errorCode, sonuc.errorMessage);
      return json(502, { hata: `Ödeme sayfası açılamadı${sonuc.errorMessage ? `: ${sonuc.errorMessage}` : ''}.` });
    }
    await sb.rpc('odeme_istegi_token', { p_id: o.id, p_token: sonuc.token });
    return json(200, { sayfa: sonuc.paymentPageUrl });
  } catch (h) {
    console.error('odeme-baslat', h);
    return json(500, { hata: 'Ödeme başlatılamadı; biraz sonra tekrar dene.' });
  }
});
