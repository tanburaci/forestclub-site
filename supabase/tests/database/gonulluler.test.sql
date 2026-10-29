-- Forest Club Urla · gönüllü başvuruları (pgTAP).
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(6);

select is(gonullu_kaydet('Gönüllü Test', 'gonullu-t@test.invalid', '05320000000', array['Mutfak / ikram', 'Karşılama'], 'Hafta sonları', true), 'tamam', 'gönüllü kaydedildi');
select is((select alanlar::text from gonulluler where eposta = 'gonullu-t@test.invalid'), '{"Mutfak / ikram",Karşılama}', 'alanlar yazıldı');
select is((select count(*) from eposta_kuyrugu where alici = 'gonullu-t@test.invalid' and sablon = 'gonullu')::int, 1, 'teşekkür maili sırada');
select throws_ok($$ select gonullu_kaydet('Gönüllü Test', 'gonullu-t2@test.invalid', null, '{}', null, false) $$, 'P0001', null, 'KVKK onayı olmadan kaydedilmez');
select ok(not has_function_privilege('anon', 'public.gonullu_kaydet(text,text,text,text[],text,boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.gonullu_kaydet(text,text,text,text[],text,boolean)', 'execute'), 'yalnız sunucu (form-gonder) çağırır');
set local role anon;
select throws_ok($$ select count(*) from gonulluler $$, '42501', null, 'ziyaretçi gönüllü listesini göremez');
reset role;

select * from finish();
rollback;
