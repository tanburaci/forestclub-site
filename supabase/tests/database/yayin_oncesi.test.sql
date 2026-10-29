-- Forest Club Urla · açılış öncesi düzeltmeler (pgTAP): yönetici notu, kontenjan, yenileme maili, ad denetimi.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'yon-yo@test.invalid'),
  ('00000000-0000-4000-8000-0000000000c2', 'uye-yo@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000c1', 'Test Yönetici');
insert into uyeler (kod, ad, eposta, user_id, baslangic, bitis, durum) values
  ('FC-T-9301', 'Not Test', 'uye-yo@test.invalid', '00000000-0000-4000-8000-0000000000c2', istanbul_bugun() - 10, istanbul_bugun() + 20, 'aktif');

create function pg_temp.ol(sub text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

-- Eski sütuna yazılan not tabloya taşınır, sütun boş kalır
update uyeler set yonetici_notu = 'Gizli not' where kod = 'FC-T-9301';
select is((select yonetici_notu from uyeler where kod = 'FC-T-9301'), null, 'uyeler.yonetici_notu boş kalır');
select is((select metin from uye_notlari where uye_id = (select id from uyeler where kod = 'FC-T-9301')), 'Gizli not', 'not uye_notlari''na taşındı');

-- Üye notunu göremez, yönetici görür
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select is((select count(*) from uye_notlari)::int, 0, 'üye yönetici notunu göremez');
select throws_ok($$ insert into uye_notlari (uye_id, metin) values ((select id from uyeler limit 1), 'x') $$, '42501', null, 'üye not yazamaz');
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1', 'aal2');
select is((select count(*) from uye_notlari where metin = 'Gizli not')::int, 1, 'yönetici notu görür');
reset role;

-- Kontenjan: incelemedeki bilet de yer tutar
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, durum) values
  (istanbul_bugun() + 5, '10.00', 'bulusma', 'Kontenjan Test YO', 1, 500, 'yayinda');
insert into bilet_istekleri (ad, eposta, kalemler, tutar, dosya, yuklendi)
  values ('Misafir', 'misafir-yo@test.invalid',
          jsonb_build_array(jsonb_build_object('etkinlik_id', (select id from etkinlikler where ad = 'Kontenjan Test YO'), 'adet', 1, 'tutar', 500)),
          500, 'yeni/test-yo-1', true);
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select is(etkinlik_kaydi((select id from etkinlikler where ad = 'Kontenjan Test YO'), 'katil') ->> 'durum', 'bekleme', 'incelemedeki bilet varken dolu etkinlikte üye bekleme listesine yazılır');
reset role;

-- Yenileme: ilk ödemede "onay", sonrakinde "uzatma"
insert into uyeler (kod, ad, eposta, durum) values ('FC-T-9302', 'Yeni Üye', 'yeni-yo@test.invalid', 'basvuru');
select uyelik_uzat((select id from uyeler where kod = 'FC-T-9302'), 3000, 'havale', null, 'test-yo-ref-1');
select uyelik_uzat((select id from uyeler where kod = 'FC-T-9302'), 3000, 'havale', null, 'test-yo-ref-2');
select is((select array_agg(sablon order by id)::text from eposta_kuyrugu where alici = 'yeni-yo@test.invalid'), '{onay,uzatma}',
  'ilk ödemede hoş geldin, sonrakinde üyelik uzadı maili');

-- Ad alanında bağlantı / e-posta olamaz
select throws_ok($$ insert into uyeler (kod, ad, eposta) values ('FC-T-9303', 'Ödeme gerekli https://kotu.example/odeme', 'x1-yo@test.invalid') $$,
  'P0001', null, 'adda bağlantı reddedilir');
select throws_ok($$ insert into tanisma_biletleri (ad, eposta, alinis, durum, kod) values ('Tıkla kotu-site.com', 'x2-yo@test.invalid', istanbul_bugun(), 'bekliyor', 'TST-YO-1') $$,
  'P0001', null, 'alan adı gibi yazılan ad reddedilir');
select lives_ok($$ insert into uyeler (kod, ad, eposta) values ('FC-T-9304', 'Ayşe Nur Çelik-Öztürk', 'x3-yo@test.invalid') $$, 'normal ad kabul edilir');
select lives_ok($$ insert into uyeler (kod, ad, eposta) values ('FC-T-9305', 'M. Ali Kaya', 'x4-yo@test.invalid') $$, 'baş harfli ad kabul edilir');

-- Üye kendi dekontunun incelemede olduğunu görür
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select is(dekont_bekliyor(), false, 'dekont yokken incelemede değil');
reset role;
insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, tutar, dosya, durum)
  values ((select id from uyeler where kod = 'FC-T-9301'), 'uye-yo@test.invalid', 'Not Test', istanbul_bugun(), 3000, 'yeni/test-yo-d', 'bekliyor');
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c2');
select is(dekont_bekliyor(), true, 'yüklenen dekont incelemede görünür');
reset role;

select * from finish();
rollback;
