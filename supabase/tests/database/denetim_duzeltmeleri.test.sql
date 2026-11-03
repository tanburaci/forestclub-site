-- Forest Club Urla · son denetimin sunucu düzeltmeleri (pgTAP, 03.11.2026): kart ödemesinde yer / iptal / tutar
-- denetimi ve iade akışı, havale dekontunda yer yeniden denetimi, iptal etkinliğin isteği onaylanamaz, üyelere ücretli
-- etkinlik, iptal duyurusu bilet alanlara, bekleme yükseltmesi, bitiş günü dahil, üye indirimi bir kez, indirim kodu.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'den-yon@test.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'den-uye@test.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'den-uye2@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000a1', 'Denetim Yönetici');
insert into uyeler (kod, ad, eposta, tel, user_id, baslangic, bitis, durum) values
  ('FC-U-8801', 'Denetim Üye', 'den-uye@test.invalid', '05321112233', '00000000-0000-4000-8000-0000000000a2', istanbul_bugun() - 29, istanbul_bugun(), 'aktif'),
  ('FC-U-8802', 'Bekleyen Üye', 'den-uye2@test.invalid', '05321112234', '00000000-0000-4000-8000-0000000000a3', istanbul_bugun() - 5, istanbul_bugun() + 25, 'aktif');
insert into etkinlikler (tarih, saat, tur, ad, kontenjan, bilet_fiyati, uyelere, durum) values
  (istanbul_bugun() + 7, '10.00', 'yoga', 'Den Dolu', 1, 1000, 'ucretsiz', 'yayinda'),
  (istanbul_bugun() + 7, '11.00', 'yoga', 'Den İptal', 10, 1000, 'ucretsiz', 'yayinda'),
  (istanbul_bugun() + 7, '12.00', 'bulusma', 'Den Ücretli', 10, 1000, 'yuzde50', 'yayinda'),
  (istanbul_bugun() + 7, '13.00', 'bulusma', 'Den Ücretsiz', 2, null, null, 'yayinda');
create temp table t_e as select
  (select id from etkinlikler where ad = 'Den Dolu') as dolu, (select id from etkinlikler where ad = 'Den İptal') as iptal,
  (select id from etkinlikler where ad = 'Den Ücretli') as ucretli, (select id from etkinlikler where ad = 'Den Ücretsiz') as ucretsiz;
create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;
create function pg_temp.istek(ep text, etk bigint, yol text, dosya text) returns bigint language sql as $$
  select (bilet_istegi_ac_yol('Den Kişi', ep, '05320000009', jsonb_build_array(jsonb_build_object('etkinlik', etk, 'adet', 1)), null, dosya, yol) ->> 'id')::bigint;
$$;

-- 1. Kart: iki kişi son yere aynı anda istek açar; ilk ödeyen alır, ikinciye iade
create temp table t_k as select pg_temp.istek('k1@test.invalid', (select dolu from t_e), 'kart', 'yeni/1730000000000-den000001') as a,
                                pg_temp.istek('k2@test.invalid', (select dolu from t_e), 'kart', 'yeni/1730000000000-den000002') as b;
select is((bilet_kart_odendi((select a from t_k), 'SIP-D1', 1000) ->> 'adet')::int, 1, 'kart: ilk ödeyen bileti alır');
select is(bilet_kart_odendi((select b from t_k), 'SIP-D2', 1000) ->> 'durum', 'iade', 'kart: dolu etkinlikte ikinci ödeme iade');
select is((select durum::text || '/' || (shopier_siparis is not null) from bilet_istekleri where id = (select b from t_k)), 'reddedildi/true',
  'iade edilecek istek kayıtlı kalır (sipariş numarasıyla)');
select is((select count(*) from eposta_kuyrugu where sablon = 'saglik' and alici = 'den-yon@test.invalid')::int, 1, 'yöneticiye iade uyarısı');
select is((select count(*) from eposta_kuyrugu where sablon = 'bilet_red' and alici = 'k2@test.invalid')::int, 1, 'alıcıya iade maili');
select is(bilet_kart_odendi((select b from t_k), 'SIP-D2', 1000) ->> 'zaten', 'true', 'aynı bildirim tekrar gelirse işlem yok');
select is((select satilan_bilet from etkinlikler where id = (select dolu from t_e)), 1, 'kontenjan aşılmadı');

