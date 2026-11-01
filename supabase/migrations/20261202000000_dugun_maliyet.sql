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
