-- Forest Club Urla: düğün kataloğuna kalem kalem ürünler (27.11.2026). Düğün süsleme ve kiralama listelerindeki kalemler
-- gruplara ayrılır: masa, örtü ve runner, peçete, tabak ve supla, çatal bıçak, bardak, çiçek, mum, masa kartı, sandalye,
-- sandalye süsü (masa adımı) ile nikah alanı, karşılama, lounge, ışıklandırma (alan adımı). Resimler grup çizimi;
-- fotoğraf bulununca yönetimden yüklenir. Aynı tür ve adla kalem varsa eklenmez (göç tekrar çalışabilir).
insert into public.dugun_katalog (tur, ad, resim, grup, sira, aciklama)
select v.tur, v.ad, v.resim, v.grup, v.sira, v.aciklama from (values
  ('urun', 'Uzun ahşap köy masası', '/dugun/cizim/masa.svg', 'Masa', 10, null),
  ('urun', 'Yuvarlak masa', '/dugun/cizim/masa.svg', 'Masa', 11, null),
  ('urun', 'Kokteyl (bistro) masası', '/dugun/cizim/masa.svg', 'Masa', 12, null),
  ('urun', 'Gelin ve damat masası', '/dugun/cizim/masa.svg', 'Masa', 13, null),
  ('urun', 'Tül runner', '/dugun/cizim/ortu.svg', 'Örtü', 10, null),
  ('urun', 'Keten runner', '/dugun/cizim/ortu.svg', 'Örtü', 11, null),
  ('urun', 'Canlı okaliptüs runner', '/dugun/cizim/ortu.svg', 'Örtü', 12, null),
  ('urun', 'Keten peçete', '/dugun/cizim/pecete.svg', 'Peçete', 10, null),
  ('urun', 'Pamuk peçete', '/dugun/cizim/pecete.svg', 'Peçete', 11, null),
  ('urun', 'Altın peçete halkası', '/dugun/cizim/pecete.svg', 'Peçete', 12, null),
  ('urun', 'Peçetede kuru çiçek dalı', '/dugun/cizim/pecete.svg', 'Peçete', 13, null),
  ('urun', 'Altın supla', '/dugun/cizim/tabak.svg', 'Tabak ve supla', 10, null),
  ('urun', 'Rattan supla', '/dugun/cizim/tabak.svg', 'Tabak ve supla', 11, null),
  ('urun', 'Şeffaf cam supla', '/dugun/cizim/tabak.svg', 'Tabak ve supla', 12, null),
  ('urun', 'El yapımı seramik tabak', '/dugun/cizim/tabak.svg', 'Tabak ve supla', 13, null),
  ('urun', 'Beyaz porselen tabak', '/dugun/cizim/tabak.svg', 'Tabak ve supla', 14, null),
  ('urun', 'Altın', '/dugun/cizim/catal.svg', 'Çatal bıçak', 10, null),
  ('urun', 'Mat siyah', '/dugun/cizim/catal.svg', 'Çatal bıçak', 11, null),
  ('urun', 'Klasik gümüş', '/dugun/cizim/catal.svg', 'Çatal bıçak', 12, null),
  ('urun', 'Kristal kadeh', '/dugun/cizim/bardak.svg', 'Bardak', 10, null),
  ('urun', 'Amber cam bardak', '/dugun/cizim/bardak.svg', 'Bardak', 11, null),
  ('urun', 'Füme cam bardak', '/dugun/cizim/bardak.svg', 'Bardak', 12, null),
  ('urun', 'Cam su sürahisi', '/dugun/cizim/bardak.svg', 'Bardak', 13, null),
  ('urun', 'Lavanta', '/dugun/cizim/cicek.svg', 'Çiçek', 10, null),
  ('urun', 'Ayçiçeği', '/dugun/cizim/cicek.svg', 'Çiçek', 11, null),
  ('urun', 'Kuru çiçek buketleri', '/dugun/cizim/cicek.svg', 'Çiçek', 12, null),
  ('urun', 'Saksıda zeytin fidanı', '/dugun/cizim/cicek.svg', 'Çiçek', 13, null),
  ('urun', 'Tealight mumlar', '/dugun/cizim/mum.svg', 'Mum', 10, null),
  ('urun', 'LED mumlar (rüzgâra dayanıklı)', '/dugun/cizim/mum.svg', 'Mum', 11, null),
  ('urun', 'Masa feneri', '/dugun/cizim/mum.svg', 'Mum', 12, null),
  ('urun', 'İsim kartları', '/dugun/cizim/kart.svg', 'Masa kartı', 10, null),
  ('urun', 'Masa numaraları', '/dugun/cizim/kart.svg', 'Masa kartı', 11, null),
  ('urun', 'Menü kartları', '/dugun/cizim/kart.svg', 'Masa kartı', 12, null),
  ('urun', 'Yaprağa yazılı isimler', '/dugun/cizim/kart.svg', 'Masa kartı', 13, null),
  ('urun', 'Çapraz sırtlı ahşap', '/dugun/cizim/sandalye.svg', 'Sandalye', 10, null),
  ('urun', 'Altın Chiavari', '/dugun/cizim/sandalye.svg', 'Sandalye', 11, null),
  ('urun', 'Ahşap bank', '/dugun/cizim/sandalye.svg', 'Sandalye', 12, null),
  ('urun', 'Sırtta çiçek demeti', '/dugun/cizim/cicek.svg', 'Sandalye süsü', 10, null),
  ('urun', 'Keten kurdele', '/dugun/cizim/cicek.svg', 'Sandalye süsü', 11, null),
  ('urun', 'Okaliptüs dalı', '/dugun/cizim/cicek.svg', 'Sandalye süsü', 12, null),
  ('urun', 'Nikah masası', '/dugun/cizim/kemer.svg', 'Nikah alanı', 10, null),
  ('urun', 'Ahşap altıgen kemer', '/dugun/cizim/kemer.svg', 'Nikah alanı', 11, null),
  ('urun', 'Tül perdeli kemer', '/dugun/cizim/kemer.svg', 'Nikah alanı', 12, null),
  ('urun', 'Çember kemer', '/dugun/cizim/kemer.svg', 'Nikah alanı', 13, null),
  ('urun', 'Jüt yol halısı', '/dugun/cizim/yol.svg', 'Nikah alanı', 14, null),
  ('urun', 'Yol kenarı çiçekleri', '/dugun/cizim/yol.svg', 'Nikah alanı', 15, null),
  ('urun', 'Lavanta / yaprak serpme', '/dugun/cizim/yol.svg', 'Nikah alanı', 16, null),
  ('urun', 'Fenerli yol', '/dugun/cizim/fener.svg', 'Nikah alanı', 17, null),
  ('urun', 'Karşılama panosu', '/dugun/cizim/pano.svg', 'Karşılama', 10, null),
  ('urun', 'Oturma planı panosu', '/dugun/cizim/pano.svg', 'Karşılama', 11, null),
  ('urun', 'Anı defteri masası', '/dugun/cizim/pano.svg', 'Karşılama', 12, null),
  ('urun', 'Hediye ve zarf kutusu', '/dugun/cizim/pano.svg', 'Karşılama', 13, null),
  ('urun', 'Fotoğraflı anı köşesi', '/dugun/cizim/pano.svg', 'Karşılama', 14, null),
  ('urun', 'Minder ve puflar', '/dugun/cizim/lounge.svg', 'Lounge', 10, null),
  ('urun', 'Kilim ve halılar', '/dugun/cizim/lounge.svg', 'Lounge', 11, null),
  ('urun', 'Rattan koltuklar', '/dugun/cizim/lounge.svg', 'Lounge', 12, null),
  ('urun', 'Saman balyası oturma', '/dugun/cizim/lounge.svg', 'Lounge', 13, null),
  ('urun', 'Ağaçlara asılı fenerler', '/dugun/cizim/fener.svg', 'Işıklandırma', 10, null),
  ('urun', 'Ağaç gövdesi aydınlatması', '/dugun/cizim/fener.svg', 'Işıklandırma', 11, null),
  ('urun', 'İsimlerinizle neon yazı', '/dugun/cizim/fener.svg', 'Işıklandırma', 12, null),
  ('ekstra', 'Fotoğraf köşesi (photo booth)', '/dugun/cizim/foto.svg', null, 10, null),
  ('ekstra', 'Dans pisti', '/dugun/cizim/parti.svg', null, 11, null),
  ('ekstra', 'Bar ve kokteyl servisi', '/dugun/cizim/kokteyl.svg', null, 12, null),
  ('ekstra', 'Kahve ve tatlı istasyonu', '/dugun/cizim/pasta.svg', null, 13, null),
  ('ekstra', 'Çocuk köşesi', '/dugun/cizim/lounge.svg', null, 14, 'Küçük misafirler için oyun ve etkinlik alanı.'),
  ('ekstra', 'Misafir hediyeleri', '/dugun/cizim/kart.svg', null, 15, 'Urla zeytinyağı, lavanta kesesi, el yapımı sabun…'),
  ('ekstra', 'Misafir servisi', '/dugun/cizim/konak.svg', null, 16, 'Şehirden ve otellerden servis aracı.'),
  ('ekstra', 'Tente (yağmur planı)', '/dugun/cizim/mekan.svg', null, 17, 'Kötü havaya karşı açık alan için tente.')
) v (tur, ad, resim, grup, sira, aciklama)
where not exists (select 1 from public.dugun_katalog k where k.tur = v.tur and k.ad = v.ad and coalesce(k.grup, '') = coalesce(v.grup, ''));

