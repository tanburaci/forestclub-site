-- Forest Club Urla · Google Sheets aktarımı, 2. adım: aktarim.ham'daki satırları üyelere, ödemelere, dekontlara ve
-- Açık Çağrı başvurularına yazar. Önce cikti/01_ham_veri.sql çalışmış olmalı (csv_sql.mjs üretir).
--
-- Tekrar çalıştırılabilir: üye e-postayla, dekont ve Açık Çağrı "kaynak" ile tanınır; ikinci çalıştırmada yeni satır
-- açılmaz, Sheets'teki değişiklikler işlenir. Yeni sistemde yapılanlar geri alınmaz: üyelik bitişi yalnız ileri gider,
-- yeni sistemde karar verilmiş dekont Sheets'e göre değişmez. Sorunlu satırlar aktarim.sorunlar'a yazılır, aktarım
-- durmaz. Hepsi tek işlem: bir hata olursa hiçbir şey yazılmaz. Supabase SQL Editor ifadeleri aynı oturumda
-- çalıştırmayabildiği için aktarım tek bir do bloğudur (ara tablolar blok içinde görünür).
--
-- Sheets'te olmayan ya da aktarılmayanlar: muhasebe hareketleri (Sheets'teki ödemeler aidat gelirine ayrıca yazılmaz),
-- KVKK onay zamanı, üye kodu (sırayla yeni kod verilir).

do $aktar$
begin

create schema if not exists aktarim;
create table if not exists aktarim.ham (sayfa text not null, satir int not null, veri jsonb not null, primary key (sayfa, satir));
create table if not exists aktarim.sorunlar (sayfa text, satir int, alan text, deger text, aciklama text);
truncate aktarim.sorunlar;

if exists (select 1 from public.uyeler where public.demo_adres_mi(eposta)) then
  raise exception 'Veritabanında demo verisi (ornek.com) var. Aktarım boş, gerçek veritabanına yapılır.';
end if;
if not exists (select 1 from aktarim.ham where sayfa = 'uyeler') then
  raise exception 'Üyeler sayfası yüklenmemiş: önce cikti/01_ham_veri.sql çalıştırın.';
end if;

