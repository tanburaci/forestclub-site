-- Forest Club Urla (03.11.2026): üyelere duyuruda göndermeden önce
--   · Önizle: maili veritabanındaki GERÇEK uye_duyuru şablonuyla doldurup konu + metni döndürür (hiçbir şey yazmaz)
--   · Bana deneme gönder: aynı maili yalnız giriş yapan yöneticinin kendi adresine kuyruğa ekler
create or replace function public.uye_duyurusu_onizle(p_konu text, p_metin text, p_etkinlik bigint default null, p_ad text default 'Ayşe')
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s eposta_sablonlari;
  ek text;
  v jsonb;
  k text;
  m text;
  a text;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into s from eposta_sablonlari where id = 'uye_duyuru';
  if s.id is null then raise exception 'Üye duyurusu şablonu bulunamadı.'; end if;
  ek := uye_duyurusu_etkinlik_metni(p_etkinlik);
  v := jsonb_build_object('ad', coalesce(nullif(trim(p_ad), ''), 'Ayşe'), 'konu', trim(coalesce(p_konu, '')), 'metin', trim(coalesce(p_metin, '')), 'etkinlik', ek);
  k := s.konu; m := s.metin;
  for a in select jsonb_object_keys(v) loop
    k := replace(k, '{' || a || '}', v ->> a);
    m := replace(m, '{' || a || '}', v ->> a);
  end loop;
  return jsonb_build_object('konu', k, 'metin', m);
end $$;
revoke execute on function public.uye_duyurusu_onizle(text, text, bigint, text) from public, anon;
grant execute on function public.uye_duyurusu_onizle(text, text, bigint, text) to authenticated;

create or replace function public.uye_duyurusu_deneme(p_konu text, p_metin text, p_etkinlik bigint default null)
  returns text language plpgsql security definer set search_path = public as $$
declare
  k text := trim(coalesce(p_konu, ''));
  m text := trim(coalesce(p_metin, ''));
  ep text;
  ad text;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if length(k) < 3 or length(k) > 150 then raise exception 'Konu 3–150 karakter olmalı.'; end if;
  if length(m) < 10 or length(m) > 5000 then raise exception 'Metin 10–5000 karakter olmalı.'; end if;
  select lower(email) into ep from auth.users where id = auth.uid();
  if ep is null then raise exception 'Giriş adresin bulunamadı.'; end if;
  select y.ad into ad from yoneticiler y where y.user_id = auth.uid();
  if eposta_ekle('uye_duyuru', ep, jsonb_build_object('ad', split_part(coalesce(ad, 'Yönetici'), ' ', 1), 'konu', '[DENEME] ' || k, 'metin', m,
                 'etkinlik', uye_duyurusu_etkinlik_metni(p_etkinlik)), 'uye_duyuru_deneme:' || auth.uid() || ':' || extract(epoch from clock_timestamp())) is null then
    raise exception 'Deneme maili bu adrese gönderilemiyor (%).', ep;
  end if;
  return ep;
end $$;
revoke execute on function public.uye_duyurusu_deneme(text, text, bigint) from public, anon;
grant execute on function public.uye_duyurusu_deneme(text, text, bigint) to authenticated;
