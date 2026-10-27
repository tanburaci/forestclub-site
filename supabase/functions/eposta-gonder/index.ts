// Forest Club Urla · e-posta kuyruğunu Resend ile gönderir. pg_cron her dakika çağırır (x-zamanlayici başlığıyla).
// Her çağrıda en çok 40 mail; Resend'in saniyede 2 istek sınırı için aralarında 600 ms beklenir. Demo adreslerine
// (ornek.com, example.*) hiçbir zaman gönderilmez. Şablon kapatıldıysa mail atlanır.
//
// Secrets: RESEND_API_KEY, EPOSTA_GONDEREN ("Forest Club Urla <merhaba@alanadi>"), ZAMANLAYICI_ANAHTARI,
//          SITE_ADRESI (https://… , {odemeLinki} = SITE_ADRESI/dekont),
//          isteğe bağlı EPOSTA_YANIT (yanıt adresi), EPOSTA_TEST_ALICI (doluysa bütün mailler yalnız bu adrese gider)
import { json, servisIstemcisi, zamanlayiciMi } from '../_ortak/ortak.ts';
import { demoAdresMi, iletiYap } from '../_ortak/sablon.ts';

const ADET = 40;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Sira { id: number; sablon: string; alici: string; veri: Record<string, unknown>; deneme: number; konu: string; metin: string; acik: boolean }

Deno.serve(async (istek) => {
  if (!zamanlayiciMi(istek)) return json(401, { hata: 'Yetkisiz.' });
  const anahtar = Deno.env.get('RESEND_API_KEY');
  const gonderen = Deno.env.get('EPOSTA_GONDEREN');
  const site = (Deno.env.get('SITE_ADRESI') || '').replace(/\/$/, '');
  // Ayar eksikse kuyruğa dokunulmaz: mailler ayar tamamlanınca gider
  if (!anahtar || !gonderen || !site) return json(503, { hata: 'RESEND_API_KEY, EPOSTA_GONDEREN ve SITE_ADRESI gerekli.' });
  const yanitAdresi = Deno.env.get('EPOSTA_YANIT') || undefined;
  const testAlici = (Deno.env.get('EPOSTA_TEST_ALICI') || '').trim();

  const sb = servisIstemcisi();
  const sonuc = async (id: number, durum: string, hata: string | null = null, saglayici: string | null = null) => {
    const { error } = await sb.rpc('eposta_sonuc', { p_id: id, p_durum: durum, p_hata: hata, p_saglayici: saglayici });
    if (error) console.error('eposta_sonuc', id, error);
  };
  const { data, error } = await sb.rpc('eposta_sirasi_al', { p_adet: ADET });
  if (error) { console.error('eposta_sirasi_al', error); return json(500, { hata: 'Kuyruk okunamadı.' }); }

  const sayi = { gonderildi: 0, atlandi: 0, hata: 0 };
  const sira = (data || []) as Sira[];
  for (let i = 0; i < sira.length; i++) {
    const s = sira[i];
    if (demoAdresMi(s.alici)) { await sonuc(s.id, 'atlandi', 'Demo adresi: gönderilmez.'); sayi.atlandi++; continue; }
    if (!s.acik) { await sonuc(s.id, 'atlandi', 'Şablon kapalı.'); sayi.atlandi++; continue; }
    const ileti = iletiYap(s.konu, s.metin, { odemeLinki: `${site}/dekont`, ...s.veri });
    const alici = testAlici || s.alici;
    try {
      const yanit = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${anahtar}`, 'Content-Type': 'application/json', 'Idempotency-Key': `fc-eposta-${s.id}-${s.deneme}` },
        body: JSON.stringify({
          from: gonderen, to: [alici], subject: testAlici ? `[TEST → ${s.alici}] ${ileti.konu}` : ileti.konu,
          text: ileti.metin, html: ileti.html, ...(yanitAdresi ? { reply_to: yanitAdresi } : {}),
          tags: [{ name: 'sablon', value: s.sablon }],
        }),
      });
      const govde = await yanit.json().catch(() => ({}));
      if (yanit.ok) { await sonuc(s.id, 'gonderildi', null, govde.id || null); sayi.gonderildi++; }
      else {
        await sonuc(s.id, 'hata', `Resend ${yanit.status}: ${govde.message || govde.name || ''}`);
        sayi.hata++;
        if (yanit.status === 429) {  // sınıra takıldı: kalanlar bir sonraki dakikaya
          for (const k of sira.slice(i + 1)) await sonuc(k.id, 'hata', 'Resend 429: sonraki turda');
          break;
        }
      }
    } catch (h) {
      await sonuc(s.id, 'hata', `Bağlantı: ${h instanceof Error ? h.message : h}`);
      sayi.hata++;
    }
    if (i < sira.length - 1) await bekle(600);
  }
  return json(200, sayi);
});
