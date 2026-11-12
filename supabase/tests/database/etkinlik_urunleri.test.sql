-- Forest Club Urla · etkinliğe özel ürünler (pgTAP, 13.11.2026): ürünler yalnız etkinlik başlangıcından 1 saat önce ile
-- 5 saat sonrası arasında listelenir ve sipariş alınır (sunucuda); toplam sunucuda hesaplanır; kart Shopier ödemesiyle,
-- havale / nakit / POS yönetici onayıyla kesinleşir; onayda muhasebeye "Ürün satışı" geliri ve alıcıya e-posta.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000f1', 'urun-yon@test.invalid'),
  ('00000000-0000-4000-8000-0000000000f2', 'urun-uye@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f1', 'Ürün Yönetici');
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Etkinlikler: başlangıcı İstanbul saatiyle şimdiden +30 dk (açık), +3 saat (henüz kapalı), −4 saat (açık), −6 saat (kapandı)
create function pg_temp.etk(ad text, fark interval) returns bigint language sql as $$
  insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum)
    values (((now() + fark) at time zone 'Europe/Istanbul')::date, to_char((now() + fark) at time zone 'Europe/Istanbul', 'HH24.MI'), 'bulusma', ad, 30, 'yayinda')
    returning id
$$;
create temp table t_e as select pg_temp.etk('Ürün Yakın', interval '30 minutes') as yakin, pg_temp.etk('Ürün Sonra', interval '3 hours') as sonra,
  pg_temp.etk('Ürün Sürüyor', interval '-4 hours') as suruyor, pg_temp.etk('Ürün Bitti', interval '-6 hours') as bitti;
insert into urunler (ad, fiyat) values ('Test Yelpaze 1', 1500), ('Test Yelpaze 2', 2000), ('Test Kapalı', 100);
update urunler set aktif = false where ad = 'Test Kapalı';
create temp table t_u as select (select id from urunler where ad = 'Test Yelpaze 1') as y1, (select id from urunler where ad = 'Test Yelpaze 2') as y2,
  (select id from urunler where ad = 'Test Kapalı') as kapali;
insert into etkinlik_urunleri (etkinlik_id, urun_id)
  select e, u from t_e, t_u, lateral (values (yakin), (sonra), (suruyor), (bitti)) x(e), lateral (values (y1), (y2), (kapali)) y(u);
grant select on t_e, t_u to anon, authenticated;

