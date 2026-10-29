-- Forest Club Urla: açılış öncesi düzeltmeler (18.11.2026).
--   · Yönetici notu üyeye görünmesin: uyeler.yonetici_notu üyenin kendi satırıyla birlikte okunabiliyordu. Notlar yalnız
--     yöneticinin okuyup yazdığı uye_notlari tablosuna taşınır; eski sütun boşaltılır (silinmez, eski işlevler ona yazıyor).
--   · Kontenjan: üye kaydı ("Randevu oluştur") ve tanışma bileti, dekontu incelemede bekleyen biletleri de sayar.
--   · Yenileme: "Hoş geldin" (onay) maili yalnız ilk ödemede gider; sonraki ödemelerde kısa "üyeliğin uzadı" maili.
--   · Ad alanları: herkese açık formlardan gelen adlarda bağlantı / e-posta olamaz (kulüp adresinden sahte mail önlemi).

-- 1. Yönetici notları
create table if not exists public.uye_notlari (
  uye_id bigint primary key references public.uyeler (id) on delete cascade,
  metin text not null,
  updated_at timestamptz not null default now()
);
alter table public.uye_notlari enable row level security;
drop policy if exists yonetici_tam on public.uye_notlari;
create policy yonetici_tam on public.uye_notlari for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.uye_notlari from anon;
grant select, insert, update, delete on public.uye_notlari to authenticated;

insert into public.uye_notlari (uye_id, metin)
  select id, yonetici_notu from public.uyeler where nullif(trim(coalesce(yonetici_notu, '')), '') is not null
  on conflict (uye_id) do nothing;
update public.uyeler set yonetici_notu = null where yonetici_notu is not null;

-- Eski sütuna yazılan not (eski panel sekmesi açık kalmışsa) tabloya aktarılır, sütun boş kalır
create or replace function public.yonetici_notu_tasi() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  if nullif(trim(coalesce(new.yonetici_notu, '')), '') is not null then
    insert into uye_notlari (uye_id, metin) values (new.id, new.yonetici_notu)
      on conflict (uye_id) do update set metin = excluded.metin, updated_at = now();
  end if;
  new.yonetici_notu := null;
  return new;
end $$;
revoke execute on function public.yonetici_notu_tasi() from public, anon, authenticated;
drop trigger if exists yonetici_notu_tasi on public.uyeler;
create trigger yonetici_notu_tasi before update of yonetici_notu on public.uyeler
  for each row when (new.yonetici_notu is not null) execute function public.yonetici_notu_tasi();

-- KVKK silmede not da gider
create or replace function public.uye_notu_sil() returns trigger
  language plpgsql security definer set search_path = public
  as $$
begin
  delete from uye_notlari where uye_id = new.id;
  return new;
end $$;
revoke execute on function public.uye_notu_sil() from public, anon, authenticated;
drop trigger if exists uye_notu_sil on public.uyeler;
create trigger uye_notu_sil after update of eposta on public.uyeler
  for each row when (new.eposta like 'silindi-%@silindi.invalid') execute function public.uye_notu_sil();

