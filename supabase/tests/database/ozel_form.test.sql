-- Forest Club Urla · özel form (pgTAP): panelde görünmez, yalnız bağlantı anahtarıyla açılır ve doldurulur.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'ozel1@test.invalid');
insert into uyeler (kod, ad, eposta, user_id) values (yeni_uye_kodu(), 'Özel Bir', 'ozel1@test.invalid', '00000000-0000-4000-8000-0000000000d1');
insert into formlar (baslik, acik, ozel, sorular) values
  ('Özel form', true, true, '[{"id":"s1","metin":"Adın","tur":"kisa","zorunlu":true}]'),
  ('Kapalı özel', false, true, '[]');
select isnt((select anahtar from formlar where baslik = 'Özel form'), (select anahtar from formlar where baslik = 'Kapalı özel'), 'her formun ayrı anahtarı var');
create temp table k as select id, anahtar from formlar where baslik in ('Özel form', 'Kapalı özel');
grant select on k to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000d1', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from formlar)::int, 0, 'özel form panelde / listede görünmez');

select is((select count(*) from ozel_form('yanlis'))::int, 0, 'yanlış anahtarla form gelmez');
select is((select baslik from ozel_form((select anahtar from k order by id limit 1))), 'Özel form', 'doğru anahtarla form gelir');
select is((select count(*) from ozel_form((select anahtar from k order by id desc limit 1)))::int, 0, 'kapalı özel form gelmez');
select throws_ok($$ select form_yanitla((select id from k order by id limit 1), '{"s1":"Ali"}') $$, 'P0001', 'Bu form artık cevap almıyor.', 'anahtarsız cevap reddedilir');
select is(form_yanitla((select id from k order by id limit 1), '{"s1":"Ali"}', (select anahtar from k order by id limit 1)) ->> 's1', 'Ali', 'anahtarla cevap yazılır');
reset role;

select * from finish();
rollback;
