-- Forest Club Urla: üye özellikleri (31.10.2026).
--   · ayarlar: tanışma bileti açık mı, iletişim bilgileri, aidat, dondurma kuralı, kartla ödeme açık mı
--   · tanışma bileti: gerçek kod (FC-T-XXXXXX), buluşma başına kontenjan, bilet maili, kapıda okutma; etkinliğin
--     doluluğuna sayılır; iptalde bilet sahiplerine de mail
--   · KVKK: üye verisinin kopyasını kendisi indirir; silme talebini yönetici anonimleştirerek kapatır
--   · üyelik dondurma (kural ayarlardan), etkinlik sonrası anket (yalnız gelenler) ve anket maili
--   · kartla ödeme (iyzico) için ödeme istekleri; ödeme onaylanınca uyelik_uzat ve komisyon gideri

-- ---------------------------------------------------------------------------------------------------------------
-- Ayarlar: herkese açık olanları site ve üye paneli okur; yalnız yönetici değiştirir
create table if not exists public.ayarlar (
  anahtar text primary key,
  deger jsonb not null,
  herkese_acik boolean not null default false
);
alter table public.ayarlar enable row level security;
drop policy if exists yonetici_tam on public.ayarlar;
create policy yonetici_tam on public.ayarlar for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists herkes_okur on public.ayarlar;
create policy herkes_okur on public.ayarlar for select to anon, authenticated using (herkese_acik);
insert into public.ayarlar (anahtar, deger, herkese_acik) values
  ('tanisma_acik', 'true', true),
  ('iletisim', '{"eposta": "forestcluburla@gmail.com", "alan": "Pinya, Urla", "whatsapp": "", "topluluk": "", "instagram": "forestcluburla"}', true),
  ('aidat', '3000', true),
  ('dondurma', '{"gunler": [7, 14], "yillik": 2}', true),
  ('kart_odeme', 'false', true)
  on conflict (anahtar) do nothing;

create or replace function public.ayar(p_anahtar text) returns jsonb
  language sql stable security definer set search_path = public as $$ select deger from ayarlar where anahtar = p_anahtar $$;
revoke execute on function public.ayar(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Tanışma bileti
alter table public.tanisma_biletleri add column if not exists kod text unique;
alter table public.etkinlikler add column if not exists tanisma_kontenjan int not null default 5 check (tanisma_kontenjan >= 0);

-- FC-T-7KQ2MX: karışan harfler (I, O, 0, 1) yok; rastgelelik gen_random_uuid'den (eklenti gerekmez)
create or replace function public.yeni_bilet_kodu() returns text
  language sql volatile as $$
    select 'FC-T-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b, i) % 32 + 1, 1), '' order by i)
    from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as b) x, generate_series(0, 5) i
  $$;

-- Etkinliğe yer tutan kişi sayısı: kayıtlı üyeler + geçerli tanışma biletleri (satılan bilet ayrıca sayılır)
create or replace function public.etkinlik_dolu(p_etkinlik bigint) returns int
  language sql stable security definer set search_path = public as $$
    select ((select count(*) from etkinlik_kayitlari where etkinlik_id = p_etkinlik and durum = 'kayitli')
          + (select count(*) from tanisma_biletleri where etkinlik_id = p_etkinlik and durum in ('bekliyor', 'geldi')))::int
  $$;
revoke execute on function public.etkinlik_dolu(bigint) from public, anon, authenticated;

create or replace function public.etkinlik_doluluk()
  returns table (etkinlik_id bigint, kayitli int, bekleme int)
  language sql stable security definer set search_path = public as $$
    select e.id, etkinlik_dolu(e.id),
           (select count(*) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'bekleme')::int
    from etkinlikler e where e.durum = 'yayinda'
  $$;
grant execute on function public.etkinlik_doluluk() to anon, authenticated;

