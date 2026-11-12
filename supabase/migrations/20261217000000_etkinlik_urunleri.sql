-- Forest Club Urla · etkinliğe özel ürünler (13.11.2026). Yönetici Yönetim › Ürünler'de ürün ekler (ad, fiyat, foto,
-- aktif) ve etkinliği düzenlerken o etkinlikte satılacak ürünleri seçer. Ürünler yalnız etkinliğin kendi sayfasında
-- (/e/<id>) ve yalnız başlangıçtan 1 saat önce ile 5 saat sonrası arasında görünür; sipariş de yalnız bu arada alınır
-- (sunucuda, etkinlik_baslangic ile). Ziyaretçi girişsiz sipariş verir (form-gonder "urun_siparis"); toplam sunucuda.
-- Ödeme yolları:
--   kart   → Shopier ödeme sayfası (ayrı pencere); shopier-bildirim → urun_kart_odendi: sipariş kesinleşir
--   havale → IBAN + dekont (form-gonder "urun_kaydet"); yönetici onaylar
--   nakit / pos → standda ödenir: sipariş açılır, alıcı ekrandaki kısa kodu (U-<no>) gösterir, yönetici "Ödendi" der
-- Kesinleşince muhasebeye "Ürün satışı" geliri (etkinliğe bağlı) ve alıcıya "urun_siparis" e-postası. Stok tutulmaz.

create table if not exists public.urunler (
  id bigint generated always as identity primary key,
  ad text not null check (length(trim(ad)) between 1 and 80),
  fiyat numeric(10, 2) not null check (fiyat > 0),
  foto text check (foto is null or foto ~ '^https://'),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.etkinlik_urunleri (
  etkinlik_id bigint not null references public.etkinlikler (id) on delete cascade,
  urun_id bigint not null references public.urunler (id) on delete cascade,
  primary key (etkinlik_id, urun_id)
);

create table if not exists public.urun_siparisleri (
  id bigint generated always as identity primary key,
  etkinlik_id bigint not null references public.etkinlikler (id),
  ad text not null,
  eposta text not null,
  tel text not null,
  kalemler jsonb not null,                         -- [{urun_id, ad, adet, birim, tutar}] (ad ve fiyat sipariş anındaki)
  tutar numeric(10, 2) not null check (tutar > 0),
  odeme_yolu text not null check (odeme_yolu in ('kart', 'havale', 'nakit', 'pos')),
  dosya text unique,                               -- havale dekontu: depoda yeni/…
  yuklendi boolean not null default false,         -- yöneticiye görünür: nakit/pos hemen, havale dekontla, kart ödemeyle
  durum dekont_durum not null default 'bekliyor',
  shopier_urun text unique,
  shopier_siparis text unique,
  sonuc text,
  karar_at timestamptz,
  karar_veren uuid references auth.users (id),
  odendi_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists urun_siparisleri_etkinlik on public.urun_siparisleri (etkinlik_id, created_at);
create index if not exists urun_siparisleri_eposta on public.urun_siparisleri (eposta, created_at);

alter table public.urunler enable row level security;
alter table public.etkinlik_urunleri enable row level security;
alter table public.urun_siparisleri enable row level security;
drop policy if exists yonetici_tam on public.urunler;
create policy yonetici_tam on public.urunler for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists yonetici_tam on public.etkinlik_urunleri;
create policy yonetici_tam on public.etkinlik_urunleri for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
-- Siparişler yalnız sunucu işlevleriyle değişir; yönetici okur
drop policy if exists yonetici_okur on public.urun_siparisleri;
create policy yonetici_okur on public.urun_siparisleri for select to authenticated using (public.yonetici_mi());
drop trigger if exists denetim on public.urun_siparisleri;
create trigger denetim after insert or update or delete on public.urun_siparisleri for each row execute function public.denetle();
drop trigger if exists denetim on public.urunler;
create trigger denetim after insert or update or delete on public.urunler for each row execute function public.denetle();

-- Satış penceresi: başlangıçtan 1 saat önce – 5 saat sonra, etkinlik yayında
create or replace function public.urun_satis_acik(e etkinlikler) returns boolean
  language sql stable set search_path = public as $$
    select coalesce(e.durum = 'yayinda', false)
       and now() between etkinlik_baslangic(e) - interval '1 hour' and etkinlik_baslangic(e) + interval '5 hours'
  $$;
revoke execute on function public.urun_satis_acik(etkinlikler) from public, anon, authenticated;

-- Etkinlik sayfasındaki liste (ziyaretçi): pencere dışında boş
create or replace function public.etkinlik_urun_listesi(p_etkinlik bigint) returns jsonb
  language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'fiyat', u.fiyat, 'foto', u.foto) order by u.fiyat, u.id), '[]'::jsonb)
      from etkinlikler e
      join etkinlik_urunleri eu on eu.etkinlik_id = e.id
      join urunler u on u.id = eu.urun_id
     where e.id = p_etkinlik and u.aktif and urun_satis_acik(e)
  $$;
