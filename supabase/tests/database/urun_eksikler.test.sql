-- Forest Club Urla · etkinlik ürünleri eksikleri (pgTAP, 13.11.2026): iptalde bekleyen siparişler reddedilir ve ödenmişler
-- için yöneticiye iade uyarısı; KVKK silmede ürün siparişleri anonimleşir; stok girişinde maliyet muhasebeye gider.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'eks-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000d1', 'Eks Yönetici');
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, durum)
  values (((now() + interval '30 minutes') at time zone 'Europe/Istanbul')::date, to_char((now() + interval '30 minutes') at time zone 'Europe/Istanbul', 'HH24.MI'),
          'bulusma', 'Eks Etkinlik', 30, 'yayinda');
insert into urunler (ad, fiyat) values ('Eks Yelpaze', 1000);
update envanter set adet = 50 where id = (select envanter_id from urunler where ad = 'Eks Yelpaze');
insert into etkinlik_urunleri (etkinlik_id, urun_id) select e.id, u.id from etkinlikler e, urunler u where e.ad = 'Eks Etkinlik' and u.ad = 'Eks Yelpaze';
create temp table t as select (select id from etkinlikler where ad = 'Eks Etkinlik') as e, (select id from urunler where ad = 'Eks Yelpaze') as u;
grant select on t to authenticated;
create function pg_temp.sip(ad text, ep text, yol text) returns bigint language sql as $$
  select (urun_siparisi_ac((select e from t), ad, ep, '05320000000', jsonb_build_array(jsonb_build_object('urun', (select u from t), 'adet', 1)), yol,
          case when yol = 'havale' then 'yeni/eks-' || md5(ep) end) ->> 'id')::bigint
$$;
create temp table s as select pg_temp.sip('Ödendi Kişi', 'odendi@test.invalid', 'nakit') as odendi, pg_temp.sip('Bekleyen Kişi', 'bekleyen@test.invalid', 'nakit') as bekleyen,
  pg_temp.sip('Havale Kişi', 'havale@test.invalid', 'havale') as havale;
update urun_siparisleri set yuklendi = true where id = (select havale from s);
grant select on s to authenticated;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000d1');
select lives_ok($$ select urun_karar((select odendi from s), true) $$, 'bir sipariş ödendi');
reset role;

-- ---------- İptal ----------
update etkinlikler set durum = 'iptal' where id = (select e from t);
select is((select string_agg(durum::text, ',' order by id) from urun_siparisleri where id in ((select bekleyen from s), (select havale from s))), 'reddedildi,reddedildi',
  'iptalde bekleyen siparişler reddedilir');
select is((select durum::text from urun_siparisleri where id = (select odendi from s)), 'onaylandi', 'ödenmiş sipariş durur (iade elle)');
select ok((select count(*) from eposta_kuyrugu where sablon = 'urun_red' and alici = 'havale@test.invalid' and veri ->> 'neden' like '%iade edilecek%') = 1
  and (select count(*) from eposta_kuyrugu where sablon = 'urun_red' and alici = 'bekleyen@test.invalid') = 1, 'bekleyenlere iptal e-postası; havaleye iade notu');
select ok((select count(*) from eposta_kuyrugu where alici = 'eks-yon@test.invalid' and veri ->> 'ozet' like '%Eks Etkinlik iptal edildi: 2 ödenmiş ürün siparişi%Ödendi Kişi%Havale Kişi%') = 1,
  'yöneticiye iade uyarısı (ödenen + dekontu gelen havale)');

-- ---------- KVKK ----------
insert into uyeler (kod, ad, eposta, tel, durum, baslangic, bitis) values (yeni_uye_kodu(), 'Ödendi Kişi', 'odendi@test.invalid', '05320000000', 'aktif', current_date - 5, current_date + 25);
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000d1');
select lives_ok($$ select uye_anonimlestir((select id from uyeler where eposta = 'odendi@test.invalid')) $$, 'üye anonimleştirildi');
reset role;
select ok((select ad like 'Silinmiş üye #%' and eposta like 'silindi-%@silindi.invalid' and tel = 'silindi' from urun_siparisleri where id = (select odendi from s)),
  'ürün siparişinde ad / e-posta / telefon silindi');
select ok((select aciklama not like '%Ödendi Kişi%' from muhasebe_hareketleri where belge = 'urun:' || (select odendi from s)), 'muhasebe açıklamasında ad yok');

-- ---------- Stok maliyeti ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000d1');
select throws_ok($$ select urun_stok_ekle((select u from t), 10, 500, null) $$, 'P0001', 'Ödemenin hangi kasadan yapıldığını seçin.', 'maliyet varsa kasa zorunlu');
select urun_stok_ekle((select u from t), 10, 500, 'nakit');
reset role;
select is((select kategori || '/' || tutar || '/' || kasa from muhasebe_hareketleri where kategori = 'Ürün alımı' and aciklama like 'Eks Yelpaze%'), 'Ürün alımı/500.00/nakit',
  'stok maliyeti muhasebeye "Ürün alımı" gideri');

select * from finish();
rollback;
