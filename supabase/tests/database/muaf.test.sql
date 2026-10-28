-- Forest Club Urla · aidattan muaf üye testleri (pgTAP). Çalıştırma: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(7);

insert into uyeler (kod, ad, eposta, durum, bitis) values
  ('FC-T-9001', 'Muaf Test', 'muaf@test.invalid', 'doldu', istanbul_bugun() - 5),
  ('FC-T-9002', 'Başvuru Test', 'basvuru-muaf@test.invalid', 'basvuru', null);

update uyeler set aidat_muaf = true where kod in ('FC-T-9001', 'FC-T-9002');
select is((select bitis from uyeler where kod = 'FC-T-9001'), date '2099-12-31', 'muaf üyenin bitişi 31.12.2099');
select is((select durum::text from uyeler where kod = 'FC-T-9001'), 'aktif', 'süresi dolmuş muaf üye aktif oldu');
select ok((select baslangic is not null and durum = 'aktif' from uyeler where kod = 'FC-T-9002'), 'hiç ödememiş muaf üye aktif, başlangıç yazıldı');

-- Muafken bitiş başka bir şeye çekilemez (ör. elden ödeme ya da dondurma bitişi uzatsa da)
update uyeler set bitis = istanbul_bugun() + 10 where kod = 'FC-T-9001';
select is((select bitis from uyeler where kod = 'FC-T-9001'), date '2099-12-31', 'muafken bitiş sabit kalır');

-- Gece işi süresi dolanları "doldu" yapar; muaf üyeye dokunmaz
update uyeler set durum = 'doldu' where durum = 'aktif' and (bitis is null or bitis <= istanbul_bugun()) and kod like 'FC-T-900%';
select is((select durum::text from uyeler where kod = 'FC-T-9001'), 'aktif', 'muaf üye süresi doldu sayılmaz');

update uyeler set aidat_muaf = false where kod = 'FC-T-9001';
select is((select bitis from uyeler where kod = 'FC-T-9001'), istanbul_bugun() + 30, 'muafiyet kalkınca bugünden 30 gün');
select is((select durum::text from uyeler where kod = 'FC-T-9001'), 'aktif', 'muafiyet kalkınca aktif');

select * from finish();
rollback;
