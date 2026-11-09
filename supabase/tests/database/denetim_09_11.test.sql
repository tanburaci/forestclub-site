-- Forest Club Urla · 09.11.2026 denetim düzeltmeleri (pgTAP): eksik kart ödemesi, shopier belgesi, tek tip başvuru
-- yanıtı, indirim kodunda IP başına sayaç, KVKK rıza kaydı
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e9', 'dn-yon@test.invalid');
insert into yoneticiler (user_id, ad) values ('00000000-0000-4000-8000-0000000000e9', 'DN Yönetici');

-- ---------- Üyelik kart ödemesi: eksik tutar ----------
insert into ayarlar (anahtar, deger) values ('kart_odeme', 'true') on conflict (anahtar) do update set deger = 'true';
insert into uyeler (kod, ad, eposta, tel, durum) values (yeni_uye_kodu(), 'Eksik Öder', 'eksik-dn@test.invalid', '05321110001', 'basvuru');
create temp table t_u as select uyelik_kart_ac('eksik-dn@test.invalid') as r;
select odeme_istegi_token((select r ->> 'id' from t_u)::uuid, 'urun-dn-1');
select is((select odeme_tamamla('urun-dn-1', 'SIP-DN-1', 1, 0) ->> 'durum'), 'eksik', 'eksik tutar hata vermez, eksik döner');
select ok((select bitis is null from uyeler where eposta = 'eksik-dn@test.invalid')
  and (select durum = 'basarisiz' and hata like 'Eksik ödeme%' from odeme_istekleri where token = 'urun-dn-1'), 'üyelik uzamadı, kayıt eksik ödeme olarak kaldı');
select is((select count(*) from eposta_kuyrugu where alici = 'dn-yon@test.invalid' and sablon = 'saglik')::int, 1, 'yöneticiye iade uyarısı gitti');
select is((select odeme_tamamla('urun-dn-1', 'SIP-DN-1', 1, 0) ->> 'tekrar'), 'true', 'aynı bildirim tekrar gelince yine eksik, çift uyarı yok');
select lives_ok(format($$ select odeme_tamamla('urun-dn-1', 'SIP-DN-2', %s, 0) $$, (select r ->> 'tutar' from t_u)), 'tam ödeme (yeni sipariş) işlenir');
select is((select count(*) from muhasebe_hareketleri where belge = 'shopier:SIP-DN-2' and kategori = 'Aidat')::int, 1, 'aidat geliri shopier belgesiyle');

-- ---------- Tek tip başvuru yanıtı ----------
select is(basvuru_yap('Eksik Öder', 'EKSIK-dn@test.invalid', '05321110001', true, true, true), 'tamam', 'kayıtlı e-postayla başvuruda da yanıt "tamam"');
select ok((select count(*) from uyeler where eposta = 'eksik-dn@test.invalid') = 1
  and (select count(*) from eposta_kuyrugu where alici = 'eksik-dn@test.invalid' and sablon = 'zaten_kayitli') = 1, 'yeni kayıt açılmadı; "zaten kaydın var" maili');
select is(basvuru_yap('Yeni Kişi', 'yeni-dn@test.invalid', '05321110002', true, true, true, true), 'tamam', 'yeni başvuru');

-- ---------- KVKK rıza kaydı ----------
select is((select string_agg(tur, ',' order by tur) from riza_kayitlari where eposta = 'yeni-dn@test.invalid'), 'dogal,foto,kosul,kvkk', 'başvuruda dört onay kaydedildi');
select is((select distinct metin_surumu from riza_kayitlari where eposta = 'yeni-dn@test.invalid'), riza_metin_surumu(), 'metin sürümü yazıldı');

-- ---------- İndirim kodu: IP başına sayaç ----------
select set_config('request.headers', '{"cf-connecting-ip": "203.0.113.7"}', true);
insert into indirim_denemeleri (ip, at) select istemci_ip_ozeti(), now() from generate_series(1, 30);
select throws_ok($$ select indirim_kodu_bak('YOKBOYLE') $$, 'P0001', 'Çok fazla deneme yapıldı; birkaç dakika sonra tekrar dene.', 'aynı IP 30 hatadan sonra kilitlenir');
select set_config('request.headers', '{"cf-connecting-ip": "198.51.100.9"}', true);
select is(indirim_kodu_bak('YOKBOYLE')::text, '{"gecerli": false}', 'başka IP etkilenmez');
select ok(not has_function_privilege('anon', 'public.indirim_kodu_durum_(text)', 'execute')
  and not has_function_privilege('anon', 'public.tanisma_kartlari_ekle(text)', 'execute'), 'iç denetim ve kart yükleme ziyaretçiye kapalı');

select * from finish();
rollback;
