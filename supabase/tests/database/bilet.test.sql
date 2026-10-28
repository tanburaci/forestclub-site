-- Forest Club Urla · etkinlik bileti (havale + dekont) testleri (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'bilet-yon@test.invalid'),
  ('00000000-0000-4000-8000-0000000000d2', 'bilet-uye@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000d1', 'Bilet Yönetici');
insert into uyeler (kod, ad, eposta, tel, user_id, baslangic, bitis, durum) values
  (yeni_uye_kodu(), 'Bilet Üye', 'bilet-uye@test.invalid', '05321112233', '00000000-0000-4000-8000-0000000000d2', current_date - 5, current_date + 25, 'aktif');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (current_date + 7, '10.00', 'yoga', 'Bilet Yoga', 3, 1000, 'yuzde50', 'yayinda'),
  (current_date + 8, '10.00', 'bulusma', 'Bilet Kahvaltı', 30, 600, 'ucretsiz', 'yayinda');
create temp table t_e as select (select id from etkinlikler where ad = 'Bilet Yoga') as yoga, (select id from etkinlikler where ad = 'Bilet Kahvaltı') as kahvalti;

select ok(not has_function_privilege('anon', 'public.bilet_istegi_ac(text,text,text,jsonb,uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.bilet_istegi_ac(text,text,text,jsonb,uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.bilet_kaydet(bigint,text)', 'execute'),
  'istek ve kayıt işlevleri yalnız service_role ile');

-- Misafir: tam fiyat
create temp table t_m as select bilet_istegi_ac('Misafir Kişi', 'misafir@test.invalid', '05320000000',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 2)), null, 'yeni/1730000000000-misafir01') as r;
select is((select (r ->> 'tutar')::numeric from t_m), 2000::numeric, 'misafir: 2 × 1.000 TL');
select throws_ok(format($$ select bilet_istegi_ac('X Y', 'x@test.invalid', '05320000000', '[{"etkinlik": %s, "adet": 4}]', null, 'yeni/1730000000000-fazla0001') $$, (select yoga from t_e)),
  'P0001', 'Bilet Yoga için yeterli yer kalmadı.', 'kontenjanı aşan istek reddedilir');
select throws_ok(format($$ select bilet_istegi_ac('X Y', 'x@test.invalid', '0532', '[{"etkinlik": %s, "adet": 1}]', null, 'yeni/1730000000000-telefon01') $$, (select kahvalti from t_e)),
  'P0001', 'Telefon numaranı yaz.', 'misafirde telefon zorunlu');

-- Dekont yüklenmeden yer ayrılmaz; yüklenince ayrılır
select throws_ok(format($$ select bilet_kaydet(%s, 'misafir@test.invalid') $$, (select (r ->> 'id') from t_m)),
  'P0001', 'Dekont dosyası yüklenemedi; tekrar dene.', 'dosya depoda yoksa kayıt olmaz');
insert into storage.objects (bucket_id, name) values ('dekontlar', 'yeni/1730000000000-misafir01');
select is(bilet_kaydet((select (r ->> 'id')::bigint from t_m), 'misafir@test.invalid'), 'tamam', 'dekont yüklendi');
select is(bilet_bekleyen((select yoga from t_e)), 2, 'bekleyen istek 2 yer ayırır');
select throws_ok(format($$ select bilet_istegi_ac('X Y', 'x@test.invalid', '05320000000', '[{"etkinlik": %s, "adet": 2}]', null, 'yeni/1730000000000-fazla0002') $$, (select yoga from t_e)),
  'P0001', 'Bilet Yoga için yeterli yer kalmadı.', 'ayrılan yer kontenjandan düşer');

-- Aktif üye: %50'li etkinlikte bir bilet yarı fiyat, ücretsiz etkinlikte misafir bileti tam fiyat; telefon profilden
create temp table t_u as select bilet_istegi_ac('Bilet Üye', 'bilet-uye@test.invalid', '',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 1), jsonb_build_object('etkinlik', (select kahvalti from t_e), 'adet', 1)),
  '00000000-0000-4000-8000-0000000000d2', 'yeni/1730000000000-uye000001') as r;
select is((select (r ->> 'tutar')::numeric from t_u), 1100::numeric, 'üye: yoga 500 + misafir kahvaltı 600');

-- Yönetici onayı
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a9', 'role', 'authenticated')::text, true);
select throws_ok(format($$ select bilet_karar(%s, true) $$, (select r ->> 'id' from t_m)), 'P0001', 'Bu işlem yalnız yönetici içindir.', 'yönetici olmayan onaylayamaz');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000d1', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select is((select bilet_karar((select (r ->> 'id')::bigint from t_m), true) ->> 'adet'), '2', 'onay: 2 bilet');
select is((select count(*) from biletler where kod ~ '^FC-B-[A-Z0-9]{6}$' and etkinlik_id = (select yoga from t_e))::int, 2, 'iki FC-B kodu üretildi');
select is((select satilan_bilet from etkinlikler where id = (select yoga from t_e)), 2, 'satılan bilet sayısı arttı');
select is((select tutar from muhasebe_hareketleri where belge = 'bilet:' || (select r ->> 'id' from t_m)), 2000::numeric(12, 2), 'muhasebeye 2.000 TL gelir');
select is((select count(*) from eposta_kuyrugu where sablon = 'bilet' and alici = 'misafir@test.invalid')::int, 1, 'bilet maili kuyrukta');

-- Kapıda bilet kodu
select is((giris_kaydet((select yoga from t_e), (select kod from biletler limit 1)) ->> 'bilet'), 'true', 'kapıda bilet kodu okunur');

select * from finish();
rollback;
