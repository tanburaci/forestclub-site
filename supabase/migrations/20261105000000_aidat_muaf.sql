-- Forest Club Urla: aidattan muaf üyeler (05.11.2026). Yönetim › Üyeler › Profil'de "Aidattan muaf" işaretlenir (yönetim
-- ekibi: Pelin, Ezgi, Deniz). Muaf üyenin üyeliği hiç bitmez: bitiş 31.12.2099'a sabitlenir, böylece giriş karekodu,
-- etkinlik kaydı ve kutlamalar (hepsi bitis > bugün'e bakar) olduğu gibi çalışır; yenileme hatırlatması gitmez,
-- gece işi üyeliği "doldu" yapmaz. Muafiyet kaldırılınca üyeye bugünden 30 gün verilir.
alter table public.uyeler add column if not exists aidat_muaf boolean not null default false;

create or replace function public.aidat_muaf_uygula() returns trigger
  language plpgsql set search_path = public
  as $$
begin
  if new.aidat_muaf then
    new.bitis := date '2099-12-31';
    new.baslangic := coalesce(new.baslangic, istanbul_bugun());
    if new.durum in ('basvuru', 'doldu') then new.durum := 'aktif'; end if;
  elsif tg_op = 'UPDATE' and old.aidat_muaf and new.bitis = date '2099-12-31' then
    new.bitis := istanbul_bugun() + 30;
    if new.durum <> 'donduruldu' then new.durum := 'aktif'; end if;
  end if;
  return new;
end $$;

drop trigger if exists aidat_muaf on public.uyeler;
create trigger aidat_muaf before insert or update of aidat_muaf, bitis, durum on public.uyeler
  for each row execute function public.aidat_muaf_uygula();