revoke execute on function public.etkinlik_urun_listesi(bigint) from public;
grant execute on function public.etkinlik_urun_listesi(bigint) to anon, authenticated;

-- Sipariş açar (form-gonder, service_role). p_kalemler: [{urun, adet}]; p_dosya yalnız havalede.
-- Dönüş: {id, kod, tutar, yol, etkinlik, kalemler, foto}
create or replace function public.urun_siparisi_ac(p_etkinlik bigint, p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_yol text, p_dosya text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  e etkinlikler;
  u urunler;
  k jsonb;
  adet int;
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

-- Shopier ödeme ürünü (form-gonder, service_role): bildirim gelince ürün numarasından sipariş bulunur
create or replace function public.urun_shopier_urun(p_id bigint, p_urun text)
  returns void language sql security definer set search_path = public as $$
  update urun_siparisleri set shopier_urun = left(trim(p_urun), 100) where id = p_id and odeme_yolu = 'kart' and shopier_urun is null;
$$;
revoke execute on function public.urun_shopier_urun(bigint, text) from public, anon, authenticated;
grant execute on function public.urun_shopier_urun(bigint, text) to service_role;

-- Havale dekontu yüklendi (form-gonder, service_role): 24 saat içinde açılmış sipariş, dosya depoda olmalı
create or replace function public.urun_kaydet(p_id bigint, p_eposta text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare s urun_siparisleri;
begin
  select * into s from urun_siparisleri where id = p_id and eposta = lower(trim(coalesce(p_eposta, ''))) and odeme_yolu = 'havale' for update;
  if s.id is null or s.created_at < now() - interval '24 hours'
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = s.dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  update urun_siparisleri set yuklendi = true where id = s.id and not yuklendi;
  return 'tamam';
end $$;
revoke execute on function public.urun_kaydet(bigint, text) from public, anon, authenticated;
grant execute on function public.urun_kaydet(bigint, text) to service_role;

-- Onayın ortak kısmı: durum, muhasebe (ödeme yoluna göre kasa), alıcıya e-posta
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
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, etkinlik_id, aciklama, belge, otomatik, odeme)
    values (istanbul_bugun(), 'gelir', s.tutar, case when s.odeme_yolu = 'nakit' then 'nakit'::kasa else 'banka'::kasa end, 'Ürün satışı', s.etkinlik_id,
            left('Ürün · U-' || s.id || ' · ' || s.ad || ' · ' || replace(liste, E'\n', ', '), 500), 'urun:' || s.id, true,
            case s.odeme_yolu when 'nakit' then 'elden'::odeme_yolu when 'havale' then 'havale'::odeme_yolu else 'kart'::odeme_yolu end);
  perform eposta_ekle('urun_siparis', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id, 'etkinlik', e.ad, 'urunler', liste,
    'tutar', round(s.tutar) || ' TL'), 'urun:' || s.id, null, s.etkinlik_id);
  return jsonb_build_object('durum', 'onaylandi', 'kod', 'U-' || s.id);
end $$;
revoke execute on function public.urun_onayla_(bigint, uuid) from public, anon, authenticated;

-- Yönetici kararı (havale, nakit, POS): onay ortak işlevle; red gerekçeli "urun_red" maili
create or replace function public.urun_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare s urun_siparisleri;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into s from urun_siparisleri where id = p_id for update;
  if s.id is null or not s.yuklendi then raise exception 'Sipariş bulunamadı.'; end if;
  if s.durum <> 'bekliyor' then raise exception 'Bu sipariş zaten sonuçlandı.'; end if;
  if s.odeme_yolu = 'kart' then raise exception 'Kartla ödenen siparişler kendiliğinden kesinleşir.'; end if;
  if not p_onay then
    update urun_siparisleri set durum = 'reddedildi', sonuc = nullif(left(trim(coalesce(p_not, '')), 300), ''), karar_at = now(), karar_veren = auth.uid()
      where id = s.id;
    perform eposta_ekle('urun_red', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id,
      'neden', coalesce(nullif(trim(p_not), ''), case when s.odeme_yolu = 'havale' then 'Dekont ödemeyle eşleşmedi.' else 'Sipariş iptal edildi.' end)),
      'urun_red:' || s.id, null, s.etkinlik_id);
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  return urun_onayla_(s.id, auth.uid());
end $$;
revoke execute on function public.urun_karar(bigint, boolean, text) from public, anon;
grant execute on function public.urun_karar(bigint, boolean, text) to authenticated;

