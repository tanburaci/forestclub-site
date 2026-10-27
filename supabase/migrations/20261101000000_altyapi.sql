-- Forest Club Urla: altyapı ve güvenlik (01.11.2026).
--   · Yönetici yetkisi iki adımlı girişle (TOTP, oturum aal2) verilir; şifre ya da e-posta bağlantısı tek başına yetmez
--   · yoneticiler tablosu yalnız service_role ile değişir (panelden yönetici eklenemez / silinemez)
--   · denetim_kaydi: önemli tablolardaki her değişiklik kim, ne zaman, ne değişti olarak yazılır (2 yıl saklanır)
--   · KVKK silmesinde üyenin denetim kayıtları da silinir

-- ---------------------------------------------------------------------------------------------------------------
-- Yönetici mi? Yönetici listesinde olmak + bu oturumda ikinci adımın (uygulamadaki 6 haneli kod) geçilmiş olması.
-- Kod telefonu kaybedilirse: Supabase › Authentication › Users › kullanıcı › MFA factor silinir; ilk girişte yeniden
-- kurulur.
create or replace function public.yonetici_mi() returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' and exists (select 1 from yoneticiler where user_id = auth.uid()) $$;

-- Yönetici listesi: herkes yalnız kendi satırını görür (panel "yönetici misin, kod gerekli mi" diye bakar); ekleme,
-- değiştirme ve silme yalnız service_role (Supabase SQL Editor / panel dışı)
drop policy if exists yonetici_tam on public.yoneticiler;
drop policy if exists kendi_satiri on public.yoneticiler;
create policy kendi_satiri on public.yoneticiler for select to authenticated using (user_id = auth.uid() or public.yonetici_mi());
revoke insert, update, delete, truncate on public.yoneticiler from anon, authenticated;

-- Bilet kodu yalnız sunucu işlevlerinin içinde üretilir
revoke execute on function public.yeni_bilet_kodu() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Denetim kaydı
create table if not exists public.denetim_kaydi (
  id bigint generated always as identity primary key,
  zaman timestamptz not null default now(),
  kullanici uuid,              -- auth.uid(); boşsa sistem (zamanlanmış iş, Edge Function, SQL Editor)
  eposta text,                 -- o anki oturumun e-postası (yönetici silinse de kim olduğu okunur)
  rol text not null,           -- authenticated / service_role / postgres
  tablo text not null,
  islem text not null check (islem in ('INSERT', 'UPDATE', 'DELETE')),
  satir text,                  -- satırın anahtarı (id, anahtar ya da etkinlik/üye)
  uye_id bigint,               -- ilgili üye (KVKK silmesinde bu üyenin kayıtları silinir)
  degisen jsonb not null       -- UPDATE: yalnız değişen alanlar {alan: [eski, yeni]}; INSERT: yeni satır; DELETE: eski satır
);
create index if not exists denetim_kaydi_zaman on public.denetim_kaydi (zaman desc);
create index if not exists denetim_kaydi_uye on public.denetim_kaydi (uye_id) where uye_id is not null;
alter table public.denetim_kaydi enable row level security;
drop policy if exists yonetici_okur on public.denetim_kaydi;
create policy yonetici_okur on public.denetim_kaydi for select to authenticated using (public.yonetici_mi());
revoke all on public.denetim_kaydi from anon, authenticated;
grant select on public.denetim_kaydi to authenticated;

create or replace function public.denetle() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  eski jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  yeni jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  s jsonb := coalesce(yeni, eski);
  fark jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_array(eski -> k, yeni -> k)) into fark
      from jsonb_object_keys(yeni) k where (eski -> k) is distinct from (yeni -> k);
    if fark is null then return null; end if;  -- hiçbir alan değişmedi
  else
    fark := s;
  end if;
  insert into denetim_kaydi (kullanici, eposta, rol, tablo, islem, satir, uye_id, degisen)
  values (auth.uid(), auth.jwt() ->> 'email', coalesce(nullif(auth.jwt() ->> 'role', ''), current_user), tg_table_name, tg_op,
          coalesce(s ->> 'id', s ->> 'anahtar', s ->> 'user_id', (s ->> 'etkinlik_id') || '/' || (s ->> 'uye_id')),
          case when tg_table_name = 'uyeler' then (s ->> 'id')::bigint else (s ->> 'uye_id')::bigint end,
          fark);
  return null;
