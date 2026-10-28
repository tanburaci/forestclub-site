-- Forest Club Urla: tanışma bileti yalnız üyelere ücretsiz buluşmalarda (12.11.2026). Bilet satılan etkinlikte
-- üyelere kuralı "ucretsiz" değilse (%50, tam fiyat) tanışma bileti verilmez; kurallar öncekiyle aynı.
create or replace function public.tanisma_bileti_al(p_ad text, p_eposta text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public as $$
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
  if etkinlik_dolu(e.id) + e.satilan_bilet >= e.kontenjan then raise exception 'Bu buluşma dolu; başka bir buluşma seç.'; end if;
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
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from public, anon, authenticated;
grant execute on function public.tanisma_bileti_al(text, text, bigint) to service_role;
