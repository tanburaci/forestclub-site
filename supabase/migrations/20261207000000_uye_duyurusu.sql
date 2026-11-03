-- Forest Club Urla: üyelere serbest duyuru maili (03.11.2026). Yönetici İletişim'de hedef (aktif / süresi dolmuş /
-- hepsi), konu ve metin yazar; her alıcıya "duyuru" şablonuyla kuyruğa bir mail eklenir (eposta-gonder gönderir).
-- Anonimleştirilmiş (KVKK) ve demo adreslere gitmez. Gönderilen duyurular kayıt altında tutulur.
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('duyuru', 'Üyelere duyuru', 'Yönetici İletişim › Üyelere duyuru ile gönderince gider.', true, null, '{konu}',
   E'Merhaba {ad},\n\n{metin}\n\nForest Club Urla', array['ad', 'konu', 'metin'])
  on conflict (id) do nothing;

create table if not exists public.uye_duyurulari (
  id bigint generated always as identity primary key,
  hedef text not null check (hedef in ('aktif', 'pasif', 'hepsi')),
  konu text not null,
  metin text not null,
  alici int not null default 0,
  gonderen uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.uye_duyurulari enable row level security;
drop policy if exists yonetici_okur on public.uye_duyurulari;
create policy yonetici_okur on public.uye_duyurulari for select to authenticated using (public.yonetici_mi());

-- Hedefteki üyeler: aktif = üyeliği bugün geçerli; pasif = üyeliği bir kez başlamış ama bitmiş; hepsi = ikisi
create or replace function public.uye_duyurusu_alicilar(p_hedef text)
  returns setof uyeler language sql stable security definer set search_path = public as $$
  select * from uyeler
   where bitis is not null
     and eposta not like 'silindi-%@silindi.invalid'
     and not demo_adres_mi(eposta)
     and case p_hedef when 'aktif' then bitis >= istanbul_bugun()
                      when 'pasif' then bitis < istanbul_bugun()
                      when 'hepsi' then true else false end;
$$;
revoke execute on function public.uye_duyurusu_alicilar(text) from public, anon, authenticated;

create or replace function public.uye_duyurusu_sayi(p_hedef text)
  returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  return (select count(*) from uye_duyurusu_alicilar(p_hedef));
end $$;
revoke execute on function public.uye_duyurusu_sayi(text) from public, anon;
grant execute on function public.uye_duyurusu_sayi(text) to authenticated;

create or replace function public.uye_duyurusu_gonder(p_hedef text, p_konu text, p_metin text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := trim(coalesce(p_konu, ''));
  m text := trim(coalesce(p_metin, ''));
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
  insert into uye_duyurulari (hedef, konu, metin, gonderen) values (p_hedef, k, m, auth.uid()) returning id into d;
  for u in select * from uye_duyurusu_alicilar(p_hedef) loop
    if eposta_ekle('duyuru', u.eposta, jsonb_build_object('ad', split_part(u.ad, ' ', 1), 'konu', k, 'metin', m),
                   'duyuru:' || d || ':' || u.id, u.id) is not null then
      n := n + 1;
    end if;
  end loop;
  update uye_duyurulari set alici = n where id = d;
  return jsonb_build_object('id', d, 'alici', n);
end $$;
revoke execute on function public.uye_duyurusu_gonder(text, text, text) from public, anon;
grant execute on function public.uye_duyurusu_gonder(text, text, text) to authenticated;
