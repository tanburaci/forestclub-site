-- Forest Club Urla · üyelere duyuru maili (pgTAP, 03.11.2026)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f9', 'dy-yon@test.invalid'), ('00000000-0000-4000-8000-0000000000fa', 'dy-uye@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f9', 'DY Yönetici');
insert into uyeler (kod, ad, eposta, tel, durum, baslangic, bitis) values
  (yeni_uye_kodu(), 'Aktif Ayşe', 'dy-aktif@test.invalid', '05320000001', 'aktif', current_date - 5, current_date + 20),
  (yeni_uye_kodu(), 'Pasif Ali', 'dy-pasif@test.invalid', '05320000002', 'doldu', current_date - 60, current_date - 30),
  (yeni_uye_kodu(), 'Hiç Ödemedi', 'dy-basvuru@test.invalid', '05320000003', 'basvuru', null, null);
create temp table t_n as select (select count(*) from uye_duyurusu_alicilar('aktif'))::int as aktif,
  (select count(*) from uye_duyurusu_alicilar('pasif'))::int as pasif, (select count(*) from uye_duyurusu_alicilar('hepsi'))::int as hepsi;
grant select on t_n to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000fa', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select throws_ok($$ select uye_duyurusu_gonder('hepsi', 'Konu', 'Bir duyuru metni') $$, 'P0001', 'Bu işlem yalnız yönetici içindir.', 'yönetici olmayan gönderemez');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000f9', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select is(uye_duyurusu_sayi('hepsi'), (select hepsi from t_n), 'sayı = aktif + pasif (hiç ödememiş hariç)');
select ok((select aktif + pasif = hepsi and pasif >= 1 from t_n), 'hepsi aktif ile pasifin toplamı (test üyesi sayıldı)');
select throws_ok($$ select uye_duyurusu_gonder('herkes', 'Konu', 'Bir duyuru metni') $$, 'P0001', 'Kime gideceğini seç.', 'geçersiz hedef reddedilir');
select is((uye_duyurusu_gonder('pasif', 'Tai Chi · üyelere %50', 'Tai Chi atölyesi 7 Kasım.') ->> 'alici')::int, (select pasif from t_n), 'pasif hedefe kuyruğa mail eklendi');
reset role;
select ok(exists (select 1 from eposta_kuyrugu where sablon = 'uye_duyuru' and alici = 'dy-pasif@test.invalid' and veri ->> 'konu' = 'Tai Chi · üyelere %50'),
  'pasif üyeye duyuru maili kuyrukta');
select ok(not exists (select 1 from eposta_kuyrugu where sablon = 'uye_duyuru' and alici in ('dy-aktif@test.invalid', 'dy-basvuru@test.invalid')),
  'aktif ve hiç ödememiş üyeye gitmedi');


-- Etkinlik seçilince: yaklaşanda tarih + üye fiyatı + yer ayırma bağlantısı, geçmişte yalnız ad + tarih
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (current_date + 4, '16.00', 'hareket', 'DY Tai Chi', 20, 1500, 'yuzde50', 'yayinda'),
  (current_date - 3, '10.00', 'hareket', 'DY Chi Gong', 20, null, null, 'yayinda');
select ok(uye_duyurusu_etkinlik_metni((select id from etkinlikler where ad = 'DY Tai Chi')) like '%Üyelere \%50 indirim: 1.500 TL yerine 750 TL%Yerini ayır: https://www.forestcluburla.com/e/%',
  'yaklaşan etkinlik: üye fiyatı ve yer ayırma bağlantısı');
select ok(uye_duyurusu_etkinlik_metni((select id from etkinlikler where ad = 'DY Chi Gong')) not like '%Yerini ayır%'
  and uye_duyurusu_etkinlik_metni((select id from etkinlikler where ad = 'DY Chi Gong')) like '%DY Chi Gong%', 'geçmiş etkinlik: yalnız ad ve tarih');
select is(uye_duyurusu_etkinlik_metni(null), '', 'etkinlik seçilmezse ek yok');
select ok((select metin like '%{metin}%' and konu = '{konu}' from eposta_sablonlari where id = 'uye_duyuru')
  and (select metin like '%{tarih}%' from eposta_sablonlari where id = 'duyuru'), 'üye duyurusu kendi şablonunu kullanır; etkinlik duyurusu şablonu bozulmadı');

select * from finish();
rollback;
