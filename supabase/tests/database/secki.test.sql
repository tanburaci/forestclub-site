-- Forest Club Urla · Seçki (pgTAP, 15.11.2026): "Seçki'de satışta" ürünler etkinlikten bağımsız her zaman listelenir ve
-- sipariş alınır; yalnız kart ya da havale; stok sınırı ortak; onayda muhasebeye "Seçki · U-…" geliri ve "secki_siparis"
-- e-postası. Etkinlik ürünlerinin penceresi değişmez.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'secki-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Seçki Yönetici');
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

insert into urunler (ad, fiyat, secki, aciklama) values ('Seçki Yelpaze', 1500, true, 'Elde yapıldı.'), ('Seçki Değil', 900, false, null),
  ('Seçki Kapalı', 700, true, null);
update urunler set aktif = false where ad = 'Seçki Kapalı';
update envanter set adet = 3 where id = (select envanter_id from urunler where ad = 'Seçki Yelpaze');
update envanter set adet = 10 where id = (select envanter_id from urunler where ad in ('Seçki Değil', 'Seçki Kapalı'));
create temp table t_u as select (select id from urunler where ad = 'Seçki Yelpaze') as y, (select id from urunler where ad = 'Seçki Değil') as degil,
  (select id from urunler where ad = 'Seçki Kapalı') as kapali;
-- Pencere dışındaki bir etkinlik (6 saat sonra): Seçki ürünü etkinliğe bağlı olsa da etkinlik siparişi kapalı kalır
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum)
  values (((now() + interval '6 hours') at time zone 'Europe/Istanbul')::date, to_char((now() + interval '6 hours') at time zone 'Europe/Istanbul', 'HH24.MI'),
          'bulusma', 'Seçki Uzak', 30, 'yayinda');
insert into etkinlik_urunleri (etkinlik_id, urun_id) select (select id from etkinlikler where ad = 'Seçki Uzak'), y from t_u;
grant select on t_u to anon, authenticated;

create function pg_temp.kalem(u bigint, n int) returns jsonb language sql as $$ select jsonb_build_array(jsonb_build_object('urun', u, 'adet', n)) $$;

-- ---------- Liste ----------
select ok(has_function_privilege('anon', 'public.secki_listesi()', 'execute'), 'ziyaretçi Seçki listesini görebilir');
set local role anon;
select is((select array_agg(x ->> 'ad') from jsonb_array_elements(secki_listesi()) x where x ->> 'ad' like 'Seçki %'), array['Seçki Yelpaze'],
  'listede yalnız Seçki''de satışta olan aktif ürünler');
select is((select x ->> 'aciklama' || ' / ' || (x ->> 'kalan')::numeric::int from jsonb_array_elements(secki_listesi()) x where x ->> 'ad' = 'Seçki Yelpaze'),
  'Elde yapıldı. / 3', 'liste: açıklama ve kalan stok');
reset role;

-- ---------- Sipariş kuralları ----------
select throws_ok(format($$ select urun_siparisi_ac(null, 'Nakit Kişi', 'n@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'nakit', null) $$, (select y from t_u)),
  'P0001', 'Ödeme yolu geçersiz.', 'Seçki''de nakit yok');
select throws_ok(format($$ select urun_siparisi_ac(null, 'X Kişi', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'kart', null) $$, (select degil from t_u)),
  'P0001', 'Seçtiğin ürünlerden biri şu an satılmıyor; sayfayı yenile.', 'Seçki''de olmayan ürün Seçki''den satılmaz');
select throws_ok(format($$ select urun_siparisi_ac(null, 'X Kişi', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'kart', null) $$, (select kapali from t_u)),
  'P0001', 'Seçtiğin ürünlerden biri şu an satılmıyor; sayfayı yenile.', 'satışa kapalı ürün Seçki''den de satılmaz');
select throws_ok(format($$ select urun_siparisi_ac(null, 'X Kişi', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 4), 'kart', null) $$, (select y from t_u)),
  'P0001', 'Seçki Yelpaze için en çok 3 adet kaldı.', 'stoktan fazlası alınamaz');
select throws_ok(format($$ select urun_siparisi_ac(%s, 'X Kişi', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'nakit', null) $$,
  (select id from etkinlikler where ad = 'Seçki Uzak'), (select y from t_u)), 'P0001', 'Bu etkinlikte ürün satışı şu an kapalı.',
  'etkinlik siparişinin penceresi değişmedi');

-- ---------- Kart: Seçki siparişi, ödeme gelince kesinleşir ----------
create temp table t_k as select urun_siparisi_ac(null, 'Kart Kişi', 'kart-secki@test.invalid', '0532 000 00 02', pg_temp.kalem((select y from t_u), 2), 'kart', null) as r;
select is((select (r ->> 'tutar')::numeric || '/' || (r ->> 'secki') || '/' || (r ->> 'etkinlik') from t_k), '3000/true/Seçki', 'kart: tutar sunucuda, Seçki siparişi');
select is((select etkinlik_id from urun_siparisleri where id = (select (r ->> 'id')::bigint from t_k)), null, 'siparişin etkinliği yok');
select is((select (x ->> 'kalan')::numeric from jsonb_array_elements(secki_listesi()) x where x ->> 'ad' = 'Seçki Yelpaze'), 1::numeric, 'bekleyen sipariş kalan stoktan düşülür');
select is(urun_kart_odendi((select (r ->> 'id')::bigint from t_k), 'SHP-SECKI-1', 3000) ->> 'durum', 'onaylandi', 'ödeme gelince sipariş kesinleşir');
select is((select aciklama like 'Seçki · U-%' and kategori = 'Ürün satışı' and etkinlik_id is null from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_k)),
  true, 'muhasebe: "Ürün satışı" geliri, açıklama "Seçki · U-…"');
select is((select adet from envanter where id = (select envanter_id from urunler where ad = 'Seçki Yelpaze')), 1::numeric, 'satış stoktan düştü');
select is((select sablon from eposta_kuyrugu where alici = 'kart-secki@test.invalid' order by id desc limit 1), 'secki_siparis',
  'alıcıya Seçki e-postası (teslim bir sonraki buluşmada)');

-- ---------- Havale: dekontla yöneticiye, onayla kesinleşir ----------
create temp table t_h as select urun_siparisi_ac(null, 'Havale Kişi', 'havale-secki@test.invalid', '0532 000 00 03', pg_temp.kalem((select y from t_u), 1), 'havale',
  'yeni/1730000000000-secki0123456789') as r;
update urun_siparisleri set yuklendi = true where id = (select (r ->> 'id')::bigint from t_h);
grant select on t_h to authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1');
set local role authenticated;
select is(urun_karar((select (r ->> 'id')::bigint from t_h), true) ->> 'durum', 'onaylandi', 'havale: yönetici onaylayınca kesinleşir');
reset role;

select * from finish();
rollback;
