-- Forest Club Urla · bilet ödeme yolları (pgTAP, 02.11.2026): nakit hemen yer ayırır ve yöneticiye düşer (nakit kasa),
-- kart Shopier ödemesi doğrulanınca kendiliğinden kesinleşir (tutar eşleşmeli, ikinci bildirim işlemez), yönetici
-- kart isteğine karar veremez; işlevler yalnız service_role ile.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'yol-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Yol Yönetici');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (current_date + 7, '10.00', 'yoga', 'Yol Yoga', 5, 1000, 'ucretsiz', 'yayinda');
create temp table t_e as select (select id from etkinlikler where ad = 'Yol Yoga') as yoga;
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

select ok(not has_function_privilege('anon', 'public.bilet_istegi_ac_yol(text,text,text,jsonb,uuid,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.bilet_istegi_ac_yol(text,text,text,jsonb,uuid,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.bilet_kart_odendi(bigint,text,numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.bilet_shopier_urun(bigint,text)', 'execute'),
  'ödeme yolu işlevleri yalnız service_role ile');

-- Nakit: yer hemen ayrılır, yöneticiye düşer
create temp table t_n as select bilet_istegi_ac_yol('Nakit Kişi', 'nakit@test.invalid', '05320000001',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 2)), null, 'yeni/1730000000000-nakit0001', 'nakit') as r;
select is((select odeme_yolu || '/' || yuklendi from bilet_istekleri where id = (select (r ->> 'id')::bigint from t_n)), 'nakit/true', 'nakit isteği hemen yer ayırır');
select is(bilet_bekleyen((select yoga from t_e)), 2, 'nakit rezervasyon kontenjandan düşer');
select throws_ok($$ select bilet_istegi_ac_yol('X Y', 'x@test.invalid', '05320000000', '[]', null, 'yeni/1730000000000-yanlis001', 'bitcoin') $$,
  'P0001', 'Ödeme yolu geçersiz.', 'bilinmeyen ödeme yolu reddedilir');

-- Kart: ödeme gelene kadar yer ayırmaz
create temp table t_k as select bilet_istegi_ac_yol('Kart Kişi', 'kart@test.invalid', '05320000002',
  jsonb_build_array(jsonb_build_object('etkinlik', (select yoga from t_e), 'adet', 1)), null, 'yeni/1730000000000-kart00001', 'kart') as r;
select is((select odeme_yolu || '/' || yuklendi from bilet_istekleri where id = (select (r ->> 'id')::bigint from t_k)), 'kart/false', 'kart isteği ödeme gelene kadar yer ayırmaz');
select lives_ok(format($$ select bilet_shopier_urun(%s, 'urun-123') $$, (select r ->> 'id' from t_k)), 'Shopier ürün numarası kaydedilir');

-- Yönetici: nakit parayı alınca onaylar; kart isteğine karar veremez
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
select is((bilet_karar((select (r ->> 'id')::bigint from t_n), true) ->> 'adet')::int, 2, 'nakit: yönetici onaylayınca 2 bilet');
select throws_ok(format($$ select bilet_karar(%s, true) $$, (select r ->> 'id' from t_k)), 'P0001', 'Bilet isteği bulunamadı.', 'ödenmemiş kart isteği yöneticide görünmez');
reset role;
select is((select kasa::text || '/' || odeme::text from muhasebe_hareketleri where belge = 'bilet:' || (select r ->> 'id' from t_n)), 'nakit/elden',
  'nakit bilet: muhasebe nakit kasa / elden');

-- Kart ödendi (Shopier bildirimi): tutar eşleşmeli, biletler kendiliğinden kesinleşir, ikinci bildirim işlemez
select throws_ok(format($$ select bilet_kart_odendi(%s, 'SIP-1', 999) $$, (select r ->> 'id' from t_k)), 'P0001', 'Ödenen tutar istekle eşleşmiyor.', 'eksik tutar reddedilir');
select is((bilet_kart_odendi((select (r ->> 'id')::bigint from t_k), 'SIP-1', 1000) ->> 'adet')::int, 1, 'kart ödendi: bilet kesinleşti');
select is((bilet_kart_odendi((select (r ->> 'id')::bigint from t_k), 'SIP-1', 1000) ->> 'zaten')::boolean, true, 'aynı bildirim ikinci kez işlemez');
select is((select kasa::text || '/' || odeme::text from muhasebe_hareketleri where belge = 'bilet:' || (select r ->> 'id' from t_k)), 'banka/kart',
  'kart bilet: muhasebe banka / kart');
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
select throws_ok(format($$ select bilet_karar(%s, false) $$, (select r ->> 'id' from t_k)), 'P0001', 'Bu istek zaten sonuçlandı.', 'kesinleşmiş kart biletine sonradan karar verilmez');
reset role;

select * from finish();
rollback;
