-- Açık Çağrı: üyelik notu yalnız yeni başvuru açıldıysa (kişi zaten kayıtlıysa yazılmaz)
create or replace function public.cagri_gonder(p jsonb)
  returns text language plpgsql security definer set search_path = public as $$
declare
  k text[] := array['ad', 'iletisim', 'uye', 'alan', 'baslik', 'anlat', 'deneyim', 'sure', 'kisi', 'ihtiyac', 'gunler'];
  n int[] := array[100, 120, 10, 300, 150, 3000, 40, 40, 40, 1000, 200];
  v jsonb := '{}';
  i int;
  uyelik text := null;
begin
  if now() > timestamptz '2026-10-31 23:59:59 Europe/Istanbul' then
    raise exception 'Açık çağrı başvuruları kapandı. İlgin için teşekkürler!';
  end if;
  for i in 1 .. array_length(k, 1) loop
    v := v || jsonb_build_object(k[i], left(trim(coalesce(p ->> k[i], '')), n[i]));
  end loop;
  if length(v ->> 'ad') < 3 or length(v ->> 'iletisim') < 6 or v ->> 'uye' = '' or v ->> 'alan' = ''
     or length(v ->> 'baslik') < 2 or length(v ->> 'anlat') < 10 then
    raise exception 'Zorunlu alanlardan biri eksik görünüyor; lütfen kontrol et.';
  end if;
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
