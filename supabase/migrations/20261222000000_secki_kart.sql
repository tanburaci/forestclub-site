-- Forest Club Urla · Seçki kartları ve envanter fotoğrafı (15.11.2026)
-- · Ürüne "kimin seçkisi" (urunler.secen): etkinliğe bağlı olmayan Seçki ürününde kartta görünür.
-- · Seçki listesi ürünün ilk bağlandığı (yayındaki) etkinliğin adını ve tarihini de verir: kartta "hangi buluşmada" yazar.
-- · Envanter kalemine fotoğraf (envanter.foto, afisler deposundaki herkese açık adres).

alter table public.urunler add column if not exists secen text check (secen is null or length(trim(secen)) between 1 and 80);
alter table public.envanter add column if not exists foto text check (foto is null or foto ~ '^https://');

create or replace function public.secki_listesi() returns jsonb
  language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'aciklama', u.aciklama, 'fiyat', u.fiyat, 'foto', u.foto,
                                                 'kalan', urun_kalan(u.id), 'secen', u.secen,
                                                 'etkinlik', ilk.ad, 'etkinlik_tarih', ilk.tarih) order by u.fiyat, u.id), '[]'::jsonb)
      from urunler u
      left join lateral (
        select e.ad, e.tarih from etkinlik_urunleri eu join etkinlikler e on e.id = eu.etkinlik_id
         where eu.urun_id = u.id and e.durum = 'yayinda'
         order by e.tarih, e.id limit 1
      ) ilk on true
     where u.aktif and u.secki
  $$;
revoke execute on function public.secki_listesi() from public;
grant execute on function public.secki_listesi() to anon, authenticated;