-- Ürün sayısı arttı: talepte en çok 80 ürün (eskiden 30)
create or replace function public.dugun_talep_ac(p_ad text, p_eposta text, p_tel text, p_tarih date, p_tarih_esnek boolean,
                                                 p_kisi text, p_secimler jsonb, p_not text, p_kvkk boolean)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ad text := trim(coalesce(p_ad, ''));
  ep text := lower(trim(coalesce(p_eposta, '')));
  s jsonb := case when jsonb_typeof(p_secimler) = 'object' then p_secimler else '{}' end;
  idler bigint[];
  sec jsonb := '{}';
  mekan dugun_katalog;
  yeni bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adınızı ve soyadınızı yazın.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yazın.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranızı yazın.'; end if;
  if not coalesce(p_kvkk, false) then raise exception 'Devam etmek için KVKK metnini onaylayın.'; end if;
  if p_kisi is null or p_kisi not in ('50den_az', '50_100', '100_150', '150den_fazla', 'bilmiyorum') then raise exception 'Yaklaşık kişi sayısını seçin.'; end if;
  if p_tarih is not null and (p_tarih < istanbul_bugun() or p_tarih > istanbul_bugun() + 1100) then raise exception 'Geçerli bir tarih seçin.'; end if;
  if p_tarih is null and not coalesce(p_tarih_esnek, false) then raise exception 'Bir tarih seçin ya da "henüz belli değil"i işaretleyin.'; end if;
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
  sec := jsonb_strip_nulls(sec);

  insert into dugun_talepleri (ad, eposta, tel, tarih, tarih_esnek, kisi, secimler, notlar)
    values (ad, ep, left(trim(p_tel), 30), p_tarih, p_tarih is null, p_kisi, sec, nullif(left(trim(coalesce(p_not, '')), 2000), ''))
    returning id into yeni;
  perform eposta_ekle('dugun_talep', ep,
                      jsonb_build_object('ad', ad, 'tarih', case when p_tarih is null then 'tarih henüz belli değil' else tr_tarih(p_tarih) end),
                      'dugun_talep:' || yeni);
  return 'tamam';
end $$;
revoke execute on function public.dugun_talep_ac(text, text, text, date, boolean, text, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.dugun_talep_ac(text, text, text, date, boolean, text, jsonb, text, boolean) to service_role;