-- Tanışma bileti: ayar açıksa, yayındaki yaklaşan buluşmaya, hiç üye olmamış e-postaya bir kez. Bilet kodu
-- yalnız e-postayla gider (ekranda gösterilmez). Dönüş: 'verildi' | 'uye' | 'kullanilmis'
create or replace function public.tanisma_bileti_al(p_ad text, p_eposta text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  e etkinlikler;
  yeni_kod text;
  bilet_id bigint;
begin
  if length(trim(p_ad)) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if coalesce((ayar('tanisma_acik'))::boolean, true) is false then raise exception 'Tanışma bileti şu an verilmiyor.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;  -- aynı anda gelen iki bilet kontenjanı aşmasın
  if e.id is null or e.tarih < istanbul_bugun() or e.durum <> 'yayinda' then
    raise exception 'Bu buluşma için bilet alınamıyor.';
  end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then return 'uye'; end if;
  if exists (select 1 from tanisma_biletleri where lower(eposta) = ep) then return 'kullanilmis'; end if;
  if (select count(*) from tanisma_biletleri where etkinlik_id = e.id) >= e.tanisma_kontenjan then
    raise exception 'Bu buluşmanın tanışma biletleri doldu; başka bir buluşma seç.';
  end if;
  if etkinlik_dolu(e.id) + e.satilan_bilet >= e.kontenjan then raise exception 'Bu buluşma dolu; başka bir buluşma seç.'; end if;
  loop
    yeni_kod := yeni_bilet_kodu();
    exit when not exists (select 1 from tanisma_biletleri where kod = yeni_kod);
  end loop;
  insert into tanisma_biletleri (ad, eposta, alinis, etkinlik_id, durum, kod)
    values (trim(p_ad), ep, istanbul_bugun(), e.id, 'bekliyor', yeni_kod) returning id into bilet_id;
  perform eposta_ekle('tanisma', ep,
                      jsonb_build_object('ad', trim(p_ad), 'biletKodu', yeni_kod, 'etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, '')),
                      'tanisma:' || bilet_id, null, e.id);
  return 'verildi';
end $$;
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from public, anon, authenticated;
grant execute on function public.tanisma_bileti_al(text, text, bigint) to service_role;

-- Kapıda giriş: üye karekodu (FC-U-…) ya da tanışma bileti (FC-T-…). Dönüş: {ad, uye_id | bilet_id, tanisma, zaten}
create or replace function public.giris_kaydet(p_etkinlik bigint, p_kod text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  metin text := upper(coalesce(p_kod, ''));
  v_kod text;
  u uyeler;
  k etkinlik_kayitlari;
  b tanisma_biletleri;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  v_kod := substring(metin from 'FC-T-[A-Z0-9]{6}');
  if v_kod is not null then
    select * into b from tanisma_biletleri where kod = v_kod for update;
    if b.id is null then raise exception '% koduyla bir tanışma bileti yok.', v_kod; end if;
    if b.etkinlik_id is distinct from p_etkinlik then
      raise exception 'Bu tanışma bileti başka bir buluşma için (%).', (select tr_tarih(tarih) || ' ' || ad from etkinlikler where id = b.etkinlik_id);
    end if;
    if b.durum <> 'bekliyor' then return jsonb_build_object('ad', b.ad, 'bilet_id', b.id, 'tanisma', true, 'zaten', true); end if;
    update tanisma_biletleri set durum = 'geldi' where id = b.id;
    return jsonb_build_object('ad', b.ad, 'bilet_id', b.id, 'tanisma', true, 'zaten', false);
  end if;
  v_kod := substring(metin from 'FC-U-\d+');
  if v_kod is null then raise exception 'Kod okunamadı; FC-U-0001 ya da FC-T-XXXXXX biçiminde olmalı.'; end if;
  select * into u from uyeler where kod = v_kod;
  if u.id is null then raise exception '% koduyla bir üye yok.', v_kod; end if;
  select * into k from etkinlik_kayitlari where etkinlik_id = p_etkinlik and uye_id = u.id for update;
  if k.uye_id is null then raise exception '% bu etkinliğe kayıtlı değil.', u.ad; end if;
  if k.durum <> 'kayitli' then raise exception '% bekleme listesinde; kaydı kesinleşmemiş.', u.ad; end if;
  if k.geldi then return jsonb_build_object('ad', u.ad, 'uye_id', u.id, 'tanisma', false, 'zaten', true); end if;
  update etkinlik_kayitlari set geldi = true where etkinlik_id = p_etkinlik and uye_id = u.id;
  return jsonb_build_object('ad', u.ad, 'uye_id', u.id, 'tanisma', false, 'zaten', false);
end $$;
revoke execute on function public.giris_kaydet(bigint, text) from public, anon;
grant execute on function public.giris_kaydet(bigint, text) to authenticated;

-- Kayıt listesi: tanışma bileti sayısı da (panel doluluğu doğru göstersin)
create or replace function public.kayit_listesi(p_etkinlik bigint)
  returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
      'kontenjan', e.kontenjan,
      'kayitli', coalesce((select jsonb_agg(k.uye_id order by k.created_at) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'kayitli'), '[]'),
      'bekleme', coalesce((select jsonb_agg(k.uye_id order by k.sira, k.created_at) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'bekleme'), '[]'),
      'gelen', coalesce((select jsonb_agg(k.uye_id) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'kayitli' and k.geldi), '[]'),
      'tanisma', (select count(*) from tanisma_biletleri t where t.etkinlik_id = e.id and t.durum in ('bekliyor', 'geldi')))
    from etkinlikler e where e.id = p_etkinlik
  $$;
revoke execute on function public.kayit_listesi(bigint) from public, anon, authenticated;

-- Bekleme listesinden yükseltme: doluluğa tanışma biletleri de sayılır
create or replace function public.bekleme_yukselt(p_etkinlik bigint)
  returns int language plpgsql security definer set search_path = public as $$
declare
  e etkinlikler;
  dolu int;
  n int := 0;
  r record;
begin
  select * into e from etkinlikler where id = p_etkinlik for update;
  if e.id is null or e.durum <> 'yayinda' or e.tarih < istanbul_bugun() then return 0; end if;
  dolu := etkinlik_dolu(e.id);
  for r in select k.uye_id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id
           where k.etkinlik_id = e.id and k.durum = 'bekleme' and u.bitis > istanbul_bugun() and u.durum <> 'donduruldu'
           order by k.sira, k.created_at loop
    exit when dolu >= e.kontenjan - e.satilan_bilet;
    update etkinlik_kayitlari set durum = 'kayitli', sira = null where etkinlik_id = e.id and uye_id = r.uye_id;
    dolu := dolu + 1;
    n := n + 1;
    perform eposta_ekle('bekleme', r.eposta,
                        jsonb_build_object('ad', r.ad, 'etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, '')),
                        'bekleme:' || e.id || ':' || r.uye_id || ':' || e.tarih, r.uye_id, e.id);
  end loop;
  update etkinlik_kayitlari k set sira = s.yeni
    from (select uye_id, row_number() over (order by sira, created_at) as yeni from etkinlik_kayitlari
          where etkinlik_id = e.id and durum = 'bekleme') s
    where k.etkinlik_id = e.id and k.uye_id = s.uye_id;
  return n;
end $$;
revoke execute on function public.bekleme_yukselt(bigint) from public, anon, authenticated;

-- Üyenin katılım isteği: doluluğa tanışma biletleri sayılır; dondurulmuş üyelik katılamaz
create or replace function public.etkinlik_kaydi(p_etkinlik bigint, p_istek text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  e etkinlikler;
  mevcut etkinlik_kayitlari;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  if e.tarih < istanbul_bugun() then raise exception 'Bu etkinlik geçti.'; end if;
  select * into mevcut from etkinlik_kayitlari where etkinlik_id = e.id and uye_id = u.id;

  if p_istek = 'katil' then
    if e.durum <> 'yayinda' then raise exception 'Bu etkinlik iptal edildi ya da yayında değil.'; end if;
    if u.bitis is null or u.bitis <= istanbul_bugun() then raise exception 'Üyeliğin aktif değil.'; end if;
    if u.durum = 'donduruldu' then raise exception 'Üyeliğin dondurulmuş; katılmak için “Erken dön”e bas.'; end if;
    if mevcut.uye_id is not null then
      return jsonb_build_object('durum', mevcut.durum, 'sira', mevcut.sira);
    end if;
    if etkinlik_dolu(e.id) < e.kontenjan - e.satilan_bilet then
      insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum) values (e.id, u.id, 'kayitli');
      return jsonb_build_object('durum', 'kayitli', 'sira', null);
    end if;
    insert into etkinlik_kayitlari (etkinlik_id, uye_id, durum, sira)
      values (e.id, u.id, 'bekleme',
              coalesce((select max(sira) from etkinlik_kayitlari where etkinlik_id = e.id and durum = 'bekleme'), 0) + 1)
      returning * into mevcut;
    return jsonb_build_object('durum', 'bekleme', 'sira', mevcut.sira);

  elsif p_istek = 'vazgec' then
    if mevcut.uye_id is null then return jsonb_build_object('durum', 'yok'); end if;
    delete from etkinlik_kayitlari where etkinlik_id = e.id and uye_id = u.id;
    perform bekleme_yukselt(e.id);
    return jsonb_build_object('durum', 'yok');
  end if;
  raise exception 'Geçersiz istek.';
end $$;
revoke execute on function public.etkinlik_kaydi(bigint, text) from public, anon;
grant execute on function public.etkinlik_kaydi(bigint, text) to authenticated;

-- İptal / erteleme: duyuru tanışma bileti sahiplerine de gider
create or replace function public.etkinlik_durum_degistir(p_id bigint, p_durum text, p_yeni_tarih date, p_neden text,
                                                          p_duyuru text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e etkinlikler;
  eski date;
  neden text := nullif(left(trim(coalesce(p_neden, '')), 300), '');
  duyuru text;
  mail int := 0;
  r record;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into e from etkinlikler where id = p_id for update;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  eski := e.tarih;
  if p_durum = 'iptal' then
    update etkinlikler set durum = 'iptal', durum_neden = neden, durum_degisti_at = now() where id = e.id
      returning * into e;
  elsif p_durum = 'ertelendi' then
    if p_yeni_tarih is null or p_yeni_tarih < istanbul_bugun() then raise exception 'Yeni tarih bugün ya da sonrası olmalı.'; end if;
    if p_yeni_tarih = e.tarih then raise exception 'Yeni tarih eskisiyle aynı.'; end if;
    if exists (select 1 from etkinlikler where tarih = p_yeni_tarih and ad = e.ad and id <> e.id) then
      raise exception 'O tarihte aynı adla bir etkinlik zaten var.';
    end if;
    update etkinlikler set eski_tarih = e.tarih, tarih = p_yeni_tarih, durum = 'yayinda', durum_neden = neden,
                           durum_degisti_at = now()
      where id = e.id returning * into e;
  elsif p_durum = 'yayinda' then
    update etkinlikler set durum = 'yayinda', durum_neden = null, durum_degisti_at = now() where id = e.id
      returning * into e;
  else
    raise exception 'Geçersiz durum.';
  end if;
  if p_durum in ('iptal', 'ertelendi') then
    duyuru := coalesce(nullif(left(trim(coalesce(p_duyuru, '')), 2000), ''),
                       case when p_durum = 'iptal'
                            then tr_tarih(eski) || ' tarihli ' || e.ad || ' iptal edildi.'
                            else tr_tarih(eski) || ' tarihli ' || e.ad || ', ' || tr_tarih(e.tarih) || ' tarihine ertelendi. Kaydın yeni tarihe taşındı.' end);
    for r in select 'u' || u.id as anahtar, u.id as uye_id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id
               where k.etkinlik_id = e.id
             union all
             select 't' || t.id, null, t.ad, t.eposta from tanisma_biletleri t where t.etkinlik_id = e.id and t.durum = 'bekliyor' loop
      if eposta_ekle('iptal', r.eposta, jsonb_build_object('ad', r.ad, 'etkinlik', e.ad, 'duyuru', duyuru),
                     'iptal:' || e.id || ':' || r.anahtar || ':' || extract(epoch from e.durum_degisti_at)::bigint, r.uye_id, e.id) is not null then
        mail := mail + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('durum', e.durum, 'tarih', e.tarih, 'eski_tarih', e.eski_tarih,
                            'kisi', (select count(*) from etkinlik_kayitlari where etkinlik_id = e.id), 'mail', mail);
end $$;
revoke execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) from public, anon;
grant execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) to authenticated;

-- Üyelik uzatma: tanışma biletiyle gelip üye olan kişinin bileti "uye" olur
create or replace function public.uyelik_uzat(p_uye bigint, p_tutar numeric, p_yol odeme_yolu, p_tarih date, p_ref text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  tarih date := coalesce(p_tarih, istanbul_bugun());
  yeni_bitis date;
  odeme_id bigint;
  hareket_id bigint;
begin
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar sıfırdan büyük olmalı.'; end if;
  if nullif(trim(coalesce(p_ref, '')), '') is null then raise exception 'Ödeme referansı eksik.'; end if;
  select * into u from uyeler where id = p_uye for update;
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  select id into odeme_id from odemeler where ref = p_ref;
  if odeme_id is not null then
    return jsonb_build_object('bitis', u.bitis, 'odeme_id', odeme_id, 'hareket_id', null, 'ref', p_ref, 'tekrar', true);
  end if;
  yeni_bitis := greatest(coalesce(u.bitis, istanbul_bugun()), istanbul_bugun()) + 30;
  update uyeler set baslangic = coalesce(baslangic, tarih), bitis = yeni_bitis,
                    durum = case when durum = 'donduruldu' then durum else 'aktif' end
    where id = u.id;
  insert into odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
    values (u.id, tarih, p_tutar, p_yol,
            case p_yol when 'havale' then 'Dekont onayı · 30 gün' when 'elden' then 'Elden ödeme · 30 gün' else 'Kart · 30 gün' end,
            p_ref)
    returning id into odeme_id;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (tarih, 'gelir', p_tutar, case when p_yol = 'elden' then 'nakit'::kasa else 'banka'::kasa end, 'Aidat',
            'Aidat · ' || u.ad, p_ref, true, p_yol)
    returning id into hareket_id;
  update tanisma_biletleri set durum = 'uye' where lower(eposta) = u.eposta and durum = 'geldi';
  perform eposta_ekle('onay', u.eposta, jsonb_build_object('ad', u.ad, 'bitis', to_char(yeni_bitis, 'DD.MM.YYYY'), 'kod', u.kod),
                      'onay:' || odeme_id, u.id);
  return jsonb_build_object('bitis', yeni_bitis, 'odeme_id', odeme_id, 'hareket_id', hareket_id, 'ref', p_ref, 'tekrar', false);
end $$;
revoke execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) from public, anon, authenticated;
grant execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Dondurma: aktif üye, ayarlardaki gün seçeneklerinden biriyle, yılda ayardaki sayı kadar. Dondurulan günler bitişe
-- eklenir; "Erken dön" kullanılmayan günleri geri alır; süresi biten dondurma her sabah kendiliğinden biter.
create table if not exists public.uyelik_dondurmalari (
  id bigint generated always as identity primary key,
  uye_id bigint not null references public.uyeler (id) on delete cascade,
  bas date not null,
  gun int not null check (gun >= 0),             -- erken dönüşte kullanılan gün sayısına iner
  bitti date,                                      -- erken dönüşte ya da süre bitince
  created_at timestamptz not null default now()
);
alter table public.uyelik_dondurmalari enable row level security;
drop policy if exists yonetici_tam on public.uyelik_dondurmalari;
create policy yonetici_tam on public.uyelik_dondurmalari for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists uye_kendi on public.uyelik_dondurmalari;
create policy uye_kendi on public.uyelik_dondurmalari for select to authenticated
  using (uye_id in (select id from public.uyeler where user_id = auth.uid()));

create or replace function public.uyelik_dondur(p_gun int)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  kural jsonb := coalesce(ayar('dondurma'), '{"gunler": [7, 14], "yillik": 2}');
begin
  select * into u from uyeler where user_id = auth.uid() for update;
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  if u.durum = 'donduruldu' then raise exception 'Üyeliğin zaten dondurulmuş.'; end if;
  if u.bitis is null or u.bitis <= istanbul_bugun() then raise exception 'Yalnız aktif üyelik dondurulabilir.'; end if;
  if not (kural -> 'gunler') @> to_jsonb(p_gun) then raise exception 'Bu süre seçilemez.'; end if;
  if (select count(*) from uyelik_dondurmalari where uye_id = u.id and bas > istanbul_bugun() - 365) >= coalesce((kural ->> 'yillik')::int, 2) then
    raise exception 'Bir yılda en çok % kez dondurabilirsin.', coalesce((kural ->> 'yillik')::int, 2);
  end if;
  insert into uyelik_dondurmalari (uye_id, bas, gun) values (u.id, istanbul_bugun(), p_gun);
  update uyeler set durum = 'donduruldu', bitis = bitis + p_gun where id = u.id returning * into u;
  return jsonb_build_object('bitis', u.bitis, 'bas', istanbul_bugun(), 'gun', p_gun);
end $$;
revoke execute on function public.uyelik_dondur(int) from public, anon;
grant execute on function public.uyelik_dondur(int) to authenticated;

create or replace function public.dondurma_bitir()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  d uyelik_dondurmalari;
  kalan int;
begin
  select * into u from uyeler where user_id = auth.uid() for update;
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into d from uyelik_dondurmalari where uye_id = u.id and bitti is null order by id desc limit 1 for update;
  if d.id is null then raise exception 'Dondurulmuş bir üyeliğin yok.'; end if;
  kalan := greatest(d.bas + d.gun - istanbul_bugun(), 0);
  update uyelik_dondurmalari set bitti = istanbul_bugun(), gun = gun - kalan where id = d.id;
  update uyeler set bitis = bitis - kalan,
                    durum = case when bitis - kalan > istanbul_bugun() then 'aktif'::uye_durum else 'doldu'::uye_durum end
    where id = u.id returning * into u;
  return jsonb_build_object('bitis', u.bitis);
end $$;
revoke execute on function public.dondurma_bitir() from public, anon;
grant execute on function public.dondurma_bitir() to authenticated;

create or replace function public.dondurmalari_sonlandir()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with biten as (
    update uyelik_dondurmalari set bitti = bas + gun where bitti is null and bas + gun <= istanbul_bugun() returning uye_id
  )
  update uyeler u set durum = case when u.bitis > istanbul_bugun() then 'aktif'::uye_durum else 'doldu'::uye_durum end
    from biten where u.id = biten.uye_id and u.durum = 'donduruldu';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.dondurmalari_sonlandir() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Anket: yalnız etkinliğe gelen üye, bir kez
create table if not exists public.anket_yanitlari (
  etkinlik_id bigint not null references public.etkinlikler (id) on delete cascade,
  uye_id bigint not null references public.uyeler (id) on delete cascade,
  puan smallint not null check (puan between 1 and 5),
  yorum text check (length(yorum) <= 500),
  created_at timestamptz not null default now(),
  primary key (etkinlik_id, uye_id)
);
alter table public.anket_yanitlari enable row level security;
drop policy if exists yonetici_tam on public.anket_yanitlari;
create policy yonetici_tam on public.anket_yanitlari for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists uye_kendi on public.anket_yanitlari;
create policy uye_kendi on public.anket_yanitlari for select to authenticated
  using (uye_id in (select id from public.uyeler where user_id = auth.uid()));

create or replace function public.anket_gonder(p_etkinlik bigint, p_puan int, p_yorum text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  e etkinlikler;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  if p_puan is null or p_puan not between 1 and 5 then raise exception 'Puan 1 ile 5 arasında olmalı.'; end if;
  if not exists (select 1 from etkinlik_kayitlari where etkinlik_id = p_etkinlik and uye_id = u.id and geldi) then
    raise exception 'Yalnız katıldığın buluşmayı puanlayabilirsin.';
  end if;
  insert into anket_yanitlari (etkinlik_id, uye_id, puan, yorum)
    values (p_etkinlik, u.id, p_puan, nullif(left(trim(coalesce(p_yorum, '')), 500), ''))
    on conflict (etkinlik_id, uye_id) do nothing;
  if not found then raise exception 'Bu buluşmayı zaten puanladın.'; end if;
  update etkinlikler set anket_sayisi = s.n, anket_ortalama = s.ort
    from (select count(*) as n, round(avg(puan), 2) as ort from anket_yanitlari where etkinlik_id = p_etkinlik) s
    where id = p_etkinlik returning * into e;
  return jsonb_build_object('n', e.anket_sayisi, 'ort', e.anket_ortalama);
end $$;
revoke execute on function public.anket_gonder(bigint, int, text) from public, anon;
grant execute on function public.anket_gonder(bigint, int, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- KVKK: üye kendi verisinin kopyasını alır; silme talebini yönetici anonimleştirerek kapatır
create table if not exists public.veri_talepleri (
  id bigint generated always as identity primary key,
  uye_id bigint references public.uyeler (id) on delete set null,
  ad text not null,
  eposta text not null,
  tur text not null check (tur in ('silme')),
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'tamam')),
  created_at timestamptz not null default now(),
  tamam_at timestamptz
);
alter table public.veri_talepleri enable row level security;
drop policy if exists yonetici_tam on public.veri_talepleri;
create policy yonetici_tam on public.veri_talepleri for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());

-- Bir üyenin bütün verisi (JSON). Üye kendisi için çağırır; yönetici herhangi biri için (p_uye)
create or replace function public.veri_kopyasi(p_uye bigint default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare u uyeler;
begin
  if p_uye is null then select * into u from uyeler where user_id = auth.uid();
  elsif yonetici_mi() then select * into u from uyeler where id = p_uye;
  else raise exception 'Bu işlem yalnız yönetici içindir.';
  end if;
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  return jsonb_build_object(
    'olusturma', now(),
    'uye', to_jsonb(u) - 'user_id' - 'yonetici_notu',
    'odemeler', coalesce((select jsonb_agg(to_jsonb(o) - 'uye_id' order by o.tarih) from odemeler o where o.uye_id = u.id), '[]'),
    'etkinlik_kayitlari', coalesce((select jsonb_agg(jsonb_build_object('etkinlik', e.ad, 'tarih', e.tarih, 'durum', k.durum, 'geldi', k.geldi) order by e.tarih)
                                    from etkinlik_kayitlari k join etkinlikler e on e.id = k.etkinlik_id where k.uye_id = u.id), '[]'),
    'dekontlar', coalesce((select jsonb_agg(jsonb_build_object('tarih', d.odeme_tarihi, 'tutar', d.tutar, 'durum', d.durum, 'sonuc', d.sonuc) order by d.id)
                           from dekontlar d where d.uye_id = u.id), '[]'),
    'dondurmalar', coalesce((select jsonb_agg(to_jsonb(x) - 'uye_id' order by x.id) from uyelik_dondurmalari x where x.uye_id = u.id), '[]'),
    'anketler', coalesce((select jsonb_agg(to_jsonb(a) - 'uye_id') from anket_yanitlari a where a.uye_id = u.id), '[]'),
    'tanisma_biletleri', coalesce((select jsonb_agg(to_jsonb(t) - 'id') from tanisma_biletleri t where lower(t.eposta) = u.eposta), '[]'),
    'gonderilen_mailler', coalesce((select jsonb_agg(jsonb_build_object('sablon', q.sablon, 'durum', q.durum, 'tarih', q.created_at) order by q.id)
                                    from eposta_kuyrugu q where q.alici = u.eposta), '[]'));
end $$;
revoke execute on function public.veri_kopyasi(bigint) from public, anon;
grant execute on function public.veri_kopyasi(bigint) to authenticated;

create or replace function public.veri_talebi_ac(p_tur text)
  returns text language plpgsql security definer set search_path = public as $$
declare u uyeler;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  if p_tur <> 'silme' then raise exception 'Geçersiz talep.'; end if;
  if exists (select 1 from veri_talepleri where uye_id = u.id and tur = p_tur and durum = 'bekliyor') then return 'zaten'; end if;
  insert into veri_talepleri (uye_id, ad, eposta, tur) values (u.id, u.ad, u.eposta, p_tur);
  return 'tamam';
end $$;
revoke execute on function public.veri_talebi_ac(text) from public, anon;
grant execute on function public.veri_talebi_ac(text) to authenticated;

-- Yönetici: üyeyi anonimleştirir (muhasebe tutarları kalır, kişiyi tanıtan her şey silinir), giriş hesabını siler,
-- açık silme talebini kapatır ve sonucu üyeye mailler. Dönüş: depodan silinecek dekont dosyaları
create or replace function public.uye_anonimlestir(p_uye bigint)
  returns text[] language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  takma text;
  dosyalar text[];
  mail bigint;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into u from uyeler where id = p_uye for update;
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  if u.user_id is not null and exists (select 1 from yoneticiler where user_id = u.user_id) then
    raise exception 'Yönetici hesabı bu yolla silinemez.';
  end if;
  takma := 'Silinmiş üye #' || u.id;
  mail := eposta_ekle('veri_talebi', u.eposta, jsonb_build_object('ad', u.ad), 'veri_talebi:silme:' || u.id);
  select coalesce(array_agg(dosya) filter (where dosya like 'yeni/%'), '{}') into dosyalar from dekontlar where uye_id = u.id;
  update dekontlar set eposta = 'silindi-' || u.id || '@silindi.invalid', ad = takma, dosya = 'silindi', sonuc = null where uye_id = u.id;
  update muhasebe_hareketleri set aciklama = 'Aidat · ' || takma where aciklama = 'Aidat · ' || u.ad and kategori = 'Aidat';
  update tanisma_biletleri set ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid' where lower(eposta) = u.eposta;
  update eposta_kuyrugu set alici = 'silindi-' || u.id || '@silindi.invalid', veri = '{}'
    where alici = u.eposta and id is distinct from mail;
  update anket_yanitlari set yorum = null where uye_id = u.id;  -- puan istatistikte kalır, yorum silinir
  update veri_talepleri set durum = 'tamam', tamam_at = now(), ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid'
    where uye_id = u.id;
  update uyeler set ad = takma, eposta = 'silindi-' || u.id || '@silindi.invalid', tel = null, dogum_gunu = null,
                    ozel_gunler = '[]', ilgi_alanlari = '{}', kutlama_izni = false, foto_izni = false, nereden_duydu = null,
                    yonetici_notu = null, user_id = null
    where id = u.id;
  if u.user_id is not null then delete from auth.users where id = u.user_id; end if;
  return dosyalar;
end $$;
revoke execute on function public.uye_anonimlestir(bigint) from public, anon;
grant execute on function public.uye_anonimlestir(bigint) to authenticated;

-- Yönetici dekont dosyasını silebilir (anonimleştirmede)
drop policy if exists dekont_sil on storage.objects;
create policy dekont_sil on storage.objects for delete to authenticated using (bucket_id = 'dekontlar' and public.yonetici_mi());

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('veri_talebi', 'Silme talebi tamamlandı', 'Yönetici bir silme talebini tamamlayınca üyeye gider.', true, null, 'Verilerin silindi',
   E'Merhaba {ad},\n\nSilme talebin tamamlandı: kişisel bilgilerin sistemimizden silindi. Yasal olarak saklamamız gereken ödeme kayıtları adın olmadan tutulur.\n\nForest Club Urla',
   array['ad'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where varsayilan_konu is null;

-- ---------------------------------------------------------------------------------------------------------------
-- Kartla ödeme (iyzico): odeme-baslat isteği açar, odeme-donus iyzico'dan doğrulayıp tamamlar (ikisi de service_role)
create table if not exists public.odeme_istekleri (
  id uuid primary key default gen_random_uuid(),
  uye_id bigint not null references public.uyeler (id),
  tutar numeric(10, 2) not null,
  durum text not null default 'basladi' check (durum in ('basladi', 'odendi', 'basarisiz')),
  token text unique,
  odeme_no text,
  hata text,
  created_at timestamptz not null default now(),
  sonuc_at timestamptz
);
alter table public.odeme_istekleri enable row level security;
drop policy if exists yonetici_okur on public.odeme_istekleri;
create policy yonetici_okur on public.odeme_istekleri for select to authenticated using (public.yonetici_mi());

create or replace function public.odeme_istegi_ac(p_uye bigint)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  tutar numeric := coalesce((ayar('aidat'))::numeric, 3000);
  yeni uuid;
begin
  if coalesce((ayar('kart_odeme'))::boolean, false) is false then raise exception 'Kartla ödeme şu an kapalı.'; end if;
  select * into u from uyeler where id = p_uye;
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  if (select count(*) from odeme_istekleri where uye_id = u.id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.';
  end if;
  insert into odeme_istekleri (uye_id, tutar) values (u.id, tutar) returning id into yeni;
  return jsonb_build_object('id', yeni, 'tutar', tutar, 'ad', u.ad, 'eposta', u.eposta, 'tel', u.tel, 'kod', u.kod);
end $$;
revoke execute on function public.odeme_istegi_ac(bigint) from public, anon, authenticated;
grant execute on function public.odeme_istegi_ac(bigint) to service_role;

create or replace function public.odeme_istegi_token(p_id uuid, p_token text)
  returns void language sql security definer set search_path = public as $$
    update odeme_istekleri set token = p_token where id = p_id and durum = 'basladi'
  $$;
revoke execute on function public.odeme_istegi_token(uuid, text) from public, anon, authenticated;
grant execute on function public.odeme_istegi_token(uuid, text) to service_role;

-- iyzico'dan doğrulanan ödeme: üyelik uzar (ref = iyzico ödeme no; ikinci kez gelirse uzamaz), komisyon gider yazılır
create or replace function public.odeme_tamamla(p_token text, p_odeme_no text, p_odenen numeric, p_komisyon numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i odeme_istekleri;
  r jsonb;
begin
  select * into i from odeme_istekleri where token = p_token for update;
  if i.id is null then raise exception 'Ödeme isteği bulunamadı.'; end if;
  if i.durum = 'odendi' then return jsonb_build_object('tekrar', true); end if;
  if p_odenen is null or p_odenen < i.tutar then raise exception 'Ödenen tutar eksik.'; end if;
  r := uyelik_uzat(i.uye_id, i.tutar, 'kart', istanbul_bugun(), 'iyzico:' || p_odeme_no);
  if coalesce(p_komisyon, 0) > 0 then
    insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
      values (istanbul_bugun(), 'gider', p_komisyon, 'banka', 'Kart komisyonu', 'iyzico komisyonu · ödeme ' || p_odeme_no,
              'iyzico:' || p_odeme_no, true, 'kart');
  end if;
  update odeme_istekleri set durum = 'odendi', odeme_no = p_odeme_no, sonuc_at = now() where id = i.id;
  return r;
end $$;
revoke execute on function public.odeme_tamamla(text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.odeme_tamamla(text, text, numeric, numeric) to service_role;

create or replace function public.odeme_basarisiz(p_token text, p_hata text)
  returns void language sql security definer set search_path = public as $$
    update odeme_istekleri set durum = 'basarisiz', hata = left(p_hata, 500), sonuc_at = now() where token = p_token and durum = 'basladi'
  $$;
revoke execute on function public.odeme_basarisiz(text, text) from public, anon, authenticated;
grant execute on function public.odeme_basarisiz(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Her sabah: anket maili de (etkinlikten şablondaki gün kadar sonra, gelen ve henüz puanlamamış üyelere)
create or replace function public.gunluk_epostalar()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bugun date := istanbul_bugun();
  ay_gun text := to_char(istanbul_bugun(), 'MM-DD');
  artik_yil boolean := (extract(year from istanbul_bugun())::int % 4 = 0 and extract(year from istanbul_bugun())::int % 100 <> 0)
                       or extract(year from istanbul_bugun())::int % 400 = 0;
  g_yenileme int;
  g_hatirlatma int;
  g_anket int;
  n_yenileme int := 0;
  n_hatirlatma int := 0;
  n_dogum int := 0;
  n_ozel int := 0;
  n_anket int := 0;
  r record;
begin
  select coalesce(gun, 3) into g_yenileme from eposta_sablonlari where id = 'yenileme' and acik;
  if g_yenileme is not null then
    for r in select * from uyeler where bitis > bugun and bitis <= bugun + g_yenileme and durum <> 'donduruldu' loop
      if eposta_ekle('yenileme', r.eposta, jsonb_build_object('ad', r.ad, 'bitis', to_char(r.bitis, 'DD.MM.YYYY')),
                     'yenileme:' || r.id || ':' || r.bitis, r.id) is not null then
        n_yenileme := n_yenileme + 1;
      end if;
    end loop;
  end if;
  select coalesce(gun, 1) into g_hatirlatma from eposta_sablonlari where id = 'hatirlatma' and acik;
  if g_hatirlatma is not null then
    for r in select e.id as etkinlik_id, e.ad as etkinlik, e.tarih, e.saat, u.id as uye_id, u.ad, u.eposta
             from etkinlikler e
             join etkinlik_kayitlari k on k.etkinlik_id = e.id and k.durum = 'kayitli'
             join uyeler u on u.id = k.uye_id
             where e.durum = 'yayinda' and e.tarih > bugun and e.tarih <= bugun + g_hatirlatma loop
      if eposta_ekle('hatirlatma', r.eposta,
                     jsonb_build_object('ad', r.ad, 'etkinlik', r.etkinlik, 'tarih', tr_tarih(r.tarih),
                                        'saat', coalesce(r.saat, ''), 'yer', 'Pinya, Urla'),
                     'hatirlatma:' || r.etkinlik_id || ':' || r.uye_id || ':' || r.tarih, r.uye_id, r.etkinlik_id) is not null then
        n_hatirlatma := n_hatirlatma + 1;
      end if;
    end loop;
  end if;
  for r in select * from uyeler
           where kutlama_izni and bitis > bugun and durum <> 'donduruldu' and dogum_gunu is not null
             and (to_char(dogum_gunu, 'MM-DD') = ay_gun or (to_char(dogum_gunu, 'MM-DD') = '02-29' and ay_gun = '02-28' and not artik_yil)) loop
    if eposta_ekle('dogumgunu', r.eposta, jsonb_build_object('ad', r.ad),
                   'dogumgunu:' || r.id || ':' || extract(year from bugun)::int, r.id) is not null then
      n_dogum := n_dogum + 1;
    end if;
  end loop;
  for r in select u.id, u.ad, u.eposta, g ->> 'ad' as ozel_ad from uyeler u, jsonb_array_elements(u.ozel_gunler) g
           where u.kutlama_izni and u.bitis > bugun and u.durum <> 'donduruldu'
             and (g ->> 'tarih') ~ '^\d{4}-\d{2}-\d{2}$'
             and (substr(g ->> 'tarih', 6) = ay_gun or (substr(g ->> 'tarih', 6) = '02-29' and ay_gun = '02-28' and not artik_yil)) loop
    if eposta_ekle('ozelgun', r.eposta, jsonb_build_object('ad', r.ad, 'ozelGun', r.ozel_ad),
                   'ozelgun:' || r.id || ':' || md5(r.ozel_ad) || ':' || extract(year from bugun)::int, r.id) is not null then
      n_ozel := n_ozel + 1;
    end if;
  end loop;
  -- anket: üç günlük pencere (bir sabah kaçarsa sonra yine yazılır)
  select coalesce(gun, 1) into g_anket from eposta_sablonlari where id = 'anket' and acik;
  if g_anket is not null then
    for r in select e.id as etkinlik_id, e.ad as etkinlik, u.id as uye_id, u.ad, u.eposta
             from etkinlikler e
             join etkinlik_kayitlari k on k.etkinlik_id = e.id and k.geldi
             join uyeler u on u.id = k.uye_id
             where e.tarih <= bugun - g_anket and e.tarih > bugun - g_anket - 3
               and not exists (select 1 from anket_yanitlari a where a.etkinlik_id = e.id and a.uye_id = u.id) loop
      if eposta_ekle('anket', r.eposta, jsonb_build_object('ad', r.ad, 'etkinlik', r.etkinlik),
                     'anket:' || r.etkinlik_id || ':' || r.uye_id, r.uye_id, r.etkinlik_id) is not null then
        n_anket := n_anket + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('yenileme', n_yenileme, 'hatirlatma', n_hatirlatma, 'dogumgunu', n_dogum, 'ozelgun', n_ozel, 'anket', n_anket);
end $$;
revoke execute on function public.gunluk_epostalar() from public, anon, authenticated;
grant execute on function public.gunluk_epostalar() to service_role;

-- Sağlık özeti: bekleyen silme talepleri de (30 gün yasal süre)
create or replace function public.saglik_ozeti()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hata int;
  bekleyen int;
  talep int;
  cron_hata int := null;
  edge_hata int := null;
  vault_eksik boolean := null;
  satirlar text[] := '{}';
begin
  if auth.uid() is not null and not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select count(*) into hata from eposta_kuyrugu where durum = 'hata' and coalesce(kilit_at, created_at) > now() - interval '24 hours';
  select count(*) into bekleyen from eposta_kuyrugu where durum = 'bekliyor' and zaman < now() - interval '30 minutes';
  select count(*) into talep from veri_talepleri where durum = 'bekliyor' and created_at < now() - interval '20 days';
  if to_regclass('cron.job_run_details') is not null then
    execute $q$select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '24 hours'$q$ into cron_hata;
  end if;
  if to_regclass('net._http_response') is not null then
    execute $q$select count(*) from net._http_response where created > now() - interval '24 hours'
                 and (coalesce(status_code, 0) >= 400 or error_msg is not null or timed_out)$q$ into edge_hata;
  end if;
  if to_regclass('vault.decrypted_secrets') is not null then
    execute $q$select count(*) < 2 from vault.decrypted_secrets where name in ('fc_proje_url', 'fc_zamanlayici_anahtari')$q$ into vault_eksik;
  end if;
  if hata > 0 then satirlar := satirlar || (hata || ' mail gönderilemedi (kalıcı hata).'); end if;
  if bekleyen > 0 then satirlar := satirlar || (bekleyen || ' mail 30 dakikadan uzun süredir sırada: gönderici çalışmıyor olabilir.'); end if;
  if talep > 0 then satirlar := satirlar || (talep || ' veri silme talebi 20 günden uzun süredir bekliyor (yasal süre 30 gün).'); end if;
  if coalesce(cron_hata, 0) > 0 then satirlar := satirlar || (cron_hata || ' zamanlanmış iş başarısız oldu.'); end if;
  if coalesce(edge_hata, 0) > 0 then satirlar := satirlar || (edge_hata || ' Edge Function çağrısı hata döndü.'); end if;
  if vault_eksik then satirlar := satirlar || 'Vault ayarları (fc_proje_url, fc_zamanlayici_anahtari) eksik: mailler ve temizlik çalışmıyor.'::text; end if;
  return jsonb_build_object('sorun', cardinality(satirlar) > 0, 'satirlar', to_jsonb(satirlar),
                            'mail_hata', hata, 'mail_bekleyen', bekleyen, 'cron_hata', cron_hata, 'edge_hata', edge_hata);
end $$;
revoke execute on function public.saglik_ozeti() from public, anon;
grant execute on function public.saglik_ozeti() to authenticated;

-- Her sabah: süresi biten dondurmalar da biter
create or replace function public.gunluk_isler()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  dondurma int := dondurmalari_sonlandir();
  durum int := uye_durumlarini_guncelle();
  mailler jsonb := gunluk_epostalar();
  saglik jsonb := saglik_ozeti();
  r record;
begin
  if (saglik ->> 'sorun')::boolean then
    for r in select y.user_id, u.email from yoneticiler y join auth.users u on u.id = y.user_id loop
      perform eposta_ekle('saglik', r.email,
                          jsonb_build_object('ozet', (select string_agg('• ' || s, E'\n') from jsonb_array_elements_text(saglik -> 'satirlar') s)),
                          'saglik:' || r.user_id || ':' || istanbul_bugun());
    end loop;
  end if;
  return jsonb_build_object('dondurma_biten', dondurma, 'durum_degisen', durum, 'mailler', mailler, 'saglik', saglik);
end $$;
revoke execute on function public.gunluk_isler() from public, anon, authenticated;
