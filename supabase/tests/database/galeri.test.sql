-- Forest Club Urla · fotoğraf galerisi altyapısı (pgTAP): ziyaretçi yalnız yayındaki fotoğrafı görür, yazamaz
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(3);

insert into galeri_fotolari (adres, yayinda) values ('https://foto.test/a.jpg', true), ('https://foto.test/gizli.jpg', false);
set local role anon;
select is((select count(*) from galeri_fotolari where adres like 'https://foto.test/%')::int, 1, 'ziyaretçi yalnız yayındaki fotoğrafı görür');
select throws_ok($$ insert into galeri_fotolari (adres, yayinda) values ('https://foto.test/kotu.jpg', true) $$, '42501', null, 'ziyaretçi fotoğraf ekleyemez');
reset role;
select throws_ok($$ insert into galeri_fotolari (adres) values ('http://duz.test/a.jpg') $$, '23514', null, 'adres https olmalı');

select * from finish();
rollback;
