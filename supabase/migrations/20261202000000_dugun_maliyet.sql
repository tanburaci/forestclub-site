-- Forest Club Urla: düğün maliyeti (01.11.2026). Yönetim › Düğün › Maliyet: her ürünün ortalama alış ve kira maliyeti,
-- tedarikçi bağlantısı ve kâr yüzdesi; müşteri fiyatı = esas maliyet × (1 + kâr %), tam TL'ye yuvarlanır ve
-- dugun_fiyatlar'a yazılır. Maliyet ve kâr hiçbir zaman ziyaretçiye açılmaz; /dugun/ sayfası yalnız müşteri fiyatını
-- dugun_fiyatlari() ile okur. Maliyeti ya da kârı girilmemiş kalemin fiyatı yoktur (sitede "teklif ile").
-- Başlangıç maliyetleri yalnız internette kaynağı bulunan 2026 fiyatlarıdır (tahmin yok); kâr boş: fiyatlar ancak
-- yönetici kârı girip kaydedince sitede görünür. Yeni ürün kalemleri ve lisanslı fotoğraflar (/dugun/foto/, Unsplash)
-- eklenir; yalnız çizimi olan kalemin resmi değişir, yüklenmiş fotoğrafa dokunulmaz.

create table if not exists public.dugun_maliyetler (
  katalog_id bigint primary key references public.dugun_katalog (id) on delete cascade,
  alis numeric(12, 2) check (alis >= 0),                 -- ortalama satın alma (birim başı)
  kira numeric(12, 2) check (kira >= 0),                 -- ortalama kira (tek etkinlik, birim başı)
  esas text not null default 'kira' check (esas in ('kira', 'alis')),
  kar_yuzde numeric(6, 2) check (kar_yuzde between 0 and 1000),
  birim text not null default 'adet' check (birim in ('adet', 'kisi', 'masa', 'metre', 'sabit')),
  tedarikci text check (length(tedarikci) <= 500 and tedarikci ~ '^https://'),
  notlar text check (length(notlar) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.dugun_maliyetler enable row level security;
drop policy if exists yonetici_tam on public.dugun_maliyetler;
create policy yonetici_tam on public.dugun_maliyetler for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.dugun_maliyetler from anon;
grant select, insert, update, delete on public.dugun_maliyetler to authenticated;

alter table public.dugun_fiyatlar drop constraint if exists dugun_fiyatlar_birim_check;
alter table public.dugun_fiyatlar add constraint dugun_fiyatlar_birim_check check (birim in ('adet', 'kisi', 'masa', 'metre', 'sabit'));

-- Maliyeti kaydeder, müşteri fiyatını hesaplar. p: {katalog_id, alis, kira, esas, kar_yuzde, birim, tedarikci, notlar}
-- Dönüş: {fiyat} (fiyat yoksa null)
create or replace function public.dugun_maliyet_kaydet(p jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  kid bigint := (p ->> 'katalog_id')::bigint;
  sayi_ numeric;
  v_alis numeric := nullif(p ->> 'alis', '')::numeric;
  v_kira numeric := nullif(p ->> 'kira', '')::numeric;
  v_kar numeric := nullif(p ->> 'kar_yuzde', '')::numeric;
  v_esas text := coalesce(nullif(p ->> 'esas', ''), 'kira');
  v_birim text := coalesce(nullif(p ->> 'birim', ''), 'adet');
  v_ted text := nullif(trim(coalesce(p ->> 'tedarikci', '')), '');
  esas_tutar numeric;
  v_fiyat numeric;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if not exists (select 1 from dugun_katalog where id = kid and tur = 'urun') then raise exception 'Ürün bulunamadı.'; end if;
  foreach sayi_ in array array[v_alis, v_kira] loop
    if sayi_ is not null and sayi_ < 0 then raise exception 'Maliyet eksi olamaz.'; end if;
  end loop;
  if v_kar is not null and (v_kar < 0 or v_kar > 1000) then raise exception 'Kâr yüzdesi 0 ile 1000 arasında olmalı.'; end if;
  if v_esas not in ('kira', 'alis') then raise exception 'Esas maliyet kira ya da alış olmalı.'; end if;
  if v_birim not in ('adet', 'kisi', 'masa', 'metre', 'sabit') then raise exception 'Geçersiz birim.'; end if;
  if v_ted is not null and v_ted !~ '^https://' then raise exception 'Tedarikçi bağlantısı https:// ile başlamalı.'; end if;
  insert into dugun_maliyetler (katalog_id, alis, kira, esas, kar_yuzde, birim, tedarikci, notlar, updated_at)
    values (kid, v_alis, v_kira, v_esas, v_kar, v_birim, left(v_ted, 500), left(nullif(trim(coalesce(p ->> 'notlar', '')), ''), 500), now())
    on conflict (katalog_id) do update set alis = excluded.alis, kira = excluded.kira, esas = excluded.esas,
      kar_yuzde = excluded.kar_yuzde, birim = excluded.birim, tedarikci = excluded.tedarikci, notlar = excluded.notlar,
      updated_at = now();
  esas_tutar := case v_esas when 'kira' then v_kira else v_alis end;
  if esas_tutar is not null and v_kar is not null then
    v_fiyat := round(esas_tutar * (1 + v_kar / 100));
    insert into dugun_fiyatlar (katalog_id, fiyat, birim) values (kid, v_fiyat, v_birim)
      on conflict (katalog_id) do update set fiyat = excluded.fiyat, birim = excluded.birim;
  else
    delete from dugun_fiyatlar where katalog_id = kid;
  end if;
  return jsonb_build_object('fiyat', v_fiyat);
end $$;
revoke execute on function public.dugun_maliyet_kaydet(jsonb) from public, anon;
grant execute on function public.dugun_maliyet_kaydet(jsonb) to authenticated;

-- /dugun/ sayfası: açık ürünlerin müşteri fiyatı (maliyet ve kâr yok)
create or replace function public.dugun_fiyatlari()
  returns table (katalog_id bigint, fiyat numeric, birim text)
  language sql stable security definer set search_path = public as $$
    select f.katalog_id, f.fiyat, f.birim from dugun_fiyatlar f join dugun_katalog k on k.id = f.katalog_id and k.acik
  $$;
revoke execute on function public.dugun_fiyatlari() from public;
grant execute on function public.dugun_fiyatlari() to anon, authenticated;

-- Seçenekler (01.11.2026, kullanıcı: "ürünleri kategori gibi yapalım, form bitince ne istendiği çok açık olsun"):
-- ürün kalemi bir ana ürünün seçeneği olabilir (ust_id). Sitede ana ürün kart, seçenekleri kartın içinde; talepte
-- "Ana ürün · seçenek". Seçeneğin fotoğrafı yoksa ana ürünün fotoğrafı görünür.
alter table public.dugun_katalog add column if not exists ust_id bigint references public.dugun_katalog (id) on delete cascade;
create index if not exists dugun_katalog_ust on public.dugun_katalog (ust_id);
alter table public.dugun_katalog drop constraint if exists dugun_katalog_ust_urun;
alter table public.dugun_katalog add constraint dugun_katalog_ust_urun check (ust_id is null or tur = 'urun');

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
  -- Ürün ya da seçeneği (ust_id): seçenek "Ana ürün · seçenek" diye yazılır, ne istendiği açık olsun
  idler := array(select x::bigint from jsonb_array_elements_text(case when jsonb_typeof(s -> 'urunler') = 'array' then s -> 'urunler' else '[]' end) x
                 where x ~ '^\d{1,12}$' limit 250);
  sec := sec || jsonb_build_object('urunler', coalesce((select jsonb_agg(jsonb_build_object('grup', coalesce(k.grup, ''),
                                                         'ad', case when u.id is null then k.ad else u.ad || ' · ' || k.ad end) order by k.grup, coalesce(u.sira, k.sira), k.sira, k.id)
                                                       from dugun_katalog k left join dugun_katalog u on u.id = k.ust_id
                                                       where k.id = any (idler) and k.tur = 'urun' and k.acik and (u.id is null or u.acik)), '[]'));
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

-- Yeni ürün kalemleri (aynı grup + ad varsa eklenmez)
insert into public.dugun_katalog (tur, grup, ad, sira)
select 'urun', y.grup, y.ad, y.sira from (values
  ('Masa', 'Büfe / servis masası', 50), ('Bardak', 'Buz kovası / şarap soğutucu', 50), ('Mum', 'Sitronella mum (sinek kovucu)', 50),
  ('Çiçek', 'Gelin buketi', 50), ('Işıklandırma', 'Ampul zinciri (dış mekan)', 50), ('Işıklandırma', 'Mantar ısıtıcı', 51),
  ('Karşılama', 'İçecek karşılama standı', 50), ('Karşılama', 'Yelpaze / şemsiye sepeti', 51), ('Lounge', 'Battaniye sepeti', 50),
  ('Nikah alanı', 'Nikah için ses ve mikrofon', 50), ('Altyapı', 'Jeneratör', 1), ('Altyapı', 'Seyyar tuvalet kabini', 2),
  ('Altyapı', 'Sahne / podyum', 3), ('Altyapı', 'Zemin / çim koruma halısı', 4), ('Altyapı', 'Atık ve geri dönüşüm istasyonu', 5)
) as y (grup, ad, sira)
where not exists (select 1 from public.dugun_katalog k where k.tur = 'urun' and k.grup = y.grup and k.ad = y.ad);

-- Genişletilmiş katalog: yeni ürünler ve gruplar (aynı grup + ad varsa eklenmez; fiyatlar boş, yönetim girer)
insert into public.dugun_katalog (tur, grup, ad, sira)
select 'urun', y.grup, y.ad, y.sira from (values
  ('Masa', 'Yuvarlak masa', 101),
  ('Masa', 'Uzun ahşap köy masası', 102),
  ('Masa', 'Kokteyl (bistro) masası', 103),
  ('Masa', 'Gelin ve damat masası', 104),
  ('Masa', 'Büfe / servis masası', 105),
  ('Masa', 'Dikdörtgen banket masa', 106),
  ('Masa', 'Kare masa', 107),
  ('Masa', 'Pasta / hediye masası', 108),
  ('Örtü', 'Doğal keten', 101),
  ('Örtü', 'Beyaz pamuk', 102),
  ('Örtü', 'Tül runner', 103),
  ('Örtü', 'Keten runner', 104),
  ('Örtü', 'Canlı okaliptüs runner', 105),
  ('Örtü', 'Gaze (tülbent) runner', 106),
  ('Örtü', 'Streç kokteyl masa örtüsü', 107),
  ('Örtü', 'Masa eteği (skört)', 108),
  ('Peçete', 'Keten peçete', 101),
  ('Peçete', 'Pamuk peçete', 102),
  ('Peçete', 'Altın peçete halkası', 103),
  ('Peçete', 'Peçetede kuru çiçek dalı', 104),
  ('Peçete', 'Peçete katlama', 105),
  ('Peçete', 'Diğer peçete halkaları', 106),
  ('Peçete', 'Kokteyl peçetesi (kâğıt)', 107),
  ('Tabak ve supla', 'Altın supla', 101),
  ('Tabak ve supla', 'Rattan supla', 102),
  ('Tabak ve supla', 'Şeffaf cam supla', 103),
  ('Tabak ve supla', 'El yapımı seramik tabak', 104),
  ('Tabak ve supla', 'Beyaz porselen tabak', 105),
  ('Tabak ve supla', 'Ahşap supla', 106),
  ('Tabak ve supla', 'Tatlı tabağı', 107),
  ('Tabak ve supla', 'Ekmek tabağı', 108),
  ('Çatal bıçak', 'Altın', 101),
  ('Çatal bıçak', 'Mat siyah', 102),
  ('Çatal bıçak', 'Klasik gümüş', 103),
  ('Çatal bıçak', 'Bakır / rose gold', 104),
  ('Çatal bıçak', 'Ahşap saplı', 105),
  ('Bardak', 'Kristal kadeh', 101),
  ('Bardak', 'Amber cam bardak', 102),
  ('Bardak', 'Füme cam bardak', 103),
  ('Bardak', 'Cam su sürahisi', 104),
  ('Bardak', 'Buz kovası / şarap soğutucu', 105),
  ('Bardak', 'Rakı kadehi', 106),
  ('Bardak', 'Renkli cam su bardağı', 107),
  ('Bardak', 'Kokteyl bardağı', 108),
  ('Çiçek', 'Kır çiçekleri', 101),
  ('Çiçek', 'Okaliptüs ve beyaz gül', 102),
  ('Çiçek', 'Pampas ve kuru çiçek', 103),
  ('Çiçek', 'Zeytin dalı', 104),
  ('Çiçek', 'Lavanta', 105),
  ('Çiçek', 'Ayçiçeği', 106),
  ('Çiçek', 'Kuru çiçek buketleri', 107),
  ('Çiçek', 'Saksıda zeytin fidanı', 108),
  ('Çiçek', 'Gelin buketi', 109),
  ('Çiçek', 'Damat yaka çiçeği', 110),
  ('Çiçek', 'Nedime buketi', 111),
  ('Çiçek', 'Gelin saç çiçeği', 112),
  ('Çiçek', 'Sukulent', 113),
  ('Çiçek', 'Yer aranjmanı (büyük vazo)', 114),
  ('Çiçek', 'Ağaçtan sarkan çiçek', 115),
  ('Mum', 'Cam fanuslu mumlar', 101),
  ('Mum', 'Uzun şamdanlar', 102),
  ('Mum', 'Tealight mumlar', 103),
  ('Mum', 'LED mumlar (rüzgâra dayanıklı)', 104),
  ('Mum', 'Masa feneri', 105),
  ('Mum', 'Sitronella mum (sinek kovucu)', 106),
  ('Mum', 'Kütük mum', 107),
  ('Mum', 'Uzun (taper) mum', 108),
  ('Masa kartı', 'İsim kartları', 101),
  ('Masa kartı', 'Masa numaraları', 102),
  ('Masa kartı', 'Menü kartları', 103),
  ('Masa kartı', 'Yaprağa yazılı isimler', 104),
  ('Masa kartı', 'Masa isimleri (numara yerine)', 105),
  ('Masa kartı', 'İsim kartı tutucu', 106),
  ('Sandalye', 'Ahşap katlanır', 101),
  ('Sandalye', 'Şeffaf Tiffany', 102),
  ('Sandalye', 'Rattan', 103),
  ('Sandalye', 'Çapraz sırtlı ahşap', 104),
  ('Sandalye', 'Altın Chiavari', 105),
  ('Sandalye', 'Ahşap bank', 106),
  ('Sandalye', 'Napolyon sandalye', 107),
  ('Sandalye', 'Sandalye minderi', 108),
  ('Sandalye', 'Gelin ve damat sandalyesi', 109),
  ('Sandalye süsü', 'Sırtta çiçek demeti', 101),
  ('Sandalye süsü', 'Keten kurdele', 102),
  ('Sandalye süsü', 'Okaliptüs dalı', 103),
  ('Sandalye süsü', 'Tül fiyonk', 104),
  ('Sandalye süsü', 'Gelin ve damat tabelası', 105),
  ('Masa üstü süs', 'Cam vazo', 101),
  ('Masa üstü süs', 'Renkli cam şişe', 102),
  ('Masa üstü süs', 'Ahşap kütük altlık', 103),
  ('Masa üstü süs', 'Meyve süsü', 104),
  ('Masa üstü süs', 'Taş ve deniz kabuğu', 105),
  ('Masa üstü süs', 'Ayna altlık', 106),
  ('Sofra servisi', 'Ekmek sepeti', 101),
  ('Sofra servisi', 'Zeytinyağı şişesi', 102),
  ('Sofra servisi', 'Tuzluk ve biberlik', 103),
  ('Sofra servisi', 'Paylaşımlı servis tabağı', 104),
  ('Sofra servisi', 'Servis tepsisi', 105),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 101),
  ('Işıklandırma', 'Ağaç gövdesi aydınlatması', 102),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 103),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', 104),
  ('Işıklandırma', 'Mantar ısıtıcı', 105),
  ('Işıklandırma', 'Peri ışıkları', 106),
  ('Işıklandırma', 'Meşale', 107),
  ('Işıklandırma', 'Ağaçtan avize', 108),
  ('Karşılama', 'Karşılama panosu', 101),
  ('Karşılama', 'Oturma planı panosu', 102),
  ('Karşılama', 'Anı defteri masası', 103),
  ('Karşılama', 'Hediye ve zarf kutusu', 104),
  ('Karşılama', 'Fotoğraflı anı köşesi', 105),
  ('Karşılama', 'İçecek karşılama standı', 106),
  ('Karşılama', 'Yelpaze / şemsiye sepeti', 107),
  ('Karşılama', 'Terlik sepeti', 108),
  ('Karşılama', 'Lavanta / pirinç atma', 109),
  ('Lounge', 'Minder ve puflar', 101),
  ('Lounge', 'Kilim ve halılar', 102),
  ('Lounge', 'Rattan koltuklar', 103),
  ('Lounge', 'Saman balyası oturma', 104),
  ('Lounge', 'Battaniye sepeti', 105),
  ('Lounge', 'Alçak sehpa', 106),
  ('Lounge', 'Şezlong ve büyük minder', 107),
  ('Lounge', 'Sedir', 108),
  ('Nikah alanı', 'Nikah masası', 101),
  ('Nikah alanı', 'Ahşap altıgen kemer', 102),
  ('Nikah alanı', 'Tül perdeli kemer', 103),
  ('Nikah alanı', 'Çember kemer', 104),
  ('Nikah alanı', 'Jüt yol halısı', 105),
  ('Nikah alanı', 'Yol kenarı çiçekleri', 106),
  ('Nikah alanı', 'Lavanta / yaprak serpme', 107),
  ('Nikah alanı', 'Fenerli yol', 108),
  ('Nikah alanı', 'Nikah için ses ve mikrofon', 109),
  ('Nikah alanı', 'Nikah oturma düzeni', 110),
  ('Nikah alanı', 'Yüzük kutusu', 111),
  ('Nikah alanı', 'Kürsü', 112),
  ('Gölgelik ve çadır', 'Tente / gölgelik', 101),
  ('Gölgelik ve çadır', 'Şeffaf çadır', 102),
  ('Gölgelik ve çadır', 'Bez yelken (gölgelik)', 103),
  ('Gölgelik ve çadır', 'Büyük şemsiye', 104),
  ('Gölgelik ve çadır', 'Rüzgâr perdesi', 105),
  ('Bar ve içecek', 'Bar tezgahı', 101),
  ('Bar ve içecek', 'Bar taburesi', 102),
  ('Bar ve içecek', 'İçecek dolabı', 103),
  ('Bar ve içecek', 'Limonata dispenseri', 104),
  ('Bar ve içecek', 'Şarap fıçısı süsleme', 105),
  ('Pasta ve tatlı sunumu', 'Pasta standı', 101),
  ('Pasta ve tatlı sunumu', 'Pasta bıçağı seti', 102),
  ('Pasta ve tatlı sunumu', 'Tatlı büfesi', 103),
  ('Pasta ve tatlı sunumu', 'Kurabiye standı', 104),
  ('Fotoğraf köşesi', 'Fotoğraf arka fonu', 101),
  ('Fotoğraf köşesi', 'Polaroid misafir kamerası', 102),
  ('Fotoğraf köşesi', 'Fotoğraf aksesuarları', 103),
  ('Fotoğraf köşesi', 'Boy aynası', 104),
  ('Çocuk köşesi', 'Çocuk masası', 101),
  ('Çocuk köşesi', 'Boyama seti', 102),
  ('Çocuk köşesi', 'Oyun alanı', 103),
  ('Tabela ve yönlendirme', 'Yön tabelası', 101),
  ('Tabela ve yönlendirme', 'Program (akış) tabelası', 102),
  ('Tabela ve yönlendirme', 'Bar menüsü tabelası', 103),
  ('Tabela ve yönlendirme', 'Telefonsuz tören tabelası', 104),
  ('Misafir konforu', 'Sinek kovucu istasyonu', 101),
  ('Misafir konforu', 'Güneş kremi sepeti', 102),
  ('Misafir konforu', 'Islak mendil ve bakım sepeti', 103),
  ('Misafir konforu', 'Yağmur şemsiyesi', 104),
  ('Kâğıt ürünler', 'Davetiye', 101),
  ('Kâğıt ürünler', 'Tarihi kaydet kartı', 102),
  ('Kâğıt ürünler', 'Teşekkür kartı', 103),
  ('Kâğıt ürünler', 'Zarf mührü', 104),
  ('Altyapı', 'Jeneratör', 101),
  ('Altyapı', 'Seyyar tuvalet kabini', 102),
  ('Altyapı', 'Sahne / podyum', 103),
  ('Altyapı', 'Zemin / çim koruma halısı', 104),
  ('Altyapı', 'Atık ve geri dönüşüm istasyonu', 105),
  ('Altyapı', 'Elektrik dağıtımı ve uzatma', 106)
) as y (grup, ad, sira)
where not exists (select 1 from public.dugun_katalog k where k.tur = 'urun' and k.grup = y.grup and k.ad = y.ad and k.ust_id is null);

-- Seçenekler: ana ürünün altında (aynı ana ürün + ad varsa eklenmez)
insert into public.dugun_katalog (tur, grup, ad, sira, ust_id)
select 'urun', v.grup, v.ad, v.sira, u.id from (values
  ('Masa', 'Yuvarlak masa', 'Ø120 cm · 6 kişi', 1),
  ('Masa', 'Yuvarlak masa', 'Ø150 cm · 8 kişi', 2),
  ('Masa', 'Yuvarlak masa', 'Ø180 cm · 10 kişi', 3),
  ('Masa', 'Yuvarlak masa', 'Ø200 cm · 12 kişi', 4),
  ('Masa', 'Uzun ahşap köy masası', '180×90 cm · 6–8 kişi', 1),
  ('Masa', 'Uzun ahşap köy masası', '240×90 cm · 8–10 kişi', 2),
  ('Masa', 'Uzun ahşap köy masası', '300×100 cm · 10–12 kişi', 3),
  ('Masa', 'Uzun ahşap köy masası', 'Birleşik uzun sofra · 20+ kişi', 4),
  ('Masa', 'Kokteyl (bistro) masası', 'Ø60 cm · 110 cm boy (ayakta)', 1),
  ('Masa', 'Kokteyl (bistro) masası', 'Ø80 cm · 110 cm boy (ayakta)', 2),
  ('Masa', 'Kokteyl (bistro) masası', 'Ø60 cm · 75 cm boy (oturmalı)', 3),
  ('Masa', 'Gelin ve damat masası', 'İki kişilik', 1),
  ('Masa', 'Gelin ve damat masası', 'Aileyle uzun masa · 8 kişi', 2),
  ('Masa', 'Gelin ve damat masası', 'Çiçek kemerli', 3),
  ('Masa', 'Büfe / servis masası', '180×75 cm', 1),
  ('Masa', 'Büfe / servis masası', '240×75 cm', 2),
  ('Masa', 'Büfe / servis masası', 'Ahşap sandık büfe', 3),
  ('Masa', 'Dikdörtgen banket masa', '180×75 cm · 6 kişi', 1),
  ('Masa', 'Dikdörtgen banket masa', '240×75 cm · 8 kişi', 2),
  ('Masa', 'Kare masa', '90×90 cm · 4 kişi', 1),
  ('Masa', 'Kare masa', '120×120 cm · 8 kişi', 2),
  ('Masa', 'Pasta / hediye masası', 'Ø80 cm yuvarlak', 1),
  ('Masa', 'Pasta / hediye masası', '120×60 cm dikdörtgen', 2),
  ('Masa', 'Pasta / hediye masası', 'Ahşap fıçı', 3),
  ('Örtü', 'Doğal keten', 'Yuvarlak Ø230 cm (Ø120 masa)', 1),
  ('Örtü', 'Doğal keten', 'Yuvarlak Ø270 cm (Ø150 masa)', 2),
  ('Örtü', 'Doğal keten', 'Yuvarlak Ø300 cm (Ø180 masa)', 3),
  ('Örtü', 'Doğal keten', 'Dikdörtgen 160×220 cm', 4),
  ('Örtü', 'Doğal keten', 'Dikdörtgen 160×300 cm', 5),
  ('Örtü', 'Doğal keten', 'Dikdörtgen 160×360 cm', 6),
  ('Örtü', 'Beyaz pamuk', 'Yuvarlak Ø230 cm (Ø120 masa)', 1),
  ('Örtü', 'Beyaz pamuk', 'Yuvarlak Ø270 cm (Ø150 masa)', 2),
  ('Örtü', 'Beyaz pamuk', 'Yuvarlak Ø300 cm (Ø180 masa)', 3),
  ('Örtü', 'Beyaz pamuk', 'Dikdörtgen 160×220 cm', 4),
  ('Örtü', 'Beyaz pamuk', 'Dikdörtgen 160×300 cm', 5),
  ('Örtü', 'Tül runner', 'Beyaz', 1),
  ('Örtü', 'Tül runner', 'Krem', 2),
  ('Örtü', 'Tül runner', 'Pudra', 3),
  ('Örtü', 'Tül runner', 'Adaçayı', 4),
  ('Örtü', 'Keten runner', 'Bej', 1),
  ('Örtü', 'Keten runner', 'Beyaz', 2),
  ('Örtü', 'Keten runner', 'Adaçayı yeşili', 3),
  ('Örtü', 'Keten runner', 'Terrakota', 4),
  ('Örtü', 'Keten runner', 'Toz mavi', 5),
  ('Örtü', 'Keten runner', 'Antrasit', 6),
  ('Örtü', 'Canlı okaliptüs runner', '1 m (yuvarlak masa ortası)', 1),
  ('Örtü', 'Canlı okaliptüs runner', '2 m', 2),
  ('Örtü', 'Canlı okaliptüs runner', '3 m (uzun masa boyunca)', 3),
  ('Örtü', 'Gaze (tülbent) runner', 'Beyaz', 1),
  ('Örtü', 'Gaze (tülbent) runner', 'Bej', 2),
  ('Örtü', 'Gaze (tülbent) runner', 'Hardal', 3),
  ('Örtü', 'Gaze (tülbent) runner', 'Terrakota', 4),
  ('Örtü', 'Streç kokteyl masa örtüsü', 'Beyaz', 1),
  ('Örtü', 'Streç kokteyl masa örtüsü', 'Siyah', 2),
  ('Örtü', 'Streç kokteyl masa örtüsü', 'Bej', 3),
  ('Örtü', 'Masa eteği (skört)', 'Beyaz', 1),
  ('Örtü', 'Masa eteği (skört)', 'Krem', 2),
  ('Örtü', 'Masa eteği (skört)', 'Pudra', 3),
  ('Peçete', 'Keten peçete', 'Bej', 1),
  ('Peçete', 'Keten peçete', 'Beyaz', 2),
  ('Peçete', 'Keten peçete', 'Adaçayı', 3),
  ('Peçete', 'Keten peçete', 'Terrakota', 4),
  ('Peçete', 'Keten peçete', 'Toz mavi', 5),
  ('Peçete', 'Keten peçete', 'Lavanta', 6),
  ('Peçete', 'Pamuk peçete', 'Beyaz', 1),
  ('Peçete', 'Pamuk peçete', 'Krem', 2),
  ('Peçete', 'Pamuk peçete', 'Gri', 3),
  ('Peçete', 'Altın peçete halkası', 'Düz', 1),
  ('Peçete', 'Altın peçete halkası', 'Yaprak desenli', 2),
  ('Peçete', 'Altın peçete halkası', 'Boncuklu', 3),
  ('Peçete', 'Peçetede kuru çiçek dalı', 'Lavanta', 1),
  ('Peçete', 'Peçetede kuru çiçek dalı', 'Okaliptüs', 2),
  ('Peçete', 'Peçetede kuru çiçek dalı', 'Kuru başak', 3),
  ('Peçete', 'Peçetede kuru çiçek dalı', 'Biberiye', 4),
  ('Peçete', 'Peçete katlama', 'Düz dikdörtgen', 1),
  ('Peçete', 'Peçete katlama', 'Cep (çatal-bıçak içinde)', 2),
  ('Peçete', 'Peçete katlama', 'Düğüm', 3),
  ('Peçete', 'Peçete katlama', 'Yelpaze', 4),
  ('Peçete', 'Diğer peçete halkaları', 'Ahşap', 1),
  ('Peçete', 'Diğer peçete halkaları', 'Rattan', 2),
  ('Peçete', 'Diğer peçete halkaları', 'Gümüş', 3),
  ('Peçete', 'Diğer peçete halkaları', 'Deri bağcık', 4),
  ('Peçete', 'Kokteyl peçetesi (kâğıt)', 'Beyaz', 1),
  ('Peçete', 'Kokteyl peçetesi (kâğıt)', 'Krem', 2),
  ('Peçete', 'Kokteyl peçetesi (kâğıt)', 'İsim baskılı', 3),
  ('Tabak ve supla', 'Altın supla', 'Cam, altın kenarlı', 1),
  ('Tabak ve supla', 'Altın supla', 'Metal altın', 2),
  ('Tabak ve supla', 'Altın supla', 'Altın boncuk kenarlı', 3),
  ('Tabak ve supla', 'Rattan supla', 'Doğal', 1),
  ('Tabak ve supla', 'Rattan supla', 'Beyaz', 2),
  ('Tabak ve supla', 'Rattan supla', 'Deniz otu', 3),
  ('Tabak ve supla', 'Şeffaf cam supla', 'Düz', 1),
  ('Tabak ve supla', 'Şeffaf cam supla', 'Boncuk kenarlı', 2),
  ('Tabak ve supla', 'Şeffaf cam supla', 'Kabartma desenli', 3),
  ('Tabak ve supla', 'El yapımı seramik tabak', 'Bej', 1),
  ('Tabak ve supla', 'El yapımı seramik tabak', 'Toprak', 2),
  ('Tabak ve supla', 'El yapımı seramik tabak', 'Yeşil sırlı', 3),
  ('Tabak ve supla', 'El yapımı seramik tabak', 'Ege mavisi', 4),
  ('Tabak ve supla', 'Beyaz porselen tabak', 'Düz kenar', 1),
  ('Tabak ve supla', 'Beyaz porselen tabak', 'Kabartma kenar', 2),
  ('Tabak ve supla', 'Beyaz porselen tabak', 'Altın şeritli', 3),
  ('Tabak ve supla', 'Ahşap supla', 'Yuvarlak', 1),
  ('Tabak ve supla', 'Ahşap supla', 'Kütük kesit', 2),
  ('Tabak ve supla', 'Tatlı tabağı', 'Porselen', 1),
  ('Tabak ve supla', 'Tatlı tabağı', 'Cam', 2),
  ('Tabak ve supla', 'Tatlı tabağı', 'Seramik', 3),
  ('Tabak ve supla', 'Ekmek tabağı', 'Porselen', 1),
  ('Tabak ve supla', 'Ekmek tabağı', 'Seramik', 2),
  ('Tabak ve supla', 'Ekmek tabağı', 'Ahşap', 3),
  ('Çatal bıçak', 'Altın', 'Parlak · 4 parça (yemek + tatlı)', 1),
  ('Çatal bıçak', 'Altın', 'Parlak · 6 parça (başlangıç dahil)', 2),
  ('Çatal bıçak', 'Altın', 'Mat · 4 parça', 3),
  ('Çatal bıçak', 'Altın', 'Mat · 6 parça', 4),
  ('Çatal bıçak', 'Mat siyah', '4 parça', 1),
  ('Çatal bıçak', 'Mat siyah', '6 parça', 2),
  ('Çatal bıçak', 'Mat siyah', 'Siyah-altın 4 parça', 3),
  ('Çatal bıçak', 'Klasik gümüş', 'Düz · 4 parça', 1),
  ('Çatal bıçak', 'Klasik gümüş', 'Vintage desenli · 4 parça', 2),
  ('Çatal bıçak', 'Klasik gümüş', '6 parça', 3),
  ('Çatal bıçak', 'Bakır / rose gold', 'Bakır · 4 parça', 1),
  ('Çatal bıçak', 'Bakır / rose gold', 'Rose gold · 4 parça', 2),
  ('Çatal bıçak', 'Ahşap saplı', '4 parça', 1),
  ('Çatal bıçak', 'Ahşap saplı', '6 parça', 2),
  ('Bardak', 'Kristal kadeh', 'Kırmızı şarap', 1),
  ('Bardak', 'Kristal kadeh', 'Beyaz şarap', 2),
  ('Bardak', 'Kristal kadeh', 'Şampanya flüt', 3),
  ('Bardak', 'Kristal kadeh', 'Şampanya coupe', 4),
  ('Bardak', 'Amber cam bardak', 'Su bardağı', 1),
  ('Bardak', 'Amber cam bardak', 'Kısa (meşrubat)', 2),
  ('Bardak', 'Amber cam bardak', 'Kadeh', 3),
  ('Bardak', 'Füme cam bardak', 'Su bardağı', 1),
  ('Bardak', 'Füme cam bardak', 'Kısa (meşrubat)', 2),
  ('Bardak', 'Füme cam bardak', 'Kadeh', 3),
  ('Bardak', 'Cam su sürahisi', '1 L', 1),
  ('Bardak', 'Cam su sürahisi', '1,5 L', 2),
  ('Bardak', 'Cam su sürahisi', 'Tıpalı cam şişe', 3),
  ('Bardak', 'Buz kovası / şarap soğutucu', 'Masa üstü (1 şişe)', 1),
  ('Bardak', 'Buz kovası / şarap soğutucu', 'Ayaklı', 2),
  ('Bardak', 'Buz kovası / şarap soğutucu', 'Büyük (bar için)', 3),
  ('Bardak', 'Rakı kadehi', 'İnce uzun', 1),
  ('Bardak', 'Rakı kadehi', 'Göbekli', 2),
  ('Bardak', 'Renkli cam su bardağı', 'Yeşil', 1),
  ('Bardak', 'Renkli cam su bardağı', 'Pembe', 2),
  ('Bardak', 'Renkli cam su bardağı', 'Mavi', 3),
  ('Bardak', 'Kokteyl bardağı', 'Martini', 1),
  ('Bardak', 'Kokteyl bardağı', 'Highball', 2),
  ('Bardak', 'Kokteyl bardağı', 'Old fashioned', 3),
  ('Çiçek', 'Kır çiçekleri', 'Küçük (tek vazo)', 1),
  ('Çiçek', 'Kır çiçekleri', 'Orta (3 vazo grubu)', 2),
  ('Çiçek', 'Kır çiçekleri', 'Büyük (masa boyu aranjman)', 3),
  ('Çiçek', 'Okaliptüs ve beyaz gül', 'Küçük', 1),
  ('Çiçek', 'Okaliptüs ve beyaz gül', 'Orta', 2),
  ('Çiçek', 'Okaliptüs ve beyaz gül', 'Büyük', 3),
  ('Çiçek', 'Okaliptüs ve beyaz gül', 'Uzun masa runner', 4),
  ('Çiçek', 'Pampas ve kuru çiçek', 'Küçük', 1),
  ('Çiçek', 'Pampas ve kuru çiçek', 'Orta', 2),
  ('Çiçek', 'Pampas ve kuru çiçek', 'Büyük', 3),
  ('Çiçek', 'Pampas ve kuru çiçek', 'Yer aranjmanı', 4),
  ('Çiçek', 'Zeytin dalı', 'Masa dalı', 1),
  ('Çiçek', 'Zeytin dalı', 'Runner (2 m)', 2),
  ('Çiçek', 'Zeytin dalı', 'Kemer süsü', 3),
  ('Çiçek', 'Lavanta', 'Saksıda', 1),
  ('Çiçek', 'Lavanta', 'Demet', 2),
  ('Çiçek', 'Lavanta', 'Masa aranjmanı', 3),
  ('Çiçek', 'Ayçiçeği', 'Tek dal vazo', 1),
  ('Çiçek', 'Ayçiçeği', 'Orta buket', 2),
  ('Çiçek', 'Ayçiçeği', 'Büyük aranjman', 3),
  ('Çiçek', 'Kuru çiçek buketleri', 'Küçük', 1),
  ('Çiçek', 'Kuru çiçek buketleri', 'Orta', 2),
  ('Çiçek', 'Kuru çiçek buketleri', 'Büyük', 3),
  ('Çiçek', 'Saksıda zeytin fidanı', '50 cm', 1),
  ('Çiçek', 'Saksıda zeytin fidanı', '1 m', 2),
  ('Çiçek', 'Saksıda zeytin fidanı', '1,5 m', 3),
  ('Çiçek', 'Gelin buketi', 'Kır çiçekli', 1),
  ('Çiçek', 'Gelin buketi', 'Beyaz gül ve okaliptüs', 2),
  ('Çiçek', 'Gelin buketi', 'Kuru çiçek', 3),
  ('Çiçek', 'Gelin buketi', 'Pampas, bohem', 4),
  ('Çiçek', 'Damat yaka çiçeği', 'Okaliptüs', 1),
  ('Çiçek', 'Damat yaka çiçeği', 'Kır çiçeği', 2),
  ('Çiçek', 'Damat yaka çiçeği', 'Kuru başak', 3),
  ('Çiçek', 'Nedime buketi', 'Küçük', 1),
  ('Çiçek', 'Nedime buketi', 'Orta', 2),
  ('Çiçek', 'Gelin saç çiçeği', 'Taze çiçek taç', 1),
  ('Çiçek', 'Gelin saç çiçeği', 'Kuru çiçek taç', 2),
  ('Çiçek', 'Gelin saç çiçeği', 'Tek çiçek toka', 3),
  ('Çiçek', 'Sukulent', 'Tek saksı', 1),
  ('Çiçek', 'Sukulent', 'Üçlü grup', 2),
  ('Çiçek', 'Yer aranjmanı (büyük vazo)', '80 cm', 1),
  ('Çiçek', 'Yer aranjmanı (büyük vazo)', '120 cm', 2),
  ('Çiçek', 'Ağaçtan sarkan çiçek', 'Kısa', 1),
  ('Çiçek', 'Ağaçtan sarkan çiçek', 'Uzun (cascade)', 2),
  ('Mum', 'Cam fanuslu mumlar', 'Küçük (15 cm)', 1),
  ('Mum', 'Cam fanuslu mumlar', 'Orta (25 cm)', 2),
  ('Mum', 'Cam fanuslu mumlar', 'Büyük (40 cm)', 3),
  ('Mum', 'Uzun şamdanlar', 'Pirinç tekli', 1),
  ('Mum', 'Uzun şamdanlar', 'Pirinç 3 kollu', 2),
  ('Mum', 'Uzun şamdanlar', 'Cam', 3),
  ('Mum', 'Uzun şamdanlar', 'Siyah metal', 4),
  ('Mum', 'Tealight mumlar', 'Beyaz', 1),
  ('Mum', 'Tealight mumlar', 'Kokulu (lavanta)', 2),
  ('Mum', 'Tealight mumlar', 'Cam mumluklu', 3),
  ('Mum', 'LED mumlar (rüzgâra dayanıklı)', 'Tealight', 1),
  ('Mum', 'LED mumlar (rüzgâra dayanıklı)', 'Uzun (taper)', 2),
  ('Mum', 'LED mumlar (rüzgâra dayanıklı)', 'Kütük', 3),
  ('Mum', 'Masa feneri', 'Beyaz metal', 1),
  ('Mum', 'Masa feneri', 'Siyah metal', 2),
  ('Mum', 'Masa feneri', 'Ahşap', 3),
  ('Mum', 'Masa feneri', 'Rattan', 4),
  ('Mum', 'Sitronella mum (sinek kovucu)', 'Kova', 1),
  ('Mum', 'Sitronella mum (sinek kovucu)', 'Bambu meşale', 2),
  ('Mum', 'Kütük mum', '7×10 cm', 1),
  ('Mum', 'Kütük mum', '7×15 cm', 2),
  ('Mum', 'Kütük mum', '10×20 cm', 3),
  ('Mum', 'Uzun (taper) mum', 'Beyaz', 1),
  ('Mum', 'Uzun (taper) mum', 'Krem', 2),
  ('Mum', 'Uzun (taper) mum', 'Adaçayı', 3),
  ('Mum', 'Uzun (taper) mum', 'Terrakota', 4),
  ('Masa kartı', 'İsim kartları', 'Krem kart', 1),
  ('Masa kartı', 'İsim kartları', 'Kraft kart', 2),
  ('Masa kartı', 'İsim kartları', 'Akrilik şeffaf', 3),
  ('Masa kartı', 'İsim kartları', 'Altın yazılı', 4),
  ('Masa kartı', 'Masa numaraları', 'Ahşap', 1),
  ('Masa kartı', 'Masa numaraları', 'Akrilik', 2),
  ('Masa kartı', 'Masa numaraları', 'Çerçeveli', 3),
  ('Masa kartı', 'Masa numaraları', 'Taş üzerine', 4),
  ('Masa kartı', 'Menü kartları', 'Tek kişilik', 1),
  ('Masa kartı', 'Menü kartları', 'Masa başı (paylaşımlı)', 2),
  ('Masa kartı', 'Menü kartları', 'Peçeteye iliştirilen', 3),
  ('Masa kartı', 'Yaprağa yazılı isimler', 'Zeytin yaprağı', 1),
  ('Masa kartı', 'Yaprağa yazılı isimler', 'Okaliptüs yaprağı', 2),
  ('Masa kartı', 'Yaprağa yazılı isimler', 'Manolya yaprağı', 3),
  ('Masa kartı', 'Masa isimleri (numara yerine)', 'Urla köyleri', 1),
  ('Masa kartı', 'Masa isimleri (numara yerine)', 'Çiçek adları', 2),
  ('Masa kartı', 'Masa isimleri (numara yerine)', 'Şarap adları', 3),
  ('Masa kartı', 'İsim kartı tutucu', 'Mantar', 1),
  ('Masa kartı', 'İsim kartı tutucu', 'Taş', 2),
  ('Masa kartı', 'İsim kartı tutucu', 'Ahşap blok', 3),
  ('Sandalye', 'Ahşap katlanır', 'Doğal', 1),
  ('Sandalye', 'Ahşap katlanır', 'Beyaz', 2),
  ('Sandalye', 'Şeffaf Tiffany', 'Şeffaf', 1),
  ('Sandalye', 'Şeffaf Tiffany', 'Minderli (beyaz)', 2),
  ('Sandalye', 'Rattan', 'Doğal', 1),
  ('Sandalye', 'Rattan', 'Beyaz', 2),
  ('Sandalye', 'Çapraz sırtlı ahşap', 'Doğal meşe', 1),
  ('Sandalye', 'Çapraz sırtlı ahşap', 'Ceviz', 2),
  ('Sandalye', 'Çapraz sırtlı ahşap', 'Hasır oturaklı', 3),
  ('Sandalye', 'Altın Chiavari', 'Altın', 1),
  ('Sandalye', 'Altın Chiavari', 'Gümüş', 2),
  ('Sandalye', 'Altın Chiavari', 'Beyaz', 3),
  ('Sandalye', 'Altın Chiavari', 'Siyah', 4),
  ('Sandalye', 'Ahşap bank', '2 kişilik', 1),
  ('Sandalye', 'Ahşap bank', '3 kişilik', 2),
  ('Sandalye', 'Ahşap bank', 'Sırtlı', 3),
  ('Sandalye', 'Napolyon sandalye', 'Beyaz', 1),
  ('Sandalye', 'Napolyon sandalye', 'Siyah', 2),
  ('Sandalye', 'Napolyon sandalye', 'Ahşap', 3),
  ('Sandalye', 'Sandalye minderi', 'Keten bej', 1),
  ('Sandalye', 'Sandalye minderi', 'Beyaz', 2),
  ('Sandalye', 'Sandalye minderi', 'Adaçayı', 3),
  ('Sandalye', 'Gelin ve damat sandalyesi', 'Rattan tavuskuşu', 1),
  ('Sandalye', 'Gelin ve damat sandalyesi', 'Çiçekli bank', 2),
  ('Sandalye', 'Gelin ve damat sandalyesi', 'Vintage koltuk', 3),
  ('Sandalye süsü', 'Sırtta çiçek demeti', 'Kır çiçeği', 1),
  ('Sandalye süsü', 'Sırtta çiçek demeti', 'Okaliptüs', 2),
  ('Sandalye süsü', 'Sırtta çiçek demeti', 'Kuru çiçek', 3),
  ('Sandalye süsü', 'Keten kurdele', 'Bej', 1),
  ('Sandalye süsü', 'Keten kurdele', 'Beyaz', 2),
  ('Sandalye süsü', 'Keten kurdele', 'Adaçayı', 3),
  ('Sandalye süsü', 'Keten kurdele', 'Terrakota', 4),
  ('Sandalye süsü', 'Okaliptüs dalı', 'Sırt dalı', 1),
  ('Sandalye süsü', 'Okaliptüs dalı', 'Çember', 2),
  ('Sandalye süsü', 'Tül fiyonk', 'Beyaz', 1),
  ('Sandalye süsü', 'Tül fiyonk', 'Krem', 2),
  ('Sandalye süsü', 'Tül fiyonk', 'Pudra', 3),
  ('Sandalye süsü', 'Gelin ve damat tabelası', 'Ahşap', 1),
  ('Sandalye süsü', 'Gelin ve damat tabelası', 'Akrilik', 2),
  ('Sandalye süsü', 'Gelin ve damat tabelası', 'Çiçekli', 3),
  ('Masa üstü süs', 'Cam vazo', 'Tek dal (ince)', 1),
  ('Masa üstü süs', 'Cam vazo', 'Silindir', 2),
  ('Masa üstü süs', 'Cam vazo', 'Damacana', 3),
  ('Masa üstü süs', 'Renkli cam şişe', 'Amber', 1),
  ('Masa üstü süs', 'Renkli cam şişe', 'Yeşil', 2),
  ('Masa üstü süs', 'Renkli cam şişe', 'Karışık', 3),
  ('Masa üstü süs', 'Ahşap kütük altlık', 'Küçük', 1),
  ('Masa üstü süs', 'Ahşap kütük altlık', 'Büyük', 2),
  ('Masa üstü süs', 'Meyve süsü', 'Nar', 1),
  ('Masa üstü süs', 'Meyve süsü', 'Limon', 2),
  ('Masa üstü süs', 'Meyve süsü', 'İncir', 3),
  ('Masa üstü süs', 'Meyve süsü', 'Üzüm', 4),
  ('Masa üstü süs', 'Taş ve deniz kabuğu', 'Ege taşı', 1),
  ('Masa üstü süs', 'Taş ve deniz kabuğu', 'Deniz kabuğu', 2),
  ('Masa üstü süs', 'Ayna altlık', 'Yuvarlak', 1),
  ('Masa üstü süs', 'Ayna altlık', 'Kare', 2),
  ('Sofra servisi', 'Ekmek sepeti', 'Hasır', 1),
  ('Sofra servisi', 'Ekmek sepeti', 'Keten torba', 2),
  ('Sofra servisi', 'Zeytinyağı şişesi', 'Cam şişe', 1),
  ('Sofra servisi', 'Zeytinyağı şişesi', 'Seramik yağdanlık', 2),
  ('Sofra servisi', 'Tuzluk ve biberlik', 'Cam', 1),
  ('Sofra servisi', 'Tuzluk ve biberlik', 'Seramik', 2),
  ('Sofra servisi', 'Tuzluk ve biberlik', 'Ahşap', 3),
  ('Sofra servisi', 'Paylaşımlı servis tabağı', 'Seramik', 1),
  ('Sofra servisi', 'Paylaşımlı servis tabağı', 'Ahşap tahta', 2),
  ('Sofra servisi', 'Paylaşımlı servis tabağı', 'Porselen', 3),
  ('Sofra servisi', 'Servis tepsisi', 'Ahşap', 1),
  ('Sofra servisi', 'Servis tepsisi', 'Pirinç', 2),
  ('Sofra servisi', 'Servis tepsisi', 'Rattan', 3),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 'Kâğıt fener beyaz', 1),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 'Kâğıt fener renkli', 2),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 'Metal fener', 3),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 'Cam kavanoz fener', 4),
  ('Işıklandırma', 'Ağaç gövdesi aydınlatması', 'Sıcak beyaz', 1),
  ('Işıklandırma', 'Ağaç gövdesi aydınlatması', 'Amber', 2),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 'Küçük (60 cm) beyaz', 1),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 'Küçük (60 cm) pembe', 2),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 'Büyük (100 cm) beyaz', 3),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 'Büyük (100 cm) pembe', 4),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', '10 m', 1),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', '20 m', 2),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', '50 m', 3),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', 'Çapraz tavan (100 m)', 4),
  ('Işıklandırma', 'Mantar ısıtıcı', 'Gazlı', 1),
  ('Işıklandırma', 'Mantar ısıtıcı', 'Elektrikli', 2),
  ('Işıklandırma', 'Peri ışıkları', 'Ağaç sarma', 1),
  ('Işıklandırma', 'Peri ışıkları', 'Perde', 2),
  ('Işıklandırma', 'Meşale', 'Bambu', 1),
  ('Işıklandırma', 'Meşale', 'Metal', 2),
  ('Işıklandırma', 'Ağaçtan avize', 'Kristal', 1),
  ('Işıklandırma', 'Ağaçtan avize', 'Rattan', 2),
  ('Işıklandırma', 'Ağaçtan avize', 'Mumlu', 3),
  ('Karşılama', 'Karşılama panosu', 'Ahşap', 1),
  ('Karşılama', 'Karşılama panosu', 'Akrilik', 2),
  ('Karşılama', 'Karşılama panosu', 'Ayna', 3),
  ('Karşılama', 'Karşılama panosu', 'Kanvas', 4),
  ('Karşılama', 'Oturma planı panosu', 'Ahşap', 1),
  ('Karşılama', 'Oturma planı panosu', 'Akrilik', 2),
  ('Karşılama', 'Oturma planı panosu', 'Ayna', 3),
  ('Karşılama', 'Oturma planı panosu', 'Asılı kartlar', 4),
  ('Karşılama', 'Anı defteri masası', 'Klasik defter', 1),
  ('Karşılama', 'Anı defteri masası', 'Polaroid defteri', 2),
  ('Karşılama', 'Anı defteri masası', 'İmzalı ahşap kalp', 3),
  ('Karşılama', 'Anı defteri masası', 'Sesli anı telefonu', 4),
  ('Karşılama', 'Hediye ve zarf kutusu', 'Ahşap kutu', 1),
  ('Karşılama', 'Hediye ve zarf kutusu', 'Kafes', 2),
  ('Karşılama', 'Hediye ve zarf kutusu', 'Akrilik', 3),
  ('Karşılama', 'Fotoğraflı anı köşesi', 'Çerçeveler', 1),
  ('Karşılama', 'Fotoğraflı anı köşesi', 'İp ve mandal', 2),
  ('Karşılama', 'Fotoğraflı anı köşesi', 'Ayna üzerine', 3),
  ('Karşılama', 'İçecek karşılama standı', 'Limonata', 1),
  ('Karşılama', 'İçecek karşılama standı', 'Şerbet', 2),
  ('Karşılama', 'İçecek karşılama standı', 'Su istasyonu', 3),
  ('Karşılama', 'Yelpaze / şemsiye sepeti', 'Hasır yelpaze', 1),
  ('Karşılama', 'Yelpaze / şemsiye sepeti', 'Kâğıt yelpaze', 2),
  ('Karşılama', 'Yelpaze / şemsiye sepeti', 'Güneş şemsiyesi', 3),
  ('Karşılama', 'Terlik sepeti', 'Babet', 1),
  ('Karşılama', 'Terlik sepeti', 'Terlik', 2),
  ('Karşılama', 'Lavanta / pirinç atma', 'Kâğıt koni', 1),
  ('Karşılama', 'Lavanta / pirinç atma', 'Keten kese', 2),
  ('Lounge', 'Minder ve puflar', 'Örgü puf', 1),
  ('Lounge', 'Minder ve puflar', 'Yer minderi', 2),
  ('Lounge', 'Minder ve puflar', 'Bohem kırlent', 3),
  ('Lounge', 'Kilim ve halılar', '160×230 cm', 1),
  ('Lounge', 'Kilim ve halılar', '200×300 cm', 2),
  ('Lounge', 'Kilim ve halılar', 'Yuvarlak Ø200 cm', 3),
  ('Lounge', 'Rattan koltuklar', 'Tavuskuşu', 1),
  ('Lounge', 'Rattan koltuklar', 'Tekli', 2),
  ('Lounge', 'Rattan koltuklar', 'İkili kanepe', 3),
  ('Lounge', 'Saman balyası oturma', 'Tek balya', 1),
  ('Lounge', 'Saman balyası oturma', 'Kilimle örtülü', 2),
  ('Lounge', 'Battaniye sepeti', 'Keten', 1),
  ('Lounge', 'Battaniye sepeti', 'Örgü', 2),
  ('Lounge', 'Battaniye sepeti', 'Polar', 3),
  ('Lounge', 'Alçak sehpa', 'Ahşap palet', 1),
  ('Lounge', 'Alçak sehpa', 'Rattan', 2),
  ('Lounge', 'Alçak sehpa', 'Pirinç tepsi', 3),
  ('Lounge', 'Şezlong ve büyük minder', 'Şezlong', 1),
  ('Lounge', 'Şezlong ve büyük minder', 'Büyük yer minderi', 2),
  ('Lounge', 'Sedir', 'Ahşap', 1),
  ('Lounge', 'Sedir', 'Kilim kaplı', 2),
  ('Nikah alanı', 'Nikah masası', 'Ahşap', 1),
  ('Nikah alanı', 'Nikah masası', 'Beyaz örtülü', 2),
  ('Nikah alanı', 'Nikah masası', 'Çiçekli', 3),
  ('Nikah alanı', 'Ahşap altıgen kemer', '2 m', 1),
  ('Nikah alanı', 'Ahşap altıgen kemer', '2,5 m', 2),
  ('Nikah alanı', 'Ahşap altıgen kemer', '3 m', 3),
  ('Nikah alanı', 'Tül perdeli kemer', 'Beyaz tül', 1),
  ('Nikah alanı', 'Tül perdeli kemer', 'Krem tül', 2),
  ('Nikah alanı', 'Çember kemer', '1,8 m', 1),
  ('Nikah alanı', 'Çember kemer', '2,2 m', 2),
  ('Nikah alanı', 'Jüt yol halısı', '10 m', 1),
  ('Nikah alanı', 'Jüt yol halısı', '15 m', 2),
  ('Nikah alanı', 'Jüt yol halısı', '20 m', 3),
  ('Nikah alanı', 'Yol kenarı çiçekleri', 'Kavanozda', 1),
  ('Nikah alanı', 'Yol kenarı çiçekleri', 'Sandalye ucuna', 2),
  ('Nikah alanı', 'Yol kenarı çiçekleri', 'Yerde aranjman', 3),
  ('Nikah alanı', 'Lavanta / yaprak serpme', 'Lavanta', 1),
  ('Nikah alanı', 'Lavanta / yaprak serpme', 'Gül yaprağı', 2),
  ('Nikah alanı', 'Lavanta / yaprak serpme', 'Zeytin yaprağı', 3),
  ('Nikah alanı', 'Fenerli yol', '6 fener', 1),
  ('Nikah alanı', 'Fenerli yol', '10 fener', 2),
  ('Nikah alanı', 'Fenerli yol', '16 fener', 3),
  ('Nikah alanı', 'Nikah için ses ve mikrofon', 'Tek mikrofon', 1),
  ('Nikah alanı', 'Nikah için ses ve mikrofon', 'Mikrofon ve müzik', 2),
  ('Nikah alanı', 'Nikah oturma düzeni', 'Düz sıralar', 1),
  ('Nikah alanı', 'Nikah oturma düzeni', 'Yarım daire', 2),
  ('Nikah alanı', 'Yüzük kutusu', 'Ahşap', 1),
  ('Nikah alanı', 'Yüzük kutusu', 'Yosunlu', 2),
  ('Nikah alanı', 'Yüzük kutusu', 'Seramik', 3),
  ('Nikah alanı', 'Kürsü', 'Ahşap', 1),
  ('Nikah alanı', 'Kürsü', 'Akrilik', 2),
  ('Gölgelik ve çadır', 'Tente / gölgelik', '3×3 m', 1),
  ('Gölgelik ve çadır', 'Tente / gölgelik', '6×3 m', 2),
  ('Gölgelik ve çadır', 'Tente / gölgelik', '10×5 m', 3),
  ('Gölgelik ve çadır', 'Şeffaf çadır', '10×5 m', 1),
  ('Gölgelik ve çadır', 'Şeffaf çadır', '15×10 m', 2),
  ('Gölgelik ve çadır', 'Bez yelken (gölgelik)', 'Üçgen', 1),
  ('Gölgelik ve çadır', 'Bez yelken (gölgelik)', 'Dörtgen', 2),
  ('Gölgelik ve çadır', 'Büyük şemsiye', '3 m', 1),
  ('Gölgelik ve çadır', 'Büyük şemsiye', '4 m', 2),
  ('Gölgelik ve çadır', 'Rüzgâr perdesi', 'Şeffaf', 1),
  ('Gölgelik ve çadır', 'Rüzgâr perdesi', 'Beyaz', 2),
  ('Bar ve içecek', 'Bar tezgahı', 'Ahşap 2 m', 1),
  ('Bar ve içecek', 'Bar tezgahı', 'Ahşap 3 m', 2),
  ('Bar ve içecek', 'Bar tezgahı', 'Fıçı bar', 3),
  ('Bar ve içecek', 'Bar taburesi', 'Ahşap', 1),
  ('Bar ve içecek', 'Bar taburesi', 'Rattan', 2),
  ('Bar ve içecek', 'Bar taburesi', 'Metal', 3),
  ('Bar ve içecek', 'İçecek dolabı', 'Tek kapı', 1),
  ('Bar ve içecek', 'İçecek dolabı', 'Çift kapı', 2),
  ('Bar ve içecek', 'Limonata dispenseri', '5 L', 1),
  ('Bar ve içecek', 'Limonata dispenseri', '8 L', 2),
  ('Bar ve içecek', 'Şarap fıçısı süsleme', 'Tek fıçı', 1),
  ('Bar ve içecek', 'Şarap fıçısı süsleme', 'Fıçı ve tahta', 2),
  ('Pasta ve tatlı sunumu', 'Pasta standı', 'Ahşap kütük', 1),
  ('Pasta ve tatlı sunumu', 'Pasta standı', 'Cam kubbe', 2),
  ('Pasta ve tatlı sunumu', 'Pasta standı', 'Altın ayaklı', 3),
  ('Pasta ve tatlı sunumu', 'Pasta bıçağı seti', 'Altın', 1),
  ('Pasta ve tatlı sunumu', 'Pasta bıçağı seti', 'Gümüş', 2),
  ('Pasta ve tatlı sunumu', 'Pasta bıçağı seti', 'Ahşap saplı', 3),
  ('Pasta ve tatlı sunumu', 'Tatlı büfesi', 'Küçük (2 m)', 1),
  ('Pasta ve tatlı sunumu', 'Tatlı büfesi', 'Büyük (3 m)', 2),
  ('Pasta ve tatlı sunumu', 'Kurabiye standı', '2 katlı', 1),
  ('Pasta ve tatlı sunumu', 'Kurabiye standı', '3 katlı', 2),
  ('Fotoğraf köşesi', 'Fotoğraf arka fonu', 'Çiçek duvarı', 1),
  ('Fotoğraf köşesi', 'Fotoğraf arka fonu', 'Pampas duvarı', 2),
  ('Fotoğraf köşesi', 'Fotoğraf arka fonu', 'Yeşil yaprak duvarı', 3),
  ('Fotoğraf köşesi', 'Fotoğraf arka fonu', 'Makrome perde', 4),
  ('Fotoğraf köşesi', 'Polaroid misafir kamerası', '1 kamera · 50 film', 1),
  ('Fotoğraf köşesi', 'Polaroid misafir kamerası', '2 kamera · 100 film', 2),
  ('Fotoğraf köşesi', 'Fotoğraf aksesuarları', 'Yazılı tabelalar', 1),
  ('Fotoğraf köşesi', 'Fotoğraf aksesuarları', 'Şapka ve gözlük', 2),
  ('Fotoğraf köşesi', 'Boy aynası', 'Ahşap çerçeveli', 1),
  ('Fotoğraf köşesi', 'Boy aynası', 'Altın çerçeveli', 2),
  ('Çocuk köşesi', 'Çocuk masası', '6 kişilik', 1),
  ('Çocuk köşesi', 'Çocuk masası', '10 kişilik', 2),
  ('Çocuk köşesi', 'Boyama seti', 'Boyama kitabı', 1),
  ('Çocuk köşesi', 'Boyama seti', 'Tebeşir tahtası', 2),
  ('Çocuk köşesi', 'Oyun alanı', 'Yer minderleri', 1),
  ('Çocuk köşesi', 'Oyun alanı', 'Kızılderili çadırı', 2),
  ('Tabela ve yönlendirme', 'Yön tabelası', 'Ahşap ok', 1),
  ('Tabela ve yönlendirme', 'Yön tabelası', 'Akrilik', 2),
  ('Tabela ve yönlendirme', 'Program (akış) tabelası', 'Ahşap', 1),
  ('Tabela ve yönlendirme', 'Program (akış) tabelası', 'Akrilik', 2),
  ('Tabela ve yönlendirme', 'Program (akış) tabelası', 'Ayna', 3),
  ('Tabela ve yönlendirme', 'Bar menüsü tabelası', 'Ahşap', 1),
  ('Tabela ve yönlendirme', 'Bar menüsü tabelası', 'Kara tahta', 2),
  ('Tabela ve yönlendirme', 'Telefonsuz tören tabelası', 'Ahşap', 1),
  ('Tabela ve yönlendirme', 'Telefonsuz tören tabelası', 'Akrilik', 2),
  ('Misafir konforu', 'Sinek kovucu istasyonu', 'Sprey', 1),
  ('Misafir konforu', 'Sinek kovucu istasyonu', 'Bileklik', 2),
  ('Misafir konforu', 'Güneş kremi sepeti', 'Sepet', 1),
  ('Misafir konforu', 'Islak mendil ve bakım sepeti', 'Tuvalet sepeti', 1),
  ('Misafir konforu', 'Islak mendil ve bakım sepeti', 'Masa başı', 2),
  ('Misafir konforu', 'Yağmur şemsiyesi', 'Şeffaf', 1),
  ('Misafir konforu', 'Yağmur şemsiyesi', 'Siyah', 2),
  ('Kâğıt ürünler', 'Davetiye', 'Kraft', 1),
  ('Kâğıt ürünler', 'Davetiye', 'Krem', 2),
  ('Kâğıt ürünler', 'Davetiye', 'Kuru çiçekli', 3),
  ('Kâğıt ürünler', 'Davetiye', 'Mühürlü zarf', 4),
  ('Kâğıt ürünler', 'Tarihi kaydet kartı', 'Kart', 1),
  ('Kâğıt ürünler', 'Tarihi kaydet kartı', 'Magnet', 2),
  ('Kâğıt ürünler', 'Teşekkür kartı', 'Kart', 1),
  ('Kâğıt ürünler', 'Teşekkür kartı', 'Fotoğraflı', 2),
  ('Kâğıt ürünler', 'Zarf mührü', 'Altın', 1),
  ('Kâğıt ürünler', 'Zarf mührü', 'Bordo', 2),
  ('Kâğıt ürünler', 'Zarf mührü', 'Yeşil', 3),
  ('Altyapı', 'Jeneratör', '5 kVA', 1),
  ('Altyapı', 'Jeneratör', '10 kVA', 2),
  ('Altyapı', 'Jeneratör', '20 kVA', 3),
  ('Altyapı', 'Seyyar tuvalet kabini', 'Standart', 1),
  ('Altyapı', 'Seyyar tuvalet kabini', 'Lavabolu', 2),
  ('Altyapı', 'Seyyar tuvalet kabini', 'Engelli erişimli', 3),
  ('Altyapı', 'Sahne / podyum', '3×2 m', 1),
  ('Altyapı', 'Sahne / podyum', '4×3 m', 2),
  ('Altyapı', 'Sahne / podyum', '6×4 m', 3),
  ('Altyapı', 'Zemin / çim koruma halısı', '50 m²', 1),
  ('Altyapı', 'Zemin / çim koruma halısı', '100 m²', 2),
  ('Altyapı', 'Zemin / çim koruma halısı', '200 m²', 3),
  ('Altyapı', 'Atık ve geri dönüşüm istasyonu', '2 bölmeli', 1),
  ('Altyapı', 'Atık ve geri dönüşüm istasyonu', '4 bölmeli', 2),
  ('Altyapı', 'Elektrik dağıtımı ve uzatma', 'Standart', 1),
  ('Altyapı', 'Elektrik dağıtımı ve uzatma', 'Kapsamlı', 2)
) as v (grup, ust, ad, sira)
join public.dugun_katalog u on u.tur = 'urun' and u.grup = v.grup and u.ad = v.ust and u.ust_id is null
where not exists (select 1 from public.dugun_katalog k where k.ust_id = u.id and k.ad = v.ad);

