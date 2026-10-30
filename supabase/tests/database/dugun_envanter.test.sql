-- Forest Club Urla · düğün envanteri (pgTAP): gider + envantere giriş tek işlemde, hasarlı düşüm adedi azaltır, fazlası
-- düşülemez, silinen hareket geri alınır; etkinlik envanteri düşüm kaydı; yalnız yönetici.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000de01', 'yon-de@test.invalid'),
  ('00000000-0000-4000-8000-00000000de02', 'uye-de@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-00000000de01', 'Test Yönetici');
insert into dugun_talepleri (ad, eposta, tel, tarih_esnek, kisi) values ('Envanter Çifti', 'env-de@test.invalid', '05320000000', true, 'bilmiyorum');

create function pg_temp.ol(sub text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

-- Üye çalıştıramaz
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-00000000de02');
select throws_ok($$ select dugun_gider_ekle('{"tutar": 100, "aciklama": "x"}') $$, 'P0001', 'Bu işlem yalnız yönetici içindir.', 'üye düğün gideri ekleyemez');
select is((select count(*) from dugun_envanter)::int, 0, 'üye düğün envanterini göremez');

-- Yönetici: gider + envantere giriş + düğün gideri
select pg_temp.ol('00000000-0000-4000-8000-00000000de01', 'aal2');
select ok((dugun_gider_ekle(jsonb_build_object('tarih', istanbul_bugun(), 'tutar', 12000, 'kasa', 'banka', 'aciklama', 'Cam fanus 40 adet',
  'talep_id', (select id from dugun_talepleri where eposta = 'env-de@test.invalid'), 'envantere', true, 'ad', 'Cam fanus DE', 'grup', 'Mum', 'adet', 40)) ->> 'envanter_id') is not null,
  'gider eklendi, envantere girdi');
select is((select adet from dugun_envanter where ad = 'Cam fanus DE'), 40.00, 'envanter adedi 40');
select is((select kategori || ' ' || tutar::int from muhasebe_hareketleri where aciklama = 'Cam fanus 40 adet'), 'Düğün 12000', 'muhasebeye "Düğün" gideri yazıldı');
select is((select count(*) from dugun_giderleri where aciklama = 'Cam fanus 40 adet')::int, 1, 'düğünün giderlerine eklendi');

-- Hasarlı düşüm, fazlası düşülemez, silinince geri gelir
insert into dugun_envanter_hareketleri (envanter_id, tur, neden, adet) values ((select id from dugun_envanter where ad = 'Cam fanus DE'), 'dusum', 'hasarli', 3);
select is((select adet from dugun_envanter where ad = 'Cam fanus DE'), 37.00, '3 hasarlı düşüldü');
select throws_ok($$ insert into dugun_envanter_hareketleri (envanter_id, tur, neden, adet) values ((select id from dugun_envanter where ad = 'Cam fanus DE'), 'dusum', 'kayip', 50) $$,
  'P0001', 'Envanterde bu kadar yok; en çok mevcut adet kadar düşülebilir.', 'mevcuttan fazlası düşülemez');
delete from dugun_envanter_hareketleri where neden = 'hasarli';
select is((select adet from dugun_envanter where ad = 'Cam fanus DE'), 40.00, 'silinen düşüm geri alındı');

-- Etkinlik envanteri düşüm kaydı
insert into envanter (ad, kategori, adet, giris, tarih) values ('Yoga matı DE', 'Yoga / hareket', 6, 'satin', istanbul_bugun());
select lives_ok($$ insert into envanter_dusumleri (envanter_id, neden, adet, notlar) values ((select id from envanter where ad = 'Yoga matı DE'), 'kullanilamaz', 2, 'yırtık') $$,
  'etkinlik envanteri düşüm kaydı');
reset role;
select ok(not has_function_privilege('anon', 'public.dugun_gider_ekle(jsonb)', 'execute'), 'ziyaretçi çağıramaz');

select * from finish();
rollback;
