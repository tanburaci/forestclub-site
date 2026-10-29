-- Forest Club Urla · hoş geldin maili yer ayırmayı üye panelinden anlatır (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(2);
select ok((select metin like '%“Randevu oluştur”%' and metin not like '%Reservation%' from eposta_sablonlari where id = 'onay'),
  'hoş geldin maili "Randevu oluştur" diyor, WhatsApp Reservation grubu yok');
select ok((select metin like '%{sifreLinki}%' from eposta_sablonlari where id = 'onay'), 'şifre bağlantısı yerinde');
select * from finish();
rollback;
