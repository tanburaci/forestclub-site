-- Forest Club Urla: etkinlik afişi (16.11.2026). Yönetici Etkinlikler'de afiş / flyer yükler (herkese açık "afisler"
-- deposu); sitede ve üye panelinde etkinlik kartı açılınca afiş ve ayrıntılı açıklama görünür.
alter table public.etkinlikler add column if not exists afis text check (afis is null or afis ~ '^https://');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('afisler', 'afisler', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists afis_yukle on storage.objects;
create policy afis_yukle on storage.objects for insert to authenticated with check (bucket_id = 'afisler' and public.yonetici_mi());
drop policy if exists afis_guncelle on storage.objects;
create policy afis_guncelle on storage.objects for update to authenticated using (bucket_id = 'afisler' and public.yonetici_mi());
drop policy if exists afis_sil on storage.objects;
create policy afis_sil on storage.objects for delete to authenticated using (bucket_id = 'afisler' and public.yonetici_mi());
