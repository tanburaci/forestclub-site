-- Forest Club Urla · Seçki (15.11.2026): ürünler etkinlikten bağımsız da satılabilir (/secki, şimdilik gizli test
-- sürümü: hiçbir menüde bağlantısı yok, arama motorlarına kapalı).
-- · Ürüne "Seçki'de satışta" (urunler.secki) ve kısa açıklama (urunler.aciklama).
-- · Seçki siparişinin etkinliği yoktur (urun_siparisleri.etkinlik_id boş); teslim bir sonraki buluşmada, Pinya'da elden,
--   sipariş koduyla. Ödeme yalnız kart (Shopier) ya da havale (online nakit yok).
-- · Stok, envanter düşümü, muhasebe ("Ürün satışı"), U-<no> kodu, iptal / KVKK işlemleri etkinlik ürünleriyle ortak.

alter table public.urunler add column if not exists secki boolean not null default false;
alter table public.urunler add column if not exists aciklama text check (aciklama is null or length(aciklama) <= 400);
alter table public.urun_siparisleri alter column etkinlik_id drop not null;
-- Seçki siparişi (etkinliksiz) nakit olamaz
alter table public.urun_siparisleri drop constraint if exists urun_siparisi_secki_yolu;
alter table public.urun_siparisleri add constraint urun_siparisi_secki_yolu
  check (etkinlik_id is not null or odeme_yolu in ('kart', 'havale'));

-- /secki listesi: Seçki'de satışta olan aktif ürünler, kalan stokla (null = sınırsız)
create or replace function public.secki_listesi() returns jsonb
  language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'aciklama', u.aciklama, 'fiyat', u.fiyat, 'foto', u.foto,
                                                 'kalan', urun_kalan(u.id)) order by u.fiyat, u.id), '[]'::jsonb)
      from urunler u
     where u.aktif and u.secki
  $$;
revoke execute on function public.secki_listesi() from public;
grant execute on function public.secki_listesi() to anon, authenticated;

