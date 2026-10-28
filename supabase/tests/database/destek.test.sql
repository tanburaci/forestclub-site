-- Forest Club Urla · "Destek ol" testleri (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

select ok(not has_function_privilege('anon', 'public.destek_istegi_ac(numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.destek_istegi_ac(numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.destek_tamamla(text,text,numeric,numeric)', 'execute'),
  'destek işlevleri yalnız service_role ile');

-- Kartla ödeme kapalıyken istek açılmaz
insert into ayarlar (anahtar, deger) values ('kart_odeme', 'false') on conflict (anahtar) do update set deger = 'false';
select throws_ok($$ select destek_istegi_ac(1000) $$, 'P0001', 'Kartla ödeme çok yakında; şimdilik IBAN ile gönderebilirsin.',
  'kart kapalıyken destek isteği açılmaz');

update ayarlar set deger = 'true' where anahtar = 'kart_odeme';
select throws_ok($$ select destek_istegi_ac(10) $$, 'P0001', 'Destek tutarı en az 50 TL olabilir.', 'çok küçük tutar reddedilir');
select throws_ok($$ select destek_istegi_ac(200000) $$, 'P0001', 'Destek tutarı en çok 100.000 TL olabilir.', 'çok büyük tutar reddedilir');

create temp table t_istek as select destek_istegi_ac(2500) as r;
select is((select (r ->> 'tutar')::numeric from t_istek), 2500::numeric, 'istek açıldı, tutar 2500');
select destek_istegi_token((select (r ->> 'id')::uuid from t_istek), 'tok-destek-1');

select throws_ok($$ select destek_tamamla('tok-destek-1', 'p1', 2000, 0) $$, 'P0001', 'Ödenen tutar eksik.', 'eksik ödeme tamamlanmaz');
select lives_ok($$ select destek_tamamla('tok-destek-1', 'p1', 2500, 87.5) $$, 'destek tamamlandı');
select is((select count(*) from muhasebe_hareketleri where belge = 'iyzico:p1' and tur = 'gelir' and kategori = 'Destek' and tutar = 2500)::int, 1,
  'muhasebeye Destek geliri yazıldı');
select is((select count(*) from muhasebe_hareketleri where belge = 'iyzico:p1' and tur = 'gider' and tutar = 87.5)::int, 1,
  'komisyon gideri yazıldı');
select is((select destek_tamamla('tok-destek-1', 'p1', 2500, 87.5) ->> 'tekrar'), 'true', 'ikinci dönüş tekrar sayılır');
select is((select count(*) from muhasebe_hareketleri where belge = 'iyzico:p1')::int, 2, 'ikinci dönüşte muhasebe çift yazılmaz');

select * from finish();
rollback;
