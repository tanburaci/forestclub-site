-- Forest Club Urla: "Destek ol" (03.11.2026). Sitedeki destek penceresinden kartla destek (iyzico) ya da IBAN'a havale.
--   · Kart: form-gonder ("destek", Turnstile + IP sınırı) destek_istegi_ac ile istek açar, iyzico ödeme sayfasına gider;
--     odeme-donus (?tur=destek) iyzico'dan doğrulayıp destek_tamamla ile gelir ve komisyon gideri yazar
--   · Kartla destek, aidattaki gibi ayarlar.kart_odeme açıkken alınır
--   · IBAN'a gelen destekler bankada görünür; sistem otomatik kaydetmez (yönetici muhasebeye elle yazar)

create table if not exists public.destekler (
  id uuid primary key default gen_random_uuid(),
  tutar numeric(10, 2) not null check (tutar >= 50 and tutar <= 100000),
  durum text not null default 'basladi' check (durum in ('basladi', 'odendi', 'basarisiz')),
  token text unique,
  odeme_no text,
  komisyon numeric(10, 2),
  hata text,
  created_at timestamptz not null default now(),
  sonuc_at timestamptz
);
create index if not exists destekler_zaman on public.destekler (created_at desc);
alter table public.destekler enable row level security;
drop policy if exists yonetici_okur on public.destekler;
create policy yonetici_okur on public.destekler for select to authenticated using (public.yonetici_mi());
revoke all on public.destekler from anon, authenticated;
grant select on public.destekler to authenticated;

drop trigger if exists denetim on public.destekler;
create trigger denetim after insert or update or delete on public.destekler for each row execute function public.denetle();

-- Tutar sitede seçilir (hazır tutarlar ya da elle); sunucu yalnız sınırları denetler
create or replace function public.destek_istegi_ac(p_tutar numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  yeni uuid;
  t numeric := round(p_tutar, 2);
begin
  if coalesce((ayar('kart_odeme'))::boolean, false) is false then
    raise exception 'Kartla ödeme çok yakında; şimdilik IBAN ile gönderebilirsin.';
  end if;
  if t is null or t < 50 then raise exception 'Destek tutarı en az 50 TL olabilir.'; end if;
  if t > 100000 then raise exception 'Destek tutarı en çok 100.000 TL olabilir.'; end if;
  -- Kötüye kullanıma karşı genel sınır (IP başına sınır form-gonder'de)
  if (select count(*) from destekler where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Şu an çok fazla istek var; biraz sonra tekrar dene.';
  end if;
  insert into destekler (tutar) values (t) returning id into yeni;
  return jsonb_build_object('id', yeni, 'tutar', t);
end $$;
revoke execute on function public.destek_istegi_ac(numeric) from public, anon, authenticated;
grant execute on function public.destek_istegi_ac(numeric) to service_role;

create or replace function public.destek_istegi_token(p_id uuid, p_token text)
  returns void language sql security definer set search_path = public as $$
    update destekler set token = p_token where id = p_id and durum = 'basladi'
  $$;
revoke execute on function public.destek_istegi_token(uuid, text) from public, anon, authenticated;
grant execute on function public.destek_istegi_token(uuid, text) to service_role;

-- iyzico'dan doğrulanan destek: muhasebeye "Destek" geliri ve kart komisyonu gideri (ikinci kez gelirse yazılmaz)
create or replace function public.destek_tamamla(p_token text, p_odeme_no text, p_odenen numeric, p_komisyon numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d destekler;
begin
  select * into d from destekler where token = p_token for update;
  if d.id is null then raise exception 'Destek isteği bulunamadı.'; end if;
  if d.durum = 'odendi' then return jsonb_build_object('tekrar', true); end if;
  if p_odenen is null or p_odenen < d.tutar then raise exception 'Ödenen tutar eksik.'; end if;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (istanbul_bugun(), 'gelir', d.tutar, 'banka', 'Destek', 'Kartla destek · ödeme ' || p_odeme_no,
            'iyzico:' || p_odeme_no, true, 'kart');
  if coalesce(p_komisyon, 0) > 0 then
    insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
      values (istanbul_bugun(), 'gider', p_komisyon, 'banka', 'Kart komisyonu', 'iyzico komisyonu · destek ' || p_odeme_no,
              'iyzico:' || p_odeme_no, true, 'kart');
  end if;
  update destekler set durum = 'odendi', odeme_no = p_odeme_no, komisyon = nullif(p_komisyon, 0), sonuc_at = now() where id = d.id;
  return jsonb_build_object('tutar', d.tutar);
end $$;
revoke execute on function public.destek_tamamla(text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.destek_tamamla(text, text, numeric, numeric) to service_role;

create or replace function public.destek_basarisiz(p_token text, p_hata text)
  returns void language sql security definer set search_path = public as $$
    update destekler set durum = 'basarisiz', hata = left(p_hata, 500), sonuc_at = now() where token = p_token and durum = 'basladi'
  $$;
revoke execute on function public.destek_basarisiz(text, text) from public, anon, authenticated;
grant execute on function public.destek_basarisiz(text, text) to service_role;
