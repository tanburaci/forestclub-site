-- Forest Club Urla: ana site (27.10.2026). Etkinliklerin sitede görünen açıklaması ve bağlantısı; ziyaretçinin üyelik
-- başvurusu ve tanışma bileti sunucuda kurala bağlanır (ziyaretçi tabloya doğrudan yazamaz, yalnız bu işlevler).

alter table etkinlikler add column aciklama text, add column link text;

-- Üyelik başvurusu. Dönüş: 'tamam' | 'kayitli' (bu e-postayla kayıt zaten var)
create or replace function public.basvuru_yap(p_ad text, p_eposta text, p_tel text,
                                              p_kosul boolean, p_dogal boolean, p_kvkk boolean)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  ad text := trim(p_ad);
  yeni_id bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  if not (p_kosul and p_dogal and p_kvkk) then raise exception 'Devam etmek için üç metni de onayla.'; end if;
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  insert into uyeler (kod, ad, eposta, tel, durum, basvuru_tarihi, nereden_duydu)
    values ('FC-U-' || lpad((coalesce((select max(id) from uyeler), 0) + 1)::text, 4, '0'), ad, ep,
            left(trim(p_tel), 30), 'basvuru', istanbul_bugun(), 'Site başvurusu')
    returning id into yeni_id;
  return 'tamam';
end $$;

-- Tanışma bileti: hiç üye olmamış e-postaya, seçilen yaklaşan buluşma için bir kez.
-- Dönüş: 'verildi' | 'uye' (zaten üye ya da üyeydi) | 'kullanilmis' (bu e-postayla bilet alınmış)
create or replace function public.tanisma_bileti_al(p_ad text, p_eposta text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  e etkinlikler;
begin
  if length(trim(p_ad)) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  select * into e from etkinlikler where id = p_etkinlik;
  if e.id is null or e.tarih < istanbul_bugun() then raise exception 'Bu buluşma için bilet alınamıyor.'; end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then return 'uye'; end if;
  if exists (select 1 from tanisma_biletleri where lower(eposta) = ep) then return 'kullanilmis'; end if;
  insert into tanisma_biletleri (ad, eposta, alinis, etkinlik_id, durum) values (trim(p_ad), ep, istanbul_bugun(), e.id, 'bekliyor');
  return 'verildi';
end $$;

revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean) from public;
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from public;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.tanisma_bileti_al(text, text, bigint) to anon, authenticated;

-- Demo etkinliklerinin site açıklamaları (sitedeki listeden)
update etkinlikler set aciklama = 'Fruma Table ile fine casual sunset bites, Taylan Aktuğ ile Rhythm Lab ve drum circle, DJ Jamie S.', link = 'https://www.instagram.com/forestcluburla/' where tarih = '2026-09-11' and ad = 'Sunset Club';
update etkinlikler set aciklama = 'Om Yoga Stüdyo × Forest Club, Urla.', link = 'https://www.instagram.com/forestcluburla/' where tarih = '2026-09-12' and ad = 'Tai Chi Günleri';
update etkinlikler set aciklama = 'Fruma Table ile fine casual sunset bites, Tayga Live Set (Mehmet Denizci), Elif Bilgen ile orman banyosu.', link = 'https://www.instagram.com/p/DeMtTC7D_9H/' where tarih = '2026-09-27' and ad = 'Sunset Club';
update etkinlikler set aciklama = '09.30 Body Sculpt (Merve Bircan) · 10.30 kahve molası · 11.00 Rhythm Lab (Taylan Aktuğ) · 12.00 ağaçların altında brunch.', link = 'https://www.instagram.com/p/Dd05NIvM9Ec/' where tarih = '2026-09-30' and ad = 'Breakfast Club';
update etkinlikler set aciklama = 'Duygu İşcan ile.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-06' and ad = 'Vinyasa Yoga';
update etkinlikler set aciklama = 'Hürriyet Keskin ile.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-06' and ad = 'Yin Yoga';
update etkinlikler set aciklama = 'Deniz Öngeç ile.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-07' and ad = 'Forest Yoga';
update etkinlikler set aciklama = 'Aslı Albayrak ile.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-08' and ad = 'Hatha Yoga';
update etkinlikler set aciklama = 'Şule Kunak ile seramik atölyesi.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-08' and ad = 'Clay & Create Seramik';
update etkinlikler set aciklama = 'Pizza Sunset Club: DJ Sivo ile scratch atölyesi, DJ Gasm müzik, akşam boyu pizza. Biletler Biletinial’da.', link = 'https://www.instagram.com/p/DeFDnS5DKWB/' where tarih = '2026-10-09' and ad = 'Sunset Club × Subkult';
update etkinlikler set aciklama = 'A Forest Club Gathering · Forest Club Urla, Pinya. Kontenjan sınırlı.', link = 'https://www.instagram.com/reel/De0pra3EXUJ/' where tarih = '2026-10-24' and ad = 'The Common Table';
update etkinlikler set aciklama = 'Örnek etkinlik (demo).', link = null where tarih = '2026-10-26' and ad = 'Breakfast Club';
update etkinlikler set aciklama = 'Örnek etkinlik (demo).', link = null where tarih = '2026-11-02' and ad = 'Sunset Club';
update etkinlikler set aciklama = 'Örnek atölye (demo). Malzeme dahil.', link = null where tarih = '2026-11-07' and ad = 'Seramik Atölyesi';
update etkinlikler set aciklama = 'Örnek ders (demo). Matını getir; yedek mat var.', link = null where tarih = '2026-11-09' and ad = 'Vinyasa Yoga';
update etkinlikler set aciklama = 'Örnek etkinlik (demo). Canlı müzik ve gün batımı ikramı.', link = null where tarih = '2026-11-14' and ad = 'Sunset Club';
update etkinlikler set aciklama = 'Örnek ders (demo). Rahat kıyafet yeterli.', link = null where tarih = '2026-11-16' and ad = 'Tai Chi Sabahı';
update etkinlikler set aciklama = 'Örnek atölye (demo). Malzeme ve fırınlama dahil.', link = null where tarih = '2026-11-22' and ad = 'Clay & Create Seramik';
update etkinlikler set aciklama = 'Örnek etkinlik (demo).', link = null where tarih = '2026-11-30' and ad = 'Breakfast Club';
