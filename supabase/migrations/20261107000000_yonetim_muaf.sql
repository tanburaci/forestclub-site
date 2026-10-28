-- Forest Club Urla: yönetim ekibi (Pelin, Ezgi, Deniz) aidattan muaf (07.11.2026). Üye, adının ilk kelimesiyle eşleşir
-- (küçük harf, Türkçe harfler sadeleşmiş). Her ad için tam bir üye bulunmazsa hiçbir şey yazılmaz; aynı adlı ikinci bir
-- üye varsa işaret Yönetim › Üyeler › Profil › "Aidattan muaf"tan elle konur. Bitiş ve durum aidat_muaf tetikleyicisinden.
do $$
declare
  ad text;
  sayi int;
begin
  if not exists (select 1 from uyeler) then return; end if;  -- boş veritabanı (CI, yerel kurulum)
  foreach ad in array array['pelin', 'ezgi', 'deniz'] loop
    select count(*) into sayi from uyeler
      where split_part(trim(lower(translate(uyeler.ad, 'ÇĞİIÖŞÜı', 'çğiiöşüi'))), ' ', 1) = ad;
    if sayi <> 1 then
      raise exception '"%" adlı % üye bulundu (1 bekleniyordu); hiçbir şey yazılmadı.', ad, sayi;
    end if;
  end loop;
  update uyeler set aidat_muaf = true
    where split_part(trim(lower(translate(uyeler.ad, 'ÇĞİIÖŞÜı', 'çğiiöşüi'))), ' ', 1) in ('pelin', 'ezgi', 'deniz');
end $$;
