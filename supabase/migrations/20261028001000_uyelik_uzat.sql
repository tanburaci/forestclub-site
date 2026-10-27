-- Forest Club Urla: üyelik uzatma tek yerde (28.10.2026). Dekont onayı, elden ödeme ve ileride kartla ödeme (iyzico)
-- üyeliği aynı işlevle uzatır: üye kilitlenir, bitiş greatest(bitiş, bugün) + 30 olur, ödeme ve muhasebe kaydı aynı
-- işlemde yazılır. Her ödemenin bir referansı (ref) vardır; aynı referans ikinci kez gelirse üyelik yeniden uzamaz.

alter table public.odemeler add column if not exists ref text unique;  -- dekont:12 · elden:<uuid> · iyzico ödeme no

create or replace function public.uyelik_uzat(p_uye bigint, p_tutar numeric, p_yol odeme_yolu, p_tarih date, p_ref text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  tarih date := coalesce(p_tarih, istanbul_bugun());
  yeni_bitis date;
  odeme_id bigint;
  hareket_id bigint;
begin
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar sıfırdan büyük olmalı.'; end if;
  if nullif(trim(coalesce(p_ref, '')), '') is null then raise exception 'Ödeme referansı eksik.'; end if;
  select * into u from uyeler where id = p_uye for update;  -- aynı üyeye aynı anda iki ödeme günleri ezmesin
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  select id into odeme_id from odemeler where ref = p_ref;
  if odeme_id is not null then
    return jsonb_build_object('bitis', u.bitis, 'odeme_id', odeme_id, 'hareket_id', null, 'ref', p_ref, 'tekrar', true);
  end if;
  yeni_bitis := greatest(coalesce(u.bitis, istanbul_bugun()), istanbul_bugun()) + 30;
  update uyeler set baslangic = coalesce(baslangic, tarih), bitis = yeni_bitis, durum = 'aktif' where id = u.id;
  insert into odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
    values (u.id, tarih, p_tutar, p_yol,
            case p_yol when 'havale' then 'Dekont onayı · 30 gün' when 'elden' then 'Elden ödeme · 30 gün' else 'Kart · 30 gün' end,
            p_ref)
    returning id into odeme_id;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (tarih, 'gelir', p_tutar, case when p_yol = 'elden' then 'nakit'::kasa else 'banka'::kasa end, 'Aidat',
            'Aidat · ' || u.ad, p_ref, true, p_yol)
    returning id into hareket_id;
  return jsonb_build_object('bitis', yeni_bitis, 'odeme_id', odeme_id, 'hareket_id', hareket_id, 'ref', p_ref, 'tekrar', false);
end $$;
-- Yalnız sunucu işlevleri (dekont_karar, elden_odeme) ve ileride ödeme işlevi (service_role) çağırır
revoke execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) from public, anon, authenticated;
grant execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) to service_role;

-- Yönetici kararı: onayda üyelik uyelik_uzat ile uzar. Dönüş: {durum, bitis}
create or replace function public.dekont_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d dekontlar;
  r jsonb;
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
  r := uyelik_uzat(d.uye_id, d.tutar, 'havale', istanbul_bugun(), 'dekont:' || d.id);
  update dekontlar set durum = 'onaylandi', karar_at = now(), karar_veren = auth.uid(),
                       sonuc = to_char(istanbul_bugun(), 'DD.MM.YYYY') || ' · bitiş ' || to_char((r ->> 'bitis')::date, 'DD.MM.YYYY')
    where id = d.id;
  return jsonb_build_object('durum', 'onaylandi', 'bitis', r -> 'bitis');
end $$;
revoke execute on function public.dekont_karar(bigint, boolean, text) from public, anon;
grant execute on function public.dekont_karar(bigint, boolean, text) to authenticated;

-- Elden (nakit) aidat: yönetici panelinden, üye numarasıyla. Dönüş: {bitis, hareket_id, ref, ad, kod}
create or replace function public.elden_odeme(p_uye bigint, p_tutar numeric, p_tarih date)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  tarih date := coalesce(p_tarih, istanbul_bugun());
  r jsonb;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_tutar is null or p_tutar <= 0 or p_tutar > 100000 then raise exception 'Tutarı kontrol edin.'; end if;
  if tarih > istanbul_bugun() then raise exception 'İleri tarihli ödeme girilemez.'; end if;
  r := uyelik_uzat(p_uye, p_tutar, 'elden', tarih, 'elden:' || gen_random_uuid());
  return r || (select jsonb_build_object('ad', ad, 'kod', kod) from uyeler where id = p_uye);
end $$;
revoke execute on function public.elden_odeme(bigint, numeric, date) from public, anon;
grant execute on function public.elden_odeme(bigint, numeric, date) to authenticated;

-- Dekont kaydı: bir e-posta için incelemede en çok iki dekont bekleyebilir (kuyruk doldurulmasın)
create or replace function public.dekont_kaydet(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  select * into u from uyeler where eposta = ep for update;  -- aynı e-postayla aynı anda gelen iki kayıt sınırı aşmasın
  if u.id is null then raise exception 'Bu e-posta ile bir başvuru bulamadık. Başvuruda yazdığın adresi yaz.'; end if;
  if p_dosya !~ '^yeni/[A-Za-z0-9._-]{8,200}$'
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
revoke execute on function public.dekont_kaydet(text, text) from public;
grant execute on function public.dekont_kaydet(text, text) to anon, authenticated;
