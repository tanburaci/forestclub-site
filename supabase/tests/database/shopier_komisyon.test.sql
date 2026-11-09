-- Forest Club Urla · Shopier kart komisyonu (pgTAP): aylık dilim oranı + 0,49 TL gider olarak yazılır, tekrar yazılmaz.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);

select is(shopier_oran(10000), 5.99, '25.000 TL altı %5,99');
select is(shopier_oran(25000), 5.49, '25.000 TL ve üstü %5,49');
select is(shopier_oran(90000), 4.99, '90.000 TL ve üstü %4,99');
select is(shopier_oran(2200000), 2.99, '2.200.000 TL ve üstü %2,99');

delete from shopier_komisyonlar;
select is(shopier_komisyon_yaz('T-1', 1000, 'bilet'), 60.39::numeric, '1.000 TL bilet: %5,99 + 0,49 = 60,39');
select is((select tutar from muhasebe_hareketleri where belge = 'shopier:T-1' and kategori = 'Kart komisyonu'), 60.39::numeric,
          'muhasebeye Kart komisyonu gideri yazıldı');
select is(shopier_komisyon_yaz('T-1', 1000, 'bilet'), 60.39::numeric, 'aynı sipariş ikinci kez: aynı tutar döner');
select is((select count(*) from muhasebe_hareketleri where belge = 'shopier:T-1')::int, 1, 'ikinci kez gider yazılmaz');
-- Ay toplamı 25.000'i geçince oran düşer (bu satış dahil)
select is(shopier_komisyon_yaz('T-2', 24500, 'üyelik'), round(24500 * 5.49 / 100 + 0.49, 2), 'ay toplamı 25.500: %5,49');

select * from finish();
rollback;
