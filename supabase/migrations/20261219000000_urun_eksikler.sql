-- Forest Club Urla · etkinlik ürünlerinde eksikler (13.11.2026)
-- 1. Etkinlik iptal edilince: bekleyen ürün siparişleri reddedilir (dekontu / kodu olan alıcıya "urun_red" e-postası);
--    ödenmiş siparişler (onaylanmış + dekontu gelmiş havale) için yöneticilere iade uyarısı.
-- 2. KVKK: anonimleştirilen üyenin ürün siparişlerinden ad, e-posta, telefon, dekont silinir; muhasebe açıklamasından adı
--    çıkar; veri kopyasına ürün siparişleri eklenir.
-- 3. Stok girişinde alış maliyeti (isteğe bağlı): muhasebeye "Ürün alımı" gideri, envanter kalemine tutar / kasa.

-- ---------- 1. İptal ----------
create or replace function public.urun_iptal_islemleri() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  s urun_siparisleri;
  odenen text := '';
  adet int := 0;
begin
  for s in select * from urun_siparisleri where etkinlik_id = new.id and durum in ('bekliyor', 'onaylandi') order by id for update loop
    if s.durum = 'onaylandi' or (s.odeme_yolu = 'havale' and s.yuklendi) then
      adet := adet + 1;
      odenen := odenen || '; U-' || s.id || ' ' || s.ad || ' (' || s.eposta || ', ' || round(s.tutar) || ' TL, '
                || case s.odeme_yolu when 'kart' then 'kart · Shopier ' || coalesce(s.shopier_siparis, '') when 'havale' then 'havale'
                                     when 'nakit' then 'nakit' else 'POS' end || ')';
    end if;
    if s.durum = 'bekliyor' then
      update urun_siparisleri set durum = 'reddedildi', karar_at = now(), sonuc = 'Etkinlik iptal edildi.' where id = s.id;
      if s.yuklendi then
        perform eposta_ekle('urun_red', s.eposta, jsonb_build_object('ad', s.ad, 'kod', 'U-' || s.id,
          'neden', 'Etkinlik iptal edildi.' || case when s.odeme_yolu = 'havale' then ' Gönderdiğin tutar hesabına iade edilecek.' else '' end),
          'urun_red:' || s.id, null, s.etkinlik_id);
      end if;
    end if;
  end loop;
  if adet > 0 then
    perform yoneticilere_uyari(tr_tarih(old.tarih) || ' tarihli ' || new.ad || ' iptal edildi: ' || adet
                               || ' ödenmiş ürün siparişi iade bekliyor. İadeyi yapınca muhasebeye de işleyin' || odenen,
                               'urun_iptal:' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return new;
end $$;
revoke execute on function public.urun_iptal_islemleri() from public, anon, authenticated;
drop trigger if exists urun_iptal on public.etkinlikler;
create trigger urun_iptal after update of durum on public.etkinlikler
  for each row when (new.durum = 'iptal' and old.durum is distinct from 'iptal') execute function public.urun_iptal_islemleri();

-- ---------- 2. KVKK ----------
create or replace function public.urun_anonimlestir() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ep text := lower(old.eposta);
begin
  update muhasebe_hareketleri m set aciklama = replace(m.aciklama, ' · ' || s.ad || ' · ', ' · ' || new.ad || ' · ')
    from urun_siparisleri s where s.eposta = ep and m.belge = 'urun:' || s.id;
  update envanter_dusumleri d set notlar = 'Satış · U-' || s.id
    from urun_siparisleri s where s.eposta = ep and d.siparis_id = s.id;
  update urun_siparisleri set ad = new.ad, eposta = new.eposta, tel = 'silindi',
         dosya = case when dosya is not null then 'silindi-' || id end
   where eposta = ep;
  return new;
end $$;
revoke execute on function public.urun_anonimlestir() from public, anon, authenticated;
drop trigger if exists urun_anonimlestir on public.uyeler;
create trigger urun_anonimlestir after update of eposta on public.uyeler
  for each row when (new.eposta like 'silindi-%@silindi.invalid' and old.eposta not like 'silindi-%@silindi.invalid')
  execute function public.urun_anonimlestir();

-- Veri kopyası: ürün siparişleri
do $$
declare
  tanim text := pg_get_functiondef('public.veri_kopyasi(bigint)'::regprocedure);
  yer constant text := '''gonderilen_mailler'', ';
begin
  if position(yer in tanim) = 0 then raise exception 'veri kopyası satırı bulunamadı'; end if;
  if position('urun_siparisleri' in tanim) = 0 then
    execute replace(tanim, yer, '''urun_siparisleri'', coalesce((select jsonb_agg(jsonb_build_object(''kod'', ''U-'' || s.id, ''ad'', s.ad, ''tel'', s.tel, '
      || '''kalemler'', s.kalemler, ''tutar'', s.tutar, ''odeme_yolu'', s.odeme_yolu, ''durum'', s.durum, ''tarih'', s.created_at) order by s.id) '
      || 'from urun_siparisleri s where s.eposta = u.eposta), ''[]''), ' || yer);
  end if;
end $$;

-- ---------- 3. Stok girişinde maliyet ----------
drop function if exists public.urun_stok_ekle(bigint, numeric);
create or replace function public.urun_stok_ekle(p_urun bigint, p_adet numeric, p_tutar numeric default null, p_kasa text default null)
  returns numeric language plpgsql security definer set search_path = public as $$
declare
  env bigint;
  yeni numeric;
  u urunler;
  kasa_ kasa;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_adet is null or p_adet <= 0 or p_adet > 100000 or p_adet <> trunc(p_adet) then raise exception 'Eklenecek adedi tam sayı olarak yazın.'; end if;
  if p_tutar is not null and (p_tutar < 0 or p_tutar > 10000000) then raise exception 'Tutar geçersiz.'; end if;
  if coalesce(p_tutar, 0) > 0 then
    if p_kasa is null or p_kasa not in ('nakit', 'banka') then raise exception 'Ödemenin hangi kasadan yapıldığını seçin.'; end if;
    kasa_ := p_kasa::kasa;
  end if;
  select * into u from urunler where id = p_urun;
  if u.id is null then raise exception 'Ürün bulunamadı.'; end if;
  env := u.envanter_id;
  if env is null then  -- kalem silinmişse yenisi
    insert into envanter (ad, kategori, adet, birim, giris, tarih, notlar)
      values (u.ad, 'Satış ürünü', 0, 'adet', 'satin', istanbul_bugun(), 'Etkinliğe özel ürün; stok Ürünler sekmesinden.')
      returning id into env;
    update urunler set envanter_id = env where id = p_urun;
  end if;
  update envanter set adet = adet + p_adet,
         tutar = case when coalesce(p_tutar, 0) > 0 then coalesce(tutar, 0) + p_tutar else tutar end,
         kasa = case when coalesce(p_tutar, 0) > 0 then kasa_ else kasa end
   where id = env returning adet into yeni;
  if coalesce(p_tutar, 0) > 0 then
    insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, otomatik)
      values (istanbul_bugun(), 'gider', p_tutar, kasa_, 'Ürün alımı', left(u.ad || ' · ' || p_adet::int || ' adet stok', 200), true);
  end if;
  return yeni;
end $$;
revoke execute on function public.urun_stok_ekle(bigint, numeric, numeric, text) from public, anon;
grant execute on function public.urun_stok_ekle(bigint, numeric, numeric, text) to authenticated;
