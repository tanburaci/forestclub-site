-- Forest Club Urla: düğün organizasyonu (26.11.2026). /dugun/ sayfasındaki "Düğününü tasarla" sihirbazı çiftin
-- seçimlerini (mekan, bölümler, menü tercihi, masa konsepti, ürünler, ekstralar) form-gonder üzerinden dugun_talep_ac'a
-- gönderir (Turnstile + IP sınırı). Sitede fiyat yok: talep yönetim › Düğün'e düşer, teklif görüşmede verilir.
-- Katalog yönetimden düzenlenir; sitede yalnız açık kalemler görünür. Teklif kalemleri, ödeme planı, giderler ve
-- tedarikçiler için tablolar hazır (yalnız yönetici); kapora / iptal koşulları belirlenince arayüzü açılacak.

-- Katalog: mekan, bölüm (nikah, kokteyl…), menü (mekanın; yemek çoğu zaman mekandan), masa konsepti, ürün, ekstra
create table if not exists public.dugun_katalog (
  id bigint generated always as identity primary key,
  tur text not null check (tur in ('mekan', 'bolum', 'menu', 'konsept', 'urun', 'ekstra')),
  ad text not null check (length(trim(ad)) between 1 and 80),
  aciklama text check (length(aciklama) <= 500),
  resim text check (length(resim) <= 400),             -- site içi çizim (/dugun/cizim/…) ya da depodaki resim (https)
  grup text check (length(grup) <= 40),                -- ürün grubu: Örtü, Çiçek, Mum, Sandalye…
  mekan_id bigint references public.dugun_katalog (id) on delete cascade,  -- menü hangi mekanın
  yemek_mekandan boolean not null default true,        -- mekan: yemeği mekan veriyor (menü yalnız tercih bilgisi)
  sira int not null default 0,
  acik boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.dugun_katalog enable row level security;
drop policy if exists herkes_acik on public.dugun_katalog;
create policy herkes_acik on public.dugun_katalog for select to anon, authenticated using (acik);
drop policy if exists yonetici_tam on public.dugun_katalog;
create policy yonetici_tam on public.dugun_katalog for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.dugun_katalog from anon;
grant select on public.dugun_katalog to anon;
grant select, insert, update, delete on public.dugun_katalog to authenticated;
drop trigger if exists denetim on public.dugun_katalog;
create trigger denetim after insert or update or delete on public.dugun_katalog for each row execute function public.denetle();

-- Talepler: seçimler gönderildiği andaki adlarıyla saklanır (katalog sonra değişse de talep okunur)
create table if not exists public.dugun_talepleri (
  id bigint generated always as identity primary key,
  ad text not null,
  eposta text not null,
  tel text not null,
  tarih date,
  tarih_esnek boolean not null default false,          -- "tarih henüz belli değil"
  kisi text not null check (kisi in ('50den_az', '50_100', '100_150', '150den_fazla', 'bilmiyorum')),
  secimler jsonb not null default '{}',
  notlar text check (length(notlar) <= 2000),
  durum text not null default 'yeni' check (durum in ('yeni', 'gorusuldu', 'teklif', 'kesin', 'tamamlandi', 'iptal')),
  yonetici_notu text check (length(yonetici_notu) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dugun_talepleri enable row level security;
drop policy if exists yonetici_tam on public.dugun_talepleri;
create policy yonetici_tam on public.dugun_talepleri for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.dugun_talepleri from anon;
grant select, update, delete on public.dugun_talepleri to authenticated;
drop trigger if exists ad_denetle on public.dugun_talepleri;
create trigger ad_denetle before insert on public.dugun_talepleri for each row execute function public.ad_denetle();
drop trigger if exists denetim on public.dugun_talepleri;
create trigger denetim after insert or update or delete on public.dugun_talepleri for each row execute function public.denetle();

-- Altyapı (arayüzü sonra): fiyatlar sitede görünmez, ayrı tabloda; teklif, ödeme planı, giderler, tedarikçiler
create table if not exists public.dugun_fiyatlar (
  katalog_id bigint primary key references public.dugun_katalog (id) on delete cascade,
  fiyat numeric(12, 2) not null check (fiyat >= 0),
  birim text not null default 'adet' check (birim in ('adet', 'kisi', 'masa', 'sabit'))
);
create table if not exists public.dugun_tedarikcileri (
  id bigint generated always as identity primary key,
  ad text not null check (length(trim(ad)) between 1 and 120),
  tur text check (length(tur) <= 60),
  tel text check (length(tel) <= 30),
  eposta text check (length(eposta) <= 160),
  notlar text check (length(notlar) <= 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.dugun_teklif_kalemleri (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.dugun_talepleri (id) on delete cascade,
  katalog_id bigint references public.dugun_katalog (id) on delete set null,
  ad text not null check (length(trim(ad)) between 1 and 160),
  adet numeric(10, 2) not null default 1 check (adet > 0),
  birim_fiyat numeric(12, 2) not null default 0 check (birim_fiyat >= 0),
  iskonto_yuzde numeric(5, 2) not null default 0 check (iskonto_yuzde between 0 and 100),
  sira int not null default 0
);
create table if not exists public.dugun_odemeleri (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.dugun_talepleri (id) on delete cascade,
  ad text not null check (length(trim(ad)) between 1 and 80),   -- Kapora, ara ödeme, kalan…
  vade date,
  tutar numeric(12, 2) not null check (tutar > 0),
  odendi date,
  yontem text check (yontem in ('havale', 'kart', 'nakit'))
);
create table if not exists public.dugun_giderleri (
  id bigint generated always as identity primary key,
  talep_id bigint not null references public.dugun_talepleri (id) on delete cascade,
  tedarikci_id bigint references public.dugun_tedarikcileri (id) on delete set null,
  aciklama text not null check (length(trim(aciklama)) between 1 and 200),
  tutar numeric(12, 2) not null check (tutar >= 0),
  vade date,
  odendi date
);
do $$
declare t text;
begin
  foreach t in array array['dugun_fiyatlar', 'dugun_tedarikcileri', 'dugun_teklif_kalemleri', 'dugun_odemeleri', 'dugun_giderleri'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists yonetici_tam on public.%I', t);
    execute format('create policy yonetici_tam on public.%I for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists denetim on public.%I', t);
    execute format('create trigger denetim after insert or update or delete on public.%I for each row execute function public.denetle()', t);
  end loop;
end $$;

-- Sihirbazdan gelen talep (yalnız form-gonder / service_role). p_secimler kimliklerle gelir:
-- {mekan, bolumler: [..], menu, konsept, urunler: [..], ekstralar: [..]}; yalnız açık ve doğru türdeki kalemler alınır,
-- adlarıyla saklanır. Aynı e-posta 10 dakika içinde tekrar gönderirse yeni satır açılmaz.
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
                 where x ~ '^\d{1,12}$' limit 30);
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

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('dugun_talep', 'Düğün talebi alındı', '/dugun/ sayfasında "Düğününü tasarla" talebi gönderen çifte gider.', true, null,
   'Düğün talebiniz bize ulaştı 🤍',
   E'Merhaba {ad},\n\nDüğününüz için hazırladığınız tasarım bize ulaştı ({tarih}). Çok teşekkür ederiz! 🌿\n\nSeçimlerinizi inceleyip en kısa sürede sizinle iletişime geçeceğiz; görüşmede ayrıntıları konuşup size özel teklifimizi hazırlayacağız.\n\nSevgiyle,\nForest Club Urla',
   array['ad', 'tarih'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where id = 'dugun_talep' and varsayilan_konu is null;

-- Örnek katalog (yönetimden değiştirilir; resimler çizim, gerçek fotoğraf gelince yüklenir)
insert into public.dugun_katalog (tur, ad, aciklama, resim, grup, sira)
select * from (values
  ('mekan', 'Pinya, Urla', 'Zeytin ağaçları ve çam gölgesinde, doğanın içinde açık hava alanı. Yemek mekanın mutfağından.', '/dugun/cizim/mekan.svg', null, 1),
  ('bolum', 'Nikah töreni', 'Açık havada, çiçekli kemerin altında.', '/dugun/cizim/kemer.svg', null, 1),
  ('bolum', 'Kokteyl', 'Gün batımında hoş geldin içecekleri ve atıştırmalıklar.', '/dugun/cizim/kokteyl.svg', null, 2),
  ('bolum', 'Akşam yemeği', 'Uzun masalarda, hep birlikte.', '/dugun/cizim/yemek.svg', null, 3),
  ('bolum', 'After party', 'Işıklar altında gece boyu dans.', '/dugun/cizim/parti.svg', null, 4),
  ('konsept', 'Kır sofrası', 'Doğal keten örtü, kır çiçekleri, ahşap ve sade seramik tabaklar.', '/dugun/cizim/konsept-kir.svg', null, 1),
  ('konsept', 'Zeytin dalı', 'Urla''ya özgü zeytin dalları, toprak tonları ve el yapımı detaylar.', '/dugun/cizim/konsept-zeytin.svg', null, 2),
  ('konsept', 'Bohem', 'Pampas otları, terrakota tonlar, makrome ve rattan.', '/dugun/cizim/konsept-bohem.svg', null, 3),
  ('konsept', 'Minimal beyaz', 'Beyaz örtü, okaliptüs, beyaz güller ve cam şamdanlar.', '/dugun/cizim/konsept-minimal.svg', null, 4),
  ('konsept', 'Işıklı gece', 'Bol mum, ampul zincirleri ve koyu yeşil tonlar.', '/dugun/cizim/konsept-gece.svg', null, 5),
  ('urun', 'Doğal keten', null, '/dugun/cizim/ortu.svg', 'Örtü', 1),
  ('urun', 'Beyaz pamuk', null, '/dugun/cizim/ortu.svg', 'Örtü', 2),
  ('urun', 'Örtüsüz ahşap masa', null, '/dugun/cizim/ortu.svg', 'Örtü', 3),
  ('urun', 'Kır çiçekleri', null, '/dugun/cizim/cicek.svg', 'Çiçek', 1),
  ('urun', 'Okaliptüs ve beyaz gül', null, '/dugun/cizim/cicek.svg', 'Çiçek', 2),
  ('urun', 'Pampas ve kuru çiçek', null, '/dugun/cizim/cicek.svg', 'Çiçek', 3),
  ('urun', 'Zeytin dalı', null, '/dugun/cizim/cicek.svg', 'Çiçek', 4),
  ('urun', 'Cam fanuslu mumlar', null, '/dugun/cizim/mum.svg', 'Mum', 1),
  ('urun', 'Uzun şamdanlar', null, '/dugun/cizim/mum.svg', 'Mum', 2),
  ('urun', 'Ahşap katlanır', null, '/dugun/cizim/sandalye.svg', 'Sandalye', 1),
  ('urun', 'Şeffaf Tiffany', null, '/dugun/cizim/sandalye.svg', 'Sandalye', 2),
  ('urun', 'Rattan', null, '/dugun/cizim/sandalye.svg', 'Sandalye', 3),
  ('ekstra', 'DJ ve ses sistemi', null, '/dugun/cizim/muzik.svg', null, 1),
  ('ekstra', 'Canlı müzik', null, '/dugun/cizim/muzik.svg', null, 2),
  ('ekstra', 'Fotoğraf ve video', null, '/dugun/cizim/foto.svg', null, 3),
  ('ekstra', 'Ampul zinciri ve ışıklandırma', null, '/dugun/cizim/isik.svg', null, 4),
  ('ekstra', 'Çiçekli nikah kemeri', null, '/dugun/cizim/kemer.svg', null, 5),
  ('ekstra', 'Düğün pastası', null, '/dugun/cizim/pasta.svg', null, 6),
  ('ekstra', 'Konaklama önerisi', 'Misafirleriniz için Urla''da konaklama yönlendirmesi.', '/dugun/cizim/konak.svg', null, 7)
) v (tur, ad, aciklama, resim, grup, sira)
where not exists (select 1 from public.dugun_katalog);
