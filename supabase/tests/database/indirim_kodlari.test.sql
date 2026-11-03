-- Forest Club Urla · bilet indirim kodları (pgTAP, 02.11.2026): yüzde / TL, süresi geçmiş, sınır, kalemlere dağıtım,
-- muhasebeye indirimli tutar, kullanım bilet kesinleşince sayılır; ziyaretçi kod tablosunu okuyamaz.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(12);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f1', 'kod-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f1', 'Kod Yönetici');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (current_date + 7, '10.00', 'yoga', 'Kod Yoga', 20, 1000, 'ucretsiz', 'yayinda'),
  (current_date + 8, '19.00', 'bulusma', 'Kod Konser', 20, 3000, 'ucretsiz', 'yayinda');
create temp table t_e as select (select id from etkinlikler where ad = 'Kod Yoga') as yoga, (select id from etkinlikler where ad = 'Kod Konser') as konser;
insert into indirim_kodlari (kod, tur, deger, son_tarih, sinir) values
  ('YUZDE20', 'yuzde', 20, null, null), ('TL500', 'tl', 500, null, 1), ('ESKI', 'yuzde', 10, current_date - 1, null), ('KOCAMAN', 'tl', 99999, null, null);

select ok(not has_table_privilege('anon', 'public.indirim_kodlari', 'select'), 'ziyaretçi kod listesini okuyamaz');
select ok(has_function_privilege('anon', 'public.indirim_kodu_bak(text)', 'execute'), 'ziyaretçi tek kodu deneyebilir');
select is(indirim_kodu_bak(' yuzde20 ') ->> 'tur', 'yuzde', 'kod büyük/küçük harf ve boşluk duyarsız');
select is(indirim_kodu_bak('ESKI') ->> 'gecerli', 'false', 'süresi geçmiş kod reddedilir');
select is(indirim_kodu_bak('YOKBOYLE')::text, '{"gecerli": false}', 'olmayan kod aynı yanıtı verir');

-- %20: 1×1000 + 1×3000 = 4000 → 800 indirim, kalemlere 200 / 600
create temp table t_y as select bilet_istegi_ac_yol('Kod Kişi', 'kod@test.invalid', '05320000003',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 1), jsonb_build_object('etkinlik', (select konser from t_e), 'adet', 1)),
  null, 'yeni/1730000000000-kod000001', 'havale', 'yuzde20') as r;
select is((select tutar from bilet_istekleri where id = (select (r ->> 'id')::bigint from t_y)), 3200.00::numeric, '%20 kod: 4000 → 3200');
select is((select string_agg(k ->> 'tutar', ',' order by (k ->> 'etkinlik_id')::bigint) from bilet_istekleri, jsonb_array_elements(kalemler) k
           where id = (select (r ->> 'id')::bigint from t_y)), '800.00,2400.00', 'indirim kalemlere orantılı dağıtıldı');

-- Onay: muhasebeye indirimli tutarlar, kod kullanımı sayılır
update bilet_istekleri set yuklendi = true where id = (select (r ->> 'id')::bigint from t_y);
grant select on t_y to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000f1', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select lives_ok(format($$ select bilet_karar(%s, true) $$, (select r ->> 'id' from t_y)), 'indirimli bilet onaylanır');
reset role;
select is((select sum(tutar) from muhasebe_hareketleri where belge = 'bilet:' || (select r ->> 'id' from t_y)), 3200.00::numeric, 'muhasebeye indirimli toplam yazıldı');
select is((select kullanilan from indirim_kodlari where kod = 'YUZDE20'), 1, 'kullanım bilet kesinleşince sayıldı');

-- TL kodu toplamı aşamaz; sınırı dolan kod geçmez
select throws_ok($$ select bilet_istegi_ac_yol('Kod Kişi', 'kod2@test.invalid', '05320000004',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 1)), null, 'yeni/1730000000000-kod000002', 'havale', 'KOCAMAN') $$,
  'P0001', 'Bu indirim kodu bu sepette kullanılamaz.', 'toplamı aşan TL kodu reddedilir');
update indirim_kodlari set kullanilan = 1 where kod = 'TL500';
select is(indirim_kodu_bak('TL500') ->> 'gecerli', 'false', 'sınırı dolan kod reddedilir');

select * from finish();
rollback;
