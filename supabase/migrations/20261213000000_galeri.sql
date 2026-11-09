-- Forest Club Urla · fotoğraf galerisi altyapısı (09.11.2026). Yükleme henüz bağlı değil (depolama kararı: Cloudflare R2
-- ya da Supabase Storage); bu tablo fotoğrafların kaydını tutar: hangi etkinliğe ait, adres, küçük önizleme, sıra.
-- Herkes yalnız yayındaki fotoğrafları görür; ekleme / düzenleme / silme yalnız yönetici (iki adımlı girişle).
create table if not exists public.galeri_fotolari (
  id bigint generated always as identity primary key,
  etkinlik_id bigint references public.etkinlikler (id) on delete set null,
  adres text not null check (adres ~ '^https://'),
  onizleme text check (onizleme is null or onizleme ~ '^https://'),
  aciklama text check (aciklama is null or length(aciklama) <= 300),
  sira int not null default 0,
  yayinda boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists galeri_fotolari_etkinlik on public.galeri_fotolari (etkinlik_id, sira);
alter table public.galeri_fotolari enable row level security;
drop policy if exists galeri_herkes on public.galeri_fotolari;
create policy galeri_herkes on public.galeri_fotolari for select to anon, authenticated using (yayinda or yonetici_mi());
drop policy if exists galeri_yonetici on public.galeri_fotolari;
create policy galeri_yonetici on public.galeri_fotolari for all to authenticated using (yonetici_mi()) with check (yonetici_mi());
