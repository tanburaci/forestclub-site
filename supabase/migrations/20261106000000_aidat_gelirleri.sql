-- Forest Club Urla: dekontla ödeme yapan üç üyenin aidatı muhasebeye (06.11.2026). Sheets'ten aktarılan ödemeler
-- muhasebeye gelir olarak yazılmadığı için bankada yalnız bir aidat görünüyordu. Her üye için dekonttaki ödeme tarihiyle
-- (dekont yoksa son ödeme tarihiyle) banka kasasına "Aidat" geliri yazılır; muhasebede aidatı zaten olan üye atlanır.
-- Depo herkese açık: üyeler ad yerine adlarının özetiyle (küçük harf, Türkçe harfler sadeleşmiş, md5) eşleşir.
-- Her şey tutmazsa (üç üye bulunamaz ya da banka 9.000 TL olmazsa) hiçbir şey yazılmaz.
do $$
declare
  ozetler text[] := array['7bc3bfe08baebad6b21556bcbef252bb', '793c45b34cf1a9a8b71a3570fb8b7c02', '0643968280004fe9e4711309657ee577'];
  u uyeler;
  bulunan int := 0;
  d dekontlar;
  o odemeler;
  banka numeric;
begin
  if not exists (select 1 from uyeler) then return; end if;  -- boş veritabanı (CI, yerel kurulum)
  for u in
    select * from uyeler
    where md5(trim(regexp_replace(lower(translate(ad, 'ÇĞİIÖŞÜı', 'çğiiöşüi')), '\s+', ' ', 'g'))) = any (ozetler)
  loop
    bulunan := bulunan + 1;
    continue when exists (select 1 from muhasebe_hareketleri
                          where tur = 'gelir' and kategori = 'Aidat' and aciklama = 'Aidat · ' || u.ad);
    select * into d from dekontlar where uye_id = u.id and durum <> 'reddedildi' order by odeme_tarihi desc, id desc limit 1;
    if d.id is not null then
      insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
        values (d.odeme_tarihi, 'gelir', d.tutar, 'banka', 'Aidat', 'Aidat · ' || u.ad, 'dekont:' || d.id, true, 'havale');
    else
      select * into o from odemeler where uye_id = u.id order by tarih desc, id desc limit 1;
      if o.id is null then raise exception 'Üye #% için dekont ya da ödeme kaydı yok; hiçbir şey yazılmadı.', u.id; end if;
      insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
        values (o.tarih, 'gelir', o.tutar, 'banka', 'Aidat', 'Aidat · ' || u.ad, coalesce(o.ref, 'odeme:' || o.id), true, o.yol);
    end if;
  end loop;
  if bulunan <> 3 then raise exception '3 üye bekleniyordu, % bulundu; hiçbir şey yazılmadı.', bulunan; end if;

  select coalesce(sum(case when tur = 'gelir' and kasa = 'banka' then tutar
                           when tur = 'gider' and kasa = 'banka' then -tutar
                           when tur = 'aktarim' then (case when hedef_kasa = 'banka' then tutar else 0 end)
                                                     - (case when kasa = 'banka' then tutar else 0 end)
                           else 0 end), 0)
    into banka from muhasebe_hareketleri;
  if banka <> 9000 then raise exception 'Banka % TL olurdu, 9.000 TL bekleniyordu; hiçbir şey yazılmadı.', banka; end if;
end $$;
