-- Forest Club Urla · Açık Çağrı genel (pgTAP): son tarih yok, kısa açıklama kabul, eksik alan adıyla söylenir.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(4);

select is(cagri_gonder('{"ad":"Deniz Ses","iletisim":"0532 111 22 33","uye":"Evet","alan":"Ses ve müzik","baslik":"Ses","anlat":"Gong"}'), 'tamam',
  'kısa açıklamayla da gönderilir (son tarih yok)');
select throws_ok($$ select cagri_gonder('{"ad":"Deniz Ses","iletisim":"0532 111 22 33","uye":"Evet","alan":"","baslik":"Ses","anlat":"Gong"}') $$,
  'P0001', 'Çalışmanın alanını seç (en az bir tane).', 'eksik alan adıyla söylenir');
select throws_ok($$ select cagri_gonder('{"ad":"Deniz Ses","iletisim":"0532 111 22 33","uye":"","alan":"Ses","baslik":"Ses","anlat":"Gong"}') $$,
  'P0001', '"Forest Club üyesi misin?" sorusunu cevapla.', 'üyelik sorusu');
select ok(not has_function_privilege('anon', 'public.cagri_gonder(jsonb)', 'execute'), 'yalnız sunucudan (form-gonder)');

select * from finish();
rollback;
