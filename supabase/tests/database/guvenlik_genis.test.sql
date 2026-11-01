-- Forest Club Urla · geniş güvenlik testleri (pgTAP, 01.11.2026). Çalıştırma: supabase test db
-- guvenlik.test.sql'e ek: üyeler arası veri sızıntısı (IDOR), üyenin kendi kaydında yetkisiz alan değiştirmesi, üyenin
-- yönetici işlevleri, ziyaretçinin yazması, SECURITY DEFINER işlevlerinde sabit search_path, gizli dosya deposu.
-- Her şey bir işlem içinde; sonunda geri alınır.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(25);

-- ---------- Katalog ----------
select is_empty($$
  select p.oid::regprocedure::text from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'her SECURITY DEFINER işlevinde search_path sabit (şema ele geçirme yok)');
select is_empty($$ select id from storage.buckets where id = 'dekontlar' and public $$, 'dekont deposu herkese açık değil');

-- ---------- Veri: iki üye, her birinin ödemesi, dekontu, kaydı, dondurması, veri talebi ----------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'idor1@test.invalid'),
  ('00000000-0000-4000-8000-0000000000c2', 'idor2@test.invalid');
insert into uyeler (kod, ad, eposta, tel, user_id, basvuru_tarihi, baslangic, bitis) values
  (yeni_uye_kodu(), 'Idor Bir', 'idor1@test.invalid', '05320000011', '00000000-0000-4000-8000-0000000000c1', current_date - 20, current_date - 10, current_date + 20),
  (yeni_uye_kodu(), 'Idor İki', 'idor2@test.invalid', '05320000012', '00000000-0000-4000-8000-0000000000c2', current_date - 20, current_date - 10, current_date + 20);
create temp table t_uye on commit drop as
  select (select id from uyeler where eposta = 'idor1@test.invalid') as bir, (select id from uyeler where eposta = 'idor2@test.invalid') as iki;
grant select on t_uye to authenticated, anon;
insert into etkinlikler (tarih, saat, tur, ad, kontenjan) values (current_date + 5, '10.00', 'yoga', 'IDOR Yoga', 10);
insert into odemeler (uye_id, tarih, tutar, yol) select bir, current_date, 3000, 'elden'::odeme_yolu from t_uye union all select iki, current_date, 3000, 'elden'::odeme_yolu from t_uye;
insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, dosya)
  select bir, 'idor1@test.invalid', 'Idor Bir', current_date, 'yeni/idor1.pdf' from t_uye
  union all select iki, 'idor2@test.invalid', 'Idor İki', current_date, 'yeni/idor2.pdf' from t_uye;
insert into etkinlik_kayitlari (etkinlik_id, uye_id)
  select (select id from etkinlikler where ad = 'IDOR Yoga'), bir from t_uye
  union all select (select id from etkinlikler where ad = 'IDOR Yoga'), iki from t_uye;
insert into uyelik_dondurmalari (uye_id, bas, gun) select bir, current_date, 7 from t_uye union all select iki, current_date, 7 from t_uye;
insert into veri_talepleri (uye_id, ad, eposta, tur) select bir, 'Idor Bir', 'idor1@test.invalid', 'silme' from t_uye
  union all select iki, 'Idor İki', 'idor2@test.invalid', 'silme' from t_uye;

create function pg_temp.ol(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', sub, 'role', 'authenticated', 'aal', 'aal1',
    'email', case sub when '00000000-0000-4000-8000-0000000000c1' then 'idor1@test.invalid' else 'idor2@test.invalid' end)::text, true);
$$;

-- ---------- Üye 1: yalnız kendi verisi ----------
set local role authenticated;
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
select is((select array_agg(uye_id) from odemeler where uye_id in (select bir from t_uye union select iki from t_uye)),
  (select array[bir] from t_uye), 'üye başka üyenin ödemesini görmez');
select is((select count(*) from dekontlar where eposta like 'idor%')::int, (select count(*) from dekontlar where eposta = 'idor1@test.invalid')::int,
  'üye başka üyenin dekontunu görmez');
select is((select count(*) from dekontlar where eposta = 'idor2@test.invalid')::int, 0, 'ikinci üyenin dekontu görünmez');
select is((select array_agg(uye_id) from etkinlik_kayitlari where etkinlik_id = (select id from etkinlikler where ad = 'IDOR Yoga')),
  (select array[bir] from t_uye), 'üye başka üyenin etkinlik kaydını görmez');
