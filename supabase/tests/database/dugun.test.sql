-- Forest Club Urla · düğün organizasyonu (pgTAP): katalog herkese (yalnız açıklar), talep yalnız sunucudan, seçimler
-- adlarıyla saklanır, talepler ve fiyatlar yalnız yöneticiye.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'yon-dg@test.invalid'),
  ('00000000-0000-4000-8000-0000000000e2', 'uye-dg@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e1', 'Test Yönetici');
insert into dugun_katalog (tur, ad, acik) values ('ekstra', 'Gizli ekstra DG', false);
insert into dugun_fiyatlar (katalog_id, fiyat) select id, 1000 from dugun_katalog where ad = 'Kır sofrası';

create function pg_temp.ol(sub text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

set local role anon;
select ok((select count(*) from dugun_katalog where tur = 'konsept') >= 1, 'ziyaretçi katalogu görür');
select is((select count(*) from dugun_katalog where ad = 'Gizli ekstra DG')::int, 0, 'kapalı kalem görünmez');
select throws_ok($$ select count(*) from dugun_fiyatlar $$, '42501', null, 'ziyaretçi fiyatları göremez');
select throws_ok($$ select count(*) from dugun_talepleri $$, '42501', null, 'ziyaretçi talepleri göremez');
select ok(not has_function_privilege('anon', 'public.dugun_talep_ac(text,text,text,date,boolean,text,jsonb,text,boolean,text)', 'execute'), 'talep yalnız sunucudan (form-gonder)');
reset role;

-- Talep: seçimler adlarıyla; kapalı / yanlış türdeki kimlik atılır
select is(dugun_talep_ac('Ayşe ve Can', 'Cift@Test.invalid', '0532 000 00 00', istanbul_bugun() + 200, false, '50_100',
  jsonb_build_object('mekan', (select id from dugun_katalog where tur = 'mekan' limit 1),
                     'bolumler', jsonb_build_array((select id from dugun_katalog where ad = 'Nikah töreni'), (select id from dugun_katalog where ad = 'Kır sofrası')),
                     'konsept', (select id from dugun_katalog where ad = 'Kır sofrası'),
                     'urunler', jsonb_build_array((select id from dugun_katalog where ad = 'Kır çiçekleri')),
                     'ekstralar', jsonb_build_array((select id from dugun_katalog where ad = 'Gizli ekstra DG'), (select id from dugun_katalog where ad = 'Düğün pastası'))),
  'Gün batımında nikah', true), 'tamam', 'talep açıldı');
select is((select secimler - 'his' from dugun_talepleri where eposta = 'cift@test.invalid'),
  jsonb_build_object('mekan', 'Pinya, Urla', 'bolumler', jsonb_build_array('Nikah töreni'), 'konsept', 'Kır sofrası',
                     'urunler', jsonb_build_array(jsonb_build_object('grup', 'Çiçek', 'ad', 'Kır çiçekleri')), 'ekstralar', jsonb_build_array('Düğün pastası')),
  'seçimler adlarıyla, kapalı ve yanlış türdekiler atıldı');
select is((select count(*) from eposta_kuyrugu where alici = 'cift@test.invalid' and sablon = 'dugun_talep')::int, 1, 'çifte "talebiniz alındı" maili');
select is(dugun_talep_ac('Ayşe ve Can', 'cift@test.invalid', '05320000000', null, true, 'bilmiyorum', '{}', null, true), 'tamam', 'aynı e-posta hemen tekrar: yeni satır yok');
select is((select count(*) from dugun_talepleri where eposta = 'cift@test.invalid')::int, 1, 'tek talep');
select throws_ok($$ select dugun_talep_ac('Ali Veli', 'a@test.invalid', '05320000000', null, false, '50_100', '{}', null, true) $$,
  'P0001', null, 'tarih yoksa "henüz belli değil" gerekir');

-- Renk paleti, kendi renkleri (geçersiz renk atılır) ve his (en çok 3)
select is(dugun_talep_ac('Deniz ve Ece', 'renk@test.invalid', '05320000002', null, true, 'bilmiyorum',
  jsonb_build_object('palet', (select id from dugun_katalog where tur = 'palet' and ad = 'Lavanta bahçesi'),
                     'renkler', jsonb_build_array('#A99BC7', 'kırmızı', '#ffffff'),
                     'his', jsonb_build_array((select id from dugun_katalog where tur = 'his' and ad = 'Doğal'), (select id from dugun_katalog where tur = 'his' and ad = 'Romantik'))),
  null, true), 'tamam', 'paletli talep açıldı');
select is((select secimler - 'bolumler' - 'urunler' - 'ekstralar' from dugun_talepleri where eposta = 'renk@test.invalid'),
  jsonb_build_object('palet', 'Lavanta bahçesi', 'palet_renkler', jsonb_build_array('#a99bc7', '#d9d0ea', '#7f8c6a', '#f6f2ea', '#c8a15a'),
                     'renkler', jsonb_build_array('#a99bc7', '#ffffff'), 'his', jsonb_build_array('Doğal', 'Romantik')),
  'palet renkleriyle, kendi renkleri ve his adlarıyla saklandı');

-- Özel davet bağlantısı: ziyaretçi anahtarla çiftin adını görür; talep davete bağlanır; yanlış anahtar reddedilir
insert into dugun_davetleri (ad) values ('Selin ve Mert');
create temp table dv as select anahtar from dugun_davetleri where ad = 'Selin ve Mert';
grant select on dv to anon;
set local role anon;
select is((select ad from dugun_davet_bilgi((select anahtar from dv))), 'Selin ve Mert', 'davet bağlantısı çiftin adını verir');
select is((select count(*) from dugun_davet_bilgi('yanlis'))::int, 0, 'yanlış anahtar boş döner');
reset role;
select is(dugun_talep_ac('Selin ve Mert', 'davet@test.invalid', '05320000003', null, true, 'bilmiyorum', '{}', null, true,
  (select anahtar from dugun_davetleri where ad = 'Selin ve Mert')), 'tamam', 'davetle talep açıldı');
select is((select d.talep_id = t.id and t.davet_id = d.id from dugun_davetleri d join dugun_talepleri t on t.eposta = 'davet@test.invalid' where d.ad = 'Selin ve Mert'), true, 'talep ve davet birbirine bağlandı');

-- Üye talepleri göremez, yönetici görür
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000e2');
select is((select count(*) from dugun_talepleri)::int, 0, 'üye talepleri göremez');
select pg_temp.ol('00000000-0000-4000-8000-0000000000e1', 'aal2');
select is((select count(*) from dugun_talepleri where eposta = 'cift@test.invalid')::int, 1, 'yönetici talepleri görür');
reset role;

select * from finish();
rollback;