-- Sipariş açar. p_etkinlik dolu: etkinlik ürünü (yalnız satış penceresinde, eskisi gibi). p_etkinlik boş: Seçki
-- (her zaman açık; ürün Seçki'de satışta olmalı; kart ya da havale).
create or replace function public.urun_siparisi_ac(p_etkinlik bigint, p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_yol text, p_dosya text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  secki boolean := p_etkinlik is null;
  e etkinlikler;
  u urunler;
  k jsonb;
  adet int;
  kalan numeric;
  kalemler jsonb := '[]';
  toplam numeric := 0;
  gorulen bigint[] := '{}';
  ilk_foto text;
  yeni_id bigint;
begin
  if p_yol is null or p_yol not in ('kart', 'havale', 'nakit') or (secki and p_yol = 'nakit') then raise exception 'Ödeme yolu geçersiz.'; end if;
  if length(trim(coalesce(p_ad, ''))) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 or length(p_tel) > 40 then raise exception 'Telefon numaranı yaz.'; end if;
  if p_yol = 'havale' and coalesce(p_dosya, '') !~ '^yeni/[A-Za-z0-9._-]{8,200}$' then raise exception 'Dosya adı geçersiz.'; end if;
  if not secki then
    select * into e from etkinlikler where id = p_etkinlik;
    if e.id is null or not urun_satis_acik(e) then raise exception 'Bu etkinlikte ürün satışı şu an kapalı.'; end if;
  end if;
  if jsonb_typeof(p_kalemler) is distinct from 'array' or jsonb_array_length(p_kalemler) not between 1 and 10 then raise exception 'Ürün seç.'; end if;
  if (select count(*) from urun_siparisleri where eposta = ep and not yuklendi and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.';
  end if;
  if (select count(*) from urun_siparisleri where eposta = ep and yuklendi and durum = 'bekliyor') >= 3 then
    raise exception 'Bu e-posta için bekleyen üç sipariş var. Biri sonuçlanınca yenisini verebilirsin.';
  end if;
  for k in select * from jsonb_array_elements(p_kalemler) loop
    adet := case when jsonb_typeof(k -> 'adet') = 'number' then (k ->> 'adet')::int else 0 end;
    if adet not between 1 and 20 then raise exception 'Bir üründen en çok 20 adet alınabilir.'; end if;
    if secki then
      select u0.* into u from urunler u0
       where u0.id = case when jsonb_typeof(k -> 'urun') = 'number' then (k ->> 'urun')::bigint end and u0.aktif and u0.secki;
    else
      select u0.* into u from urunler u0 join etkinlik_urunleri eu on eu.urun_id = u0.id and eu.etkinlik_id = e.id
       where u0.id = case when jsonb_typeof(k -> 'urun') = 'number' then (k ->> 'urun')::bigint end and u0.aktif;
    end if;
    if u.id is null or u.id = any (gorulen) then raise exception 'Seçtiğin ürünlerden biri şu an satılmıyor; sayfayı yenile.'; end if;
    if u.envanter_id is not null then
      perform 1 from envanter where id = u.envanter_id for update;
      kalan := urun_kalan(u.id);
      if kalan is not null and adet > kalan then
        raise exception '%', case when kalan = 0 then u.ad || ' tükendi.' else u.ad || ' için en çok ' || floor(kalan)::int || ' adet kaldı.' end;
      end if;
    end if;
    gorulen := gorulen || u.id;
    ilk_foto := coalesce(ilk_foto, u.foto);
    kalemler := kalemler || jsonb_build_object('urun_id', u.id, 'ad', u.ad, 'adet', adet, 'birim', u.fiyat, 'tutar', adet * u.fiyat);
    toplam := toplam + adet * u.fiyat;
  end loop;
  insert into urun_siparisleri (etkinlik_id, ad, eposta, tel, kalemler, tutar, odeme_yolu, dosya, yuklendi)
    values (e.id, trim(p_ad), ep, trim(p_tel), kalemler, toplam, p_yol, case when p_yol = 'havale' then p_dosya end, p_yol = 'nakit')
    returning id into yeni_id;
  return jsonb_build_object('id', yeni_id, 'kod', 'U-' || yeni_id, 'tutar', toplam, 'yol', p_yol,
                            'etkinlik', coalesce(e.ad, 'Seçki'), 'secki', secki, 'kalemler', kalemler, 'foto', ilk_foto);
end $$;
revoke execute on function public.urun_siparisi_ac(bigint, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.urun_siparisi_ac(bigint, text, text, text, jsonb, text, text) to service_role;

-- Onay: Seçki siparişine kendi e-postası (teslim bir sonraki buluşmada); muhasebe açıklaması "Seçki · U-…"
create or replace function public.urun_onayla_(p_id bigint, p_veren uuid)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s urun_siparisleri;
  e etkinlikler;
  liste text;
begin
  select * into s from urun_siparisleri where id = p_id for update;
  select * into e from etkinlikler where id = s.etkinlik_id;
  select string_agg((k ->> 'adet') || ' × ' || (k ->> 'ad') || ' · ' || round((k ->> 'tutar')::numeric) || ' TL', E'\n') into liste
    from jsonb_array_elements(s.kalemler) k;
  update urun_siparisleri set durum = 'onaylandi', odendi_at = coalesce(odendi_at, now()), karar_at = now(), karar_veren = p_veren where id = s.id;
  perform urun_stoktan_dus_(s.id);
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, etkinlik_id, aciklama, belge, otomatik, odeme)
    values (istanbul_bugun(), 'gelir', s.tutar, case when s.odeme_yolu = 'nakit' then 'nakit'::kasa else 'banka'::kasa end, 'Ürün satışı', s.etkinlik_id,
            left(case when s.etkinlik_id is null then 'Seçki' else 'Ürün' end || ' · U-' || s.id || ' · ' || s.ad || ' · ' || replace(liste, E'\n', ', '), 500),
            'urun:' || s.id, true,
            case s.odeme_yolu when 'nakit' then 'elden'::odeme_yolu when 'havale' then 'havale'::odeme_yolu else 'kart'::odeme_yolu end);
  if s.etkinlik_id is null then
    perform eposta_ekle('secki_siparis', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id, 'urunler', liste,
      'tutar', round(s.tutar) || ' TL'), 'urun:' || s.id, null, null);
  else
    perform eposta_ekle('urun_siparis', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id, 'etkinlik', e.ad, 'urunler', liste,
      'tutar', round(s.tutar) || ' TL'), 'urun:' || s.id, null, s.etkinlik_id);
  end if;
  return jsonb_build_object('durum', 'onaylandi', 'kod', 'U-' || s.id);
end $$;
revoke execute on function public.urun_onayla_(bigint, uuid) from public, anon, authenticated;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('secki_siparis', 'Seçki siparişi onaylandı',
  'Seçki''den verilen ürün siparişi ödenince (kart) ya da yönetici havaleyi onaylayınca alıcıya gider.', true, null,
  'Siparişin hazır: {kod}', 'Merhaba {ad},

Seçki''den verdiğin siparişin ödemesi alındı. Teşekkürler!

Sipariş kodu: {kod}
{urunler}
Toplam: {tutar}

Ürününü bir sonraki buluşmada, Pinya''da elden teslim ediyoruz. Geldiğinde bu kodu ekibimize göstermen yeterli.

Forest Club Urla', array['ad', 'kod', 'urunler', 'tutar']::text[]) on conflict (id) do nothing;
