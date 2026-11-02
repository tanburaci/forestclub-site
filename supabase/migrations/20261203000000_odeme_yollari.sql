-- Forest Club Urla: bilet ödeme yolları (02.11.2026). Sepette kişi ödeme yolunu seçer:
--   kart   → Shopier'in güvenli ödeme sayfası; Shopier'den imzalı bildirim gelince (shopier-bildirim) biletler
--            kendiliğinden kesinleşir (yönetici onayı gerekmez), muhasebeye banka / kart geliri yazılır
--   havale → IBAN'a havale + dekont (eskisi gibi; yönetici onaylar)
--   nakit  → yer ayrılır, ödeme girişte nakit; yönetici parayı alınca onaylar (muhasebe: nakit kasa / elden)
-- Ayrıca Shopier üyelik ödemeleri için istek tablosu (odeme_istekleri) yol bilgisini tutar.
alter table public.bilet_istekleri
  add column if not exists odeme_yolu text not null default 'havale' check (odeme_yolu in ('havale', 'kart', 'nakit')),
  add column if not exists shopier_siparis text,
  add column if not exists shopier_urun text,                 -- Shopier'de bu istek için açılan tek kullanımlık ödeme ürünü
  add column if not exists odendi_at timestamptz;
create unique index if not exists bilet_istekleri_shopier on public.bilet_istekleri (shopier_siparis) where shopier_siparis is not null;
create unique index if not exists bilet_istekleri_shopier_urun on public.bilet_istekleri (shopier_urun) where shopier_urun is not null;

-- Shopier ödeme ürünü kaydı (form-gonder, service_role): bildirim gelince ürün numarasından istek bulunur
create or replace function public.bilet_shopier_urun(p_id bigint, p_urun text)
  returns void language sql security definer set search_path = public as $$
  update bilet_istekleri set shopier_urun = left(trim(p_urun), 100) where id = p_id and odeme_yolu = 'kart' and shopier_urun is null;
$$;
revoke execute on function public.bilet_shopier_urun(bigint, text) from public, anon, authenticated;
grant execute on function public.bilet_shopier_urun(bigint, text) to service_role;