-- Kart: iptal edilen etkinlik ve okunamayan tutar
create temp table t_k2 as select pg_temp.istek('k3@test.invalid', (select iptal from t_e), 'kart', 'yeni/1730000000000-den000003') as a,
                                 pg_temp.istek('k4@test.invalid', (select iptal from t_e), 'kart', 'yeni/1730000000000-den000004') as b;
select is(bilet_kart_odendi((select b from t_k2), 'SIP-D4', null) ->> 'durum', 'iade', 'kart: tutar okunamazsa bilet verilmez');
update etkinlikler set durum = 'iptal' where id = (select iptal from t_e);
select is(bilet_kart_odendi((select a from t_k2), 'SIP-D3', 1000) ->> 'durum', 'iade', 'kart: iptal edilen etkinliğe bilet verilmez');

-- 2. Havale: dekont yüklenirken yer yeniden denetlenir; iptal edilen etkinliğin isteği onaylanamaz
update etkinlikler set durum = 'yayinda' where id = (select iptal from t_e);
update etkinlikler set kontenjan = 3 where id = (select dolu from t_e);
create temp table t_h as select pg_temp.istek('h1@test.invalid', (select dolu from t_e), 'havale', 'yeni/1730000000000-den000005') as a,
                                pg_temp.istek('h2@test.invalid', (select dolu from t_e), 'havale', 'yeni/1730000000000-den000006') as b,
                                pg_temp.istek('h3@test.invalid', (select iptal from t_e), 'havale', 'yeni/1730000000000-den000007') as c;
update bilet_istekleri set dosya = 'yeni/1730000000000-den000005' where id = (select a from t_h);
insert into storage.objects (bucket_id, name) select 'dekontlar', dosya from bilet_istekleri where id in (select a from t_h union select b from t_h union select c from t_h);
select is(bilet_kaydet((select a from t_h), 'h1@test.invalid'), 'tamam', 'havale: ilk dekont yer alır');
update etkinlikler set kontenjan = 2 where id = (select dolu from t_e);
select throws_ok(format($$ select bilet_kaydet(%s, 'h2@test.invalid') $$, (select b from t_h)), 'P0001', null, 'havale: yer kalmayınca dekont kabul edilmez');
select is(bilet_kaydet((select c from t_h), 'h3@test.invalid'), 'tamam', 'havale: iptal öncesi dekont yüklendi');
update etkinlikler set durum = 'iptal' where id = (select iptal from t_e);
grant select on t_h, t_e to authenticated;
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1');
select throws_ok(format($$ select bilet_karar(%s, true) $$, (select c from t_h)), 'P0001', null, 'iptal edilen etkinliğin bileti onaylanamaz');
reset role;

-- 3. Üyelere ücretli etkinlik: "Geliyorum" yok, üye karekoduyla giriş yok; bitiş günü (bugün) üye aktif
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a2');
select throws_ok(format($$ select etkinlik_kaydi(%s, 'katil') $$, (select ucretli from t_e)), 'P0001', 'Bu etkinlik üyelere de ücretli; katılmak için bilet al.',
  'üye ücretli etkinliğe biletsiz kayıt olamaz');
select is(etkinlik_kaydi((select ucretsiz from t_e), 'katil') ->> 'durum', 'kayitli', 'bitiş günü bugün olan üye etkinliğe kayıt olabilir');
reset role;
insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum) values ((select ucretli from t_e), (select id from uyeler where kod = 'FC-U-8801'), 'kayitli');
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1');
select throws_ok(format($$ select giris_kontrol(%s, 'FC-U-8801') $$, (select ucretli from t_e)), 'P0001', null, 'ücretli etkinlikte üye karekodu geçmez (kontrol)');
select throws_ok(format($$ select giris_kaydet(%s, 'FC-U-8801') $$, (select ucretli from t_e)), 'P0001', null, 'ücretli etkinlikte üye karekodu geçmez (kayıt)');
reset role;
select is(uye_durumlarini_guncelle(), 0, 'bitiş günü bugün olan üye gece "doldu" olmaz');

-- Üye indirimi (%50) etkinlik başına bir kez
create temp table t_u as select bilet_istegi_ac_yol('Denetim Üye', 'den-uye@test.invalid', '', jsonb_build_array(jsonb_build_object('etkinlik', (select ucretli from t_e), 'adet', 1)),
  '00000000-0000-4000-8000-0000000000a2', 'yeni/1730000000000-den000008', 'havale') as r1;