-- Üyelik aidatı (Sheets'te tutar yoksa)
create or replace function aktarim.aidat() returns numeric language sql immutable as $$ select 3000::numeric $$;

-- Satırdaki ilk dolu sütun (aynı bilgi farklı sütun adlarıyla gelebilir)
create or replace function aktarim.al(v jsonb, variadic anahtarlar text[]) returns text language sql immutable as $$
  select nullif(trim(v ->> k), '') from unnest(anahtarlar) with ordinality as u(k, n)
  where nullif(trim(v ->> k), '') is not null order by n limit 1
$$;

-- Tarih: 27.10.2026 · 27/10/2026 · 27.10.26 · 2026-10-27 (arkasında saat olabilir). Gün önce (Türkiye biçimi).
create or replace function aktarim.tarih(t text) returns date language plpgsql immutable as $$
declare m text[];
begin
  if t is null or trim(t) = '' then return null; end if;
  m := regexp_match(t, '^\s*(\d{4})-(\d{1,2})-(\d{1,2})');
  if m is not null then return make_date(m[1]::int, m[2]::int, m[3]::int); end if;
  m := regexp_match(t, '^\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(\D|$)');
  if m is not null then
    return make_date(case when length(m[3]) = 2 then 2000 + m[3]::int else m[3]::int end, m[2]::int, m[1]::int);
  end if;
  return null;
exception when others then
  return null;
end $$;

-- Zaman damgası (İstanbul saati): "27.10.2026 14:05:33" ya da yalnız tarih
create or replace function aktarim.zaman(t text) returns timestamptz language plpgsql immutable as $$
declare
  g date := aktarim.tarih(t);
  s text[];
begin
  if g is null then return null; end if;
  s := regexp_match(t, '(\d{1,2}):(\d{2})(?::(\d{2}))?');
  return (g + make_time(coalesce(s[1]::int, 0), coalesce(s[2]::int, 0), coalesce(s[3]::int, 0)))::timestamp
         at time zone 'Europe/Istanbul';
exception when others then
  return null;
end $$;

-- Evet / hayır: "Evet", "Fotoğraf ve video çekilmesine izin veriyorum" → true; "Hayır", "İzin vermiyorum" → false;
-- tanınmayan → null (sorunlara yazılır, izin yok sayılır)
create or replace function aktarim.evet(t text) returns boolean language sql immutable as $$
  select case
    when t is null or trim(t) = '' then false
    when lower(t) ~ '(hay[iı]r|vermiyorum|istemiyorum|kabul etmiyorum|^\s*yok|false|^\s*0\s*$)' then false
    when lower(t) ~ '(evet|kabul|izin ver|onayl[iı]yorum|^\s*var|true|^\s*1\s*$|^\s*x\s*$|✓|✔)' then true
  end
$$;

-- Tutar: "3.000", "3.000,00 TL", "3000" → 3000
create or replace function aktarim.tutar(t text) returns numeric language plpgsql immutable as $$
declare s text := regexp_replace(coalesce(t, ''), '[^0-9,.]', '', 'g');
begin
  if s = '' then return null; end if;
  if s ~ ',\d{1,2}$' then s := replace(replace(s, '.', ''), ',', '.');
  else s := replace(replace(s, ',', ''), '.', '');
  end if;
  return nullif(s, '')::numeric;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Üyeler
drop table if exists aktarim.k_uye;
create table aktarim.k_uye as
select h.satir,
       aktarim.al(h.veri, 'ad_soyad', 'ad_soyadi', 'adi_soyadi', 'isim', 'ad') as ad,
       lower(aktarim.al(h.veri, 'e_posta', 'eposta', 'e_posta_adresi', 'email', 'e_mail', 'mail')) as eposta,
       left(aktarim.al(h.veri, 'telefon', 'telefon_numarasi', 'tel', 'telefon_no'), 30) as tel,
       aktarim.al(h.veri, 'basvuru_tarihi', 'zaman_damgasi') as basvuru_ham,
       aktarim.al(h.veri, 'odeme_onay_tarihi', 'onay_tarihi', 'odeme_tarihi') as onay_ham,
       aktarim.al(h.veri, 'uyelik_bitisi', 'uyelik_bitis_tarihi', 'bitis', 'bitis_tarihi') as bitis_ham,
       aktarim.al(h.veri, 'durum') as durum_ham,
       aktarim.al(h.veri, 'son_hatirlatma', 'son_hatirlatma_tarihi') as hatirlatma_ham,
       aktarim.al(h.veri, 'fotograf_video_izinleri', 'fotograf_video_izni', 'fotograf_izni', 'foto_izni') as foto_ham
from aktarim.ham h where h.sayfa = 'uyeler';

alter table aktarim.k_uye add column basvuru date, add column onay date, add column bitis date, add column hatirlatma date,
                  add column foto boolean, add column gecerli boolean not null default true;
update aktarim.k_uye set basvuru = aktarim.tarih(basvuru_ham), onay = aktarim.tarih(onay_ham), bitis = aktarim.tarih(bitis_ham),
                 hatirlatma = aktarim.tarih(hatirlatma_ham), foto = aktarim.evet(foto_ham);

insert into aktarim.sorunlar
select 'uyeler', satir, 'e_posta', eposta, 'E-posta yok ya da geçersiz: satır aktarılmadı' from aktarim.k_uye
  where eposta is null or eposta !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
union all select 'uyeler', satir, 'ad_soyad', ad, 'Ad yok: e-posta ad olarak yazıldı' from aktarim.k_uye where ad is null
union all select 'uyeler', satir, 'basvuru_tarihi', basvuru_ham, 'Tarih okunamadı' from aktarim.k_uye where basvuru_ham is not null and basvuru is null
union all select 'uyeler', satir, 'odeme_onay_tarihi', onay_ham, 'Tarih okunamadı' from aktarim.k_uye where onay_ham is not null and onay is null
union all select 'uyeler', satir, 'uyelik_bitisi', bitis_ham, 'Tarih okunamadı' from aktarim.k_uye where bitis_ham is not null and bitis is null
union all select 'uyeler', satir, 'son_hatirlatma', hatirlatma_ham, 'Tarih okunamadı' from aktarim.k_uye where hatirlatma_ham is not null and hatirlatma is null
union all select 'uyeler', satir, 'fotograf_video_izinleri', foto_ham, 'Anlaşılamadı: izin yok sayıldı' from aktarim.k_uye where foto is null;
update aktarim.k_uye set gecerli = false where eposta is null or eposta !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
update aktarim.k_uye set foto = false where foto is null;

-- Aynı e-posta birden çok satırda: bitişi en ileri olan (eşitse en alttaki) kalır
insert into aktarim.sorunlar
select 'uyeler', k.satir, 'e_posta', k.eposta, 'Aynı e-posta başka satırda da var: bu satır atlandı (satır ' || s.satir || ' kaldı)'
from aktarim.k_uye k
join lateral (select x.satir from aktarim.k_uye x where x.eposta = k.eposta and x.gecerli
              order by x.bitis desc nulls last, x.satir desc limit 1) s on true
where k.gecerli and s.satir <> k.satir;
update aktarim.k_uye k set gecerli = false
where k.gecerli and exists (select 1 from aktarim.sorunlar s where s.sayfa = 'uyeler' and s.satir = k.satir and s.aciklama like 'Aynı e-posta%');

-- Var olanlar: Sheets'e göre güncellenir; bitiş yalnız ileri gider (yeni sistemde uzatılan geri alınmaz)
update public.uyeler u set
  ad = coalesce(k.ad, u.ad),
  tel = coalesce(k.tel, u.tel),
  basvuru_tarihi = coalesce(u.basvuru_tarihi, k.basvuru),
  bitis = greatest(u.bitis, k.bitis),
  foto_izni = k.foto
from aktarim.k_uye k where k.gecerli and u.eposta = k.eposta;

-- Yeniler: kod sayaçtan, başvuru sırasıyla
insert into public.uyeler (ad, eposta, tel, durum, basvuru_tarihi, bitis, foto_izni, nereden_duydu)
select coalesce(k.ad, k.eposta), k.eposta, k.tel, 'basvuru', coalesce(k.basvuru, k.onay), k.bitis, k.foto, 'Sheets aktarımı'
from aktarim.k_uye k
where k.gecerli and not exists (select 1 from public.uyeler u where u.eposta = k.eposta)
order by coalesce(k.basvuru, k.onay, k.bitis - 30), k.satir;

-- ---------------------------------------------------------------------------------------------------------------
-- Dekontlar
drop table if exists aktarim.k_dekont;
create table aktarim.k_dekont as
select h.satir,
       lower(aktarim.al(h.veri, 'e_posta', 'eposta', 'e_posta_adresi', 'email', 'e_mail', 'mail')) as eposta,
       aktarim.al(h.veri, 'ad_soyad', 'ad_soyadi', 'adi_soyadi', 'isim', 'ad') as ad,
       aktarim.al(h.veri, 'zaman_damgasi', 'tarih', 'gonderim_tarihi', 'yukleme_tarihi', 'yuklenme') as zaman_ham,
       aktarim.al(h.veri, 'odeme_tarihi', 'dekont_tarihi', 'zaman_damgasi', 'tarih') as odeme_ham,
       aktarim.al(h.veri, 'karar_tarihi', 'onay_tarihi', 'sonuc_tarihi') as karar_ham,
       aktarim.al(h.veri, 'tutar', 'miktar', 'odenen_tutar') as tutar_ham,
       aktarim.al(h.veri, 'dekont', 'dosya', 'dekont_dosyasi', 'dekont_linki', 'dosya_linki', 'link', 'dekont_yukle', 'drive') as dosya,
       aktarim.al(h.veri, 'durum', 'onay', 'sonuc_durumu') as durum_ham,
       aktarim.al(h.veri, 'sonuc', 'islendi', 'not', 'notlar', 'aciklama', 'red_gerekcesi') as sonuc
from aktarim.ham h where h.sayfa = 'dekontlar';

alter table aktarim.k_dekont add column uye_id bigint, add column durum dekont_durum, add column kaynak text;
update aktarim.k_dekont k set
  uye_id = (select id from public.uyeler u where u.eposta = k.eposta),
  -- "Onay" onay kutusu ise TRUE / FALSE gelir
  durum = case when lower(coalesce(k.durum_ham, '')) ~ 'red' then 'reddedildi'
               when lower(coalesce(k.durum_ham, '')) ~ '^\s*(true|evet|x|✓|✔)\s*$' then 'onaylandi'
               when lower(coalesce(k.durum_ham, '')) ~ '(onay|kabul|tamam)' and lower(k.durum_ham) !~ 'bekl' then 'onaylandi'
               else 'bekliyor' end::dekont_durum,
  kaynak = 'sheets:dekont:' || md5(coalesce(k.eposta, '') || '|' || coalesce(k.dosya, '') || '|' || coalesce(k.zaman_ham, ''));

insert into aktarim.sorunlar
select 'dekontlar', satir, 'e_posta', eposta, 'Bu e-postayla üye yok: dekont aktarılmadı' from aktarim.k_dekont where uye_id is null
union all select 'dekontlar', satir, 'dekont', dosya, 'Dosya bağlantısı https değil ya da yok' from aktarim.k_dekont
  where uye_id is not null and coalesce(dosya, '') !~ '^https://'
union all select 'dekontlar', satir, 'tutar', tutar_ham, 'Tutar okunamadı: ' || aktarim.aidat() || ' yazıldı' from aktarim.k_dekont
  where uye_id is not null and tutar_ham is not null and aktarim.tutar(tutar_ham) is null;

-- Yeni sistemde henüz karar verilmemiş olanlar Sheets'e göre güncellenir
insert into public.dekontlar (uye_id, eposta, ad, odeme_tarihi, tutar, dosya, durum, sonuc, karar_at, created_at, kaynak)
select k.uye_id, k.eposta, coalesce(k.ad, u.ad), coalesce(aktarim.tarih(k.odeme_ham), aktarim.tarih(k.zaman_ham), current_date),
       coalesce(aktarim.tutar(k.tutar_ham), aktarim.aidat()), coalesce(k.dosya, 'sheets: dosya yok'), k.durum, k.sonuc,
       -- karar zamanı: ayrı sütun, yoksa Sonuç'un başındaki tarih ("03.09.2026 · bitiş 03.10.2026"), yoksa gönderim
       case when k.durum <> 'bekliyor' then coalesce(aktarim.zaman(k.karar_ham), aktarim.zaman(k.sonuc), aktarim.zaman(k.zaman_ham)) end,
       coalesce(aktarim.zaman(k.zaman_ham), now()), k.kaynak
from aktarim.k_dekont k join public.uyeler u on u.id = k.uye_id
on conflict (kaynak) do update set
  durum = excluded.durum, sonuc = excluded.sonuc, karar_at = excluded.karar_at, tutar = excluded.tutar
  where public.dekontlar.durum = 'bekliyor' and public.dekontlar.karar_veren is null;

-- ---------------------------------------------------------------------------------------------------------------
-- Ödemeler: onaylı her dekont bir ödeme; Üyeler'deki "Ödeme onay tarihi" ±7 gün içinde ödeme yoksa ayrıca bir ödeme
insert into public.odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
select d.uye_id, coalesce(d.karar_at at time zone 'Europe/Istanbul', d.odeme_tarihi)::date, d.tutar, 'havale', 'Sheets · dekont onayı',
       'sheets:dekont:' || d.id
from public.dekontlar d where d.kaynak like 'sheets:%' and d.durum = 'onaylandi'
on conflict (ref) do nothing;

insert into public.odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
select u.id, k.onay, aktarim.aidat(), 'havale', 'Sheets · ödeme onayı', 'sheets:uye:' || u.id || ':' || k.onay
from aktarim.k_uye k join public.uyeler u on u.eposta = k.eposta
where k.gecerli and k.onay is not null
  and not exists (select 1 from public.odemeler o where o.uye_id = u.id and o.tarih between k.onay - 7 and k.onay + 7)
on conflict (ref) do nothing;

-- Başlangıç = ilk ödeme; durum bitişten (Sheets'te "dondur" yazıyorsa donduruldu)
update public.uyeler u set baslangic = least(u.baslangic, (select min(o.tarih) from public.odemeler o where o.uye_id = u.id))
from aktarim.k_uye k where k.gecerli and u.eposta = k.eposta;
update public.uyeler u set durum = case
    when lower(coalesce(k.durum_ham, '')) ~ 'dondur' then 'donduruldu'
    when u.bitis > public.istanbul_bugun() then 'aktif'
    when u.bitis is not null then 'doldu'
    else 'basvuru' end::uye_durum
from aktarim.k_uye k where k.gecerli and u.eposta = k.eposta;

-- Sheets'te yenileme hatırlatması bu bitiş için zaten gittiyse yeni sistem ikinci kez göndermez
insert into public.eposta_kuyrugu (sablon, alici, uye_id, veri, tekil, durum, son_hata, gonderim_at)
select 'yenileme', u.eposta, u.id, jsonb_build_object('ad', u.ad, 'bitis', to_char(u.bitis, 'DD.MM.YYYY')),
       'yenileme:' || u.id || ':' || u.bitis, 'gonderildi', 'Sheets''ten gönderilmiş (aktarım)', k.hatirlatma::timestamptz
from aktarim.k_uye k join public.uyeler u on u.eposta = k.eposta
where k.gecerli and k.hatirlatma is not null and u.bitis is not null and k.hatirlatma >= u.bitis - 7
on conflict (tekil) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- Açık Çağrı başvuruları (sütun adları sitedeki formun soruları ya da kısa adları)
insert into public.acik_cagri (ad, iletisim, uye, alan, baslik, anlatim, deneyim, sure, kisi, ihtiyac, gunler, durum, notlar, created_at, kaynak)
select coalesce(c.ad, ''), coalesce(c.iletisim, ''), coalesce(c.uye, ''), coalesce(c.alan, ''), coalesce(c.baslik, ''), coalesce(c.anlatim, ''),
       c.deneyim, c.sure, c.kisi, c.ihtiyac, c.gunler, coalesce(c.durum, 'Yeni'), c.notlar, coalesce(aktarim.zaman(c.zaman_ham), now()),
       -- zaman damgası yoksa satır numarası (o durumda Sheets'te satırların yeri değişmemeli)
       'sheets:cagri:' || md5(coalesce(c.zaman_ham, 'satir ' || c.satir) || '|' || coalesce(c.iletisim, '') || '|' || coalesce(c.baslik, ''))
from (
  select h.satir,
         aktarim.al(h.veri, 'zaman_damgasi', 'tarih', 'gonderim_tarihi') as zaman_ham,
         aktarim.al(h.veri, 'adin_ve_soyadin', 'ad_soyad', 'adi_soyadi', 'ad') as ad,
         aktarim.al(h.veri, 'e_posta_veya_telefon_numaran', 'iletisim', 'e_posta', 'telefon') as iletisim,
         aktarim.al(h.veri, 'forest_club_uyesi_misin', 'uye', 'uye_mi', 'uyelik') as uye,
         aktarim.al(h.veri, 'calisman_hangi_alanda', 'alan') as alan,
         aktarim.al(h.veri, 'atolyenin_veya_bulusmanin_adi', 'atolye_bulusma_adi', 'baslik', 'atolye_adi', 'bulusma_adi') as baslik,
         aktarim.al(h.veri, 'bize_biraz_anlatir_misin', 'anlatim', 'anlat', 'aciklama') as anlatim,
         aktarim.al(h.veri, 'daha_once_bu_calismayi_gerceklestirdin_mi', 'daha_once_yapti_mi', 'deneyim') as deneyim,
         aktarim.al(h.veri, 'bulusma_ne_kadar_surer', 'sure') as sure,
         aktarim.al(h.veri, 'kac_kisiyle_gerceklestirmek_istersin', 'kisi', 'kisi_sayisi') as kisi,
         aktarim.al(h.veri, 'ihtiyac_duydugun_malzemeler_veya_alan_var_mi', 'malzeme_alan_ihtiyaci', 'ihtiyac', 'malzemeler') as ihtiyac,
         aktarim.al(h.veri, 'kasim_ayinda_hangi_gunler_uygunsun', 'gunler', 'uygun_gunler') as gunler,
         aktarim.al(h.veri, 'durum') as durum,
         aktarim.al(h.veri, 'notlar', 'not') as notlar
  from aktarim.ham h where h.sayfa = 'acik_cagri'
) c
on conflict (kaynak) do update set durum = excluded.durum, notlar = excluded.notlar;

insert into aktarim.sorunlar
select 'acik_cagri', h.satir, 'iletisim', null, 'İletişim bilgisi yok'
from aktarim.ham h where h.sayfa = 'acik_cagri'
  and aktarim.al(h.veri, 'e_posta_veya_telefon_numaran', 'iletisim', 'e_posta', 'telefon') is null;

-- Ara tablolar
drop table aktarim.k_uye, aktarim.k_dekont;

end $aktar$;

select sayfa, count(*) as sorun from aktarim.sorunlar group by sayfa order by sayfa;