-- 2. Kontenjan: incelemedeki biletler de dolu sayılır
create or replace function public.etkinlik_kaydi(p_etkinlik bigint, p_istek text) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  u uyeler;
  e etkinlikler;
  mevcut etkinlik_kayitlari;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  if e.tarih < istanbul_bugun() then raise exception 'Bu etkinlik geçti.'; end if;
  select * into mevcut from etkinlik_kayitlari where etkinlik_id = e.id and uye_id = u.id;

  if p_istek = 'katil' then
    if e.durum <> 'yayinda' then raise exception 'Bu etkinlik iptal edildi ya da yayında değil.'; end if;
    if u.bitis is null or u.bitis <= istanbul_bugun() then raise exception 'Üyeliğin aktif değil.'; end if;
    if u.durum = 'donduruldu' then raise exception 'Üyeliğin dondurulmuş; katılmak için “Erken dön”e bas.'; end if;
    if mevcut.uye_id is not null then
      return jsonb_build_object('durum', mevcut.durum, 'sira', mevcut.sira);
    end if;
    if etkinlik_dolu(e.id) < e.kontenjan - e.satilan_bilet - bilet_bekleyen(e.id) then
      insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum) values (e.id, u.id, 'kayitli');
      return jsonb_build_object('durum', 'kayitli', 'sira', null);
    end if;
    insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum, sira)
      values (e.id, u.id, 'bekleme',
              coalesce((select max(sira) from etkinlik_kayitlari where etkinlik_id = e.id and durum = 'bekleme'), 0) + 1)
      returning * into mevcut;
    return jsonb_build_object('durum', 'bekleme', 'sira', mevcut.sira);

  elsif p_istek = 'vazgec' then
    if mevcut.uye_id is null then return jsonb_build_object('durum', 'yok'); end if;
    delete from etkinlik_kayitlari where etkinlik_id = e.id and uye_id = u.id;
    perform bekleme_yukselt(e.id);
    return jsonb_build_object('durum', 'yok');
  end if;
  raise exception 'Geçersiz istek.';
end $$;

create or replace function public.tanisma_bileti_al(p_ad text, p_eposta text, p_etkinlik bigint) returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  ep text := lower(trim(p_eposta));
  e etkinlikler;
  yeni_kod text;
  bilet_id bigint;
