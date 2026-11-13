-- Forest Club Urla · etkinlik ürünlerinde stok (pgTAP, 13.11.2026): ürün eklenince envanter kalemi açılır, stok girişi,
-- bekleyen siparişler kalanı düşürür, kalandan fazlası sipariş edilemez, kesinleşen satış envanterden düşer ("satis" kaydı),
-- panel adedi fark olarak yazar.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'stok-yon@test.invalid'), ('00000000-0000-4000-8000-0000000000e2', 'stok-uye@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Stok Yönetici');
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum)
  values (((now() + interval '30 minutes') at time zone 'Europe/Istanbul')::date, to_char((now() + interval '30 minutes') at time zone 'Europe/Istanbul', 'HH24.MI'),
          'bulusma', 'Stok Etkinlik', 30, 'yayinda');
insert into urunler (ad, fiyat) values ('Stok Yelpaze', 1500);
insert into etkinlik_urunleri (etkinlik_id, urun_id) select e.id, u.id from etkinlikler e, urunler u where e.ad = 'Stok Etkinlik' and u.ad = 'Stok Yelpaze';
create temp table t as select (select id from etkinlikler where ad = 'Stok Etkinlik') as e, (select id from urunler where ad = 'Stok Yelpaze') as u,
  (select envanter_id from urunler where ad = 'Stok Yelpaze') as env;
grant select on t to authenticated;
create function pg_temp.sip(ep text, adet int, yol text default 'nakit') returns jsonb language sql as $$
  select urun_siparisi_ac((select e from t), 'Stok Kişi', ep, '05320000000', jsonb_build_array(jsonb_build_object('urun', (select u from t), 'adet', adet)), yol, null)
$$;

-- ---------- Kalem ve stok girişi ----------
select is((select kategori || '/' || adet || '/' || ad from envanter where id = (select env from t)), 'Satış ürünü/0.00/Stok Yelpaze', 'ürün eklenince envanter kalemi (stok 0)');
update urunler set ad = 'Stok Yelpaze X' where id = (select u from t);
select is((select ad from envanter where id = (select env from t)), 'Stok Yelpaze X', 'ürün adı değişince kalemin adı da değişir');
select is((etkinlik_urun_listesi((select e from t)) -> 0 ->> 'kalan')::numeric, 0::numeric, 'stok yokken liste kalan 0 verir');
select throws_ok($$ select pg_temp.sip('a@test.invalid', 1) $$, 'P0001', 'Stok Yelpaze X tükendi.', 'stok yokken sipariş alınmaz');
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e2');
select throws_ok($$ select urun_stok_ekle((select u from t), 5) $$, 'P0001', 'Bu işlem yalnız yönetici içindir.', 'yönetici olmayan stok giremez');
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
select is(urun_stok_ekle((select u from t), 5), 5::numeric, 'yönetici 5 adet stok girer');
reset role;

-- ---------- Bekleyen siparişler kalanı düşürür ----------
create temp table t_n as select pg_temp.sip('n@test.invalid', 3) as r;
select is((etkinlik_urun_listesi((select e from t)) -> 0 ->> 'kalan')::numeric, 2::numeric, 'bekleyen nakit sipariş (3) kalanı 2''ye düşürür');
select throws_ok($$ select pg_temp.sip('b@test.invalid', 3) $$, 'P0001', 'Stok Yelpaze X için en çok 2 adet kaldı.', 'kalandan fazlası sipariş edilemez');
insert into urun_siparisleri (etkinlik_id, ad, eposta, tel, kalemler, tutar, odeme_yolu, created_at)
  select e, 'Eski Kart', 'eski@test.invalid', '05320000000', jsonb_build_array(jsonb_build_object('urun_id', u, 'ad', 'x', 'adet', 2, 'birim', 1500, 'tutar', 3000)),
         3000, 'kart', now() - interval '2 hours' from t;
select is((etkinlik_urun_listesi((select e from t)) -> 0 ->> 'kalan')::numeric, 2::numeric, '2 saat önce yarıda kalan kart siparişi stok tutmaz');

-- ---------- Kesinleşince envanterden düşer ----------
grant select on t_n to authenticated;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
select lives_ok($$ select urun_karar((select (r ->> 'id')::bigint from t_n), true) $$, 'nakit sipariş ödendi');
reset role;
select is((select adet from envanter where id = (select env from t)), 2::numeric, 'satılan 3 adet envanterden düştü (5 → 2)');
select is((select neden || '/' || adet from envanter_dusumleri where siparis_id = (select (r ->> 'id')::bigint from t_n)), 'satis/3.00', 'envanterde "satış" kaydı');

-- ---------- Panel adedi fark olarak ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
select is(envanter_adet_degis((select env from t), 4), 6::numeric, 'panel +4: 2 → 6 (arada satılan ezilmez)');
select is(envanter_adet_degis((select env from t), -10), 0::numeric, 'adet 0''ın altına inmez');
reset role;

select * from finish();
rollback;
