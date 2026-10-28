-- Forest Club Urla · tanışma bileti yalnız üyelere ücretsiz buluşmalarda (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(2);

insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere) values
  (current_date + 5, '10.00', 'atolye', 'Ücretli Atölye', 12, 1500, 'yuzde50'),
  (current_date + 6, '10.00', 'bulusma', 'Ücretsiz Kahvaltı', 30, null, null);
select throws_ok($$ select tanisma_bileti_al('Yeni Kişi', 'yeni-tanisma@test.invalid', (select id from etkinlikler where ad = 'Ücretli Atölye')) $$,
  'P0001', 'Tanışma bileti yalnız üyelere ücretsiz buluşmalar için; başka bir buluşma seç.', 'ücretli etkinliğe tanışma bileti verilmez');
select is(tanisma_bileti_al('Yeni Kişi', 'yeni-tanisma@test.invalid', (select id from etkinlikler where ad = 'Ücretsiz Kahvaltı')), 'verildi',
  'üyelere ücretsiz buluşmaya tanışma bileti verilir');

select * from finish();
rollback;
