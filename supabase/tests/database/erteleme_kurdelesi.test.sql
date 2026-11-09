-- Forest Club Urla · erteleme kurdelesi (pgTAP, 09.11.2026): erteleme duyurusu etkinliğe yazılır, etkinlik
-- yayında kalır, ziyaretçi görür; mail yine kuyruğa girer; yeniden yayına alınca silinir.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c2', 'ertele-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000c2', 'Ertele Yönetici');
insert into uyeler (kod, ad, eposta, tel, baslangic, bitis, durum) values
  ('FC-U-8902', 'Ertele Üye', 'ertele-uye@test.invalid', '05321119999', istanbul_bugun() - 5, istanbul_bugun() + 25, 'aktif');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum) values (istanbul_bugun() + 3, '10.00', 'yoga', 'Ertele Yoga', 10, 'yayinda');
insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum)
  select (select id from etkinlikler where ad = 'Ertele Yoga'), (select id from uyeler where kod = 'FC-U-8902'), 'kayitli';
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select lives_ok($$ select etkinlik_durum_degistir((select id from etkinlikler where ad = 'Ertele Yoga'), 'ertelendi', istanbul_bugun() + 10, 'iç not', 'Yağmur nedeniyle 10 güne ertelendi.') $$,
  'etkinlik ertelendi');
reset role;
select is((select durum || ' ' || (tarih - istanbul_bugun()) || ' ' || durum_duyuru from etkinlikler where ad = 'Ertele Yoga'), 'yayinda 10 Yağmur nedeniyle 10 güne ertelendi.', 'yayında, yeni tarihte, duyuru metni etkinlikte');
select is((select count(*) from eposta_kuyrugu where sablon = 'iptal' and alici = 'ertele-uye@test.invalid')::int, 1, 'kayıtlı üyeye erteleme maili yine gitti');

set local role anon;
select is((select durum_duyuru from etkinlikler where ad = 'Ertele Yoga'), 'Yağmur nedeniyle 10 güne ertelendi.', 'ziyaretçi ertelenen etkinliği ve duyurusunu görür');
reset role;

set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select lives_ok($$ select etkinlik_durum_degistir((select id from etkinlikler where ad = 'Ertele Yoga'), 'yayinda', null, null) $$, 'yeniden yayına alındı');
reset role;
select ok((select durum_duyuru is null from etkinlikler where ad = 'Ertele Yoga'), 'yeniden yayında duyuru metni silindi');

select * from finish();
rollback;
