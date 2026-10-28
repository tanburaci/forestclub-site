-- Forest Club Urla: üye formları (15.11.2026). Yönetim › Formlar'da form kurulur (sorular: kısa yazı, uzun yazı, tek
-- seçim, çoklu seçim; zorunlu olabilir) ve açılır. Üye açık formları panelinde doldurur, sonradan düzeltebilir.
-- Cevaplar yalnız form_yanitla ile (sunucuda doğrulanarak) yazılır; yönetici görür ve CSV indirir.
create table if not exists public.formlar (
  id bigint generated always as identity primary key,
  baslik text not null check (length(trim(baslik)) between 1 and 120),
  aciklama text check (length(aciklama) <= 1000),
  -- [{id, metin, tur: kisa | uzun | tek | coklu, secenekler: [..], zorunlu}]
  sorular jsonb not null default '[]' check (jsonb_typeof(sorular) = 'array'),
  acik boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.form_yanitlari (
  form_id bigint not null references public.formlar (id) on delete cascade,
  uye_id bigint not null references public.uyeler (id) on delete cascade,
  cevaplar jsonb not null default '{}',             -- {soru id: "metin" | ["seçenek", ..]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (form_id, uye_id)
);

alter table public.formlar enable row level security;
alter table public.form_yanitlari enable row level security;
drop policy if exists yonetici_tam on public.formlar;
create policy yonetici_tam on public.formlar for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists uye_acik on public.formlar;
create policy uye_acik on public.formlar for select to authenticated using (acik);
drop policy if exists yonetici_tam on public.form_yanitlari;
create policy yonetici_tam on public.form_yanitlari for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists uye_kendi on public.form_yanitlari;
create policy uye_kendi on public.form_yanitlari for select to authenticated
  using (uye_id in (select id from public.uyeler where user_id = auth.uid()));

drop trigger if exists denetim on public.formlar;
create trigger denetim after insert or update or delete on public.formlar for each row execute function public.denetle();

-- Üye cevabı: yalnız açık forma, sorulara göre doğrulanır; bilinmeyen alanlar atılır. Tekrar gönderilirse güncellenir.
create or replace function public.form_yanitla(p_form bigint, p_cevaplar jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  f formlar;
  s jsonb;
  v jsonb;
  temiz jsonb := '{}';
  metin text;
  secim text;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into f from formlar where id = p_form;
  if f.id is null or not f.acik then raise exception 'Bu form artık cevap almıyor.'; end if;
  if p_cevaplar is null or jsonb_typeof(p_cevaplar) <> 'object' then raise exception 'Cevaplar okunamadı.'; end if;
  for s in select * from jsonb_array_elements(f.sorular) loop
    v := p_cevaplar -> (s ->> 'id');
    if s ->> 'tur' = 'coklu' then
      if v is not null and jsonb_typeof(v) <> 'array' then raise exception '"%" için seçim okunamadı.', s ->> 'metin'; end if;
      v := coalesce(v, '[]');
      for secim in select jsonb_array_elements_text(v) loop
        if not (coalesce(s -> 'secenekler', '[]') ? secim) then raise exception '"%" için geçersiz seçim.', s ->> 'metin'; end if;
      end loop;
      if coalesce((s ->> 'zorunlu')::boolean, false) and jsonb_array_length(v) = 0 then
        raise exception '"%" sorusunu cevapla.', s ->> 'metin';
      end if;
      if jsonb_array_length(v) > 0 then temiz := temiz || jsonb_build_object(s ->> 'id', v); end if;
    else
      metin := case when v is null or jsonb_typeof(v) = 'null' then '' when jsonb_typeof(v) = 'string' then trim(v #>> '{}') else null end;
      if metin is null then raise exception '"%" için cevap okunamadı.', s ->> 'metin'; end if;
      if coalesce((s ->> 'zorunlu')::boolean, false) and metin = '' then raise exception '"%" sorusunu cevapla.', s ->> 'metin'; end if;
      if s ->> 'tur' = 'tek' and metin <> '' and not (coalesce(s -> 'secenekler', '[]') ? metin) then
        raise exception '"%" için geçersiz seçim.', s ->> 'metin';
      end if;
      if length(metin) > (case when s ->> 'tur' = 'uzun' then 2000 else 200 end) then
        raise exception '"%" cevabı çok uzun.', s ->> 'metin';
      end if;
      if metin <> '' then temiz := temiz || jsonb_build_object(s ->> 'id', metin); end if;
    end if;
  end loop;
  insert into form_yanitlari (form_id, uye_id, cevaplar) values (f.id, u.id, temiz)
    on conflict (form_id, uye_id) do update set cevaplar = excluded.cevaplar, updated_at = now();
  return temiz;
end $$;
revoke execute on function public.form_yanitla(bigint, jsonb) from public, anon;
grant execute on function public.form_yanitla(bigint, jsonb) to authenticated;

-- KVKK: anonimleştirilen üyenin form cevapları silinir (uye_anonimlestir e-postayı silindi-… yapar)
create or replace function public.form_yanit_temizle() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  delete from form_yanitlari where uye_id = new.id;
  return new;
end $$;
revoke execute on function public.form_yanit_temizle() from public, anon, authenticated;
drop trigger if exists form_yanit_temizle on public.uyeler;
create trigger form_yanit_temizle after update of eposta on public.uyeler
  for each row when (new.eposta like 'silindi-%@silindi.invalid' and old.eposta not like 'silindi-%@silindi.invalid')
  execute function public.form_yanit_temizle();

-- KVKK: üyenin veri kopyasına form cevapları da girer
create or replace function public.veri_kopyasi(p_uye bigint default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare u uyeler;
begin
  if p_uye is null then select * into u from uyeler where user_id = auth.uid();
  elsif yonetici_mi() then select * into u from uyeler where id = p_uye;
  else raise exception 'Bu işlem yalnız yönetici içindir.';
  end if;
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  return jsonb_build_object(
    'olusturma', now(),
    'uye', to_jsonb(u) - 'user_id' - 'yonetici_notu',
    'odemeler', coalesce((select jsonb_agg(to_jsonb(o) - 'uye_id' order by o.tarih) from odemeler o where o.uye_id = u.id), '[]'),
    'etkinlik_kayitlari', coalesce((select jsonb_agg(jsonb_build_object('etkinlik', e.ad, 'tarih', e.tarih, 'durum', k.durum, 'geldi', k.geldi) order by e.tarih)
                                    from etkinlik_kayitlari k join etkinlikler e on e.id = k.etkinlik_id where k.uye_id = u.id), '[]'),
    'dekontlar', coalesce((select jsonb_agg(jsonb_build_object('tarih', d.odeme_tarihi, 'tutar', d.tutar, 'durum', d.durum, 'sonuc', d.sonuc) order by d.id)
                           from dekontlar d where d.uye_id = u.id), '[]'),
    'dondurmalar', coalesce((select jsonb_agg(to_jsonb(x) - 'uye_id' order by x.id) from uyelik_dondurmalari x where x.uye_id = u.id), '[]'),
    'anketler', coalesce((select jsonb_agg(to_jsonb(a) - 'uye_id') from anket_yanitlari a where a.uye_id = u.id), '[]'),
    'formlar', coalesce((select jsonb_agg(jsonb_build_object('form', f.baslik, 'cevaplar', y.cevaplar, 'tarih', y.updated_at) order by y.created_at)
                         from form_yanitlari y join formlar f on f.id = y.form_id where y.uye_id = u.id), '[]'),
    'tanisma_biletleri', coalesce((select jsonb_agg(to_jsonb(t) - 'id') from tanisma_biletleri t where lower(t.eposta) = u.eposta), '[]'),
    'gonderilen_mailler', coalesce((select jsonb_agg(jsonb_build_object('sablon', q.sablon, 'durum', q.durum, 'tarih', q.created_at) order by q.id)
                                    from eposta_kuyrugu q where q.alici = u.eposta), '[]'));
end $$;
revoke execute on function public.veri_kopyasi(bigint) from public, anon;
grant execute on function public.veri_kopyasi(bigint) to authenticated;
