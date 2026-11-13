-- Forest Club Urla · etkinlik ürünlerinde stok (13.11.2026). Her ürünün envanterde bir kalemi var (kategori "Satış ürünü");
-- stok = o kalemin adedi. Ürün eklenince kalem kendiliğinden açılır, ürün adı değişince kalemin adı da değişir.
-- · Stok girişi: Yönetim › Ürünler › "Stok ekle" (urun_stok_ekle) ya da Envanter sekmesinde adet.
-- · Sipariş açılırken: kalan = stok − bekleyen siparişler (nakit / POS / dekontu gelmiş havale kararına kadar, ödenmemiş
--   kart ve dekontsuz havale 1 saat). Kalandan fazlası sipariş edilemez; liste "kalan"ı verir (0 → Tükendi).
-- · Sipariş kesinleşince (urun_onayla_) envanterden düşer ve envanter_dusumleri'ne "satis" kaydı (sipariş numarasıyla) yazılır.
--   Stok yetmezse adet 0'da kalır, yöneticilere uyarı gider.
-- · Panel envanter adedini artık fark olarak yazar (envanter_adet_degis): açık panel, arada satılan adedi ezmez.

alter table public.urunler add column if not exists envanter_id bigint references public.envanter (id) on delete set null;

alter table public.envanter_dusumleri drop constraint if exists envanter_dusumleri_neden_check;
alter table public.envanter_dusumleri add constraint envanter_dusumleri_neden_check check (neden in ('hasarli', 'kullanilamaz', 'kayip', 'satis'));
alter table public.envanter_dusumleri add column if not exists siparis_id bigint references public.urun_siparisleri (id) on delete set null;

-- Ürün eklenince envanter kalemi; ad değişince kalemin adı
create or replace function public.urun_envanter_kalemi() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.envanter_id is null then
      insert into envanter (ad, kategori, adet, birim, giris, tarih, notlar)
        values (new.ad, 'Satış ürünü', 0, 'adet', 'satin', istanbul_bugun(), 'Etkinliğe özel ürün; stok Ürünler sekmesinden.')
        returning id into new.envanter_id;
    end if;
  elsif new.ad is distinct from old.ad and new.envanter_id is not null then
    update envanter set ad = new.ad where id = new.envanter_id;
  end if;
  return new;
end $$;
revoke execute on function public.urun_envanter_kalemi() from public, anon, authenticated;
drop trigger if exists envanter_kalemi on public.urunler;
create trigger envanter_kalemi before insert or update of ad on public.urunler for each row execute function public.urun_envanter_kalemi();

-- Var olan ürünlere kalem
do $$
declare u record; yeni bigint;
begin
  for u in select id, ad from urunler where envanter_id is null loop
    insert into envanter (ad, kategori, adet, birim, giris, tarih, notlar)
      values (u.ad, 'Satış ürünü', 0, 'adet', 'satin', istanbul_bugun(), 'Etkinliğe özel ürün; stok Ürünler sekmesinden.')
      returning id into yeni;
    update urunler set envanter_id = yeni where id = u.id;
  end loop;
end $$;

-- Satılabilir kalan: stok − bekleyen siparişler (kalemsiz ürün: sınırsız → null)
create or replace function public.urun_kalan(p_urun bigint) returns numeric
  language sql stable security definer set search_path = public as $$
    select greatest(0, e.adet - coalesce((
      select sum((k ->> 'adet')::numeric)
        from urun_siparisleri s, jsonb_array_elements(s.kalemler) k
       where s.durum = 'bekliyor' and (k ->> 'urun_id')::bigint = u.id
         and (s.yuklendi or s.created_at > now() - interval '1 hour')), 0))
      from urunler u join envanter e on e.id = u.envanter_id
     where u.id = p_urun
  $$;
revoke execute on function public.urun_kalan(bigint) from public, anon, authenticated;

-- Etkinlik sayfasındaki liste: kalan da gelir (null = sınırsız)
create or replace function public.etkinlik_urun_listesi(p_etkinlik bigint) returns jsonb
  language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'fiyat', u.fiyat, 'foto', u.foto, 'kalan', urun_kalan(u.id)) order by u.fiyat, u.id), '[]'::jsonb)
      from etkinlikler e
      join etkinlik_urunleri eu on eu.etkinlik_id = e.id
      join urunler u on u.id = eu.urun_id
     where e.id = p_etkinlik and u.aktif and urun_satis_acik(e)
  $$;

