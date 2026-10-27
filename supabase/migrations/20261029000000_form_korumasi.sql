-- Forest Club Urla: anonim formlar için spam koruması (29.10.2026).
-- Başvuru, tanışma bileti, Açık Çağrı ve dekont artık tarayıcıdan doğrudan değil, "form-gonder" Edge Function
-- üzerinden gelir: işlev Cloudflare Turnstile jetonunu doğrular, IP başına saatlik sınırı uygular ve SQL işlevlerini
-- service_role ile çağırır. Dekont dosyası tek kullanımlık imzalı adresle yüklenir; ziyaretçi depoya doğrudan yazamaz.

-- IP başına saatlik sayaç (IP açık saklanmaz: Edge Function tuzlu özetini yazar). Satırlar iki gün sonra silinir.
create table if not exists public.istek_sayaci (
  anahtar text not null,                           -- IP özeti
  tur text not null,                               -- basvuru | tanisma | cagri | dekont_adres | dekont_kaydet | hepsi
  saat timestamptz not null,                       -- saatin başı
  adet int not null default 0,
  primary key (anahtar, tur, saat)
);
alter table public.istek_sayaci enable row level security;  -- politika yok: yalnız service_role

-- Sayacı bir artırır; sınır aşılmadıysa true
create or replace function public.istek_sinir(p_anahtar text, p_tur text, p_sinir int)
  returns boolean language sql security definer set search_path = public as $$
    insert into istek_sayaci (anahtar, tur, saat, adet) values (p_anahtar, p_tur, date_trunc('hour', now()), 1)
      on conflict (anahtar, tur, saat) do update set adet = istek_sayaci.adet + 1
      returning adet <= p_sinir
  $$;
revoke execute on function public.istek_sinir(text, text, int) from public, anon, authenticated;
grant execute on function public.istek_sinir(text, text, int) to service_role;

-- Dekont yükleme hakları: form-gonder imzalı yükleme adresi verirken yolu buraya yazar; dekont_kaydet yalnız
-- bu e-postaya verilmiş bir yolu kabul eder.
create table if not exists public.dekont_yuklemeleri (
  dosya text primary key,                          -- yeni/1730000000000-abc123.pdf
  eposta text not null,
  created_at timestamptz not null default now()
);
alter table public.dekont_yuklemeleri enable row level security;
create index if not exists dekont_yuklemeleri_eposta on public.dekont_yuklemeleri (eposta, created_at);

-- Yükleme hakkı açar (kurallar dekont_kaydet ile aynı: başvurusu olan e-posta, en çok iki bekleyen dekont;
-- ayrıca bir saatte en çok beş kullanılmamış yükleme hakkı)
create or replace function public.dekont_yukleme_ac(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  select * into u from uyeler where eposta = ep for update;
  if u.id is null then raise exception 'Bu e-posta ile bir başvuru bulamadık. Başvuruda yazdığın adresi yaz.'; end if;
  if p_dosya !~ '^yeni/[A-Za-z0-9._-]{8,200}$' then raise exception 'Dosya adı geçersiz.'; end if;
  if (select count(*) from dekontlar where uye_id = u.id and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için incelemede bekleyen iki dekont var. Biri sonuçlanınca yenisini gönderebilirsin.';
  end if;
  if (select count(*) from dekont_yuklemeleri y where y.eposta = ep and y.created_at > now() - interval '1 hour'
        and not exists (select 1 from dekontlar d where d.dosya = y.dosya)) >= 5 then
    raise exception 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.';
  end if;
  insert into dekont_yuklemeleri (dosya, eposta) values (p_dosya, ep);
  return 'tamam';
end $$;
revoke execute on function public.dekont_yukleme_ac(text, text) from public, anon, authenticated;
grant execute on function public.dekont_yukleme_ac(text, text) to service_role;

-- Dekont kaydı: dosya bu e-postaya son 24 saatte verilmiş bir yükleme hakkıyla yüklenmiş olmalı
create or replace function public.dekont_kaydet(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  select * into u from uyeler where eposta = ep for update;  -- aynı e-postayla aynı anda gelen iki kayıt sınırı aşmasın
  if u.id is null then raise exception 'Bu e-posta ile bir başvuru bulamadık. Başvuruda yazdığın adresi yaz.'; end if;
  if not exists (select 1 from dekont_yuklemeleri where dosya = p_dosya and eposta = ep and created_at > now() - interval '24 hours')
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = p_dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  if exists (select 1 from dekontlar where dosya = p_dosya) then return 'tamam'; end if;
  if (select count(*) from dekontlar where uye_id = u.id and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için incelemede bekleyen iki dekont var. Biri sonuçlanınca yenisini gönderebilirsin.';
  end if;
  insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, dosya) values (u.id, ep, u.ad, istanbul_bugun(), p_dosya);
  return 'tamam';
end $$;

-- 24 saatten eski, hiçbir dekont kaydına bağlanmamış dosyalar (dekont-temizle işlevi bunları Storage API ile siler;
-- storage.objects satırını SQL'le silmek dosyayı depodan kaldırmaz)
create or replace function public.dekont_artiklari(p_adet int default 500)
  returns setof text language sql stable security definer set search_path = public, storage as $$
    select o.name from storage.objects o
    where o.bucket_id = 'dekontlar' and o.name like 'yeni/%' and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.dekontlar d where d.dosya = o.name)
    order by o.created_at
    limit p_adet
  $$;
revoke execute on function public.dekont_artiklari(int) from public, anon, authenticated;
grant execute on function public.dekont_artiklari(int) to service_role;

-- Ziyaretçi depoya artık doğrudan yükleyemez (imzalı adres service_role ile verilir)
drop policy if exists dekont_yukle on storage.objects;

-- Anonim formların SQL işlevleri yalnız form-gonder (service_role) içindir
revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) from public, anon, authenticated;
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from public, anon, authenticated;
revoke execute on function public.cagri_gonder(jsonb) from public, anon, authenticated;
revoke execute on function public.dekont_kaydet(text, text) from public, anon, authenticated;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) to service_role;
grant execute on function public.tanisma_bileti_al(text, text, bigint) to service_role;
grant execute on function public.cagri_gonder(jsonb) to service_role;
grant execute on function public.dekont_kaydet(text, text) to service_role;
