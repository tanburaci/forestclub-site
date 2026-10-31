-- Forest Club Urla: Açık Çağrı artık sürekli açık (genel çağrı; 31.10.2026 son tarihi kalktı). Eksik alanda hangi alanın
-- eksik olduğu söylenir (eskiden tek bir genel mesaj vardı; "anlat" 10 karakterden kısaysa neden reddedildiği belli değildi).
create or replace function public.cagri_gonder(p jsonb)
  returns text language plpgsql security definer set search_path = public as $$
declare
  k text[] := array['ad', 'iletisim', 'uye', 'alan', 'baslik', 'anlat', 'deneyim', 'sure', 'kisi', 'ihtiyac', 'gunler'];
  n int[] := array[100, 120, 10, 300, 150, 3000, 40, 40, 40, 1000, 200];
  v jsonb := '{}';
  i int;
  uyelik text := null;
begin
  for i in 1 .. array_length(k, 1) loop
    v := v || jsonb_build_object(k[i], left(trim(coalesce(p ->> k[i], '')), n[i]));
  end loop;
  if length(v ->> 'ad') < 3 then raise exception 'Adını ve soyadını yaz.'; end if;
  if length(regexp_replace(v ->> 'iletisim', '\s', '', 'g')) < 6 then raise exception 'E-posta adresini ya da telefon numaranı yaz.'; end if;
  if v ->> 'uye' = '' then raise exception '"Forest Club üyesi misin?" sorusunu cevapla.'; end if;
  if v ->> 'alan' = '' then raise exception 'Çalışmanın alanını seç (en az bir tane).'; end if;
  if length(v ->> 'baslik') < 2 then raise exception 'Atölyenin ya da buluşmanın adını yaz.'; end if;
  if length(v ->> 'anlat') < 3 then raise exception '"Bize biraz anlatır mısın?" alanını doldur.'; end if;
  if coalesce((p ->> 'uyeOl')::boolean, false) then
    if basvuru_yap(v ->> 'ad', p ->> 'uyeEposta', p ->> 'uyeTelefon', true, true, true,
                   coalesce((p ->> 'uyeFoto')::boolean, false)) = 'tamam' then
      uyelik := 'Üyelik başvurusu da yapıldı (' || lower(trim(p ->> 'uyeEposta')) || ')';
    end if;
  end if;
  insert into acik_cagri (ad, iletisim, uye, alan, baslik, anlatim, deneyim, sure, kisi, ihtiyac, gunler, notlar)
    values (v ->> 'ad', v ->> 'iletisim', v ->> 'uye', v ->> 'alan', v ->> 'baslik', v ->> 'anlat',
            nullif(v ->> 'deneyim', ''), nullif(v ->> 'sure', ''), nullif(v ->> 'kisi', ''), nullif(v ->> 'ihtiyac', ''),
            nullif(v ->> 'gunler', ''), uyelik);
  return 'tamam';
end $$;
revoke execute on function public.cagri_gonder(jsonb) from public, anon, authenticated;
grant execute on function public.cagri_gonder(jsonb) to service_role;