-- Sipariş açar: kalan stoktan fazlası alınamaz (envanter satırı kilitlenir: aynı anda iki sipariş son ürünü alamaz)
create or replace function public.urun_siparisi_ac(p_etkinlik bigint, p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_yol text, p_dosya text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
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
  if p_yol is null or p_yol not in ('kart', 'havale', 'nakit', 'pos') then raise exception 'Ödeme yolu geçersiz.'; end if;
  if length(trim(coalesce(p_ad, ''))) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 or length(p_tel) > 40 then raise exception 'Telefon numaranı yaz.'; end if;
  if p_yol = 'havale' and coalesce(p_dosya, '') !~ '^yeni/[A-Za-z0-9._-]{8,200}$' then raise exception 'Dosya adı geçersiz.'; end if;
  select * into e from etkinlikler where id = p_etkinlik;
  if e.id is null or not urun_satis_acik(e) then raise exception 'Bu etkinlikte ürün satışı şu an kapalı.'; end if;
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
    select u0.* into u from urunler u0 join etkinlik_urunleri eu on eu.urun_id = u0.id and eu.etkinlik_id = e.id
     where u0.id = case when jsonb_typeof(k -> 'urun') = 'number' then (k ->> 'urun')::bigint end and u0.aktif;
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
    values (e.id, trim(p_ad), ep, trim(p_tel), kalemler, toplam, p_yol, case when p_yol = 'havale' then p_dosya end, p_yol in ('nakit', 'pos'))
    returning id into yeni_id;
  return jsonb_build_object('id', yeni_id, 'kod', 'U-' || yeni_id, 'tutar', toplam, 'yol', p_yol, 'etkinlik', e.ad, 'kalemler', kalemler, 'foto', ilk_foto);
end $$;
revoke execute on function public.urun_siparisi_ac(bigint, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.urun_siparisi_ac(bigint, text, text, text, jsonb, text, text) to service_role;

-- Kesinleşen siparişi envanterden düş (urun_onayla_ içinden)
create or replace function public.urun_stoktan_dus_(p_id bigint) returns void
  language plpgsql security definer set search_path = public as $$
declare
  s urun_siparisleri;
  k jsonb;
  env envanter;
  n numeric;
  eksik text := '';
begin
  select * into s from urun_siparisleri where id = p_id;
  for k in select * from jsonb_array_elements(s.kalemler) loop
    n := (k ->> 'adet')::numeric;
    select e.* into env from envanter e join urunler u on u.envanter_id = e.id where u.id = (k ->> 'urun_id')::bigint for update of e;
    continue when env.id is null;
    if env.adet < n then eksik := eksik || ' ' || (k ->> 'ad') || ' (stok ' || floor(env.adet)::int || ', satılan ' || n || ')'; end if;
    update envanter set adet = greatest(0, adet - n) where id = env.id;
    insert into envanter_dusumleri (envanter_id, neden, adet, tarih, notlar, siparis_id)
      values (env.id, 'satis', n, istanbul_bugun(), 'Satış · U-' || s.id || ' · ' || s.ad, s.id);
  end loop;
  if eksik <> '' then
    perform yoneticilere_uyari('Ürün siparişi U-' || s.id || ' stoktan fazla satıldı:' || eksik || '. Envanteri kontrol edin.', 'urun_stok:' || s.id);
  end if;
end $$;
revoke execute on function public.urun_stoktan_dus_(bigint) from public, anon, authenticated;

-- Onayın ortak kısmı: durum, stok, muhasebe (ödeme yoluna göre kasa), alıcıya e-posta
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
            left('Ürün · U-' || s.id || ' · ' || s.ad || ' · ' || replace(liste, E'\n', ', '), 500), 'urun:' || s.id, true,
            case s.odeme_yolu when 'nakit' then 'elden'::odeme_yolu when 'havale' then 'havale'::odeme_yolu else 'kart'::odeme_yolu end);
  perform eposta_ekle('urun_siparis', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id, 'etkinlik', e.ad, 'urunler', liste,
    'tutar', round(s.tutar) || ' TL'), 'urun:' || s.id, null, s.etkinlik_id);
  return jsonb_build_object('durum', 'onaylandi', 'kod', 'U-' || s.id);
end $$;
revoke execute on function public.urun_onayla_(bigint, uuid) from public, anon, authenticated;

-- Stok girişi (Yönetim › Ürünler). Dönüş: yeni stok
create or replace function public.urun_stok_ekle(p_urun bigint, p_adet numeric) returns numeric
  language plpgsql security definer set search_path = public as $$
declare env bigint; yeni numeric;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_adet is null or p_adet <= 0 or p_adet > 100000 or p_adet <> trunc(p_adet) then raise exception 'Eklenecek adedi tam sayı olarak yazın.'; end if;
  select envanter_id into env from urunler where id = p_urun;
  if not found then raise exception 'Ürün bulunamadı.'; end if;
  if env is null then  -- kalem silinmişse yenisi
    insert into envanter (ad, kategori, adet, birim, giris, tarih, notlar)
      select ad, 'Satış ürünü', 0, 'adet', 'satin', istanbul_bugun(), 'Etkinliğe özel ürün; stok Ürünler sekmesinden.' from urunler where id = p_urun
      returning id into env;
    update urunler set envanter_id = env where id = p_urun;
  end if;
  update envanter set adet = adet + p_adet where id = env returning adet into yeni;
  return yeni;
end $$;
revoke execute on function public.urun_stok_ekle(bigint, numeric) from public, anon;
grant execute on function public.urun_stok_ekle(bigint, numeric) to authenticated;

-- Panelin envanter adedi değişikliği fark olarak (açık panel arada satılanı ezmesin); 0'ın altına inmez
create or replace function public.envanter_adet_degis(p_id bigint, p_fark numeric) returns numeric
  language plpgsql security definer set search_path = public as $$
declare yeni numeric;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  update envanter set adet = greatest(0, adet + coalesce(p_fark, 0)) where id = p_id returning adet into yeni;
  if not found then raise exception 'Envanter kalemi bulunamadı.'; end if;
  return yeni;
end $$;
revoke execute on function public.envanter_adet_degis(bigint, numeric) from public, anon;
grant execute on function public.envanter_adet_degis(bigint, numeric) to authenticated;
