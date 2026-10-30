-- Forest Club Urla · düğün organizasyonu (pgTAP): katalog herkese (yalnız açıklar), talep yalnız sunucudan, seçimler
-- adlarıyla saklanır, talepler ve fiyatlar yalnız yöneticiye.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'yon-dg@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e2', 'uye-dg@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Test Yönetici');
insert into dugun_katalog (tur, ad, acik) values ('ekstra', 'Gizli ekstra DG', false);
insert into dugun_fiyatlar (katalog_id, fiyat) select id, 1000 from dugun_katalog where ad = 'Kır sofrası';

create function pg_temp.ol(sub text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

set local role anon;
select ok((select count(*) from dugun_katalog where tur = 'konsept') >= 1, 'ziyaretçi katalogu görür');
select is((select count(*) from dugun_katalog where ad = 'Gizli ekstra DG')::int, 0, 'kapalı kalem görünmez');
select throws_ok($$ select count(*) from dugun_fiyatlar $$, '42501', null, 'ziyaretçi fiyatları göremez');
select throws_ok($$ select count(*) from dugun_talepleri $$, '42501', null, 'ziyaretçi talepleri göremez');
select ok(not has_function_privilege('anon', 'public.dugun_talep_ac(text,text,text,date,boolean,text,jsonb,text,boolean)', 'execute'), 'talep yalnız sunucudan (form-gonder)');
reset role;

-- Talep: seçimler adlarıyla; kapalı / yanlış türdeki kimlik atılır
select is(dugun_talep_ac('Ayşe ve Can', 'Cift@Test.invalid', '0532 000 00 00', istanbul_bugun() + 200, false, '50_100',
  jsonb_build_object('mekan', (select id from dugun_katalog where tur = 'mekan' limit 1),
                     'bolumler', jsonb_build_array((select id from dugun_katalog where ad = 'Nikah töreni'), (select id from dugun_katalog where ad = 'Kır sofrası')),
                     'konsept', (select id from dugun_katalog where ad = 'Kır sofrası'),
                     'urunler', jsonb_build_array((select id from dugun_katalog where ad = 'Kır çiçekleri')),
                     'ekstralar', jsonb_build_array((select id from dugun_katalog where ad = 'Gizli ekstra DG'), (select id from dugun_katalog where ad = 'Düğün pastası'))),
  'Gün batımında nikah', true), 'tamam', 'talep açıldı');
select is((select secimler from dugun_talepleri where eposta = 'cift@test.invalid'),
  jsonb_build_object('mekan', 'Pinya, Urla', 'bolumler', jsonb_build_array('Nikah töreni'), 'konsept', 'Kır sofrası',
                     'urunler', jsonb_build_array(jsonb_build_object('grup', 'Çiçek', 'ad', 'Kır çiçekleri')), 'ekstralar', jsonb_build_array('Düğün pastası')),
  'seçimler adlarıyla, kapalı ve yanlış türdekiler atıldı');
select is((select count(*) from eposta_kuyrugu where alici = 'cift@test.invalid' and sablon = 'dugun_talep')::int, 1, 'çifte "talebiniz alındı" maili');
select is(dugun_talep_ac('Ayşe ve Can', 'cift@test.invalid', '05320000000', null, true, 'bilmiyorum', '{}', null, true), 'tamam', 'aynı e-posta hemen tekrar: yeni satır yok');
select is((select count(*) from dugun_talepleri where eposta = 'cift@test.invalid')::int, 1, 'tek talep');
select throws_ok($$ select dugun_talep_ac('Ali Veli', 'a@test.invalid', '05320000000', null, false, '50_100', '{}', null, true) $$,
  'P0001', null, 'tarih yoksa "henüz belli değil" gerekir');

-- Üye talepleri göremez, yönetici görür
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e2');
select is((select count(*) from dugun_talepleri)::int, 0, 'üye talepleri göremez');
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1', 'aal2');
select is((select count(*) from dugun_talepleri where eposta = 'cift@test.invalid')::int, 1, 'yönetici talepleri görür');
reset role;

select * from finish();
rollback;
