-- Forest Club Urla · özel form (pgTAP): panelde görünmez, bağlantı anahtarıyla girişsiz açılır ve ad + e-postayla doldurulur.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'ozel1@test.invalid');
insert into uyeler (kod, ad, eposta, user_id) values (yeni_uye_kodu(), 'Özel Bir', 'ozel1@test.invalid', '00000000-0000-4000-8000-0000000000d1');
insert into formlar (baslik, acik, ozel, sorular) values
  ('Özel form', true, true, '[{"id":"s1","metin":"Adın","tur":"kisa","zorunlu":true}]'),
  ('Kapalı özel', false, true, '[]');
create temp table k as select id, baslik, anahtar from formlar where baslik in ('Özel form', 'Kapalı özel');
grant select on k to anon, authenticated;
select isnt((select anahtar from k where baslik = 'Özel form'), (select anahtar from k where baslik = 'Kapalı özel'), 'her formun ayrı anahtarı var');

-- Üye listede görmez, numarayla cevaplayamaz
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000d1', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from formlar)::int, 0, 'özel form panelde / listede görünmez');
select throws_ok($$ select form_yanitla((select id from k where baslik = 'Özel form'), '{"s1":"Ali"}') $$, 'P0001', 'Bu form artık cevap almıyor.', 'numarayla cevap reddedilir');
reset role;

-- Girişsiz: bağlantıyla açılır
set local role anon;
select is((select baslik from ozel_form((select anahtar from k where baslik = 'Özel form'))), 'Özel form', 'girişsiz, doğru anahtarla form gelir');
select is((select count(*) from ozel_form('yanlis'))::int, 0, 'yanlış anahtarla form gelmez');
select is((select count(*) from ozel_form((select anahtar from k where baslik = 'Kapalı özel')))::int, 0, 'kapalı özel form gelmez');
select ok(not has_function_privilege('anon', 'public.ozel_form_yanitla(text,text,text,jsonb)', 'execute'), 'cevap yalnız sunucudan (form-gonder)');
reset role;

-- Cevap: ad + e-posta; aynı e-posta güncellenir
select is(ozel_form_yanitla((select anahtar from k where baslik = 'Özel form'), 'Ayşe Kaya', 'Ayse@Test.invalid', '{"s1":"Merhaba"}') ->> 's1', 'Merhaba', 'girişsiz cevap yazılır');
select lives_ok($$ select ozel_form_yanitla((select anahtar from k where baslik = 'Özel form'), 'Ayşe Kaya', 'ayse@test.invalid', '{"s1":"Düzelttim"}') $$, 'aynı e-posta tekrar gönderebilir');
select is((select string_agg(ad || '|' || eposta || '|' || (cevaplar ->> 's1'), ',') from form_yanitlari), 'Ayşe Kaya|ayse@test.invalid|Düzelttim', 'tek satır, güncellendi');
select throws_ok($$ select ozel_form_yanitla('yanlis', 'Ayşe Kaya', 'b@test.invalid', '{"s1":"x"}') $$, 'P0001', 'Bu form artık cevap almıyor.', 'yanlış anahtarla cevap reddedilir');
select throws_ok($$ select ozel_form_yanitla((select anahtar from k where baslik = 'Özel form'), 'Ayşe Kaya', 'c@test.invalid', '{}') $$, 'P0001', '"Adın" sorusunu cevapla.', 'zorunlu soru denetlenir');

select * from finish();
rollback;
