-- Forest Club Urla · erteleme kurdelesi (09.11.2026): ertelenen etkinlik sitede yeni tarihinde sarı "ERTELENDİ"
-- kurdelesi + duyuru yazısıyla görünür (sitenin en üstünde duyuru yok). Duyuru metni ertelemede de etkinliğe yazılır
-- (durum_duyuru); yeniden yayına alınca silinir. Mailler değişmedi (kayıtlılar + bilet alanlar).
create or replace function public.etkinlik_durum_degistir(p_id bigint, p_durum text, p_yeni_tarih date, p_neden text,
                                                          p_duyuru text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e etkinlikler;
  eski date;
  neden text := nullif(left(trim(coalesce(p_neden, '')), 300), '');
  duyuru text;
  mail int := 0;
  r record;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into e from etkinlikler where id = p_id for update;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  eski := e.tarih;
  if p_durum = 'iptal' then
    update etkinlikler set durum = 'iptal', durum_neden = neden, durum_degisti_at = now() where id = e.id
      returning * into e;
  elsif p_durum = 'ertelendi' then
    if p_yeni_tarih is null or p_yeni_tarih < istanbul_bugun() then raise exception 'Yeni tarih bugün ya da sonrası olmalı.'; end if;
    if p_yeni_tarih = e.tarih then raise exception 'Yeni tarih eskisiyle aynı.'; end if;
    if exists (select 1 from etkinlikler where tarih = p_yeni_tarih and ad = e.ad and id <> e.id) then
      raise exception 'O tarihte aynı adla bir etkinlik zaten var.';
    end if;
    update etkinlikler set eski_tarih = e.tarih, tarih = p_yeni_tarih, durum = 'yayinda', durum_neden = neden,
                           durum_degisti_at = now()
      where id = e.id returning * into e;
  elsif p_durum = 'yayinda' then
    update etkinlikler set durum = 'yayinda', durum_neden = null, durum_duyuru = null, durum_degisti_at = now() where id = e.id
      returning * into e;
  else
    raise exception 'Geçersiz durum.';
  end if;
  if p_durum in ('iptal', 'ertelendi') then
    duyuru := coalesce(nullif(left(trim(coalesce(p_duyuru, '')), 2000), ''),
                       case when p_durum = 'iptal'
                            then tr_tarih(eski) || ' tarihli ' || e.ad || ' iptal edildi.'
                            else tr_tarih(eski) || ' tarihli ' || e.ad || ', ' || tr_tarih(e.tarih) || ' tarihine ertelendi. Kaydın yeni tarihe taşındı.' end);
    -- Duyuru etkinlikte saklanır: sitede kartta ve sayfasında kurdeleyle görünür (iptal kırmızı, erteleme sarı)
    update etkinlikler set durum_duyuru = left(duyuru, 300) where id = e.id;
    -- Aynı e-postaya tek mail (üye hem kayıtlı hem bilet almışsa)
    for r in select distinct on (lower(x.eposta)) x.* from (
               select 1 as oncelik, 'u' || u.id as anahtar, u.id as uye_id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id
                 where k.etkinlik_id = e.id
               union all
               select 2, 't' || t.id, null, t.ad, t.eposta from tanisma_biletleri t where t.etkinlik_id = e.id and t.durum = 'bekliyor'
               union all
               select 3, 'b' || i.id, i.uye_id, i.ad, i.eposta from bilet_istekleri i
                 where (i.durum = 'onaylandi' or (i.durum = 'bekliyor' and i.yuklendi))
                   and exists (select 1 from jsonb_array_elements(i.kalemler) ik where (ik ->> 'etkinlik_id')::bigint = e.id)
             ) x
             where x.eposta not like 'silindi-%'
             order by lower(x.eposta), x.oncelik loop
      if eposta_ekle('iptal', r.eposta, jsonb_build_object('ad', r.ad, 'etkinlik', e.ad, 'duyuru', duyuru),
                     'iptal:' || e.id || ':' || r.anahtar || ':' || extract(epoch from e.durum_degisti_at)::bigint, r.uye_id, e.id) is not null then
        mail := mail + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('durum', e.durum, 'tarih', e.tarih, 'eski_tarih', e.eski_tarih,
                            'kisi', (select count(*) from etkinlik_kayitlari where etkinlik_id = e.id), 'mail', mail);
end $$;
revoke execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) from public, anon;
grant execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) to authenticated;
