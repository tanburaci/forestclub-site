-- Forest Club Urla: etkinlikte minimum kişi sayısı (10.11.2026). Etkinliğe 24 saatten az kala kayıtlı + bilet sayısı
-- minimumun altındaysa yöneticilere bir kez "min_kisi" maili gider; iptal mi erteleme mi kararı yönetimde
-- (Etkinlikler › İptal / ertele, kayıtlılara mail gider). Saatte bir kontrol edilir.
alter table public.etkinlikler
  add column if not exists min_kisi int check (min_kisi > 0),
  add column if not exists min_uyari_at timestamptz;

-- Etkinliğin başlangıcı (İstanbul saati; saat "10.00" ya da "10.00–11.30", yoksa 10.00)
create or replace function public.etkinlik_baslangic(e etkinlikler) returns timestamptz
  language sql stable set search_path = public as $$
    select (e.tarih + coalesce(replace(substring(e.saat from '^\s*(\d{1,2}\.\d{2})'), '.', ':')::time, time '10:00'))
           at time zone 'Europe/Istanbul'
  $$;
revoke execute on function public.etkinlik_baslangic(etkinlikler) from public, anon, authenticated;

create or replace function public.min_kisi_kontrol() returns int
  language plpgsql security definer set search_path = public as $$
declare
  e etkinlikler;
  gelen int;
  r record;
  n int := 0;
begin
  for e in
    select * from etkinlikler
    where durum = 'yayinda' and min_kisi is not null and min_uyari_at is null
      and etkinlik_baslangic(etkinlikler) between now() and now() + interval '24 hours'
  loop
    gelen := etkinlik_dolu(e.id) + e.satilan_bilet;
    if gelen < e.min_kisi then
      for r in select y.user_id, u.email from yoneticiler y join auth.users u on u.id = y.user_id loop
        perform eposta_ekle('min_kisi', r.email,
                            jsonb_build_object('etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, ''),
                                               'kayitli', gelen::text, 'minimum', e.min_kisi::text),
                            'min_kisi:' || e.id || ':' || r.user_id, null, e.id);
      end loop;
      n := n + 1;
    end if;
    update etkinlikler set min_uyari_at = now() where id = e.id;
  end loop;
  return n;
end $$;
revoke execute on function public.min_kisi_kontrol() from public, anon, authenticated;

-- Tarih / saat değişince (erteleme) uyarı yeniden yapılabilir
create or replace function public.min_uyari_sifirla() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.tarih is distinct from old.tarih or new.saat is distinct from old.saat or new.min_kisi is distinct from old.min_kisi then
    new.min_uyari_at := null;
  end if;
  return new;
end $$;
revoke execute on function public.min_uyari_sifirla() from public, anon, authenticated;
drop trigger if exists min_uyari_sifirla on public.etkinlikler;
create trigger min_uyari_sifirla before update on public.etkinlikler for each row execute function public.min_uyari_sifirla();

select cron.schedule('fc-min-kisi', '7 * * * *', $$select public.min_kisi_kontrol()$$);

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('min_kisi', 'Minimum kişiye ulaşılmadı (yöneticilere)', 'Etkinliğe 24 saatten az kala kayıt minimumun altındaysa yöneticilere gider.', true, null,
   '{etkinlik}: minimum kişiye ulaşılmadı',
   E'Merhaba,\n\n{etkinlik} ({tarih}, {saat}) için kayıtlı kişi sayısı {kayitli}; minimum {minimum} kişi gerekiyordu.\n\nİptal ya da erteleme kararı için yönetim panelinde Etkinlikler › İptal / ertele''yi kullanabilirsiniz; kayıtlılara mail kendiliğinden gider.\n\nForest Club Urla sitesi',
   array['etkinlik', 'tarih', 'saat', 'kayitli', 'minimum'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where varsayilan_konu is null;
