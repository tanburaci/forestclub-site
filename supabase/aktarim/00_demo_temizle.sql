-- Forest Club Urla · Google Sheets aktarımı, 0. adım: deneme veritabanındaki DEMO verisini siler (seed_demo.sql).
-- Göçlerden SONRA, 02_aktar.sql'den ÖNCE ve yalnız bir kez çalıştırılır. Çalıştırmadan önce yedek alın.
--
-- Silinir: üyeler (ve giriş hesapları @ornek.com), ödemeler, etkinlik kayıtları, tanışma biletleri, muhasebe,
--          envanter, dekontlar, Açık Çağrı, sayaçlar, mail kuyruğu, form sayaçları, ödeme istekleri, dondurmalar,
--          anketler, veri talepleri, denetim kaydı; uydurma etkinlikler ("Örnek etkinlik / atölye / ders").
-- Kalır:   yöneticiler, e-posta şablonları, ayarlar ve kulübün gerçek geçmiş etkinlikleri (Instagram'dan; yoklama
--          ve anket sayıları sıfırlanır).
-- Üye kodları baştan başlar: Sheets'ten gelen ilk üye FC-U-0001 olur.
--
-- Güvenlik: veritabanında ornek.com dışında bir üye varsa (gerçek veri aktarılmış olabilir) hiçbir şey silmez.
-- Bu kişiler bilinçli olarak silinecekse önce şunu çalıştırın:  set fc.temizle_zorla = 'evet';

begin;

do $$
declare
  gercek int;
  ornekler text;
begin
  select count(*), string_agg(eposta, ', ' order by id) filter (where rn <= 10)
    into gercek, ornekler
    from (select id, eposta, row_number() over (order by id) as rn from public.uyeler where not public.demo_adres_mi(eposta)) x;
  if gercek > 0 and coalesce(current_setting('fc.temizle_zorla', true), '') <> 'evet' then
    raise exception 'Veritabanında demo olmayan % üye var (%). Gerçek veri silinmesin diye durdu; bunlar da silinecekse önce: set fc.temizle_zorla = ''evet'';',
      gercek, ornekler;
  end if;
end $$;

-- Üyeye ve etkinliğe bağlı her şey (truncate: denetim tetikleyicileri çalışmaz, sayaçlar baştan başlar)
truncate table
  public.etkinlik_kayitlari, public.tanisma_biletleri, public.odemeler, public.muhasebe_hareketleri, public.envanter,
  public.dekontlar, public.dekont_yuklemeleri, public.acik_cagri, public.sayaclar, public.eposta_kuyrugu,
  public.istek_sayaci, public.odeme_istekleri, public.uyelik_dondurmalari, public.anket_yanitlari,
  public.veri_talepleri, public.denetim_kaydi
  restart identity;

-- Üyeler ve demo giriş hesapları (yönetici hesaplarına dokunulmaz)
truncate table public.uyeler restart identity cascade;
delete from auth.users u
  where public.demo_adres_mi(u.email) and not exists (select 1 from public.yoneticiler y where y.user_id = u.id);
select setval('public.uye_kod_seq', 1, false);

-- Etkinlikler: uydurmalar silinir, gerçek geçmiş etkinliklerin demo sayıları sıfırlanır
delete from public.etkinlikler where kim in ('Örnek etkinlik', 'Örnek atölye', 'Örnek ders');
update public.etkinlikler set satilan_bilet = 0, anket_sayisi = 0, anket_ortalama = null;

-- Sonuç
do $$
begin
  raise notice 'Kalan: % üye, % etkinlik, % yönetici, % e-posta şablonu, % ayar',
    (select count(*) from public.uyeler), (select count(*) from public.etkinlikler), (select count(*) from public.yoneticiler),
    (select count(*) from public.eposta_sablonlari), (select count(*) from public.ayarlar);
end $$;

commit;
