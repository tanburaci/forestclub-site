-- Forest Club Urla: Google Sheets sisteminin siteye taşınması (27.10.2026). Dekont yükleme ve onayı (IBAN ile ödeme,
-- iyzico gelene kadar), Açık Çağrı başvuruları, başvuru sayfası sayaçları, başvuruda fotoğraf izni.
-- Kurallar Sheets'teki (hatirlatma.js) ile aynı: yalnız başvurusu olan e-posta dekont yükler; onayda üyelik 30 gün
-- uzar (süresi dolmadıysa mevcut bitişten); Açık Çağrı 31.10.2026 23.59'da kapanır.

alter type odeme_yolu add value if not exists 'havale';

create type dekont_durum as enum ('bekliyor', 'onaylandi', 'reddedildi');

create table dekontlar (
  id bigint generated always as identity primary key,
  uye_id bigint not null references uyeler (id),
  eposta text not null,
  ad text not null,
  odeme_tarihi date not null,
  tutar numeric(10, 2) not null default 3000,
  dosya text not null,                             -- depodaki yol: dekontlar/yeni/...
  durum dekont_durum not null default 'bekliyor',
  sonuc text,                                      -- "27.10.2026 · bitiş 26.11.2026" ya da red gerekçesi
  karar_at timestamptz,
  karar_veren uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table acik_cagri (
  id bigint generated always as identity primary key,
  ad text not null,
  iletisim text not null,
  uye text not null,                               -- Evet / Hayır
  alan text not null,
  baslik text not null,
  anlatim text not null,
  deneyim text,
  sure text,
  kisi text,
  ihtiyac text,
  gunler text,
  durum text not null default 'Yeni',
  notlar text,
  created_at timestamptz not null default now()
);

create table sayaclar (
  tarih date not null,
  adim text not null check (adim in ('acildi', 'bilgiler', 'onaylar', 'dekont', 'gonderildi')),
  adet int not null default 0,
  primary key (tarih, adim)
);

do $$
declare t text;
begin
  foreach t in array array['dekontlar', 'acik_cagri', 'sayaclar'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy yonetici_tam on %I for all to authenticated using (public.yonetici_mi()) '
                   'with check (public.yonetici_mi())', t);
  end loop;
end $$;

-- Dekont dosyaları: gizli depo. Ziyaretçi yalnız "yeni/" altına yükler (üzerine yazamaz, okuyamaz); yönetici okur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('dekontlar', 'dekontlar', false, 10485760,
          array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])
  on conflict (id) do nothing;
create policy dekont_yukle on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'dekontlar' and (storage.foldername(name))[1] = 'yeni');
create policy dekont_oku on storage.objects for select to authenticated
  using (bucket_id = 'dekontlar' and public.yonetici_mi());

-- Başvuru (fotoğraf/video izniyle). Eski altı alanlı sürüm kalkar.
drop function if exists public.basvuru_yap(text, text, text, boolean, boolean, boolean);
create or replace function public.basvuru_yap(p_ad text, p_eposta text, p_tel text, p_kosul boolean, p_dogal boolean,
                                              p_kvkk boolean, p_foto boolean default false)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  ad text := trim(p_ad);
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  if not (p_kosul and p_dogal and p_kvkk) then raise exception 'Devam etmek için üç metni de onayla.'; end if;
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  insert into uyeler (kod, ad, eposta, tel, durum, basvuru_tarihi, nereden_duydu, foto_izni)
    values ('FC-U-' || lpad((coalesce((select max(id) from uyeler), 0) + 1)::text, 4, '0'), ad, ep,
            left(trim(p_tel), 30), 'basvuru', istanbul_bugun(), 'Site başvurusu', coalesce(p_foto, false));
  return 'tamam';
end $$;
revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) from public;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) to anon, authenticated;

-- Dekont kaydı: dosya önce depoya "yeni/" altına yüklenir, sonra bu işlev kaydı açar.
create or replace function public.dekont_kaydet(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  select * into u from uyeler where eposta = ep;
  if u.id is null then raise exception 'Bu e-posta ile bir başvuru bulamadık. Başvuruda yazdığın adresi yaz.'; end if;
  if p_dosya !~ '^yeni/[A-Za-z0-9._-]{8,200}$'
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = p_dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  if exists (select 1 from dekontlar where dosya = p_dosya) then return 'tamam'; end if;
  insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, dosya) values (u.id, ep, u.ad, istanbul_bugun(), p_dosya);
  return 'tamam';
end $$;
revoke execute on function public.dekont_kaydet(text, text) from public;
grant execute on function public.dekont_kaydet(text, text) to anon, authenticated;

