// Forest Club Urla · iyzico ödeme sayfasından dönüş (callbackUrl). iyzico token'ı form olarak POST eder; sonuç
// iyzico'dan yeniden sorgulanır (gelen veriye güvenilmez), başarılıysa odeme_tamamla üyeliği uzatır. Üye
// SITE_ADRESI/uye#odeme-tamam ya da #odeme-hata sayfasına yönlenir.
// Secrets: IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_ADRES, SITE_ADRESI
import { servisIstemcisi } from '../_ortak/ortak.ts';
import { iyzico } from '../_ortak/iyzico.ts';

const yonlen = (sonuc: 'tamam' | 'hata') => new Response(null, {
  status: 303, headers: { Location: `${(Deno.env.get('SITE_ADRESI') || '').replace(/\/$/, '')}/uye#odeme-${sonuc}` },
});

Deno.serve(async (istek) => {
  if (istek.method !== 'POST') return yonlen('hata');
  let token = '';
  try {
    token = String((await istek.formData()).get('token') || '');
    if (!/^[A-Za-z0-9-]{10,100}$/.test(token)) return yonlen('hata');
    const sb = servisIstemcisi();
    const sonuc = await iyzico('/payment/iyzipos/checkoutform/auth/ecom/detail', { locale: 'tr', token });
    if (sonuc.status === 'success' && sonuc.paymentStatus === 'SUCCESS' && sonuc.paymentId) {
      const komisyon = Number(sonuc.iyziCommissionRateAmount || 0) + Number(sonuc.iyziCommissionFee || 0);
      const { error } = await sb.rpc('odeme_tamamla', {
        p_token: token, p_odeme_no: String(sonuc.paymentId), p_odenen: Number(sonuc.paidPrice), p_komisyon: Math.round(komisyon * 100) / 100,
      });
      if (error) { console.error('odeme_tamamla', error); return yonlen('hata'); }
      return yonlen('tamam');
    }
    await sb.rpc('odeme_basarisiz', { p_token: token, p_hata: sonuc.errorMessage || sonuc.paymentStatus || 'başarısız' });
    return yonlen('hata');
  } catch (h) {
    console.error('odeme-donus', h);
    return yonlen('hata');
  }
});
