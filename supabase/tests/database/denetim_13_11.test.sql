-- Forest Club Urla · 13.11.2026 denetim düzeltmeleri (pgTAP): tek tip yanıt (dekont, kartla aidat), etkinlik saati,
-- indirim kodunda yarıda kalan kart isteği, envanter tarihi, iptalde iade uyarısı, tanınmayan Shopier ödemesi
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000f3', 'd13-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000f3', 'D13 Yönetici');

-- ---------- Tek tip yanıt: dekont ----------
select is(dekont_yukleme_ac('yok-d13@test.invalid', 'yeni/1730000000000-d13aaaa01.pdf'), 'tamam', 'başvurusu olmayan adrese de yükleme hakkı (aynı yanıt)');
insert into storage.objects (bucket_id, name) values ('dekontlar', 'yeni/1730000000000-d13aaaa01.pdf');
select is(dekont_kaydet('yok-d13@test.invalid', 'yeni/1730000000000-d13aaaa01.pdf'), 'tamam', 'başvurusu olmayan adreste de "tamam"');
select ok(not exists (select 1 from dekontlar where dosya = 'yeni/1730000000000-d13aaaa01.pdf')
  and (select count(*) from eposta_kuyrugu where alici = 'yok-d13@test.invalid' and sablon = 'dekont_bulunamadi') = 1,
  'dekont kaydı açılmadı; "başvuru bulunamadı" yalnız o adrese e-postayla');

-- ---------- Tek tip yanıt: kartla aidat ----------
select is(uyelik_kart_ac('yok-d13@test.invalid')::text, '{"eposta": true}', 'başvuru yoksa: "e-postana gönderdik" yanıtı');
insert into uyeler (kod, ad, eposta, tel, durum, baslangic, bitis) values (yeni_uye_kodu(), 'Aktif Üye', 'aktif-d13@test.invalid', '05321110013', 'aktif', current_date - 5, current_date + 25);
select is(uyelik_kart_ac('aktif-d13@test.invalid')::text, '{"eposta": true}', 'üyelik aktifse: aynı yanıt');
select is((select count(*) from eposta_kuyrugu where sablon = 'kart_bilgi' and alici in ('yok-d13@test.invalid', 'aktif-d13@test.invalid'))::int, 2,
  'nedeni yalnız o adrese e-postayla');

-- ---------- Etkinlik saati ----------
select is(saat_oku('19:30'), time '19:30', '"19:30" okunur');
select is(saat_oku('19.00–01.00'), time '19:00', 'aralıkta ilk saat okunur');
select is(saat_oku('24.30'), null, 'geçersiz saat hata vermez, boş döner');
insert into etkinlikler (tarih, saat, tur, ad, durum) values (current_date + 1, '12–13 Eylül', 'bulusma', 'D13 Serbest Saat', 'yayinda');
select throws_ok($$ insert into etkinlikler (tarih, saat, tur, ad, durum) values (current_date + 1, '24.30', 'bulusma', 'D13 Bozuk Saat', 'yayinda') $$,
  '23514', null, 'yeni etkinlikte geçersiz saat kaydedilmez');
select lives_ok($$ select etkinlik_baslangic(e) from etkinlikler e $$, 'başlangıç hesabı hiçbir etkinlikte hata vermiyor');

-- ---------- İndirim kodu: yarıda bırakılan kart isteği ----------
insert into indirim_kodlari (kod, tur, deger, sinir, aktif) values ('D13KOD', 'yuzde', 10, 1, true);
insert into etkinlikler (tarih, saat, tur, ad, durum, bilet_fiyati, kontenjan) values (current_date + 10, '18.00', 'bulusma', 'D13 Biletli', 'yayinda', 500, 20);
insert into bilet_istekleri (ad, eposta, kalemler, tutar, dosya, durum, odeme_yolu, indirim_kodu, created_at)
  values ('Kart Yarım', 'yarim-d13@test.invalid', '[]', 450, 'yeni/d13-kart-yarim', 'bekliyor', 'kart', 'D13KOD', now() - interval '1 hour');
select is((indirim_kodu_durum_('D13KOD') ->> 'gecerli')::boolean, true, 'bir saat önce yarıda kalan kart isteği kodu kilitlemez');

-- ---------- Envanter düşümü tarihi ----------
select ok((select column_default from information_schema.columns where table_name = 'envanter_dusumleri' and column_name = 'tarih') like '%istanbul_bugun()%',
  'envanter düşümü varsayılan tarihi İstanbul günü');

-- ---------- İptal: ödenmiş bilet iade uyarısı ----------
insert into bilet_istekleri (ad, eposta, kalemler, tutar, dosya, durum, odeme_yolu)
  select 'Ödeyen Kişi', 'oder-d13@test.invalid', jsonb_build_array(jsonb_build_object('etkinlik_id', id, 'adet', 1)), 500, 'yeni/d13-oder', 'onaylandi', 'kart'
  from etkinlikler where ad = 'D13 Biletli';
update etkinlikler set durum = 'iptal' where ad = 'D13 Biletli';
select ok((select count(*) from eposta_kuyrugu where alici = 'd13-yon@test.invalid' and sablon = 'saglik'
           and veri ->> 'ozet' like '%D13 Biletli iptal edildi: 1 ödenmiş bilet%Ödeyen Kişi%') = 1, 'iptalde yöneticiye iade uyarısı');

-- ---------- Tanınmayan Shopier ödemesi ----------
select shopier_tanimsiz_odeme('SIP-D13-1', 750);
select shopier_tanimsiz_odeme('SIP-D13-1', 750);
select is((select count(*) from eposta_kuyrugu where alici = 'd13-yon@test.invalid' and veri ->> 'ozet' like '%SIP-D13-1%')::int, 1,
  'tanınmayan ödemede yöneticiye bir kez uyarı');
select ok(not has_function_privilege('anon', 'public.shopier_tanimsiz_odeme(text,numeric)', 'execute'), 'uyarı işlevi ziyaretçiye kapalı');

select * from finish();
rollback;