-- Yol seçimli bilet isteği (form-gonder, service_role): tutar ve yerler bilet_istegi_ac'taki kurallarla hesaplanır.
-- Nakit isteği hemen yer ayırır ve yöneticiye düşer; kart isteği ödeme gelene kadar yer ayırmaz (yuklendi = false).
create or replace function public.bilet_istegi_ac_yol(p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_user uuid, p_dosya text, p_yol text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if p_yol not in ('havale', 'kart', 'nakit') then raise exception 'Ödeme yolu geçersiz.'; end if;
  if p_yol = 'nakit' and (select count(*) from bilet_istekleri where eposta = lower(trim(p_eposta)) and odeme_yolu = 'nakit'
                           and yuklendi and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için girişte ödenecek iki rezervasyon var. Biri sonuçlanınca yenisini yapabilirsin.';
  end if;
  r := bilet_istegi_ac(p_ad, p_eposta, p_tel, p_kalemler, p_user, p_dosya);
  update bilet_istekleri set odeme_yolu = p_yol, yuklendi = (p_yol = 'nakit') where id = (r ->> 'id')::bigint;
  return r || jsonb_build_object('yol', p_yol);
end $$;
revoke execute on function public.bilet_istegi_ac_yol(text, text, text, jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bilet_istegi_ac_yol(text, text, text, jsonb, uuid, text, text) to service_role;

-- Onayın ortak kısmı: kodlar, satılan bilet, muhasebe (ödeme yoluna göre kasa), "bilet" maili
create or replace function public.bilet_onayla_(p_id bigint, p_veren uuid)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i bilet_istekleri;
  k jsonb;
  e etkinlikler;
  yeni_kod text;
  kodlar text[];
  satirlar text[] := '{}';
  toplam_adet int := 0;
  kasa_ kasa;
  odeme_ odeme_yolu;
begin
  select * into i from bilet_istekleri where id = p_id for update;
  kasa_ := case when i.odeme_yolu = 'nakit' then 'nakit'::kasa else 'banka'::kasa end;
  odeme_ := case i.odeme_yolu when 'nakit' then 'elden'::odeme_yolu when 'kart' then 'kart'::odeme_yolu else 'havale'::odeme_yolu end;
  for k in select * from jsonb_array_elements(i.kalemler) loop
    select * into e from etkinlikler where id = (k ->> 'etkinlik_id')::bigint for update;
    kodlar := '{}';
    for n in 1 .. (k ->> 'adet')::int loop
      loop
        yeni_kod := yeni_bilet_satis_kodu();
        exit when not exists (select 1 from biletler b where b.kod = yeni_kod);
      end loop;
      insert into biletler (kod, istek_id, etkinlik_id, ad) values (yeni_kod, i.id, e.id, i.ad);
      kodlar := kodlar || yeni_kod;
    end loop;
    update etkinlikler set satilan_bilet = satilan_bilet + (k ->> 'adet')::int where id = e.id;
    if (k ->> 'tutar')::numeric > 0 then
      insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, etkinlik_id, aciklama, belge, otomatik, odeme)
        values (istanbul_bugun(), 'gelir', (k ->> 'tutar')::numeric, kasa_, 'Etkinlik katılım ücreti', e.id,
                'Bilet · ' || i.ad || ' · ' || (k ->> 'adet') || ' kişi', 'bilet:' || i.id, true, odeme_);
    end if;
    satirlar := satirlar || (e.ad || ' · ' || tr_tarih(e.tarih) || coalesce(' · ' || e.saat, '') || E'\n' || array_to_string(kodlar, E'\n'));
    toplam_adet := toplam_adet + (k ->> 'adet')::int;
  end loop;
  update bilet_istekleri set durum = 'onaylandi', sonuc = toplam_adet || ' bilet', karar_at = now(), karar_veren = p_veren where id = i.id;
  perform eposta_ekle('bilet', i.eposta, jsonb_build_object('ad', i.ad, 'biletler', array_to_string(satirlar, E'\n\n')), 'bilet:' || i.id, i.uye_id);
  return jsonb_build_object('durum', 'onaylandi', 'adet', toplam_adet);
end $$;
revoke execute on function public.bilet_onayla_(bigint, uuid) from public, anon, authenticated;

-- Yönetici kararı (havale ve nakit): onay ortak işlevle; red gerekçeli "bilet_red" maili
create or replace function public.bilet_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare i bilet_istekleri;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into i from bilet_istekleri where id = p_id for update;
  if i.id is null or not i.yuklendi then raise exception 'Bilet isteği bulunamadı.'; end if;
  if i.durum <> 'bekliyor' then raise exception 'Bu istek zaten sonuçlandı.'; end if;
  if i.odeme_yolu = 'kart' then raise exception 'Kartla ödenen biletler kendiliğinden kesinleşir.'; end if;
  if not p_onay then
    update bilet_istekleri set durum = 'reddedildi', sonuc = nullif(left(trim(coalesce(p_not, '')), 300), ''), karar_at = now(), karar_veren = auth.uid()
      where id = i.id;
    perform eposta_ekle('bilet_red', i.eposta, jsonb_build_object('ad', i.ad, 'neden',
      coalesce(nullif(trim(p_not), ''), case when i.odeme_yolu = 'nakit' then 'Rezervasyon iptal edildi.' else 'Dekont ödemeyle eşleşmedi.' end)),
      'bilet_red:' || i.id, i.uye_id);
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  return bilet_onayla_(i.id, auth.uid());
end $$;
revoke execute on function public.bilet_karar(bigint, boolean, text) from public, anon;
grant execute on function public.bilet_karar(bigint, boolean, text) to authenticated;

-- Shopier ödemesi doğrulandı (shopier-bildirim, service_role; sipariş Shopier API'sinden tekrar okunmuş ve tutar
-- eşleşmiş olmalı): yerler o an hâlâ müsaitse biletler kesinleşir. Aynı bildirim iki kez gelirse ikinci kez işlemez.
create or replace function public.bilet_kart_odendi(p_id bigint, p_siparis text, p_tutar numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare i bilet_istekleri;
begin
  select * into i from bilet_istekleri where id = p_id for update;
  if i.id is null or i.odeme_yolu <> 'kart' then raise exception 'Kart ödemeli bilet isteği bulunamadı.'; end if;
  if i.durum = 'onaylandi' then return jsonb_build_object('durum', 'onaylandi', 'zaten', true); end if;
  if i.durum <> 'bekliyor' then raise exception 'Bu istek zaten sonuçlandı.'; end if;
  if round(p_tutar, 2) <> round(i.tutar, 2) then raise exception 'Ödenen tutar istekle eşleşmiyor.'; end if;
  if length(trim(coalesce(p_siparis, ''))) < 3 then raise exception 'Sipariş numarası eksik.'; end if;
  update bilet_istekleri set yuklendi = true, shopier_siparis = trim(p_siparis), odendi_at = now() where id = i.id;
  return bilet_onayla_(i.id, null);
end $$;
revoke execute on function public.bilet_kart_odendi(bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.bilet_kart_odendi(bigint, text, numeric) to service_role;
