-- Forest Club Urla · üye formları testleri (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'form1@test.invalid'),
  ('00000000-0000-4000-8000-0000000000c2', 'form2@test.invalid');
insert into uyeler (kod, ad, eposta, user_id) values
  (yeni_uye_kodu(), 'Form Bir', 'form1@test.invalid', '00000000-0000-4000-8000-0000000000c1'),
  (yeni_uye_kodu(), 'Form İki', 'form2@test.invalid', '00000000-0000-4000-8000-0000000000c2');
insert into formlar (baslik, acik, sorular) values
  ('Açık form', true, '[{"id":"s1","metin":"Adın","tur":"kisa","zorunlu":true},
                        {"id":"s2","metin":"Gün","tur":"tek","secenekler":["Cumartesi","Pazar"],"zorunlu":true},
                        {"id":"s3","metin":"İlgi","tur":"coklu","secenekler":["Yoga","Müzik"]},
                        {"id":"s4","metin":"Not","tur":"uzun"}]'),
  ('Kapalı form', false, '[]');

create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated')::text, true);
$$;

select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
set local role authenticated;
select is((select count(*) from formlar)::int, 1, 'üye yalnız açık formu görür');
select throws_ok($$ select form_yanitla((select id from formlar where baslik = 'Açık form'), '{"s2":"Pazar"}') $$,
  'P0001', '"Adın" sorusunu cevapla.', 'zorunlu soru boşsa reddedilir');
select throws_ok($$ select form_yanitla((select id from formlar where baslik = 'Açık form'), '{"s1":"Ali","s2":"Salı"}') $$,
  'P0001', '"Gün" için geçersiz seçim.', 'listede olmayan tek seçim reddedilir');
select throws_ok($$ select form_yanitla((select id from formlar where baslik = 'Açık form'), '{"s1":"Ali","s2":"Pazar","s3":["Yüzme"]}') $$,
  'P0001', '"İlgi" için geçersiz seçim.', 'listede olmayan çoklu seçim reddedilir');
select is(form_yanitla((select id from formlar where baslik = 'Açık form'), '{"s1":" Ali ","s2":"Pazar","s3":["Yoga"],"s4":"","x":"atılır"}'),
  '{"s1":"Ali","s2":"Pazar","s3":["Yoga"]}'::jsonb, 'cevap temizlenip yazıldı (boş ve bilinmeyen alan yok)');
select lives_ok($$ select form_yanitla((select id from formlar where baslik = 'Açık form'), '{"s1":"Ali","s2":"Cumartesi"}') $$, 'cevap düzeltilebilir');
select is((select cevaplar ->> 's2' from form_yanitlari), 'Cumartesi', 'düzeltme tek satırı günceller');
reset role;

-- Başka üye kapalı forma yazamaz, başkasının cevabını görmez
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
set local role authenticated;
select is((select count(*) from form_yanitlari)::int, 0, 'üye başkasının cevabını görmez');
select throws_ok($$ select form_yanitla((select id from formlar where baslik = 'Açık form') + 1, '{}') $$,
  'P0001', 'Bu form artık cevap almıyor.', 'kapalı forma cevap yazılmaz');
select throws_ok($$ insert into form_yanitlari (form_id, uye_id) values ((select id from formlar where baslik = 'Açık form'), 1) $$,
  '42501', null, 'üye tabloya doğrudan yazamaz');
reset role;

-- KVKK: anonimleştirmede cevaplar silinir; veri kopyasında görünür
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
select is(jsonb_array_length(veri_kopyasi() -> 'formlar'), 1, 'veri kopyasında form cevabı var');
update uyeler set eposta = 'silindi-' || id || '@silindi.invalid' where eposta = 'form1@test.invalid';
select is((select count(*) from form_yanitlari)::int, 0, 'anonimleştirilen üyenin cevapları silindi');

select * from finish();
rollback;