select is((select (r1 ->> 'tutar')::numeric from t_u), 500::numeric, 'üye indirimi ilk sepette');
select is((bilet_istegi_ac_yol('Denetim Üye', 'den-uye@test.invalid', '', jsonb_build_array(jsonb_build_object('etkinlik', (select ucretli from t_e), 'adet', 1)),
  '00000000-0000-4000-8000-0000000000a2', 'yeni/1730000000000-den000009', 'havale') ->> 'tutar')::numeric, 1000::numeric, 'aynı etkinlikte ikinci sepette üye indirimi yok');

-- 4. İptal duyurusu bilet alana da gider (onaylı bilet: Den Dolu'da k1)
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1');
select lives_ok(format($$ select etkinlik_durum_degistir(%s, 'iptal', null, 'yağmur') $$, (select dolu from t_e)), 'etkinlik iptal edildi');
reset role;
select is((select count(*) from eposta_kuyrugu where sablon = 'iptal' and alici in ('k1@test.invalid', 'h1@test.invalid'))::int, 2,
  'iptal duyurusu bilet alanlara (onaylı ve incelemedeki) gitti');

-- 7. İndirim kodu: sınır bekleyen istekleri de sayar
insert into indirim_kodlari (kod, tur, deger, sinir) values ('DENTEK', 'tl', 100, 1);
update etkinlikler set durum = 'yayinda', kontenjan = 10 where id = (select iptal from t_e);
select lives_ok(format($$ select bilet_istegi_ac_yol('Kod A', 'kod-a@test.invalid', '05320000010', '[{"etkinlik": %s, "adet": 1}]', null, 'yeni/1730000000000-den000010', 'kart', 'DENTEK') $$,
  (select iptal from t_e)), 'tek kullanımlık kod ilk sepette geçer');
select throws_ok(format($$ select bilet_istegi_ac_yol('Kod B', 'kod-b@test.invalid', '05320000011', '[{"etkinlik": %s, "adet": 1}]', null, 'yeni/1730000000000-den000011', 'kart', 'DENTEK') $$,
  (select iptal from t_e)), 'P0001', 'Bu indirim kodu geçerli değil.', 'ödemesi bekleyen sepet varken sınır dolu sayılır');

-- 8. Dekont tutarı aidat ayarından; 9. IP sayacından düşme
update ayarlar set deger = '3500' where anahtar = 'aidat';
insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, dosya) select id, eposta, ad, istanbul_bugun(), 'yeni/1730000000000-den000012' from uyeler where kod = 'FC-U-8802';
select is((select tutar from dekontlar where dosya = 'yeni/1730000000000-den000012'), 3500.00::numeric, 'dekont tutarı aidat ayarından');
select istek_sinir('den-ip', 'basvuru', 5), istek_sinir('den-ip', 'basvuru', 5);
select istek_iade('den-ip', 'basvuru');
select is((select adet from istek_sayaci where anahtar = 'den-ip' and tur = 'basvuru'), 1, 'hatalı form denemesi IP sayacından düşer');

-- 10. KVKK: anonimleştirme gönüllü / düğün / Açık Çağrı kayıtlarını da temizler, üyelik pasif olur
insert into gonulluler (ad, eposta, tel, alanlar) values ('Bekleyen Üye', 'den-uye2@test.invalid', '05321112234', '{Kurulum}');
insert into dugun_talepleri (ad, eposta, tel, kisi, notlar) values ('Bekleyen Üye', 'den-uye2@test.invalid', '05321112234', '50_100', 'Kır düğünü');
insert into acik_cagri (ad, iletisim, uye, alan, baslik, anlatim) values ('Bekleyen Üye', '0532 111 22 34', 'Evet', 'Müzik', 'Konser', 'Akustik');
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1');
select lives_ok($$ select uye_anonimlestir((select id from uyeler where kod = 'FC-U-8802')) $$, 'üye anonimleştirildi');
reset role;
select is((select count(*) from gonulluler where eposta = 'den-uye2@test.invalid')::int
        + (select count(*) from dugun_talepleri where eposta = 'den-uye2@test.invalid' or ad = 'Bekleyen Üye')::int
        + (select count(*) from acik_cagri where ad = 'Bekleyen Üye')::int, 0, 'gönüllü, düğün ve Açık Çağrı kayıtları temizlendi');
select is((select durum::text from uyeler where kod = 'FC-U-8802'), 'doldu', 'anonimleştirilen üye pasif');

select * from finish();
rollback;
