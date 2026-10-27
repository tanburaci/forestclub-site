-- Forest Club Urla: zamanlanmış işler (29.10.2026, pg_cron + pg_net).
--   her dakika          eposta-gonder Edge Function: kuyruktaki mailleri gönderir
--   her saat (:17)      dekont-temizle Edge Function: 24 saatten eski, kayda bağlanmamış dekont dosyalarını siler
--   her gün 09.00 TR    gunluk_epostalar(): yenileme ve etkinlik hatırlatmalarını kuyruğa yazar
--   her gün 06.30 TR    iki günden eski istek sayaçlarını ve kullanılmamış yükleme haklarını siler
-- Edge Function adresi ve zamanlayıcı anahtarı koda yazılmaz; Supabase Vault'tan okunur (PR açıklamasındaki adımlar):
--   fc_proje_url               https://<proje>.supabase.co
--   fc_zamanlayici_anahtari    Edge Function secret'ı ZAMANLAYICI_ANAHTARI ile aynı uzun rastgele değer
-- Vault'ta bu iki değer yoksa işler hiçbir şey yapmaz (hata vermez).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Bir Edge Function'ı zamanlayıcı anahtarıyla çağırır (yanıt beklenmez). Dönüş: pg_net istek numarası ya da null
create or replace function public.edge_cagir(p_islev text)
  returns bigint language plpgsql security definer set search_path = public as $$
declare
  adres text;
  anahtar text;
begin
  select decrypted_secret into adres from vault.decrypted_secrets where name = 'fc_proje_url';
  select decrypted_secret into anahtar from vault.decrypted_secrets where name = 'fc_zamanlayici_anahtari';
  if adres is null or anahtar is null then return null; end if;
  return net.http_post(
    url := rtrim(adres, '/') || '/functions/v1/' || p_islev,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-zamanlayici', anahtar),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
end $$;
revoke execute on function public.edge_cagir(text) from public, anon, authenticated;

create or replace function public.eski_kayitlari_temizle()
  returns void language sql security definer set search_path = public as $$
    delete from istek_sayaci where saat < now() - interval '2 days';
    delete from dekont_yuklemeleri y where y.created_at < now() - interval '2 days'
      and not exists (select 1 from dekontlar d where d.dosya = y.dosya);
  $$;
revoke execute on function public.eski_kayitlari_temizle() from public, anon, authenticated;

-- Aynı adla yeniden çalıştırılırsa iş güncellenir (saatler UTC: 06.00 UTC = 09.00 İstanbul)
select cron.schedule('fc-eposta-gonder', '* * * * *', $$select public.edge_cagir('eposta-gonder')$$);
select cron.schedule('fc-dekont-temizle', '17 * * * *', $$select public.edge_cagir('dekont-temizle')$$);
select cron.schedule('fc-gunluk-epostalar', '0 6 * * *', $$select public.gunluk_epostalar()$$);
select cron.schedule('fc-eski-kayitlar', '30 3 * * *', $$select public.eski_kayitlari_temizle()$$);