-- Shopier ödemesi doğrulandı (shopier-bildirim, service_role). Tutar tutmazsa sipariş kesinleşmez: alıcıya ve
-- yöneticilere haber, iade elle (Shopier paneli). Aynı bildirim iki kez gelirse ikinci kez işlemez.
create or replace function public.urun_kart_odendi(p_id bigint, p_siparis text, p_tutar numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s urun_siparisleri;
  sorun text;
begin
  select * into s from urun_siparisleri where id = p_id for update;
  if s.id is null or s.odeme_yolu <> 'kart' then raise exception 'Kart ödemeli sipariş bulunamadı.'; end if;
  if s.durum = 'onaylandi' or (s.durum = 'reddedildi' and s.shopier_siparis is not null) then
    return jsonb_build_object('durum', s.durum, 'zaten', true);
  end if;
  if length(trim(coalesce(p_siparis, ''))) < 3 then raise exception 'Sipariş numarası eksik.'; end if;
  if s.durum <> 'bekliyor' then
    sorun := 'sipariş daha önce sonuçlanmıştı';
  elsif p_tutar is null then
    sorun := 'ödenen tutar okunamadı';
  elsif round(p_tutar, 2) <> round(s.tutar, 2) then
    sorun := 'ödenen tutar (' || round(p_tutar, 2) || ' TL) siparişle (' || round(s.tutar, 2) || ' TL) eşleşmiyor';
  end if;
  update urun_siparisleri set yuklendi = true, shopier_siparis = trim(p_siparis), odendi_at = now() where id = s.id;
  if sorun is null then return urun_onayla_(s.id, null); end if;
  update urun_siparisleri set durum = 'reddedildi', karar_at = now(),
    sonuc = left('Kart ödemesi alındı, sipariş kesinleşmedi: ' || sorun || '. Shopier''den iade edilmeli (sipariş ' || trim(p_siparis) || ').', 300)
    where id = s.id;
  perform eposta_ekle('urun_red', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id,
    'neden', 'Kartla ödemen bize ulaştı ama siparişini kesinleştiremedik: ' || sorun || '. Ücretin aynı karta iade edilecek.'),
    'urun_red:' || s.id, null, s.etkinlik_id);
  perform yoneticilere_uyari('Kartla ödenen ürün siparişi U-' || s.id || ' (' || s.ad || ', ' || s.tutar || ' TL) kesinleşemedi: ' || sorun
    || '. Shopier panelinden ' || trim(p_siparis) || ' numaralı siparişi iade edin.', 'urun_iade:' || s.id);
  return jsonb_build_object('durum', 'iade', 'neden', sorun);
end $$;
revoke execute on function public.urun_kart_odendi(bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.urun_kart_odendi(bigint, text, numeric) to service_role;

-- Kartla ödeme Shopier penceresindeyken sayfa sorar (sipariş no + e-posta birlikte; yalnız durum döner)
create or replace function public.urun_siparis_durum(p_id bigint, p_eposta text)
  returns text language sql stable security definer set search_path = public as $$
  select case when durum = 'onaylandi' then 'onaylandi' when durum = 'reddedildi' then 'reddedildi' else 'bekliyor' end
    from urun_siparisleri where id = p_id and eposta = lower(trim(coalesce(p_eposta, '')));
$$;
revoke execute on function public.urun_siparis_durum(bigint, text) from public;
grant execute on function public.urun_siparis_durum(bigint, text) to anon, authenticated;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('urun_siparis', 'Ürün siparişi onaylandı',
  'Etkinliğe özel ürün siparişi ödenince (kart) ya da yönetici onaylayınca (havale, nakit, POS) alıcıya gider.', true, null,
  'Siparişin hazır: {kod}', 'Merhaba {ad},

{etkinlik} için verdiğin ürün siparişinin ödemesi alındı. Teşekkürler!

Sipariş kodu: {kod}
{urunler}
Toplam: {tutar}

Ürünlerini teslim alırken bu kodu standdaki ekibimize göstermen yeterli.

Forest Club Urla', array['ad', 'kod', 'etkinlik', 'urunler', 'tutar']::text[]) on conflict (id) do nothing;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('urun_red', 'Ürün siparişi reddedildi',
  'Yönetici bir ürün siparişini reddedince ya da kart ödemesi siparişle eşleşmeyince alıcıya gider.', true, null,
  'Siparişin hakkında: {kod}', 'Merhaba {ad},

{kod} numaralı ürün siparişini kesinleştiremedik: {neden}

Bir yanlışlık olduğunu düşünüyorsan bu e-postayı yanıtlayabilirsin.

Forest Club Urla', array['ad', 'kod', 'neden']::text[]) on conflict (id) do nothing;

-- Dekont artıkları: ürün siparişine bağlı (yüklendi) dekontlar da silinmez
create or replace function public.dekont_artiklari(p_adet int default 500)
  returns setof text language sql stable security definer set search_path = public, storage as $$
    select o.name from storage.objects o
    where o.bucket_id = 'dekontlar' and o.name like 'yeni/%' and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.dekontlar d where d.dosya = o.name)
      and not exists (select 1 from public.bilet_istekleri b where b.dosya = o.name and b.yuklendi)
      and not exists (select 1 from public.urun_siparisleri u where u.dosya = o.name and u.yuklendi)
    order by o.created_at
    limit p_adet
  $$;
revoke execute on function public.dekont_artiklari(int) from public, anon, authenticated;
grant execute on function public.dekont_artiklari(int) to service_role;