select is((select count(*) from uyelik_dondurmalari where uye_id = (select iki from t_uye))::int, 0, 'üye başka üyenin dondurmasını görmez');
select is((select count(*) from veri_talepleri where eposta = 'idor2@test.invalid')::int, 0, 'üye başka üyenin veri talebini görmez');
select is((select count(*) from uyeler where eposta = 'idor2@test.invalid')::int, 0, 'üye başka üyenin kaydını görmez');

-- Kendi kaydında yetkisiz değişiklik: bitiş, kod, kullanıcı bağı (hata ya da etkisiz olmalı; aşağıda değer denetlenir)
select pg_temp.ol('00000000-0000-4000-8000-0000000000c1');
do $$ begin update uyeler set bitis = current_date + 3650 where eposta = 'idor1@test.invalid'; exception when others then null; end $$;
do $$ begin update uyeler set tel = '05000000000' where eposta = 'idor2@test.invalid'; exception when others then null; end $$;
do $$ begin update uyeler set user_id = '00000000-0000-4000-8000-0000000000c1' where eposta = 'idor2@test.invalid'; exception when others then null; end $$;
do $$ begin delete from odemeler where uye_id = (select bir from t_uye); exception when others then null; end $$;
do $$ begin update dekontlar set durum = 'onaylandi' where eposta = 'idor1@test.invalid'; exception when others then null; end $$;
select throws_ok($$ insert into odemeler (uye_id, tarih, tutar, yol) select bir, current_date, 1, 'elden'::odeme_yolu from t_uye $$, '42501', null,
  'üye kendine ödeme yazamaz');
select throws_ok($$ insert into etkinlik_kayitlari (etkinlik_id, uye_id) select (select id from etkinlikler where ad = 'IDOR Yoga'), iki from t_uye $$,
  '42501', null, 'üye başkası adına etkinlik kaydı açamaz');

-- Yönetici işlevleri
select throws_ok($$ select dekont_karar((select id from dekontlar where eposta = 'idor1@test.invalid'), true) $$, 'P0001', null,
  'üye kendi dekontunu onaylayamaz');
select throws_ok($$ select elden_odeme((select bir from t_uye), 3000, current_date) $$, 'P0001', null, 'üye elden ödeme yazamaz');
select throws_ok($$ select yoklama_isaretle((select id from etkinlikler where ad = 'IDOR Yoga'), (select bir from t_uye), true) $$, 'P0001', null,
  'üye yoklama işaretleyemez');
select throws_ok($$ select veri_kopyasi((select iki from t_uye)) $$, 'P0001', null, 'üye başka üyenin veri kopyasını alamaz');
select throws_ok($$ select kontenjan_degistir((select id from etkinlikler where ad = 'IDOR Yoga'), 999) $$, 'P0001', null,
  'üye kontenjan değiştiremez');
reset role;

-- Değerler değişmedi mi (süper kullanıcı gözüyle)
select is((select bitis from uyeler where eposta = 'idor1@test.invalid'), current_date + 20, 'üye kendi bitiş tarihini uzatamaz');
select is((select tel from uyeler where eposta = 'idor2@test.invalid'), '05320000012', 'üye başkasının telefonunu değiştiremez');
select is((select user_id::text from uyeler where eposta = 'idor2@test.invalid'), '00000000-0000-4000-8000-0000000000c2',
  'üye başkasının üyeliğini hesabına bağlayamaz');
select is((select count(*) from odemeler where uye_id = (select bir from t_uye))::int, 1, 'üye kendi ödeme kaydını silemez');
select is((select durum::text from dekontlar where eposta = 'idor1@test.invalid'), 'bekliyor', 'üye kendi dekontunu onaylı yapamaz');
select is((select kontenjan from etkinlikler where ad = 'IDOR Yoga'), 10, 'kontenjan değişmedi');

-- ---------- Ziyaretçi yazamaz ----------
set local role anon;
select pg_temp.ol(null);
select throws_ok($$ insert into uyeler (kod, ad, eposta) values ('FC-U-9999', 'Saldırgan', 'x@test.invalid') $$, '42501', null,
  'ziyaretçi üye ekleyemez');
select throws_ok($$ insert into etkinlikler (tarih, tur, ad, kontenjan) values (current_date, 'yoga', 'Sahte', 1) $$, '42501', null,
  'ziyaretçi etkinlik ekleyemez');
select is((select count(*) from storage.objects where bucket_id = 'dekontlar')::int, 0, 'ziyaretçi dekont dosyalarını listeleyemez');
reset role;

select * from finish();
rollback;