end $$;
revoke execute on function public.denetle() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['yoneticiler', 'uyeler', 'odemeler', 'etkinlikler', 'etkinlik_kayitlari', 'tanisma_biletleri',
                           'muhasebe_hareketleri', 'envanter', 'eposta_sablonlari', 'dekontlar', 'ayarlar',
                           'uyelik_dondurmalari', 'veri_talepleri'] loop
    execute format('drop trigger if exists denetim on public.%I', t);
    execute format('create trigger denetim after insert or update or delete on public.%I for each row execute function public.denetle()', t);
  end loop;
end $$;

-- 2 yıldan eski kayıtlar haftada bir silinir (Pazar 03.47 UTC)
create or replace function public.denetim_temizle() returns int
  language sql security definer set search_path = public as $$
    with s as (delete from denetim_kaydi where zaman < now() - interval '2 years' returning 1) select count(*)::int from s
  $$;
revoke execute on function public.denetim_temizle() from public, anon, authenticated;
select cron.schedule('fc-denetim-temizle', '47 3 * * 0', $$select public.denetim_temizle()$$);

-- ---------------------------------------------------------------------------------------------------------------
-- KVKK silme: 20261031000000 ile aynı; sonunda üyenin denetim kayıtları da silinir (eski ad / e-posta içerenler dahil)
create or replace function public.uye_anonimlestir(p_uye bigint)
  returns text[] language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  takma text;
  dosyalar text[];
  mail bigint;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into u from uyeler where id = p_uye for update;
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  if u.user_id is not null and exists (select 1 from yoneticiler where user_id = u.user_id) then
    raise exception 'Yönetici hesabı bu yolla silinemez.';
  end if;
  takma := 'Silinmiş üye #' || u.id;
  mail := eposta_ekle('veri_talebi', u.eposta, jsonb_build_object('ad', u.ad), 'veri_talebi:silme:' || u.id);
  select coalesce(array_agg(dosya) filter (where dosya like 'yeni/%'), '{}') into dosyalar from dekontlar where uye_id = u.id;
  update dekontlar set eposta = 'silindi-' || u.id || '@silindi.invalid', ad = takma, dosya = 'silindi', sonuc = null where uye_id = u.id;
  update muhasebe_hareketleri set aciklama = 'Aidat · ' || takma where aciklama = 'Aidat · ' || u.ad and kategori = 'Aidat';
  update tanisma_biletleri set ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid' where lower(eposta) = u.eposta;
  update eposta_kuyrugu set alici = 'silindi-' || u.id || '@silindi.invalid', veri = '{}'
    where alici = u.eposta and id is distinct from mail;
  update anket_yanitlari set yorum = null where uye_id = u.id;  -- puan istatistikte kalır, yorum silinir
  update veri_talepleri set durum = 'tamam', tamam_at = now(), ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid'
    where uye_id = u.id;
  update uyeler set ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid', tel = null, dogum_gunu = null,
                    ozel_gunler = '[]', ilgi_alanlari = '{}', kutlama_izni = false, foto_izni = false, nereden_duydu = null,
                    yonetici_notu = null, user_id = null
    where id = u.id;
  if u.user_id is not null then delete from auth.users where id = u.user_id; end if;
  -- Denetim kayıtları: üyeye bağlı olanlar ve eski adını / e-postasını içerenler (muhasebe açıklaması, bilet vb.)
  delete from denetim_kaydi
    where uye_id = u.id or strpos(degisen::text, u.eposta) > 0 or strpos(degisen::text, u.ad) > 0
       or (u.tel is not null and strpos(degisen::text, u.tel) > 0);
  insert into denetim_kaydi (kullanici, eposta, rol, tablo, islem, satir, uye_id, degisen)
    values (auth.uid(), auth.jwt() ->> 'email', 'authenticated', 'uyeler', 'UPDATE', u.id::text, null,
            jsonb_build_object('kvkk', 'Üye anonimleştirildi; önceki denetim kayıtları silindi'));
  return dosyalar;
end $$;
revoke execute on function public.uye_anonimlestir(bigint) from public, anon;
grant execute on function public.uye_anonimlestir(bigint) to authenticated;
