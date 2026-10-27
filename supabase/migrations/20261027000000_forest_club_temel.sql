-- Forest Club Urla: temel tablolar (demo yönetici / üye panellerindeki yapı, 27.10.2026).
-- Her tabloda satır bazlı yetki (RLS) açık; politika yazılana kadar tarayıcıdan (anon) hiçbir satır görünmez.

create type uye_durum as enum ('basvuru', 'aktif', 'doldu', 'donduruldu');
create type odeme_yolu as enum ('kart', 'elden');
create type etkinlik_tur as enum ('bulusma', 'yoga', 'atolye', 'hareket');
create type uye_kurali as enum ('ucretsiz', 'yuzde50', 'tam');
create type kayit_durum as enum ('kayitli', 'bekleme', 'vazgecti');
create type hareket_tur as enum ('gelir', 'gider', 'aktarim');
create type kasa as enum ('banka', 'nakit');
create type bilet_durum as enum ('bekliyor', 'geldi', 'uye');
create type envanter_giris as enum ('satin', 'firma', 'diger');

-- Yönetici hesapları (Supabase Auth kullanıcısına bağlı)
create table yoneticiler (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ad text not null,
  created_at timestamptz not null default now()
);

create table uyeler (
  id bigint generated always as identity primary key,
  kod text not null unique,                       -- giriş karekodu: FC-U-0001
  ad text not null,
  eposta text not null unique,
  tel text,
  durum uye_durum not null default 'basvuru',
  basvuru_tarihi date,
  baslangic date,                                 -- ilk ödeme
  bitis date,                                     -- üyelik bitişi (son ödeme + 30 gün)
  dogum_gunu date,
  ozel_gunler jsonb not null default '[]',        -- [{ad, tarih}]
  ilgi_alanlari text[] not null default '{}',
  kutlama_izni boolean not null default false,
  foto_izni boolean not null default false,
  nereden_duydu text,
  yonetici_notu text,
  user_id uuid unique references auth.users (id) on delete set null,  -- üye girişi
  created_at timestamptz not null default now()
);

create table odemeler (
  id bigint generated always as identity primary key,
  uye_id bigint not null references uyeler (id),
  tarih date not null,
  tutar numeric(10, 2) not null check (tutar > 0),
  yol odeme_yolu not null,
  aciklama text,
  created_at timestamptz not null default now()
);

create table etkinlikler (
  id bigint generated always as identity primary key,
  tarih date not null,
  saat text,
  tur etkinlik_tur not null,
  ad text not null,
  kim text,
  kontenjan int not null default 30 check (kontenjan > 0),
  bilet_fiyati numeric(10, 2),                    -- boş: bilet satılmaz
  uyelere uye_kurali,                             -- bilet satılıyorsa üyelere kural
  satilan_bilet int not null default 0,
  anket_sayisi int not null default 0,
  anket_ortalama numeric(3, 2),
  durum text not null default 'yayinda',          -- yayinda | iptal | ertelendi
  created_at timestamptz not null default now(),
  unique (tarih, ad)
);

create table etkinlik_kayitlari (
  etkinlik_id bigint not null references etkinlikler (id) on delete cascade,
  uye_id bigint not null references uyeler (id),
  durum kayit_durum not null default 'kayitli',
  geldi boolean not null default false,
  sira int,                                       -- bekleme listesi sırası
  created_at timestamptz not null default now(),
  primary key (etkinlik_id, uye_id)
);

create table tanisma_biletleri (
  id bigint generated always as identity primary key,
  ad text not null,
  eposta text not null,
  alinis date not null,
  etkinlik_id bigint references etkinlikler (id),
  durum bilet_durum not null default 'bekliyor',
  created_at timestamptz not null default now()
);

create table muhasebe_hareketleri (
  id bigint generated always as identity primary key,
  tarih date not null,
  tur hareket_tur not null,
  tutar numeric(12, 2) not null check (tutar > 0),
  kasa kasa not null,
  hedef_kasa kasa,                                -- yalnız aktarım
  kategori text,
  etkinlik_id bigint references etkinlikler (id),
  aciklama text not null,
  belge text,
  otomatik boolean not null default false,        -- aidat / bilet / envanterden türeyen
  odeme odeme_yolu,
  created_at timestamptz not null default now(),
  check ((tur = 'aktarim') = (hedef_kasa is not null))
);

create table envanter (
  id bigint generated always as identity primary key,
  ad text not null,
  kategori text not null,
  adet numeric(10, 2) not null default 0 check (adet >= 0),
  birim text not null default 'adet',
  giris envanter_giris not null,
  tarih date not null,
  tutar numeric(12, 2),
  kasa kasa,
  firma text,
  karsilik text,
  kaynak text,
  konum text,
  notlar text,
  created_at timestamptz not null default now()
);

create table eposta_sablonlari (
  id text primary key,                            -- basvuru, onay, yenileme, ...
  ad text not null,
  ne_zaman text not null,
  acik boolean not null default true,
  gun int,                                        -- "X gün kala / önce / sonra"
  konu text not null,
  metin text not null,
  alanlar text[] not null default '{}'
);

create index on odemeler (uye_id, tarih);
create index on etkinlik_kayitlari (uye_id);
create index on muhasebe_hareketleri (tarih);
create index on muhasebe_hareketleri (etkinlik_id);

-- Yönetici mi? (politikalarda kullanılır)
create function public.yonetici_mi() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from yoneticiler where user_id = auth.uid()) $$;

do $$
declare t text;
begin
  foreach t in array array['yoneticiler', 'uyeler', 'odemeler', 'etkinlikler', 'etkinlik_kayitlari',
                           'tanisma_biletleri', 'muhasebe_hareketleri', 'envanter', 'eposta_sablonlari'] loop
    execute format('alter table %I enable row level security', t);
    -- Yönetici her şeyi görür ve değiştirir
    execute format('create policy yonetici_tam on %I for all to authenticated using (public.yonetici_mi()) '
                   'with check (public.yonetici_mi())', t);
  end loop;
end $$;

-- Üye: kendi kaydı, kendi ödemeleri, kendi etkinlik kayıtları; etkinlik listesi herkese açık
create policy uye_kendi on uyeler for select to authenticated using (user_id = auth.uid());
create policy uye_kendi on odemeler for select to authenticated
  using (uye_id in (select id from uyeler where user_id = auth.uid()));
create policy uye_kendi on etkinlik_kayitlari for select to authenticated
  using (uye_id in (select id from uyeler where user_id = auth.uid()));
create policy herkes_gorur on etkinlikler for select to anon, authenticated using (durum <> 'taslak');
