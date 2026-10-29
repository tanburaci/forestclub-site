-- Forest Club Urla · maillerde WhatsApp rezervasyonu / iletişimi kalmadı (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(2);
select is_empty($$ select id from eposta_sablonlari where metin ilike '%whatsapp%' or metin ilike '%reservation%' $$,
  'hiçbir mail şablonunda WhatsApp / Reservation yok');
select ok((select metin like '%“Randevu oluştur”%' from eposta_sablonlari where id = 'onay'), 'hoş geldin maili "Randevu oluştur" diyor');
select * from finish();
rollback;