create function pg_temp.kalem(variadic ciftler bigint[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('urun', ciftler[i], 'adet', ciftler[i + 1])) from generate_series(1, array_length(ciftler, 1), 2) i
$$;

-- ---------- Yetkiler ----------
select ok(not has_function_privilege('anon', 'public.urun_siparisi_ac(bigint,text,text,text,jsonb,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.urun_siparisi_ac(bigint,text,text,text,jsonb,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.urun_kart_odendi(bigint,text,numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.urun_shopier_urun(bigint,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.urun_kaydet(bigint,text)', 'execute')
  and not has_function_privilege('anon', 'public.urun_karar(bigint,boolean,text)', 'execute'),
  'sipariş açma, kart ödemesi ve dekont işlevleri yalnız service_role ile; karar yalnız giriş yapmışa');
select ok(has_function_privilege('anon', 'public.etkinlik_urun_listesi(bigint)', 'execute')
  and has_function_privilege('anon', 'public.urun_siparis_durum(bigint,text)', 'execute'),
  'ziyaretçi ürün listesini ve kendi siparişinin durumunu sorabilir');

-- ---------- Satış penceresi (sunucuda) ----------
set local role anon;
select is(jsonb_array_length(etkinlik_urun_listesi((select yakin from t_e))), 2, 'başlangıca 30 dk kala: aktif ürünler listelenir (kapalı ürün yok)');
select is((select array_agg(x ->> 'ad' order by (x ->> 'fiyat')::numeric) from jsonb_array_elements(etkinlik_urun_listesi((select yakin from t_e))) x),
  array['Test Yelpaze 1', 'Test Yelpaze 2'], 'liste: ad ve fiyat');
select is(etkinlik_urun_listesi((select sonra from t_e)), '[]'::jsonb, 'başlangıca 3 saat varken ürün görünmez');
select is(jsonb_array_length(etkinlik_urun_listesi((select suruyor from t_e))), 2, 'başlangıçtan 4 saat sonra hâlâ satılır');
select is(etkinlik_urun_listesi((select bitti from t_e)), '[]'::jsonb, 'başlangıçtan 6 saat sonra ürün görünmez');
select is((select count(*) from urunler)::int, 0, 'ziyaretçi ürün tablosunu doğrudan okuyamaz');
select is((select count(*) from urun_siparisleri)::int, 0, 'ziyaretçi siparişleri göremez');
reset role;

select throws_ok(format($$ select urun_siparisi_ac(%s, 'Geç Kişi', 'gec@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'nakit', null) $$,
  (select sonra from t_e), (select y1 from t_u)), 'P0001', 'Bu etkinlikte ürün satışı şu an kapalı.', 'pencere dışında sipariş reddedilir');
select throws_ok(format($$ select urun_siparisi_ac(%s, 'Geç Kişi', 'gec@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'nakit', null) $$,
  (select bitti from t_e), (select y1 from t_u)), 'P0001', 'Bu etkinlikte ürün satışı şu an kapalı.', 'etkinlikten 6 saat sonra sipariş reddedilir');
select throws_ok(format($$ select urun_siparisi_ac(%s, 'Kapalı Kişi', 'kapali@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'nakit', null) $$,
  (select yakin from t_e), (select kapali from t_u)), 'P0001', 'Seçtiğin ürünlerden biri şu an satılmıyor; sayfayı yenile.', 'satışa kapalı ürün reddedilir');
select throws_ok(format($$ select urun_siparisi_ac(%s, 'X Y', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'bitcoin', null) $$,
  (select yakin from t_e), (select y1 from t_u)), 'P0001', 'Ödeme yolu geçersiz.', 'bilinmeyen ödeme yolu reddedilir');
select throws_ok(format($$ select urun_siparisi_ac(%s, 'X Y', 'x@test.invalid', '05320000000', pg_temp.kalem(%s, 1), 'havale', null) $$,
  (select yakin from t_e), (select y1 from t_u)), 'P0001', 'Dosya adı geçersiz.', 'havalede dekont yolu zorunlu');

-- ---------- Nakit: toplam sunucuda, sipariş kodu, yöneticiye düşer ----------
create temp table t_n as select urun_siparisi_ac((select yakin from t_e), 'Nakit Kişi', 'nakit@test.invalid', '0532 000 00 01',
  pg_temp.kalem((select y1 from t_u), 2, (select y2 from t_u), 1), 'nakit', null) as r;
select is((select (r ->> 'tutar')::numeric from t_n), 5000::numeric, 'toplam sunucuda: 2 × 1500 + 1 × 2000');
select is((select r ->> 'kod' from t_n), (select 'U-' || (r ->> 'id') from t_n), 'standda gösterilecek kısa sipariş kodu');
select is((select odeme_yolu || '/' || yuklendi || '/' || durum from urun_siparisleri where id = (select (r ->> 'id')::bigint from t_n)), 'nakit/true/bekliyor',
  'nakit sipariş hemen yöneticinin listesine düşer');

-- ---------- Yönetici kararı ----------
grant select on t_n to authenticated;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000f2');
select throws_ok(format($$ select urun_karar(%s, true) $$, (select r ->> 'id' from t_n)), 'P0001', 'Bu işlem yalnız yönetici içindir.', 'yönetici olmayan karar veremez');
select pg_temp.ol('00000000-0000-4000-8000-0000000000f1');
select is(urun_karar((select (r ->> 'id')::bigint from t_n), true) ->> 'durum', 'onaylandi', 'yönetici nakit siparişi "ödendi" işaretler');
reset role;
select is((select kasa::text || '/' || odeme::text || '/' || kategori || '/' || tutar from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_n)),
  'nakit/elden/Ürün satışı/5000.00', 'nakit ürün satışı: muhasebe nakit kasa / elden');
select is((select etkinlik_id from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_n)), (select yakin from t_e), 'gelir etkinliğe bağlı');
select is((select count(*) from eposta_kuyrugu where sablon = 'urun_siparis' and alici = 'nakit@test.invalid')::int, 1, 'alıcıya onay e-postası kuyrukta');

-- POS: banka / kart; red: e-posta gider, muhasebeye yazılmaz
create temp table t_p as select urun_siparisi_ac((select suruyor from t_e), 'Pos Kişi', 'pos@test.invalid', '05320000002',
  pg_temp.kalem((select y2 from t_u), 1), 'pos', null) as r;
create temp table t_r as select urun_siparisi_ac((select suruyor from t_e), 'Red Kişi', 'red@test.invalid', '05320000003',
  pg_temp.kalem((select y1 from t_u), 1), 'nakit', null) as r;
grant select on t_p, t_r to authenticated;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000f1');
select lives_ok(format($$ select urun_karar(%s, true) $$, (select r ->> 'id' from t_p)), 'POS siparişi onaylanır');
select is(urun_karar((select (r ->> 'id')::bigint from t_r), false, 'Gelmedi') ->> 'durum', 'reddedildi', 'yönetici siparişi reddeder');
reset role;
select is((select kasa::text || '/' || odeme::text from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_p)), 'banka/kart', 'POS: muhasebe banka / kart');
select is((select count(*) from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_r))::int, 0, 'reddedilen sipariş muhasebeye yazılmaz');

