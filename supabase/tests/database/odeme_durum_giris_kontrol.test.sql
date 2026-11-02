-- Forest Club Urla · ödeme durumu (Shopier penceresi açıkken sepet sorar) ve kapıda iki aşamalı giriş (pgTAP, 02.11.2026)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f7', 'gk-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f7', 'GK Yönetici');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (current_date + 6, '10.00', 'yoga', 'GK Yoga', 10, 100, 'ucretsiz', 'yayinda'),
  (current_date + 9, '10.00', 'yoga', 'GK Başka', 10, 100, 'ucretsiz', 'yayinda');
create temp table t_e as select (select id from etkinlikler where ad = 'GK Yoga') as yoga, (select id from etkinlikler where ad = 'GK Başka') as baska;
create temp table t_k as select bilet_istegi_ac_yol('Kart Kişi', 'gk@test.invalid', '05320000009',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 1)), null, 'yeni/1730000000000-gk0000001', 'kart') as r;

-- Ödeme durumu: yalnız doğru istek + e-posta; kişisel veri dönmez
select is(bilet_istek_durum((select (r ->> 'id')::bigint from t_k), 'GK@test.invalid '), 'bekliyor', 'ödeme gelmeden: bekliyor (e-posta büyük harf/boşluk duyarsız)');
select is(bilet_istek_durum((select (r ->> 'id')::bigint from t_k), 'baska@test.invalid'), null, 'yanlış e-postayla durum dönmez');
select lives_ok(format($$ select bilet_kart_odendi(%s, 'SIP-GK1', 100) $$, (select r ->> 'id' from t_k)), 'Shopier ödemesi işlendi');
select is(bilet_istek_durum((select (r ->> 'id')::bigint from t_k), 'gk@test.invalid'), 'onaylandi', 'ödeme gelince: onaylandi');
select ok(has_function_privilege('anon', 'public.bilet_istek_durum(bigint,text)', 'execute')
  and not has_function_privilege('anon', 'public.giris_kontrol(bigint,text)', 'execute'), 'durum ziyaretçiye açık; giriş kontrolü değil');

-- Kapıda: kontrol hiçbir şey yazmaz; onaydan sonra "zaten girdi" görünür
create temp table t_b as select kod from biletler where etkinlik_id = (select yoga from t_e) limit 1;
grant select on t_b, t_e to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000f7', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select is(giris_kontrol((select yoga from t_e), (select kod from t_b)) - 'kod', '{"ad": "Kart Kişi", "tur": "bilet", "zaten": false}'::jsonb, 'kontrol: kim ve henüz girmedi');
select is((select durum from biletler where kod = (select kod from t_b)), 'gecerli', 'kontrol bileti "geldi" yapmadı');
select lives_ok(format($$ select giris_kaydet(%s, %L) $$, (select yoga from t_e), (select kod from t_b)), 'onay: giriş kaydedildi');
select throws_ok(format($$ select giris_kontrol(%s, %L) $$, (select baska from t_e), (select kod from t_b)), 'P0001', null, 'başka etkinliğin bileti reddedilir');
reset role;

select * from finish();
rollback;