-- Lisanslı fotoğraflar: yalnız resmi olmayan ya da çizim olan kalemde
update public.dugun_katalog k set resim = '/dugun/foto/' || f.dosya
from (values
  ('Sandalye', 'Ahşap katlanır', 'sandalye-ahsap-katlanir.jpg'), ('Sandalye', 'Şeffaf Tiffany', 'sandalye-seffaf-tiffany.jpg'),
  ('Sandalye', 'Rattan', 'sandalye-rattan.jpg'), ('Sandalye', 'Çapraz sırtlı ahşap', 'sandalye-capraz-sirtli-ahsap.jpg'),
  ('Sandalye', 'Altın Chiavari', 'sandalye-altin-chiavari.jpg'), ('Sandalye', 'Ahşap bank', 'sandalye-ahsap-bank.jpg'),
  ('Masa', 'Uzun ahşap köy masası', 'masa-uzun-ahsap-koy-masasi.jpg'), ('Masa', 'Yuvarlak masa', 'masa-yuvarlak-masa.jpg'),
  ('Masa', 'Kokteyl (bistro) masası', 'masa-kokteyl-bistro-masasi.jpg'), ('Masa', 'Gelin ve damat masası', 'masa-gelin-ve-damat-masasi.jpg'),
  ('Masa', 'Büfe / servis masası', 'masa-bufe-servis-masasi.jpg'),
  ('Örtü', 'Doğal keten', 'ortu-dogal-keten.jpg'), ('Örtü', 'Beyaz pamuk', 'ortu-beyaz-pamuk.jpg'),
  ('Örtü', 'Örtüsüz ahşap masa', 'ortu-ortusuz-ahsap-masa.jpg'), ('Örtü', 'Tül runner', 'ortu-tul-runner.jpg'),
  ('Örtü', 'Keten runner', 'ortu-keten-runner.jpg'), ('Örtü', 'Canlı okaliptüs runner', 'ortu-canli-okaliptus-runner.jpg'),
  ('Peçete', 'Keten peçete', 'pecete-keten-pecete.jpg'), ('Peçete', 'Pamuk peçete', 'pecete-pamuk-pecete.jpg'),
  ('Peçete', 'Altın peçete halkası', 'pecete-altin-pecete-halkasi.jpg'), ('Peçete', 'Peçetede kuru çiçek dalı', 'pecete-pecetede-kuru-cicek-dali.jpg'),
  ('Tabak ve supla', 'Altın supla', 'tabak-ve-supla-altin-supla.jpg'), ('Tabak ve supla', 'Rattan supla', 'tabak-ve-supla-rattan-supla.jpg'),
  ('Tabak ve supla', 'Şeffaf cam supla', 'tabak-ve-supla-seffaf-cam-supla.jpg'), ('Tabak ve supla', 'El yapımı seramik tabak', 'tabak-ve-supla-el-yapimi-seramik-tabak.jpg'),
  ('Tabak ve supla', 'Beyaz porselen tabak', 'tabak-ve-supla-beyaz-porselen-tabak.jpg'),
  ('Çatal bıçak', 'Altın', 'catal-bicak-altin.jpg'), ('Çatal bıçak', 'Klasik gümüş', 'catal-bicak-klasik-gumus.jpg'),
  ('Bardak', 'Kristal kadeh', 'bardak-kristal-kadeh.jpg'), ('Bardak', 'Amber cam bardak', 'bardak-amber-cam-bardak.jpg'),
  ('Bardak', 'Füme cam bardak', 'bardak-fume-cam-bardak.jpg'), ('Bardak', 'Cam su sürahisi', 'bardak-cam-su-surahisi.jpg'),
  ('Bardak', 'Buz kovası / şarap soğutucu', 'bardak-buz-kovasi-sarap-sogutucu.jpg'),
  ('Mum', 'Cam fanuslu mumlar', 'mum-cam-fanuslu-mumlar.jpg'), ('Mum', 'Uzun şamdanlar', 'mum-uzun-samdanlar.jpg'),
  ('Mum', 'Tealight mumlar', 'mum-tealight-mumlar.jpg'), ('Mum', 'LED mumlar (rüzgâra dayanıklı)', 'mum-led-mumlar-ruzgara-dayanikli.jpg'),
  ('Mum', 'Masa feneri', 'mum-masa-feneri.jpg'),
  ('Çiçek', 'Kır çiçekleri', 'cicek-kir-cicekleri.jpg'), ('Çiçek', 'Okaliptüs ve beyaz gül', 'cicek-okaliptus-ve-beyaz-gul.jpg'),
  ('Çiçek', 'Pampas ve kuru çiçek', 'cicek-pampas-ve-kuru-cicek.jpg'), ('Çiçek', 'Zeytin dalı', 'cicek-zeytin-dali.jpg'),
  ('Çiçek', 'Lavanta', 'cicek-lavanta.jpg'), ('Çiçek', 'Ayçiçeği', 'cicek-aycicegi.jpg'),
  ('Çiçek', 'Kuru çiçek buketleri', 'cicek-kuru-cicek-buketleri.jpg'), ('Çiçek', 'Saksıda zeytin fidanı', 'cicek-saksida-zeytin-fidani.jpg'),
  ('Çiçek', 'Gelin buketi', 'cicek-gelin-buketi.jpg'),
  ('Işıklandırma', 'Ağaçlara asılı fenerler', 'isiklandirma-agaclara-asili-fenerler.jpg'),
  ('Işıklandırma', 'Ağaç gövdesi aydınlatması', 'isiklandirma-agac-govdesi-aydinlatmasi.jpg'),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 'isiklandirma-isimlerinizle-neon-yazi.jpg'),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', 'isiklandirma-ampul-zinciri-dis-mekan.jpg'),
  ('Işıklandırma', 'Mantar ısıtıcı', 'isiklandirma-mantar-isitici.jpg'),
  ('Karşılama', 'Karşılama panosu', 'karsilama-karsilama-panosu.jpg'), ('Karşılama', 'Oturma planı panosu', 'karsilama-oturma-plani-panosu.jpg'),
  ('Karşılama', 'Anı defteri masası', 'karsilama-ani-defteri-masasi.jpg'), ('Karşılama', 'Hediye ve zarf kutusu', 'karsilama-hediye-ve-zarf-kutusu.jpg'),
  ('Karşılama', 'Fotoğraflı anı köşesi', 'karsilama-fotografli-ani-kosesi.jpg'),
  ('Karşılama', 'İçecek karşılama standı', 'karsilama-icecek-karsilama-standi.jpg'),
  ('Karşılama', 'Yelpaze / şemsiye sepeti', 'karsilama-yelpaze-semsiye-sepeti.jpg'),
  ('Lounge', 'Minder ve puflar', 'lounge-minder-ve-puflar.jpg'), ('Lounge', 'Kilim ve halılar', 'lounge-kilim-ve-halilar.jpg'),
  ('Lounge', 'Rattan koltuklar', 'lounge-rattan-koltuklar.jpg'), ('Lounge', 'Saman balyası oturma', 'lounge-saman-balyasi-oturma.jpg'),
  ('Lounge', 'Battaniye sepeti', 'lounge-battaniye-sepeti.jpg'),
  ('Masa kartı', 'İsim kartları', 'masa-karti-isim-kartlari.jpg'), ('Masa kartı', 'Masa numaraları', 'masa-karti-masa-numaralari.jpg'),
  ('Masa kartı', 'Menü kartları', 'masa-karti-menu-kartlari.jpg'),
  ('Nikah alanı', 'Nikah masası', 'nikah-alani-nikah-masasi.jpg'), ('Nikah alanı', 'Ahşap altıgen kemer', 'nikah-alani-ahsap-altigen-kemer.jpg'),
  ('Nikah alanı', 'Tül perdeli kemer', 'nikah-alani-tul-perdeli-kemer.jpg'), ('Nikah alanı', 'Jüt yol halısı', 'nikah-alani-jut-yol-halisi.jpg'),
  ('Nikah alanı', 'Yol kenarı çiçekleri', 'nikah-alani-yol-kenari-cicekleri.jpg'),
  ('Nikah alanı', 'Lavanta / yaprak serpme', 'nikah-alani-lavanta-yaprak-serpme.jpg'), ('Nikah alanı', 'Fenerli yol', 'nikah-alani-fenerli-yol.jpg'),
  ('Nikah alanı', 'Nikah için ses ve mikrofon', 'nikah-alani-nikah-icin-ses-ve-mikrofon.jpg'),
  ('Sandalye süsü', 'Sırtta çiçek demeti', 'sandalye-susu-sirtta-cicek-demeti.jpg'), ('Sandalye süsü', 'Keten kurdele', 'sandalye-susu-keten-kurdele.jpg'),
  ('Sandalye süsü', 'Okaliptüs dalı', 'sandalye-susu-okaliptus-dali.jpg'),
  ('Altyapı', 'Seyyar tuvalet kabini', 'altyapi-seyyar-tuvalet-kabini.jpg'), ('Altyapı', 'Atık ve geri dönüşüm istasyonu', 'altyapi-atik-ve-geri-donusum-istasyonu.jpg')
) as f (grup, ad, dosya)
where k.tur = 'urun' and k.grup = f.grup and k.ad = f.ad and (k.resim is null or k.resim like '/dugun/cizim/%');

