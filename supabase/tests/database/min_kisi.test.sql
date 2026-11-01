-- Forest Club Urla · minimum kişi uyarısı testleri (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'min-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Min Yönetici');
-- 12 saat sonra başlayan, minimumu 5 kişi olan etkinlik (kimse kayıtlı değil); 3 gün sonraki ayrıca
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, min_kisi) values
  (((now() + interval '12 hours') at time zone 'Europe/Istanbul')::date, to_char((now() + interval '12 hours') at time zone 'Europe/Istanbul', 'HH24.MI'), 'yoga', 'Min Yoga', 12, 5),
  (current_date + 3, '10.00', 'yoga', 'Uzak Yoga', 12, 5);

select is(min_kisi_kontrol(), 1, 'yaklaşan ve minimumun altındaki etkinlik için uyarı');
select is((select count(*) from eposta_kuyrugu where sablon = 'min_kisi' and alici = 'min-yon@test.invalid')::int, 1, 'yöneticiye min_kisi maili kuyrukta');
select is(min_kisi_kontrol(), 0, 'aynı etkinlik için ikinci kez uyarı yok');
-- Saat gerçekten değişsin: test İstanbul 11.59'da koşarsa etkinlik zaten 23.59'dadır (eskiden o dakika kalıyordu)
update etkinlikler set saat = case when saat = '23.59' then '23.58' else '23.59' end where ad = 'Min Yoga';
select ok((select min_uyari_at is null from etkinlikler where ad = 'Min Yoga'), 'saat değişince uyarı sıfırlanır');
select ok((select min_uyari_at is null from etkinlikler where ad = 'Uzak Yoga'), '24 saatten uzak etkinliğe dokunulmaz');

select * from finish();
rollback;
