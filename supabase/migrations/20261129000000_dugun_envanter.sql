-- Forest Club Urla: düğün envanteri ve envanterden düşme (29.11.2026).
-- · Düğün envanteri etkinlik envanterinden ayrı: dugun_envanter (kalemler) + dugun_envanter_hareketleri (giriş / düşüm).
--   Hareket eklenince ya da silinince kalemin adedi tetikleyiciyle güncellenir; envanterde olandan fazlası düşülemez.
-- · Yönetim › Düğün › Envanter › "Gider ekle": gider muhasebeye ("Düğün" kategorisi) yazılır, istenirse envantere girer,
--   bir düğüne aitse o düğünün giderlerine de eklenir (dugun_gider_ekle; tek işlemde).
-- · Hasarlı / kullanılamaz / kayıp: düğünde düşüm hareketi; etkinlik envanterinde envanter_dusumleri kaydı (adet panelden
--   düşer, kayıt geçmiş için).

create table if not exists public.dugun_envanter (
  id bigint generated always as identity primary key,
  ad text not null check (length(trim(ad)) between 1 and 120),
  grup text check (length(grup) <= 40),                -- düğün ürün grupları: Sandalye, Mum, Örtü…
  adet numeric(10, 2) not null default 0 check (adet >= 0),
  birim text not null default 'adet' check (length(birim) <= 20),
  konum text check (length(konum) <= 120),
  notlar text check (length(notlar) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.dugun_envanter_hareketleri (
  id bigint generated always as identity primary key,
  envanter_id bigint not null references public.dugun_envanter (id) on delete cascade,
  tur text not null check (tur in ('giris', 'dusum')),
  neden text not null check (neden in ('satin', 'hediye', 'diger', 'hasarli', 'kullanilamaz', 'kayip')),
  adet numeric(10, 2) not null check (adet > 0),
  tarih date not null default current_date,
  tutar numeric(12, 2) check (tutar >= 0),
  kasa kasa,
  muhasebe_id bigint references public.muhasebe_hareketleri (id) on delete set null,
  talep_id bigint references public.dugun_talepleri (id) on delete set null,   -- hangi düğünde (hasar vb.)
  notlar text check (length(notlar) <= 1000),
  created_at timestamptz not null default now(),
  check ((tur = 'giris') = (neden in ('satin', 'hediye', 'diger')))
);

-- Adet: giriş ekler, düşüm çıkarır; silinen hareket geri alınır. Fazla düşüm adet >= 0 kuralına takılır.
create or replace function public.dugun_envanter_adet() returns trigger
  language plpgsql set search_path = public as $$
declare
  h dugun_envanter_hareketleri;
  fark numeric;
begin
  if tg_op = 'DELETE' then h := old; else h := new; end if;
  fark := case when h.tur = 'giris' then h.adet else -h.adet end;
  if tg_op = 'DELETE' then fark := -fark; end if;
  update dugun_envanter set adet = adet + fark where id = h.envanter_id;
  return null;
exception when check_violation then
  raise exception 'Envanterde bu kadar yok; en çok mevcut adet kadar düşülebilir.';
end $$;
revoke execute on function public.dugun_envanter_adet() from public, anon, authenticated;
drop trigger if exists adet on public.dugun_envanter_hareketleri;
create trigger adet after insert or delete on public.dugun_envanter_hareketleri for each row execute function public.dugun_envanter_adet();

-- Etkinlik envanteri: hasarlı / kullanılamaz / kayıp kayıtları (adet panelden düşer)
create table if not exists public.envanter_dusumleri (
  id bigint generated always as identity primary key,
  envanter_id bigint not null references public.envanter (id) on delete cascade,
  neden text not null check (neden in ('hasarli', 'kullanilamaz', 'kayip')),
  adet numeric(10, 2) not null check (adet > 0),
  tarih date not null default current_date,
  notlar text check (length(notlar) <= 1000),
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['dugun_envanter', 'dugun_envanter_hareketleri', 'envanter_dusumleri'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists yonetici_tam on public.%I', t);
    execute format('create policy yonetici_tam on public.%I for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists denetim on public.%I', t);
    execute format('create trigger denetim after insert or update or delete on public.%I for each row execute function public.denetle()', t);
  end loop;
end $$;

-- Düğün gideri: muhasebeye "Düğün" gideri; istenirse envantere giriş (var olan kaleme ya da yeni kalem), düğüne aitse
-- o düğünün giderlerine. p: {tarih, tutar, kasa, aciklama, talep_id, envantere, envanter_id, ad, grup, adet, birim, konum}
-- Dönüş: {muhasebe_id, envanter_id}
create or replace function public.dugun_gider_ekle(p jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  tarih date := coalesce(nullif(p ->> 'tarih', '')::date, istanbul_bugun());
  tutar numeric := nullif(p ->> 'tutar', '')::numeric;
  kasa_ kasa := coalesce(nullif(p ->> 'kasa', ''), 'banka')::kasa;
  aciklama text := left(trim(coalesce(p ->> 'aciklama', '')), 200);
  talep bigint := nullif(p ->> 'talep_id', '')::bigint;
  adet numeric := coalesce(nullif(p ->> 'adet', '')::numeric, 0);
  env bigint := nullif(p ->> 'envanter_id', '')::bigint;
  muh bigint;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if tutar is null or tutar <= 0 then raise exception 'Tutarı yazın.'; end if;
  if aciklama = '' then raise exception 'Kısa bir açıklama yazın.'; end if;
  if talep is not null and not exists (select 1 from dugun_talepleri where id = talep) then raise exception 'Düğün bulunamadı.'; end if;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, otomatik)
    values (tarih, 'gider', tutar, kasa_, 'Düğün', aciklama, true) returning id into muh;
  if talep is not null then
    insert into dugun_giderleri (talep_id, aciklama, tutar, vade, odendi) values (talep, aciklama, tutar, tarih, tarih);
  end if;
  if coalesce((p ->> 'envantere')::boolean, false) then
    if adet <= 0 then raise exception 'Envantere girecek miktarı yazın.'; end if;
    if env is null then
      if trim(coalesce(p ->> 'ad', '')) = '' then raise exception 'Envanter kaleminin adını yazın.'; end if;
      insert into dugun_envanter (ad, grup, birim, konum)
        values (left(trim(p ->> 'ad'), 120), nullif(left(trim(coalesce(p ->> 'grup', '')), 40), ''),
                coalesce(nullif(left(trim(coalesce(p ->> 'birim', '')), 20), ''), 'adet'), nullif(left(trim(coalesce(p ->> 'konum', '')), 120), ''))
        returning id into env;
    elsif not exists (select 1 from dugun_envanter where id = env) then
      raise exception 'Envanter kalemi bulunamadı.';
    end if;
    insert into dugun_envanter_hareketleri (envanter_id, tur, neden, adet, tarih, tutar, kasa, muhasebe_id, talep_id, notlar)
      values (env, 'giris', 'satin', adet, tarih, tutar, kasa_, muh, talep, aciklama);
  else
    env := null;
  end if;
  return jsonb_build_object('muhasebe_id', muh, 'envanter_id', env);
end $$;
revoke execute on function public.dugun_gider_ekle(jsonb) from public, anon;
grant execute on function public.dugun_gider_ekle(jsonb) to authenticated;
