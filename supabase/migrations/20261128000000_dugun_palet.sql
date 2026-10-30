-- Forest Club Urla: düğün renk paleti, his ve özel davet bağlantısı (28.11.2026). Sihirbaza "Renkler ve his" adımı: hazır paletlerden biri ya da
-- çiftin kendi renkleri (en çok 5) ve düğünün hissi (en çok 3: doğal, romantik, bohem…). Son adımda mood board: konsept,
-- palet, his ve seçilen detaylar bir arada. Paletler katalogda (tur 'palet', renkler #rrggbb), yönetimden düzenlenir.
alter table public.dugun_katalog drop constraint if exists dugun_katalog_tur_check;
alter table public.dugun_katalog add constraint dugun_katalog_tur_check check (tur in ('mekan', 'bolum', 'menu', 'konsept', 'urun', 'ekstra', 'palet', 'his'));
alter table public.dugun_katalog add column if not exists renkler text[];
alter table public.dugun_katalog drop constraint if exists dugun_katalog_renkler_check;
alter table public.dugun_katalog add constraint dugun_katalog_renkler_check
  check (renkler is null or (cardinality(renkler) between 1 and 6 and array_to_string(renkler, ',') ~ '^#[0-9a-f]{6}(,#[0-9a-f]{6})*$'));

insert into public.dugun_katalog (tur, ad, aciklama, renkler, sira)
select v.tur, v.ad, v.aciklama, v.renkler, v.sira from (values
  ('palet', 'Zeytin ve krem', 'Zeytinliklerin yeşili, krem ve sıcak kil tonu.', array['#6b7048', '#a3a77f', '#efe6d2', '#c98b6b', '#f8f4ec']::text[], 1),
  ('palet', 'Adaçayı ve toz mavi', 'Yumuşak, ferah ve yaz akşamına uygun.', array['#9caf88', '#b8c9d9', '#7e95ab', '#f2efe8', '#d8cbb4']::text[], 2),
  ('palet', 'Terrakota gün batımı', 'Kiremit, şeftali ve zeytin yeşili; sıcak ve bohem.', array['#c9825f', '#e3b48f', '#8c4a35', '#f4e3d0', '#6e7a4e']::text[], 3),
  ('palet', 'Lavanta bahçesi', 'Lila tonları, yeşillik ve altın dokunuş.', array['#a99bc7', '#d9d0ea', '#7f8c6a', '#f6f2ea', '#c8a15a']::text[], 4),
  ('palet', 'Ege mavisi', 'Denizin mavisi, beyaz ve kum rengi.', array['#2f5d8a', '#8fb3d1', '#ffffff', '#e9e4d8', '#c8a15a']::text[], 5),
  ('palet', 'Şampanya ve altın', 'Zarif, ışıltılı ve zamansız.', array['#e9d8b8', '#c8a15a', '#fffdf8', '#b9aa8c', '#6b5b45']::text[], 6),
  ('palet', 'Pudra ve okaliptüs', 'Romantik pembe, okaliptüs yeşili ve beyaz.', array['#e9c9c0', '#f6e7e1', '#9bb0a0', '#ffffff', '#c8a15a']::text[], 7),
  ('palet', 'Bordo ve erik', 'Sonbahar akşamları için derin ve sıcak tonlar.', array['#6e1e2b', '#8e4a6b', '#d9b8a0', '#f2e9e1', '#4a5a3c']::text[], 8),
  ('his', 'Doğal', null, null, 1),
  ('his', 'Romantik', null, null, 2),
  ('his', 'Bohem', null, null, 3),
  ('his', 'Zarif', null, null, 4),
  ('his', 'Minimal', null, null, 5),
  ('his', 'Eğlenceli', null, null, 6),
  ('his', 'Samimi', null, null, 7),
  ('his', 'Rustik', null, null, 8)
) v (tur, ad, aciklama, renkler, sira)
where not exists (select 1 from public.dugun_katalog k where k.tur = v.tur and k.ad = v.ad);

-- Özel davet bağlantısı (/dugun/?k=<anahtar>): yönetim çifte gönderir, çift yalnız tasarım formunu görür ve doldurur;
-- talep davete bağlanır. Bağlantı herkese açık sayfadan bağımsız çalışır (sayfa yayında olmasa da).
create table if not exists public.dugun_davetleri (
  id bigint generated always as identity primary key,
  anahtar text not null unique default replace(gen_random_uuid()::text, '-', ''),
  ad text check (length(ad) <= 120),                   -- çiftin adı (formda selamlanır, ad alanına yazılır)
  notlar text check (length(notlar) <= 1000),          -- yalnız yönetim görür
  talep_id bigint references public.dugun_talepleri (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.dugun_davetleri enable row level security;
drop policy if exists yonetici_tam on public.dugun_davetleri;
create policy yonetici_tam on public.dugun_davetleri for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.dugun_davetleri from anon;
grant select, insert, update, delete on public.dugun_davetleri to authenticated;
drop trigger if exists denetim on public.dugun_davetleri;
create trigger denetim after insert or update or delete on public.dugun_davetleri for each row execute function public.denetle();
alter table public.dugun_talepleri add column if not exists davet_id bigint references public.dugun_davetleri (id) on delete set null;

-- Formun selamlaması için: anahtar geçerliyse çiftin adı (yoksa satır dönmez)
create or replace function public.dugun_davet_bilgi(p_anahtar text) returns table (ad text)
  language sql stable security definer set search_path = public
  as $$ select coalesce(d.ad, '') from dugun_davetleri d where d.anahtar = p_anahtar $$;
revoke execute on function public.dugun_davet_bilgi(text) from public;
grant execute on function public.dugun_davet_bilgi(text) to anon, authenticated;

-- Talep: palet, kendi renkleri, his ve davet de saklanır (imzaya p_davet eklendi)
drop function if exists public.dugun_talep_ac(text, text, text, date, boolean, text, jsonb, text, boolean);
create or replace function public.dugun_talep_ac(p_ad text, p_eposta text, p_tel text, p_tarih date, p_tarih_esnek boolean,
                                                 p_kisi text, p_secimler jsonb, p_not text, p_kvkk boolean, p_davet text default null)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ad text := trim(coalesce(p_ad, ''));
  ep text := lower(trim(coalesce(p_eposta, '')));
  s jsonb := case when jsonb_typeof(p_secimler) = 'object' then p_secimler else '{}' end;
  idler bigint[];
  sec jsonb := '{}';
  mekan dugun_katalog;
  davet dugun_davetleri;
  yeni bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adınızı ve soyadınızı yazın.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yazın.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranızı yazın.'; end if;
  if not coalesce(p_kvkk, false) then raise exception 'Devam etmek için KVKK metnini onaylayın.'; end if;
  if p_kisi is null or p_kisi not in ('50den_az', '50_100', '100_150', '150den_fazla', 'bilmiyorum') then raise exception 'Yaklaşık kişi sayısını seçin.'; end if;
  if p_tarih is not null and (p_tarih < istanbul_bugun() or p_tarih > istanbul_bugun() + 1100) then raise exception 'Geçerli bir tarih seçin.'; end if;
  if p_tarih is null and not coalesce(p_tarih_esnek, false) then raise exception 'Bir tarih seçin ya da "henüz belli değil"i işaretleyin.'; end if;
  if nullif(trim(coalesce(p_davet, '')), '') is not null then
    select * into davet from dugun_davetleri where anahtar = trim(p_davet);
    if davet.id is null then raise exception 'Davet bağlantısı geçersiz; size gönderilen bağlantıyı yeniden açın.'; end if;
  end if;
  if exists (select 1 from dugun_talepleri where eposta = ep and created_at > now() - interval '10 minutes') then return 'tamam'; end if;

  if jsonb_typeof(s -> 'mekan') = 'number' then
    select * into mekan from dugun_katalog where id = (s ->> 'mekan')::bigint and tur = 'mekan' and acik;
  end if;
  if mekan.id is not null then sec := sec || jsonb_build_object('mekan', mekan.ad); end if;

  -- Çoklu alanlar: bolumler, urunler, ekstralar (ürün grubu adıyla)
  idler := array(select x::bigint from jsonb_array_elements_text(case when jsonb_typeof(s -> 'bolumler') = 'array' then s -> 'bolumler' else '[]' end) x
                 where x ~ '^\d{1,12}$' limit 30);
  sec := sec || jsonb_build_object('bolumler', coalesce((select jsonb_agg(k.ad order by k.sira, k.id) from dugun_katalog k where k.id = any (idler) and k.tur = 'bolum' and k.acik), '[]'));
  idler := array(select x::bigint from jsonb_array_elements_text(case when jsonb_typeof(s -> 'urunler') = 'array' then s -> 'urunler' else '[]' end) x
                 where x ~ '^\d{1,12}$' limit 80);
  sec := sec || jsonb_build_object('urunler', coalesce((select jsonb_agg(jsonb_build_object('grup', coalesce(k.grup, ''), 'ad', k.ad) order by k.grup, k.sira, k.id)
                                                       from dugun_katalog k where k.id = any (idler) and k.tur = 'urun' and k.acik), '[]'));
  idler := array(select x::bigint from jsonb_array_elements_text(case when jsonb_typeof(s -> 'ekstralar') = 'array' then s -> 'ekstralar' else '[]' end) x
                 where x ~ '^\d{1,12}$' limit 30);
  sec := sec || jsonb_build_object('ekstralar', coalesce((select jsonb_agg(k.ad order by k.sira, k.id) from dugun_katalog k where k.id = any (idler) and k.tur = 'ekstra' and k.acik), '[]'));

  -- Tekli: menü (mekanın menüsü; yoksa "mekan karşılar") ve masa konsepti
  if jsonb_typeof(s -> 'menu') = 'number' then
    sec := sec || jsonb_build_object('menu', (select k.ad from dugun_katalog k where k.id = (s ->> 'menu')::bigint and k.tur = 'menu' and k.acik));
  end if;
  if jsonb_typeof(s -> 'konsept') = 'number' then
    sec := sec || jsonb_build_object('konsept', (select k.ad from dugun_katalog k where k.id = (s ->> 'konsept')::bigint and k.tur = 'konsept' and k.acik));
  end if;
  -- Renk paleti (katalogdan) ya da kendi renkleri (en çok 5, #RRGGBB) ve his (en çok 3)
  if jsonb_typeof(s -> 'palet') = 'number' then
    sec := sec || coalesce((select jsonb_build_object('palet', k.ad, 'palet_renkler', to_jsonb(k.renkler)) from dugun_katalog k
                            where k.id = (s ->> 'palet')::bigint and k.tur = 'palet' and k.acik), '{}');
  end if;
  if jsonb_typeof(s -> 'renkler') = 'array' then
    sec := sec || jsonb_build_object('renkler', coalesce((select jsonb_agg(lower(x)) from (select x from jsonb_array_elements_text(s -> 'renkler') x
                                                                                       where x ~ '^#[0-9A-Fa-f]{6}$' limit 5) r), '[]'));
  end if;
  idler := array(select x::bigint from jsonb_array_elements_text(case when jsonb_typeof(s -> 'his') = 'array' then s -> 'his' else '[]' end) x
                 where x ~ '^\d{1,12}$' limit 3);
  sec := sec || jsonb_build_object('his', coalesce((select jsonb_agg(k.ad order by k.sira, k.id) from dugun_katalog k where k.id = any (idler) and k.tur = 'his' and k.acik), '[]'));
  if sec -> 'renkler' = '[]'::jsonb then sec := sec - 'renkler'; end if;
  sec := jsonb_strip_nulls(sec);

  insert into dugun_talepleri (ad, eposta, tel, tarih, tarih_esnek, kisi, secimler, notlar, davet_id)
    values (ad, ep, left(trim(p_tel), 30), p_tarih, p_tarih is null, p_kisi, sec, nullif(left(trim(coalesce(p_not, '')), 2000), ''), davet.id)
    returning id into yeni;
  if davet.id is not null then update dugun_davetleri set talep_id = yeni where id = davet.id; end if;
  perform eposta_ekle('dugun_talep', ep,
                      jsonb_build_object('ad', ad, 'tarih', case when p_tarih is null then 'tarih henüz belli değil' else tr_tarih(p_tarih) end),
                      'dugun_talep:' || yeni);
  return 'tamam';
end $$;
revoke execute on function public.dugun_talep_ac(text, text, text, date, boolean, text, jsonb, text, boolean, text) from public, anon, authenticated;
grant execute on function public.dugun_talep_ac(text, text, text, date, boolean, text, jsonb, text, boolean, text) to service_role;