-- Başlangıç maliyetleri: yalnız kaynağı bulunan 2026 fiyatları; kâr boş (fiyat yönetici kârı girince oluşur)
insert into public.dugun_maliyetler (katalog_id, alis, kira, esas, birim, notlar)
select k.id, m.alis, m.kira, m.esas, m.birim, m.notlar from (values
  ('Sandalye', 'Ahşap katlanır', 2200::numeric, null::numeric, 'alis', 'adet', 'Alış 1.209–3.965 TL (N11, Trendyol), Kasım 2026'),
  ('Sandalye', 'Şeffaf Tiffany', 3700, 175, 'kira', 'adet', 'Alış 3.500–3.880 TL; kira 150–200 TL (İstanbul firmaları), 2026'),
  ('Sandalye', 'Rattan', null, null, 'alis', 'adet', 'Alış 800–5.700 TL: model farkı büyük, ortalama yazılmadı'),
  ('Sandalye', 'Çapraz sırtlı ahşap', null, 200, 'kira', 'adet', 'Kira: ahşap crossback minderli 200 TL, 2026'),
  ('Sandalye', 'Altın Chiavari', null, 150, 'kira', 'adet', 'Kira: gold Tiffany 150 TL, 2026'),
  ('Sandalye', 'Ahşap bank', null, null, 'alis', 'adet', 'Alış 1.100–15.000 TL: boyuta göre çok değişiyor'),
  ('Masa', 'Yuvarlak masa', null, 875, 'kira', 'adet', 'Kira 750–1.000 TL, örtüyle (10 kişilik), 2026'),
  ('Masa', 'Kokteyl (bistro) masası', null, 1000, 'kira', 'adet', 'Kira örtülü 1.000 TL''den, 2026'),
  ('Masa', 'Büfe / servis masası', null, 1000, 'kira', 'adet', 'Kira: servis masası 1.000 TL, 2026'),
  ('Örtü', 'Doğal keten', 950, null, 'alis', 'adet', 'Keten görünümlü 150×200 (English Home); 160×300 için fiyat yok'),
  ('Örtü', 'Örtüsüz ahşap masa', 0, 0, 'kira', 'adet', 'Maliyet yok'),
  ('Tabak ve supla', 'Altın supla', 290, null, 'alis', 'adet', 'Cam altın supla 33 cm, 166–424 TL / adet'),
  ('Tabak ve supla', 'Şeffaf cam supla', 350, null, 'alis', 'adet', 'Lora Bianca 6''lı 2.099 TL'),
  ('Çatal bıçak', 'Altın', 440, null, 'alis', 'kisi', '6 kişilik 24 parça 2.300–2.800 TL'),
  ('Çatal bıçak', 'Mat siyah', 550, null, 'alis', 'kisi', '6 kişilik 24 parça 1.950–4.700 TL'),
  ('Bardak', 'Kristal kadeh', 80, null, 'alis', 'adet', 'Paşabahçe 6''lı 272–645 TL'),
  ('Mum', 'Cam fanuslu mumlar', 530, null, 'alis', 'adet', 'Cam mumluk 360–700 TL (Karaca)'),
  ('Mum', 'Tealight mumlar', 7, null, 'alis', 'adet', '100''lü ≈ 690 TL; tek kullanımlık'),
  ('Çiçek', 'Gelin buketi', 3000, null, 'alis', 'sabit', 'Canlı buket ortalaması (NTV Para; tarih belirsiz)'),
  ('Işıklandırma', 'İsimlerinizle neon yazı', 4300, null, 'alis', 'sabit', 'İsme özel 4.256–4.400 TL (Trendyol)'),
  ('Işıklandırma', 'Ampul zinciri (dış mekan)', 150, null, 'alis', 'metre', '10 m 1.780 TL, 20 m 2.905 TL (Trendyol)'),
  ('Karşılama', 'Karşılama panosu', 580, null, 'alis', 'adet', '50×70 cm, 519–649 TL (Çiçeksepeti)'),
  ('Lounge', 'Minder ve puflar', null, null, 'alis', 'adet', 'Alış 144–2.590 TL: model belirlenmeli'),
  ('Lounge', 'Kilim ve halılar', 2870, null, 'alis', 'adet', '160×230, 2.799–2.944 TL (Koçtaş)'),
  ('Nikah alanı', 'Nikah masası', null, 10000, 'kira', 'sabit', 'Kira: süslü nikah masası seti 10.000 TL, 2026'),
  ('Altyapı', 'Jeneratör', null, null, 'kira', 'sabit', 'Kira fiyatı yayınlanmıyor; 6 kVA satın alma ≈ 43.800 TL')
) as m (grup, ad, alis, kira, esas, birim, notlar)
join public.dugun_katalog k on k.tur = 'urun' and k.grup = m.grup and k.ad = m.ad
on conflict (katalog_id) do nothing;
