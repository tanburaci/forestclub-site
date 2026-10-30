-- Forest Club Urla: özel form (25.11.2026). Özel form üye panelinde ve sitede görünmez; yalnız gizli bağlantısı
-- (/form/?k=<anahtar>) olan üye açar ve doldurur. Yönetici bağlantıyı istediği üyeye kendisi gönderir.
-- Form numarasıyla (/form/?id=N) özel forma ulaşılamaz: RLS göstermez, form_yanitla anahtar ister.
alter table public.formlar add column if not exists ozel boolean not null default false;
alter table public.formlar add column if not exists anahtar text not null default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists formlar_anahtar on public.formlar (anahtar);

drop policy if exists uye_acik on public.formlar;
create policy uye_acik on public.formlar for select to authenticated using (acik and not ozel);

-- Bağlantıdaki anahtarla özel formu getirir (yalnız açıksa)
create or replace function public.ozel_form(p_anahtar text)
  returns table (id bigint, baslik text, aciklama text, sorular jsonb)
  language sql stable security definer set search_path = public
  as $$ select f.id, f.baslik, f.aciklama, f.sorular from formlar f where f.ozel and f.acik and f.anahtar = p_anahtar $$;
revoke execute on function public.ozel_form(text) from public, anon;
grant execute on function public.ozel_form(text) to authenticated;

-- Cevap: özel forma yalnız doğru anahtarla
drop function if exists public.form_yanitla(bigint, jsonb);
create or replace function public.form_yanitla(p_form bigint, p_cevaplar jsonb, p_anahtar text default null)
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
  if f.ozel and p_anahtar is distinct from f.anahtar then raise exception 'Bu form artık cevap almıyor.'; end if;
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
revoke execute on function public.form_yanitla(bigint, jsonb, text) from public, anon;
grant execute on function public.form_yanitla(bigint, jsonb, text) to authenticated;
