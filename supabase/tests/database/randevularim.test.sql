-- Forest Club Urla · üyenin biletleri (Randevularım): onaylı bilet kodları ve incelemedeki istekler; okutulan düşer.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(4);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'uye-rv@test.invalid'), ('00000000-0000-4000-8000-0000000000d2', 'baska-rv@test.invalid');
insert into uyeler (kod, ad, eposta, user_id, baslangic, bitis, durum) values
  ('FC-T-9401', 'Randevu Test', 'uye-rv@test.invalid', '00000000-0000-4000-8000-0000000000d1', istanbul_bugun() - 5, istanbul_bugun() + 25, 'aktif'),
  ('FC-T-9402', 'Başka Üye', 'baska-rv@test.invalid', '00000000-0000-4000-8000-0000000000d2', istanbul_bugun() - 5, istanbul_bugun() + 25, 'aktif');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, durum) values (istanbul_bugun() + 4, '10.00', 'atolye', 'RV Atölye', 20, 800, 'yayinda');
insert into bilet_istekleri (uye_id, ad, eposta, kalemler, tutar, dosya, yuklendi, durum) values
  ((select id from uyeler where kod = 'FC-T-9401'), 'Randevu Test', 'uye-rv@test.invalid', jsonb_build_array(jsonb_build_object('etkinlik_id', (select id from etkinlikler where ad = 'RV Atölye'), 'adet', 2, 'tutar', 1200)), 1200, 'yeni/rv-1', true, 'onaylandi'),
  ((select id from uyeler where kod = 'FC-T-9401'), 'Randevu Test', 'uye-rv@test.invalid', jsonb_build_array(jsonb_build_object('etkinlik_id', (select id from etkinlikler where ad = 'RV Atölye'), 'adet', 1, 'tutar', 800)), 800, 'yeni/rv-2', true, 'bekliyor');
insert into biletler (kod, istek_id, etkinlik_id, ad) select x, (select min(id) from bilet_istekleri where dosya = 'yeni/rv-1'), (select id from etkinlikler where ad = 'RV Atölye'), 'Randevu Test' from unnest(array['FC-B-RVAA11', 'FC-B-RVBB22']) x;
update biletler set durum = 'geldi' where kod = 'FC-B-RVBB22';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select is((select array_agg(kod order by kod)::text from uye_biletlerim() where durum = 'bilet'), '{FC-B-RVAA11}', 'onaylı bilet kodu görünür, okutulan düşer');
select is((select count(*) from uye_biletlerim() where durum = 'inceleniyor')::int, 1, 'incelemedeki istek görünür');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
select is((select count(*) from uye_biletlerim())::int, 0, 'başka üye bu biletleri göremez');
reset role;
select ok(not has_function_privilege('anon', 'public.uye_biletlerim()', 'execute'), 'ziyaretçi çağıramaz');
select * from finish();
rollback;