-- Yönetici kararı: onayda üyelik 30 gün uzar, ödeme ve muhasebe (banka, aidat) yazılır. Dönüş: {bitis}
create or replace function public.dekont_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d dekontlar;
  u uyeler;
  bas date;
  yeni_bitis date;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into d from dekontlar where id = p_id for update;
  if d.id is null then raise exception 'Dekont bulunamadı.'; end if;
  if d.durum <> 'bekliyor' then raise exception 'Bu dekont için karar zaten verilmiş.'; end if;
  if not p_onay then
    update dekontlar set durum = 'reddedildi', sonuc = nullif(trim(coalesce(p_not, '')), ''), karar_at = now(),
                         karar_veren = auth.uid() where id = d.id;
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  select * into u from uyeler where id = d.uye_id for update;
  bas := greatest(coalesce(u.bitis, istanbul_bugun()), istanbul_bugun());
  yeni_bitis := bas + 30;
  update uyeler set baslangic = coalesce(baslangic, istanbul_bugun()), bitis = yeni_bitis, durum = 'aktif' where id = u.id;
  insert into odemeler (uye_id, tarih, tutar, yol, aciklama) values (u.id, istanbul_bugun(), d.tutar, 'havale', 'Dekont onayı · 30 gün');
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (istanbul_bugun(), 'gelir', d.tutar, 'banka', 'Aidat', 'Aidat · ' || u.ad, 'dekont', true, 'havale');
  update dekontlar set durum = 'onaylandi', karar_at = now(), karar_veren = auth.uid(),
                       sonuc = to_char(istanbul_bugun(), 'DD.MM.YYYY') || ' · bitiş ' || to_char(yeni_bitis, 'DD.MM.YYYY')
    where id = d.id;
  return jsonb_build_object('durum', 'onaylandi', 'bitis', yeni_bitis);
end $$;
revoke execute on function public.dekont_karar(bigint, boolean, text) from public, anon;
grant execute on function public.dekont_karar(bigint, boolean, text) to authenticated;

-- Açık Çağrı başvurusu (p: ad, iletisim, uye, alan, baslik, anlat, deneyim, sure, kisi, ihtiyac, gunler, uyeOl,
-- uyeEposta, uyeTelefon, uyeFoto). Üye olmak istediyse ayrıca üyelik başvurusu açılır.
create or replace function public.cagri_gonder(p jsonb)
  returns text language plpgsql security definer set search_path = public as $$
declare
  k text[] := array['ad', 'iletisim', 'uye', 'alan', 'baslik', 'anlat', 'deneyim', 'sure', 'kisi', 'ihtiyac', 'gunler'];
  n int[] := array[100, 120, 10, 300, 150, 3000, 40, 40, 40, 1000, 200];
  v jsonb := '{}';
  i int;
  uyelik text := null;
begin
  if now() > timestamptz '2026-10-31 23:59:59 Europe/Istanbul' then
    raise exception 'Açık çağrı başvuruları kapandı. İlgin için teşekkürler!';
  end if;
  for i in 1 .. array_length(k, 1) loop
    v := v || jsonb_build_object(k[i], left(trim(coalesce(p ->> k[i], '')), n[i]));
  end loop;
  if length(v ->> 'ad') < 3 or length(v ->> 'iletisim') < 6 or v ->> 'uye' = '' or v ->> 'alan' = ''
     or length(v ->> 'baslik') < 2 or length(v ->> 'anlat') < 10 then
    raise exception 'Zorunlu alanlardan biri eksik görünüyor; lütfen kontrol et.';
  end if;
  if coalesce((p ->> 'uyeOl')::boolean, false) then
    if basvuru_yap(v ->> 'ad', p ->> 'uyeEposta', p ->> 'uyeTelefon', true, true, true,
                   coalesce((p ->> 'uyeFoto')::boolean, false)) is not null then
      uyelik := 'Üyelik başvurusu da yapıldı (' || lower(trim(p ->> 'uyeEposta')) || ')';
    end if;
  end if;
  insert into acik_cagri (ad, iletisim, uye, alan, baslik, anlatim, deneyim, sure, kisi, ihtiyac, gunler, notlar)
    values (v ->> 'ad', v ->> 'iletisim', v ->> 'uye', v ->> 'alan', v ->> 'baslik', v ->> 'anlat',
            nullif(v ->> 'deneyim', ''), nullif(v ->> 'sure', ''), nullif(v ->> 'kisi', ''), nullif(v ->> 'ihtiyac', ''),
            nullif(v ->> 'gunler', ''), uyelik);
  return 'tamam';
end $$;
revoke execute on function public.cagri_gonder(jsonb) from public;
grant execute on function public.cagri_gonder(jsonb) to anon, authenticated;

-- Başvuru sayfası adım sayacı (kişisel veri yok, yalnız günlük toplam)
create or replace function public.sayac_artir(p_adim text)
  returns void language sql security definer set search_path = public as $$
    insert into sayaclar (tarih, adim, adet) values (istanbul_bugun(), p_adim, 1)
      on conflict (tarih, adim) do update set adet = sayaclar.adet + 1
  $$;
revoke execute on function public.sayac_artir(text) from public;
grant execute on function public.sayac_artir(text) to anon, authenticated;