-- ---------- Kart (Shopier) ----------
create temp table t_k as select urun_siparisi_ac((select yakin from t_e), 'Kart Kişi', 'kart@test.invalid', '05320000004',
  pg_temp.kalem((select y1 from t_u), 1), 'kart', null) as r;
select lives_ok(format($$ select urun_shopier_urun(%s, 'urun-shopier-1') $$, (select r ->> 'id' from t_k)), 'Shopier ürün numarası kaydedilir');
grant select on t_k to authenticated, anon;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000f1');
select throws_ok(format($$ select urun_karar(%s, true) $$, (select r ->> 'id' from t_k)), 'P0001', 'Sipariş bulunamadı.', 'ödenmemiş kart siparişi yöneticide görünmez');
reset role;
select is(urun_kart_odendi((select (r ->> 'id')::bigint from t_k), 'USIP-1', 1500) ->> 'durum', 'onaylandi', 'kart ödendi: sipariş kesinleşti');
select is((select (urun_kart_odendi((select (r ->> 'id')::bigint from t_k), 'USIP-1', 1500) ->> 'zaten')::boolean), true, 'aynı bildirim ikinci kez işlemez');
select is((select string_agg(kasa::text || '/' || odeme::text, ',') from muhasebe_hareketleri where belge = 'urun:' || (select r ->> 'id' from t_k)), 'banka/kart',
  'kart ürün satışı: muhasebe banka / kart, bir kez');
create temp table t_k2 as select urun_siparisi_ac((select yakin from t_e), 'Eksik Kişi', 'eksik@test.invalid', '05320000005',
  pg_temp.kalem((select y2 from t_u), 1), 'kart', null) as r;
select is(urun_kart_odendi((select (r ->> 'id')::bigint from t_k2), 'USIP-2', 999) ->> 'durum', 'iade', 'eksik tutar: sipariş kesinleşmez, iade uyarısı');
set local role anon;
select is(urun_siparis_durum((select (r ->> 'id')::bigint from t_k), 'KART@test.invalid '), 'onaylandi', 'ziyaretçi kendi siparişinin durumunu görür');
reset role;

select * from finish();
rollback;
