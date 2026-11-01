-- Forest Club Urla · düğün maliyeti ve seçenekler (pgTAP, 01.11.2026): müşteri fiyatı = esas maliyet × (1 + kâr %),
-- maliyet yalnız yöneticide, ziyaretçi yalnız müşteri fiyatını görür; seçenek talepte "Ana ürün · seçenek" yazılır.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'yon-mal@test.invalid'),
  ('00000000-0000-4000-8000-0000000000f2', 'uye-mal@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f1', 'Maliyet Yönetici');
create function pg_temp.ol(sub text, aal text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

-- Göçün kataloğu
select ok((select count(*) from dugun_katalog where ust_id = (select id from dugun_katalog where tur = 'urun' and grup = 'Masa' and ad = 'Yuvarlak masa' and ust_id is null)) >= 4,
  'Yuvarlak masanın seçenekleri var');
select ok((select count(distinct grup) from dugun_katalog where tur = 'urun') >= 20, 'genişletilmiş ürün grupları var');
select ok((select resim from dugun_katalog where tur = 'urun' and grup = 'Sandalye' and ad = 'Şeffaf Tiffany' and ust_id is null) like '/dugun/foto/%', 'ürün fotoğrafı bağlandı');
select is((select kira from dugun_maliyetler m join dugun_katalog k on k.id = m.katalog_id where k.grup = 'Sandalye' and k.ad = 'Şeffaf Tiffany' and k.ust_id is null),
  175.00::numeric, 'kaynaklı başlangıç maliyeti');
select is((select count(*) from dugun_fiyatlar f join dugun_maliyetler m using (katalog_id))::int, 0, 'kâr girilmeden müşteri fiyatı yok');

-- Yönetici: kâr %40 → 175 × 1,4 = 245
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000f1', 'aal2');
select is((dugun_maliyet_kaydet(jsonb_build_object('katalog_id', (select id from dugun_katalog where grup = 'Sandalye' and ad = 'Şeffaf Tiffany' and ust_id is null),
  'kira', 175, 'alis', 3700, 'esas', 'kira', 'kar_yuzde', 40, 'birim', 'adet')) ->> 'fiyat')::numeric, 245::numeric, 'müşteri fiyatı hesaplandı');
select throws_ok($$ select dugun_maliyet_kaydet(jsonb_build_object('katalog_id', (select id from dugun_katalog where grup = 'Sandalye' and ad = 'Rattan' and ust_id is null),
  'tedarikci', 'http://tedarikci.invalid')) $$, 'P0001', 'Tedarikçi bağlantısı https:// ile başlamalı.', 'https olmayan bağlantı reddedilir');
select is((dugun_maliyet_kaydet(jsonb_build_object('katalog_id', (select id from dugun_katalog where grup = 'Sandalye' and ad = 'Rattan' and ust_id is null),
  'kar_yuzde', 40)) ->> 'fiyat'), null, 'maliyeti olmayan üründe fiyat yok');
reset role;

-- Üye (yönetici değil)
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000f2', 'aal1');
select throws_ok($$ select dugun_maliyet_kaydet('{"katalog_id": 1}') $$, 'P0001', 'Bu işlem yalnız yönetici içindir.', 'üye maliyet kaydedemez');
select is((select count(*) from dugun_maliyetler)::int, 0, 'üye maliyetleri göremez');
reset role;

-- Ziyaretçi
set local role anon;
select throws_ok($$ select count(*) from dugun_maliyetler $$, '42501', null, 'ziyaretçi maliyet tablosuna erişemez');
select is((select fiyat from dugun_fiyatlari() f join dugun_katalog k on k.id = f.katalog_id where k.ad = 'Şeffaf Tiffany' and k.ust_id is null), 245::numeric,
  'ziyaretçi yalnız müşteri fiyatını görür');
reset role;

-- Seçenek talepte "Ana ürün · seçenek"
select is(dugun_talep_ac('Seçenek Çifti', 'secenek@test.invalid', '05320000099', null, true, '50_100',
  jsonb_build_object('urunler', jsonb_build_array((select k.id from dugun_katalog k join dugun_katalog u on u.id = k.ust_id where u.ad = 'Yuvarlak masa' and k.ad = 'Ø180 cm · 10 kişi'))),
  null, true), 'tamam', 'seçenekli talep kaydedildi');
select is((select secimler -> 'urunler' -> 0 ->> 'ad' from dugun_talepleri where eposta = 'secenek@test.invalid'), 'Yuvarlak masa · Ø180 cm · 10 kişi',
  'talepte "Ana ürün · seçenek"');

select * from finish();
rollback;
