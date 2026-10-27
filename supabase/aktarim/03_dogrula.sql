-- Forest Club Urla · Google Sheets aktarımı, 3. adım: doğrulama. Veriye dokunmaz (yalnız aktarim şemasında bir görünüm
-- açar); her sorgu bir tablo döndürür.
-- "fark" sütunu 0 değilse ya da liste boş değilse o satırlara Sheets'te bakın.

-- 1. Sayılar: Sheets'teki satır, aktarılan, sorunlu
select 'Üyeler' as sayfa,
       (select count(*) from aktarim.ham where sayfa = 'uyeler') as sheets_satiri,
       (select count(*) from public.uyeler where eposta in (select lower(aktarim.al(veri, 'e_posta', 'eposta', 'e_posta_adresi', 'email', 'e_mail', 'mail'))
                                                           from aktarim.ham where sayfa = 'uyeler')) as aktarilan,
       (select count(distinct satir) from aktarim.sorunlar where sayfa = 'uyeler' and (aciklama like '%aktarılmadı%' or aciklama like 'Aynı e-posta%')) as atlanan
union all
select 'Dekontlar', (select count(*) from aktarim.ham where sayfa = 'dekontlar'),
       (select count(*) from public.dekontlar where kaynak like 'sheets:%'),
       (select count(*) from aktarim.sorunlar where sayfa = 'dekontlar' and aciklama like '%aktarılmadı%')
union all
select 'Açık Çağrı', (select count(*) from aktarim.ham where sayfa = 'acik_cagri'),
       (select count(*) from public.acik_cagri where kaynak like 'sheets:%'), 0;

-- 2. Sorunlu satırlar (satır numarası Sheets'teki satır)
select sayfa, satir, alan, deger, aciklama from aktarim.sorunlar order by sayfa, satir;

-- Atlanan Sheets satırları (e-postasız ya da aynı e-postanın ikinci satırı) aşağıdaki karşılaştırmalara girmez
create or replace view aktarim.uye_satirlari as
select h.* from aktarim.ham h
where h.sayfa = 'uyeler' and not exists (select 1 from aktarim.sorunlar s where s.sayfa = 'uyeler' and s.satir = h.satir
                                         and (s.aciklama like '%aktarılmadı%' or s.aciklama like 'Aynı e-posta%'));

-- 3. Durum karşılaştırması: Sheets'teki "Durum" ile yeni sistemin bitişten hesapladığı durum
with s as (
  select lower(aktarim.al(veri, 'e_posta', 'eposta', 'e_posta_adresi', 'email', 'e_mail', 'mail')) as eposta,
         aktarim.al(veri, 'durum') as sheets_durum, satir
  from aktarim.uye_satirlari
)
select s.satir, u.ad, u.eposta, s.sheets_durum, u.durum as yeni_durum, u.bitis
from s join public.uyeler u on u.eposta = s.eposta
where case
        when lower(coalesce(s.sheets_durum, '')) ~ 'dondur' then 'donduruldu'
        when lower(coalesce(s.sheets_durum, '')) ~ '(aktif|devam)' then 'aktif'
        when lower(coalesce(s.sheets_durum, '')) ~ '(dol|bitti|sona|pasif|s[uü]resi)' then 'doldu'
        when lower(coalesce(s.sheets_durum, '')) ~ '(ba[sş]vuru|bekl|[oö]deme)' then 'basvuru'
        else u.durum::text
      end <> u.durum::text
order by s.satir;

-- 4. Durum sayıları (Sheets'teki özetle karşılaştırın)
select durum, count(*) as uye from public.uyeler group by durum order by durum;

-- 5. Bitişi Sheets'tekinden farklı olanlar (ilk aktarımda boş olmalı; sonra yeni sistemde uzatılanlar görünür)
select u.ad, u.eposta, aktarim.tarih(aktarim.al(h.veri, 'uyelik_bitisi', 'uyelik_bitis_tarihi', 'bitis', 'bitis_tarihi')) as sheets_bitis, u.bitis
from aktarim.uye_satirlari h join public.uyeler u on u.eposta = lower(aktarim.al(h.veri, 'e_posta', 'eposta', 'e_posta_adresi', 'email', 'e_mail', 'mail'))
where u.bitis is distinct from aktarim.tarih(aktarim.al(h.veri, 'uyelik_bitisi', 'uyelik_bitis_tarihi', 'bitis', 'bitis_tarihi'));

-- 6. Bitişi olup hiç ödemesi görünmeyen üyeler (Sheets'te ödeme onay tarihi boş)
select u.kod, u.ad, u.eposta, u.bitis from public.uyeler u
where u.bitis is not null and not exists (select 1 from public.odemeler o where o.uye_id = u.id)
order by u.bitis;

-- 7. Dekont durumları ve ödemeler
select d.durum, count(*) as dekont, count(o.id) as odeme_kaydi
from public.dekontlar d left join public.odemeler o on o.ref = 'sheets:dekont:' || d.id
where d.kaynak like 'sheets:%' group by d.durum order by d.durum;

-- 8. Fotoğraf/video izni dağılımı
select foto_izni, count(*) from public.uyeler group by foto_izni order by foto_izni;

-- 9. Üye kodları: hepsi dolu ve tekil, sayaç en büyük kodun arkasında
select count(*) as uye, count(distinct kod) as farkli_kod,
       max((substring(kod from '^FC-U-(\d+)$'))::int) as en_buyuk_kod,
       (select last_value from public.uye_kod_seq) as sayac
from public.uyeler;

-- 10. Sheets'te yenileme hatırlatması bu bitiş için gitmiş üyeler (yeni sistem aynı bitiş için yeniden göndermez)
select u.kod, u.ad, u.bitis, q.gonderim_at::date as sheets_hatirlatma
from public.eposta_kuyrugu q join public.uyeler u on u.id = q.uye_id
where q.son_hata = 'Sheets''ten gönderilmiş (aktarım)' order by u.bitis;
