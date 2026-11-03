-- Forest Club Urla: üyelere duyuruya isteğe bağlı etkinlik (03.11.2026). Yönetici kayıtlı bir etkinlik seçerse mailin
-- sonuna etkinliğin bilgileri sistemden eklenir: yaklaşan etkinlikte tarih, saat, üye fiyatı ve "Yerini ayır" bağlantısı;
-- geçmiş etkinlikte (ör. teşekkür maili) yalnız adı ve tarihi.
alter table public.uye_duyurulari add column if not exists etkinlik_id bigint references public.etkinlikler (id) on delete set null;

update public.eposta_sablonlari set metin = E'Merhaba {ad},\n\n{metin}{etkinlik}\n\nForest Club Urla', alanlar = array['ad', 'konu', 'metin', 'etkinlik']
 where id = 'duyuru' and metin = E'Merhaba {ad},\n\n{metin}\n\nForest Club Urla';

create or replace function public.uye_duyurusu_etkinlik_metni(p_etkinlik bigint)
  returns text language plpgsql stable security definer set search_path = public as $$
declare
  e etkinlikler;
  fiyat text;
begin
  if p_etkinlik is null then return ''; end if;
  select * into e from etkinlikler where id = p_etkinlik;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  if e.tarih < istanbul_bugun() then
    return E'\n\n— ' || e.ad || ' · ' || tr_tarih(e.tarih);
  end if;
  fiyat := case
    when e.bilet_fiyati is null then 'Üyelere açık'
    when e.uyelere = 'ucretsiz' then 'Üyeliğe dahil'
    when e.uyelere = 'yuzde50' then 'Üyelere %50 indirim: ' || replace(to_char(e.bilet_fiyati, 'FM999,999'), ',', '.') || ' TL yerine ' || replace(to_char(round(e.bilet_fiyati / 2), 'FM999,999'), ',', '.') || ' TL'
    else replace(to_char(e.bilet_fiyati, 'FM999,999'), ',', '.') || ' TL' end;
  return E'\n\n— ' || e.ad || ' · ' || tr_tarih(e.tarih) || coalesce(' · ' || e.saat, '') || E'\n' || fiyat
         || E'\nYerini ayır: https://www.forestcluburla.com/e/' || e.id;
end $$;
revoke execute on function public.uye_duyurusu_etkinlik_metni(bigint) from public, anon, authenticated;

drop function if exists public.uye_duyurusu_gonder(text, text, text);
create or replace function public.uye_duyurusu_gonder(p_hedef text, p_konu text, p_metin text, p_etkinlik bigint default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := trim(coalesce(p_konu, ''));
  m text := trim(coalesce(p_metin, ''));
  ek text;
  d bigint;
  u uyeler;
  n int := 0;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_hedef not in ('aktif', 'pasif', 'hepsi') then raise exception 'Kime gideceğini seç.'; end if;
  if length(k) < 3 or length(k) > 150 then raise exception 'Konu 3–150 karakter olmalı.'; end if;
  if length(m) < 10 or length(m) > 5000 then raise exception 'Metin 10–5000 karakter olmalı.'; end if;
  if (select count(*) from uye_duyurulari where created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bugün çok fazla duyuru gönderildi; yarın tekrar dene.';
  end if;
  ek := uye_duyurusu_etkinlik_metni(p_etkinlik);
  insert into uye_duyurulari (hedef, konu, metin, gonderen, etkinlik_id) values (p_hedef, k, m, auth.uid(), p_etkinlik) returning id into d;
  for u in select * from uye_duyurusu_alicilar(p_hedef) loop
    if eposta_ekle('duyuru', u.eposta, jsonb_build_object('ad', split_part(u.ad, ' ', 1), 'konu', k, 'metin', m, 'etkinlik', ek),
                   'duyuru:' || d || ':' || u.id, u.id, p_etkinlik) is not null then
      n := n + 1;
    end if;
  end loop;
  update uye_duyurulari set alici = n where id = d;
  return jsonb_build_object('id', d, 'alici', n);
end $$;
revoke execute on function public.uye_duyurusu_gonder(text, text, text, bigint) from public, anon;
grant execute on function public.uye_duyurusu_gonder(text, text, text, bigint) to authenticated;
