-- Forest Club Urla: tanışma bileti artık sitede dağıtılmaz (23.11.2026). Bir üyeden tanışma bileti almış kişi
-- "Tanışma biletimle rezervasyon" formunu doldurur: referans (bileti veren), kendi adı, bilet numarası, telefon,
-- e-posta ve etkinlik. Rezervasyon yalnız:
--   · etkinliğe 24 saatten az kala (gerçekleşmeden 1 gün önce açılır),
--   · katılım kontenjanın yarısından azsa (kalabalık etkinlikte ücretsiz yer açılmaz),
--   · üyelere ücretsiz buluşmalarda ve etkinliğin tanışma kontenjanı dolmadıysa,
--   · aynı e-posta ve aynı bilet numarası bir kez.
-- Rezervasyon kodu (FC-T-…) e-postayla gider, girişte okutulur (eskisi gibi tanisma_biletleri).
alter table public.tanisma_biletleri add column if not exists referans text;
alter table public.tanisma_biletleri add column if not exists bilet_no text;
alter table public.tanisma_biletleri add column if not exists tel text;
create unique index if not exists tanisma_biletleri_bilet_no on public.tanisma_biletleri (upper(bilet_no)) where bilet_no is not null;

-- Etkinlik tanışma rezervasyonuna açık mı (sitedeki liste ve rezervasyon aynı kuralı kullanır)
create or replace function public.tanisma_acik_mi(e etkinlikler) returns boolean
  language sql stable security definer set search_path = public
  as $$
    select e.durum = 'yayinda'
      and (e.bilet_fiyati is null or e.uyelere = 'ucretsiz')
      and coalesce(e.tanisma_kontenjan, 0) > 0
      and coalesce((ayar('tanisma_acik'))::boolean, true)
      and etkinlik_baslangic(e) > now()
      and etkinlik_baslangic(e) <= now() + interval '24 hours'
      and (etkinlik_dolu(e.id) + e.satilan_bilet + bilet_bekleyen(e.id)) * 2 < e.kontenjan
      and (select count(*) from tanisma_biletleri t where t.etkinlik_id = e.id) < e.tanisma_kontenjan
  $$;
revoke execute on function public.tanisma_acik_mi(etkinlikler) from public, anon, authenticated;

-- Sitedeki liste: şu an tanışma rezervasyonuna açık etkinlikler
create or replace function public.tanisma_etkinlikleri() returns table (etkinlik_id bigint)
  language sql stable security definer set search_path = public
  as $$ select e.id from etkinlikler e where e.tarih between istanbul_bugun() and istanbul_bugun() + 1 and tanisma_acik_mi(e) $$;
revoke execute on function public.tanisma_etkinlikleri() from public;
grant execute on function public.tanisma_etkinlikleri() to anon, authenticated;

create or replace function public.tanisma_rezervasyon(p_ad text, p_eposta text, p_tel text, p_referans text, p_bilet_no text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public
  as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  ad text := trim(coalesce(p_ad, ''));
  ref text := trim(coalesce(p_referans, ''));
  no text := upper(regexp_replace(trim(coalesce(p_bilet_no, '')), '\s+', '', 'g'));
  e etkinlikler;
  yeni_kod text;
  bilet_id bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if length(ref) < 3 or length(ref) > 120 then raise exception 'Bileti veren kişinin adını ve soyadını yaz.'; end if;
  if ref ~* '(https?:|www\.|://|[@/\\<>]|[[:alnum:]-]+\.[[:alpha:]]{2,})' then raise exception 'Bileti veren kişinin yalnız adını ve soyadını yaz.'; end if;
  if no !~ '^[A-Z0-9-]{3,30}$' then raise exception 'Tanışma bileti numarasını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;  -- aynı anda gelen rezervasyonlar kontenjanı aşmasın
  if e.id is null or not tanisma_acik_mi(e) then
    raise exception 'Bu etkinlik şu an tanışma rezervasyonuna açık değil; listedeki etkinliklerden birini seç.';
  end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then return 'uye'; end if;
  if exists (select 1 from tanisma_biletleri where lower(eposta) = ep or upper(bilet_no) = no) then return 'kullanilmis'; end if;
  loop
    yeni_kod := yeni_bilet_kodu();
    exit when not exists (select 1 from tanisma_biletleri where kod = yeni_kod);
  end loop;
  insert into tanisma_biletleri (ad, eposta, tel, referans, bilet_no, alinis, etkinlik_id, durum, kod)
    values (ad, ep, left(trim(p_tel), 30), ref, no, istanbul_bugun(), e.id, 'bekliyor', yeni_kod) returning id into bilet_id;
  perform eposta_ekle('tanisma', ep,
                      jsonb_build_object('ad', ad, 'biletKodu', yeni_kod, 'etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, '')),
                      'tanisma:' || bilet_id, null, e.id);
  return 'verildi';
end $$;
revoke execute on function public.tanisma_rezervasyon(text, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.tanisma_rezervasyon(text, text, text, text, text, bigint) to service_role;

-- Eski "tanışma bileti al" artık kullanılmaz (form-gonder yeni işlevi çağırır)
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from service_role;

-- Onay maili: "biletin hazır" yerine "rezervasyonun hazır" (yönetimde değiştirilmemişse)
update public.eposta_sablonlari set
  ad = 'Tanışma rezervasyonu',
  ne_zaman = 'Tanışma biletiyle rezervasyon yapan kişiye gider.',
  konu = 'Tanışma rezervasyonun hazır 🎟️',
  metin = E'Merhaba {ad},\n\nTanışma biletinle rezervasyonun tamam: {etkinlik} · {tarih} {saat}, Pinya, Urla. 🌲\n\nGirişte bu kodu göstermen yeterli: {biletKodu}\n\nGörüşmek üzere,\nForest Club Urla\nWe listen carefully.'
  where id = 'tanisma' and metin = varsayilan_metin;
update public.eposta_sablonlari set varsayilan_konu = 'Tanışma rezervasyonun hazır 🎟️',
  varsayilan_metin = E'Merhaba {ad},\n\nTanışma biletinle rezervasyonun tamam: {etkinlik} · {tarih} {saat}, Pinya, Urla. 🌲\n\nGirişte bu kodu göstermen yeterli: {biletKodu}\n\nGörüşmek üzere,\nForest Club Urla\nWe listen carefully.'
  where id = 'tanisma';
