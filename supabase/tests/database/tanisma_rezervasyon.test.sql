-- Forest Club Urla · tanışma biletiyle rezervasyon (pgTAP): 24 saat kala açılır, kalabalık etkinlikte açılmaz,
-- e-posta ve bilet numarası bir kez.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

-- Yarın, şu andan birkaç saat sonra başlayan (24 saatten az kala) ve uzak tarihli etkinlik
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, durum, tanisma_kontenjan) values
  ((now() at time zone 'Europe/Istanbul' + interval '3 hours')::date, to_char(now() at time zone 'Europe/Istanbul' + interval '3 hours', 'HH24.MI'), 'bulusma', 'TR Yakın', 20, null, 'yayinda', 2),
  (istanbul_bugun() + 5, '10.00', 'bulusma', 'TR Uzak', 20, null, 'yayinda', 2),
  ((now() at time zone 'Europe/Istanbul' + interval '3 hours')::date, to_char(now() at time zone 'Europe/Istanbul' + interval '3 hours', 'HH24.MI'), 'bulusma', 'TR Dolu', 4, null, 'yayinda', 2);
update etkinlikler set satilan_bilet = 3 where ad = 'TR Dolu';

select ok((select array_agg(etkinlik_id) from tanisma_etkinlikleri()) @> array[(select id from etkinlikler where ad = 'TR Yakın')], '24 saatten az kalan, katılımı düşük etkinlik açık');
select ok(not exists (select 1 from tanisma_etkinlikleri() t join etkinlikler e on e.id = t.etkinlik_id where e.ad in ('TR Uzak', 'TR Dolu')), 'uzak ya da kalabalık etkinlik açık değil');
select is(tanisma_rezervasyon('Misafir Kişi', 'misafir-tr@test.invalid', '05320000000', 'Pelin Küçükali', 'FC-0042', (select id from etkinlikler where ad = 'TR Yakın')), 'verildi', 'rezervasyon verildi');
select is((select referans || ' · ' || bilet_no from tanisma_biletleri where eposta = 'misafir-tr@test.invalid'), 'Pelin Küçükali · FC-0042', 'referans ve bilet numarası yazıldı');
select is((select count(*) from eposta_kuyrugu where alici = 'misafir-tr@test.invalid' and sablon = 'tanisma')::int, 1, 'rezervasyon kodu maille');
select is(tanisma_rezervasyon('Başka Kişi', 'baska-tr@test.invalid', '05320000001', 'Ezgi Pehlivan', 'fc-0042', (select id from etkinlikler where ad = 'TR Yakın')), 'kullanilmis', 'aynı bilet numarası ikinci kez kullanılamaz');
select throws_ok($$ select tanisma_rezervasyon('Misafir Üç', 'uc-tr@test.invalid', '05320000002', 'Pelin Küçükali', 'FC-0099', (select id from etkinlikler where ad = 'TR Uzak')) $$,
  'P0001', null, 'uzak etkinliğe rezervasyon yapılamaz');
select throws_ok($$ select tanisma_rezervasyon('Misafir Dört', 'dort-tr@test.invalid', '05320000003', 'https://kotu.example', 'FC-0100', (select id from etkinlikler where ad = 'TR Yakın')) $$,
  'P0001', null, 'referansta bağlantı olamaz');
select ok(not has_function_privilege('anon', 'public.tanisma_rezervasyon(text,text,text,text,text,bigint)', 'execute')
  and has_function_privilege('anon', 'public.tanisma_etkinlikleri()', 'execute'), 'rezervasyon yalnız sunucudan; açık liste herkese');

select * from finish();
rollback;
