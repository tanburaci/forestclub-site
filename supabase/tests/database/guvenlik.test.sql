-- Forest Club Urla · veritabanı güvenlik testleri (pgTAP). Çalıştırma: supabase test db
-- Her şey bir işlem içinde; sonunda geri alınır.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(28);

-- Test kişileri: yönetici, iki üye
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'yonetici@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b1', 'uye1@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'uye2@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000a1', 'Test Yönetici');
insert into uyeler (kod, ad, eposta, tel, user_id, basvuru_tarihi, baslangic, bitis) values
  (yeni_uye_kodu(), 'Test Bir', 'uye1@test.invalid', '05320000001', '00000000-0000-4000-8000-0000000000b1', current_date - 20, current_date - 10, current_date + 20),
  (yeni_uye_kodu(), 'Test İki', 'uye2@test.invalid', '05320000002', '00000000-0000-4000-8000-0000000000b2', current_date - 20, current_date - 10, current_date + 20);

create function pg_temp.ol(sub text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', aal,
    'email', case sub when '00000000-0000-4000-8000-0000000000a1' then 'yonetici@test.invalid'
                      when '00000000-0000-4000-8000-0000000000b1' then 'uye1@test.invalid' end)::text, true);
$$;

-- ---------- Genel kurallar ----------
select is_empty($$ select tablename::text from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'public şemasındaki her tabloda satır güvenliği (RLS) açık');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.proname not in ('demo_adres_mi', 'etkinlik_doluluk', 'istanbul_bugun', 'sayac_artir', 'tanisma_etkinlikleri', 'ozel_form', 'dugun_davet_bilgi', 'dugun_fiyatlari', 'tr_tarih', 'yonetici_mi') $$,
  'ziyaretçi (anon) yalnız izinli işlevleri çalıştırabilir');

select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and p.proname not in ('demo_adres_mi', 'etkinlik_doluluk', 'istanbul_bugun', 'sayac_artir', 'tanisma_etkinlikleri', 'tr_tarih', 'yonetici_mi',
      'anket_gonder', 'dekont_karar', 'dondurma_bitir', 'elden_odeme', 'eposta_deneme', 'eposta_yeniden_dene',
      'bilet_karar', 'dekont_bekliyor', 'uye_biletlerim', 'ozel_form', 'dugun_davet_bilgi', 'dugun_fiyatlari', 'dugun_gider_ekle', 'dugun_maliyet_kaydet', 'etkinlik_durum_degistir', 'etkinlik_kaydi', 'form_yanitla', 'giris_kaydet', 'kontenjan_degistir', 'profil_kaydet', 'saglik_ozeti',
      'uye_anonimlestir', 'uye_bagla', 'uyelik_dondur', 'veri_kopyasi', 'veri_talebi_ac', 'yoklama_isaretle') $$,
  'giriş yapmış kullanıcı yalnız izinli işlevleri çalıştırabilir');

select ok(not has_function_privilege('authenticated', 'public.odeme_tamamla(text,text,numeric,numeric)', 'execute')
  and not has_function_privilege('authenticated', 'public.odeme_istegi_ac(bigint)', 'execute')
  and not has_function_privilege('authenticated', 'public.tanisma_bileti_al(text,text,bigint)', 'execute'),
  'ödeme ve anonim form işlevleri yalnız service_role ile');

-- ---------- Ziyaretçi ----------
set local role anon;
select pg_temp.ol(null);
select is((select count(*) from uyeler)::int, 0, 'ziyaretçi üyeleri göremez');
select is((select count(*) from yoneticiler)::int, 0, 'ziyaretçi yönetici listesini göremez');
select throws_ok($$ select count(*) from denetim_kaydi $$, '42501', null, 'ziyaretçi denetim kaydını göremez');
select is((select count(*) from ayarlar where not herkese_acik)::int, 0, 'ziyaretçi gizli ayarları göremez');
reset role;

-- ---------- Üye ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000b1');
select is((select array_agg(eposta) from uyeler), array['uye1@test.invalid'], 'üye yalnız kendi kaydını görür');
select ok(not yonetici_mi(), 'üye yönetici değil');
select throws_ok($$ select uye_anonimlestir((select id from uyeler limit 1)) $$, 'P0001', 'Bu işlem yalnız yönetici içindir.',
  'üye başkasını silemez');
select throws_ok($$ insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000b1', 'Ben') $$, '42501',
  null, 'üye kendini yönetici yapamaz');
reset role;

-- ---------- Yönetici, ikinci adım yok (aal1) ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1', 'aal1');
select ok(not yonetici_mi(), 'kodsuz (aal1) oturum yönetici sayılmaz');
select is((select count(*) from uyeler)::int, 0, 'kodsuz oturum üyeleri göremez');
select is((select count(*) from yoneticiler)::int, 1, 'kodsuz oturum kendi yönetici satırını görür (panel kod ister)');
select throws_ok($$ select saglik_ozeti() $$, 'P0001', null, 'kodsuz oturum yönetici işlevini çalıştıramaz');
reset role;

-- ---------- Yönetici (aal2) ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000a1', 'aal2');
select ok(yonetici_mi(), 'iki adımlı oturum yönetici');
select cmp_ok((select count(*) from uyeler)::int, '>=', 2, 'yönetici üyeleri görür');
select throws_ok($$ insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000b2', 'Yeni') $$, '42501',
  null, 'yönetici panelden yönetici ekleyemez');
select throws_ok($$ delete from yoneticiler $$, '42501', null, 'yönetici, yönetici silemez');

-- Denetim: değişen alan, kim yaptı
update uyeler set tel = '05329999999' where eposta = 'uye1@test.invalid';
select is((select degisen -> 'tel' from denetim_kaydi where tablo = 'uyeler' and islem = 'UPDATE' order by id desc limit 1),
  '["05320000001", "05329999999"]'::jsonb, 'denetim: değişen alanın eski ve yeni değeri');
select is((select kullanici::text || ' ' || eposta from denetim_kaydi where tablo = 'uyeler' and islem = 'UPDATE' order by id desc limit 1),
  '00000000-0000-4000-8000-0000000000a1 yonetici@test.invalid', 'denetim: değişikliği yapan yönetici');
select lives_ok($$ update uyeler set tel = '05329999999' where eposta = 'uye1@test.invalid' $$, 'değişmeyen güncelleme');
select is((select count(*) from denetim_kaydi where tablo = 'uyeler' and islem = 'UPDATE' and satir = (select id::text from uyeler where eposta = 'uye1@test.invalid'))::int,
  1, 'denetim: hiçbir alan değişmediyse kayıt yazılmaz');
select throws_ok($$ delete from denetim_kaydi $$, '42501', null, 'denetim kaydı silinemez');
select throws_ok($$ update denetim_kaydi set rol = 'x' $$, '42501', null, 'denetim kaydı değiştirilemez');

-- KVKK silme: üyenin denetim kayıtları da gider
select lives_ok($$ select uye_anonimlestir((select id from uyeler where eposta = 'uye1@test.invalid')) $$, 'yönetici üyeyi anonimleştirir');
select is((select count(*) from denetim_kaydi where degisen::text like '%uye1@test.invalid%' or degisen::text like '%05329999999%'
             or degisen::text like '%Test Bir%')::int, 0, 'anonimleştirmeden sonra denetimde eski e-posta / telefon / ad yok');
reset role;

select * from finish();
rollback;
