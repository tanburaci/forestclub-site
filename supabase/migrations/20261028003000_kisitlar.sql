-- Forest Club Urla: veri kısıtları (28.10.2026). Etkinlik bağlantısı yalnız https olabilir (javascript: gibi
-- değerler sitede çalışmasın); üye profili boyut ve biçim sınırlarıyla kaydedilir.

-- https olmayan eski bağlantılar (ör. '#') boşaltılır; site boş bağlantıyı zaten göstermez
update public.etkinlikler set link = null where link is not null and link !~ '^https://';
alter table public.etkinlikler add constraint etkinlik_link_https check (link is null or link ~ '^https://');

-- Üye profilini kaydeder (yalnız kendi kaydı; ad, e-posta, üyelik tarihleri değiştirilemez).
-- Sınırlar: telefon 10–15 rakam, doğum günü 1900'den bugüne, en çok 20 ilgi alanı (her biri ≤ 60 harf),
-- en çok 10 özel gün ({ad ≤ 60 harf, tarih YYYY-AA-GG}); başka alanlar saklanmaz.
create or replace function public.profil_kaydet(p_tel text, p_dogum date, p_kutlama boolean, p_foto boolean,
                                                p_ilgi text[], p_ozel jsonb)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_tel text := nullif(trim(coalesce(p_tel, '')), '');
  v_ilgi text[] := coalesce(p_ilgi, '{}');
  v_ozel jsonb := coalesce(p_ozel, '[]');
  temiz jsonb := '[]';
  x jsonb;
  t date;
begin
  if v_tel is not null and (length(v_tel) > 30 or length(regexp_replace(v_tel, '\D', '', 'g')) not between 10 and 15) then
    raise exception 'Telefon numarasını kontrol et.';
  end if;
  if p_dogum is not null and (p_dogum < date '1900-01-01' or p_dogum > istanbul_bugun()) then
    raise exception 'Doğum gününü kontrol et.';
  end if;
  if cardinality(v_ilgi) > 20 or exists (select 1 from unnest(v_ilgi) i where i is null or length(i) > 60) then
    raise exception 'İlgi alanları çok uzun.';
  end if;
  if jsonb_typeof(v_ozel) <> 'array' or jsonb_array_length(v_ozel) > 10 then
    raise exception 'En çok 10 özel gün eklenebilir.';
  end if;
  for x in select * from jsonb_array_elements(v_ozel) loop
    if jsonb_typeof(x) <> 'object' or length(trim(coalesce(x ->> 'ad', ''))) not between 1 and 60
       or coalesce(x ->> 'tarih', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Özel günlerden biri hatalı (ad en çok 60 harf, tarih gerekli).';
    end if;
    begin
      t := (x ->> 'tarih')::date;
    exception when others then
      raise exception 'Özel günlerden birinin tarihi hatalı.';
    end;
    temiz := temiz || jsonb_build_array(jsonb_build_object('ad', trim(x ->> 'ad'), 'tarih', to_char(t, 'YYYY-MM-DD')));
  end loop;
  update uyeler set tel = v_tel, dogum_gunu = p_dogum, kutlama_izni = coalesce(p_kutlama, false),
                    foto_izni = coalesce(p_foto, false), ilgi_alanlari = v_ilgi, ozel_gunler = temiz
    where user_id = auth.uid();
  if not found then raise exception 'Üye kaydı bulunamadı.'; end if;
end $$;
revoke execute on function public.profil_kaydet(text, date, boolean, boolean, text[], jsonb) from public, anon;
grant execute on function public.profil_kaydet(text, date, boolean, boolean, text[], jsonb) to authenticated;