begin
  if length(trim(p_ad)) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if coalesce((ayar('tanisma_acik'))::boolean, true) is false then raise exception 'Tanışma bileti şu an verilmiyor.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;  -- aynı anda gelen iki bilet kontenjanı aşmasın
  if e.id is null or e.tarih < istanbul_bugun() or e.durum <> 'yayinda' then
    raise exception 'Bu buluşma için bilet alınamıyor.';
  end if;
  if e.bilet_fiyati is not null and e.uyelere is distinct from 'ucretsiz' then
    raise exception 'Tanışma bileti yalnız üyelere ücretsiz buluşmalar için; başka bir buluşma seç.';
  end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then return 'uye'; end if;
  if exists (select 1 from tanisma_biletleri where lower(eposta) = ep) then return 'kullanilmis'; end if;
  if (select count(*) from tanisma_biletleri where etkinlik_id = e.id) >= e.tanisma_kontenjan then
    raise exception 'Bu buluşmanın tanışma biletleri doldu; başka bir buluşma seç.';
  end if;
  if etkinlik_dolu(e.id) + e.satilan_bilet + bilet_bekleyen(e.id) >= e.kontenjan then
    raise exception 'Bu buluşma dolu; başka bir buluşma seç.';
  end if;
  loop
    yeni_kod := yeni_bilet_kodu();
    exit when not exists (select 1 from tanisma_biletleri where kod = yeni_kod);
  end loop;
  insert into tanisma_biletleri (ad, eposta, alinis, etkinlik_id, durum, kod)
    values (trim(p_ad), ep, istanbul_bugun(), e.id, 'bekliyor', yeni_kod) returning id into bilet_id;
  perform eposta_ekle('tanisma', ep,
                      jsonb_build_object('ad', trim(p_ad), 'biletKodu', yeni_kod, 'etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, '')),
                      'tanisma:' || bilet_id, null, e.id);
  return 'verildi';
end $$;

-- 3. Yenileme maili
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('uzatma', 'Üyelik uzadı', 'Üyeliği devam eden üyenin ödemesi onaylanınca gider (ilk ödemede "Hoş geldin" gider).', true, null,
   'Üyeliğin uzadı 🌿',
   E'Merhaba {ad},\n\nÖdemen bize ulaştı, teşekkürler. Forest Club üyeliğin {bitis} tarihine kadar uzadı.\n\nYeni buluşmalarda görüşmek üzere.\n\nSevgiler,\nForest Club Urla\nWe listen carefully.',
   array['ad', 'bitis', 'kod'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where id = 'uzatma' and varsayilan_konu is null;

create or replace function public.uyelik_uzat(p_uye bigint, p_tutar numeric, p_yol odeme_yolu, p_tarih date, p_ref text) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
declare
  u uyeler;
  tarih date := coalesce(p_tarih, istanbul_bugun());
  yeni_bitis date;
  odeme_id bigint;
  hareket_id bigint;
begin
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar sıfırdan büyük olmalı.'; end if;
  if nullif(trim(coalesce(p_ref, '')), '') is null then raise exception 'Ödeme referansı eksik.'; end if;
  select * into u from uyeler where id = p_uye for update;
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  select id into odeme_id from odemeler where ref = p_ref;
  if odeme_id is not null then
    return jsonb_build_object('bitis', u.bitis, 'odeme_id', odeme_id, 'hareket_id', null, 'ref', p_ref, 'tekrar', true);
  end if;
  yeni_bitis := greatest(coalesce(u.bitis, istanbul_bugun()), istanbul_bugun()) + 30;
  update uyeler set baslangic = coalesce(baslangic, tarih), bitis = yeni_bitis,
                    durum = case when durum = 'donduruldu' then durum else 'aktif' end
    where id = u.id;
  insert into odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
    values (u.id, tarih, p_tutar, p_yol,
            case p_yol when 'havale' then 'Dekont onayı · 30 gün' when 'elden' then 'Elden ödeme · 30 gün' else 'Kart · 30 gün' end,
            p_ref)
    returning id into odeme_id;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (tarih, 'gelir', p_tutar, case when p_yol = 'elden' then 'nakit'::kasa else 'banka'::kasa end, 'Aidat',
            'Aidat · ' || u.ad, p_ref, true, p_yol)
    returning id into hareket_id;
  update tanisma_biletleri set durum = 'uye' where lower(eposta) = u.eposta and durum = 'geldi';
  -- İlk ödeme: "Hoş geldin" (şifre bağlantısıyla); sonrakiler: "Üyeliğin uzadı"
  perform eposta_ekle(case when u.baslangic is null then 'onay' else 'uzatma' end, u.eposta,
                      jsonb_build_object('ad', u.ad, 'bitis', to_char(yeni_bitis, 'DD.MM.YYYY'), 'kod', u.kod),
                      'onay:' || odeme_id, u.id);
  return jsonb_build_object('bitis', yeni_bitis, 'odeme_id', odeme_id, 'hareket_id', hareket_id, 'ref', p_ref, 'tekrar', false);
end $$;

-- 4. Herkese açık formlardan gelen adlarda bağlantı / e-posta olamaz
create or replace function public.ad_denetle() returns trigger
  language plpgsql set search_path = public
  as $$
begin
  if new.ad ~* '(https?:|www\.|://|[@/\\<>]|[[:alnum:]-]+\.[[:alpha:]]{2,})' then
    raise exception 'Adında bağlantı ya da e-posta olamaz; yalnız adını ve soyadını yaz.';
  end if;
  return new;
end $$;
revoke execute on function public.ad_denetle() from public, anon, authenticated;
drop trigger if exists ad_denetle on public.uyeler;
create trigger ad_denetle before insert on public.uyeler for each row execute function public.ad_denetle();
drop trigger if exists ad_denetle on public.tanisma_biletleri;
create trigger ad_denetle before insert on public.tanisma_biletleri for each row execute function public.ad_denetle();
drop trigger if exists ad_denetle on public.bilet_istekleri;
create trigger ad_denetle before insert on public.bilet_istekleri for each row execute function public.ad_denetle();

-- 5. Üye paneli: dekontu incelemede mi (üye dekontlar tablosunu okuyamaz; yalnız kendi durumunu öğrenir)
create or replace function public.dekont_bekliyor() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select exists (select 1 from dekontlar d join uyeler u on u.id = d.uye_id
                   where u.user_id = auth.uid() and d.durum = 'bekliyor')
  $$;
revoke execute on function public.dekont_bekliyor() from public, anon;
grant execute on function public.dekont_bekliyor() to authenticated;
