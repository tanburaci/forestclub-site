-- Forest Club Urla · iptal kurdelesi (pgTAP, 09.11.2026): iptal duyurusu etkinliğe yazılır, ziyaretçi görür,
-- yeniden yayına alınca silinir; mail yine kuyruğa girer.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000c1', 'kurdele-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000c1', 'Kurdele Yönetici');
insert into uyeler (kod, ad, eposta, tel, baslangic, bitis, durum) values
  ('FC-U-8901', 'Kurdele Üye', 'kurdele-uye@test.invalid', '05321119999', istanbul_bugun() - 5, istanbul_bugun() + 25, 'aktif');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum) values (istanbul_bugun() + 3, '10.00', 'yoga', 'Kurdele Yoga', 10, 'yayinda');
insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum)
  select (select id from etkinlikler where ad = 'Kurdele Yoga'), (select id from uyeler where kod = 'FC-U-8901'), 'kayitli';
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
select lives_ok($$ select etkinlik_durum_degistir((select id from etkinlikler where ad = 'Kurdele Yoga'), 'iptal', null, 'iç not', 'Yağmur nedeniyle iptal.') $$,
  'etkinlik iptal edildi');
reset role;
select is((select durum_duyuru from etkinlikler where ad = 'Kurdele Yoga'), 'Yağmur nedeniyle iptal.', 'duyuru metni etkinliğe yazıldı');
select is((select count(*) from eposta_kuyrugu where sablon = 'iptal' and alici = 'kurdele-uye@test.invalid')::int, 1, 'kayıtlı üyeye iptal maili yine gitti');

set local role anon;
select is((select durum_duyuru from etkinlikler where ad = 'Kurdele Yoga'), 'Yağmur nedeniyle iptal.', 'ziyaretçi iptal edilen etkinliği ve duyurusunu görür');
reset role;

set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
select lives_ok($$ select etkinlik_durum_degistir((select id from etkinlikler where ad = 'Kurdele Yoga'), 'yayinda', null, null) $$, 'yeniden yayına alındı');
reset role;
select ok((select durum_duyuru is null from etkinlikler where ad = 'Kurdele Yoga'), 'yeniden yayında duyuru metni silindi');

select * from finish();
rollback;
