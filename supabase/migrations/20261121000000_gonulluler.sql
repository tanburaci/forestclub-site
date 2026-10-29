-- Forest Club Urla: gönüllü başvuruları (21.11.2026). Ana sayfadaki "Gönüllü ol" formu form-gonder üzerinden
-- gonullu_kaydet'e gelir (Turnstile + IP başına sınır); yönetim › Başvurular › Gönüllüler'de görünür, başvurana
-- teşekkür maili gider. Kulüp kişiyle e-postayla iletişime geçer.
create table if not exists public.gonulluler (
  id bigint generated always as identity primary key,
  ad text not null,
  eposta text not null,
  tel text,
  alanlar text[] not null default '{}',
  notlar text,
  durum text not null default 'yeni' check (durum in ('yeni', 'iletisim')),
  created_at timestamptz not null default now()
);
alter table public.gonulluler enable row level security;
drop policy if exists yonetici_tam on public.gonulluler;
create policy yonetici_tam on public.gonulluler for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.gonulluler from anon;
grant select, update, delete on public.gonulluler to authenticated;

drop trigger if exists ad_denetle on public.gonulluler;
create trigger ad_denetle before insert on public.gonulluler for each row execute function public.ad_denetle();

create or replace function public.gonullu_kaydet(p_ad text, p_eposta text, p_tel text, p_alanlar text[], p_not text, p_kvkk boolean)
  returns text language plpgsql security definer set search_path = public
  as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  ad text := trim(coalesce(p_ad, ''));
  yeni bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if not coalesce(p_kvkk, false) then raise exception 'Devam etmek için KVKK metnini onayla.'; end if;
  if exists (select 1 from gonulluler where eposta = ep and created_at > now() - interval '1 day') then return 'tamam'; end if;
  insert into gonulluler (ad, eposta, tel, alanlar, notlar)
    values (ad, ep, nullif(left(trim(coalesce(p_tel, '')), 30), ''),
            coalesce((select array_agg(left(trim(x), 60)) from unnest(p_alanlar[1:10]) x where trim(x) <> ''), '{}'),
            nullif(left(trim(coalesce(p_not, '')), 1000), ''))
    returning id into yeni;
  perform eposta_ekle('gonullu', ep, jsonb_build_object('ad', ad), 'gonullu:' || yeni);
  return 'tamam';
end $$;
revoke execute on function public.gonullu_kaydet(text, text, text, text[], text, boolean) from public, anon, authenticated;
grant execute on function public.gonullu_kaydet(text, text, text, text[], text, boolean) to service_role;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('gonullu', 'Gönüllü başvurusu alındı', 'Ana sayfadaki "Gönüllü ol" formunu dolduran kişiye gider.', true, null,
   'Gönüllü başvurun bize ulaştı 🌿',
   E'Merhaba {ad},\n\nForest Club Urla etkinliklerinde gönüllü olmak istediğini öğrendik, çok teşekkürler! 🌲\n\nBir sonraki buluşmalarımızın planı netleştiğinde seninle e-postayla iletişime geçeceğiz.\n\nSevgiler,\nForest Club Urla\nWe listen carefully.',
   array['ad'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where id = 'gonullu' and varsayilan_konu is null;
