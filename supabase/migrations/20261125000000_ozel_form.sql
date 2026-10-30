-- Forest Club Urla: özel form (25.11.2026). Özel form üye panelinde ve sitede görünmez; yalnız gizli bağlantısı
-- (/form/?k=<anahtar>) olan kişi açar ve giriş yapmadan, adı ve e-postasıyla doldurur. Yönetici bağlantıyı istediği
-- kişiye kendisi gönderir. Numarayla (/form/?id=N) özel forma ulaşılamaz: RLS göstermez, form_yanitla reddeder.
-- Cevap form-gonder'den (Turnstile + IP sınırı) ozel_form_yanitla ile gelir; aynı e-posta tekrar gönderirse güncellenir.
alter table public.formlar add column if not exists ozel boolean not null default false;
alter table public.formlar add column if not exists anahtar text not null default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists formlar_anahtar on public.formlar (anahtar);

drop policy if exists uye_acik on public.formlar;
create policy uye_acik on public.formlar for select to authenticated using (acik and not ozel);

-- Özel form cevabı üyeye bağlı değil: ad ve e-postayla tutulur
alter table public.form_yanitlari drop constraint if exists form_yanitlari_pkey;
alter table public.form_yanitlari alter column uye_id drop not null;
alter table public.form_yanitlari add column if not exists ad text check (length(ad) <= 120);
alter table public.form_yanitlari add column if not exists eposta text check (length(eposta) <= 160);
alter table public.form_yanitlari drop constraint if exists form_yanitlari_kimlik;
alter table public.form_yanitlari add constraint form_yanitlari_kimlik check (uye_id is not null or (ad is not null and eposta is not null));
create unique index if not exists form_yanitlari_uye on public.form_yanitlari (form_id, uye_id);
create unique index if not exists form_yanitlari_eposta on public.form_yanitlari (form_id, eposta) where uye_id is null;
drop trigger if exists ad_denetle on public.form_yanitlari;
create trigger ad_denetle before insert or update of ad on public.form_yanitlari for each row when (new.ad is not null) execute function public.ad_denetle();

-- Bağlantıdaki anahtarla özel formu getirir (yalnız açıksa); bağlantıyı bilen herkes açabilir
create or replace function public.ozel_form(p_anahtar text)
  returns table (id bigint, baslik text, aciklama text, sorular jsonb)
  language sql stable security definer set search_path = public
  as $$ select f.id, f.baslik, f.aciklama, f.sorular from formlar f where f.ozel and f.acik and f.anahtar = p_anahtar $$;
revoke execute on function public.ozel_form(text) from public;
grant execute on function public.ozel_form(text) to anon, authenticated;

-- Cevapları sorulara göre doğrular; bilinmeyen alanlar atılır. Dönüş: temiz cevaplar
create or replace function public.form_cevap_temizle(f formlar, p_cevaplar jsonb)
  returns jsonb language plpgsql stable set search_path = public as $$
declare
  s jsonb;
  v jsonb;
  temiz jsonb := '{}';
  metin text;
  secim text;
begin
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
  return temiz;
end $$;
revoke execute on function public.form_cevap_temizle(formlar, jsonb) from public, anon, authenticated;

drop function if exists public.form_yanitla(bigint, jsonb, text);
-- Üye cevabı (açık, özel olmayan form): tekrar gönderilirse güncellenir
create or replace function public.form_yanitla(p_form bigint, p_cevaplar jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  f formlar;
  temiz jsonb;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into f from formlar where id = p_form;
  if f.id is null or not f.acik or f.ozel then raise exception 'Bu form artık cevap almıyor.'; end if;
  temiz := form_cevap_temizle(f, p_cevaplar);
  insert into form_yanitlari (form_id, uye_id, cevaplar) values (f.id, u.id, temiz)
    on conflict (form_id, uye_id) do update set cevaplar = excluded.cevaplar, updated_at = now();
  return temiz;
end $$;
revoke execute on function public.form_yanitla(bigint, jsonb) from public, anon;
grant execute on function public.form_yanitla(bigint, jsonb) to authenticated;

-- Özel form cevabı (girişsiz): anahtar, ad ve e-postayla; aynı e-posta tekrar gönderirse güncellenir
create or replace function public.ozel_form_yanitla(p_anahtar text, p_ad text, p_eposta text, p_cevaplar jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f formlar;
  ad text := trim(coalesce(p_ad, ''));
  ep text := lower(trim(coalesce(p_eposta, '')));
  temiz jsonb;
begin
  select * into f from formlar where ozel and acik and anahtar = coalesce(p_anahtar, '');
  if f.id is null then raise exception 'Bu form artık cevap almıyor.'; end if;
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if (select count(*) from form_yanitlari where form_id = f.id) >= 1000 then raise exception 'Bu form artık cevap almıyor.'; end if;
  temiz := form_cevap_temizle(f, p_cevaplar);
  insert into form_yanitlari (form_id, ad, eposta, cevaplar) values (f.id, ad, ep, temiz)
    on conflict (form_id, eposta) where uye_id is null do update set ad = excluded.ad, cevaplar = excluded.cevaplar, updated_at = now();
  return temiz;
end $$;
revoke execute on function public.ozel_form_yanitla(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ozel_form_yanitla(text, text, text, jsonb) to service_role;

-- KVKK: kişinin veri kopyasına girişsiz doldurduğu özel form cevapları da girer (e-postasıyla)
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
                         from form_yanitlari y join formlar f on f.id = y.form_id where y.uye_id = u.id or (y.uye_id is null and y.eposta = u.eposta)), '[]'),
    'tanisma_biletleri', coalesce((select jsonb_agg(to_jsonb(t) - 'id') from tanisma_biletleri t where lower(t.eposta) = u.eposta), '[]'),
    'gonderilen_mailler', coalesce((select jsonb_agg(jsonb_build_object('sablon', q.sablon, 'durum', q.durum, 'tarih', q.created_at) order by q.id)
                                    from eposta_kuyrugu q where q.alici = u.eposta), '[]'));
end $$;
revoke execute on function public.veri_kopyasi(bigint) from public, anon;
grant execute on function public.veri_kopyasi(bigint) to authenticated;

-- KVKK: anonimleştirilen üyenin aynı e-postayla verdiği özel form cevapları da silinir
create or replace function public.form_yanit_temizle() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  delete from form_yanitlari where uye_id = new.id or (uye_id is null and eposta = lower(old.eposta));
  return new;
end $$;
revoke execute on function public.form_yanit_temizle() from public, anon, authenticated;
