-- Forest Club Urla · 09.11.2026 denetimi düzeltmeleri (güvenlik + geliştirme raporları; kullanıcı onayı "hepsini yap")
--  1. Kart ödemesi (Shopier): üyelik / destek tutarı eksik gelirse hata yerine kayıt + yöneticiye iade uyarısı (Shopier
--     sonsuza dek yeniden denemesin); muhasebe belgesi "shopier:<sipariş>" (komisyonla aynı önek, mutabakat eşleşir)
--  2. İndirim kodu: hata sayacı tüm site için değil, istemci IP'si başına (biri herkesi kilitleyemesin); bilet açarken
--     iç denetim sayaçtan muaf
--  3. Tanışma bileti: yönetimin yüklediği kart numaraları varsa yalnız onlar, her biri bir kez geçer
--  4. Tek tip yanıt: başvuru ve tanışma formu, e-postanın üye olup olmadığını ekranda belli etmez; durum e-postayla bildirilir
--  5. KVKK: onayın zamanı, metin sürümü ve kaynağı kaydedilir (riza_kayitlari)

-- ---------- 1. Kart ödemesi: eksik tutar ----------
create or replace function public.odeme_tamamla(p_token text, p_odeme_no text, p_odenen numeric, p_komisyon numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i odeme_istekleri;
  u uyeler;
  r jsonb;
begin
  select * into i from odeme_istekleri where token = p_token for update;
  if i.id is null then raise exception 'Ödeme isteği bulunamadı.'; end if;
  if i.durum = 'odendi' then return jsonb_build_object('tekrar', true); end if;
  if i.durum = 'basarisiz' and i.odeme_no = p_odeme_no then return jsonb_build_object('durum', 'eksik', 'tekrar', true); end if;
  if p_odenen is null or round(p_odenen, 2) < round(i.tutar, 2) then
    -- Para alındı ama eksik: üyelik uzamaz, kayıt kalır, yöneticiye iade uyarısı (bildirim 200 döner, tekrar gelmez)
    select * into u from uyeler where id = i.uye_id;
    update odeme_istekleri set durum = 'basarisiz', odeme_no = p_odeme_no, sonuc_at = now(),
      hata = left('Eksik ödeme: ' || coalesce(round(p_odenen, 2)::text, '?') || ' TL geldi, ' || round(i.tutar, 2) || ' TL bekleniyordu. Shopier''den iade edilmeli.', 500)
      where id = i.id;
    perform yoneticilere_uyari('Kartla üyelik ödemesi eksik geldi (' || coalesce(u.ad, 'üye #' || i.uye_id) || ': '
      || coalesce(round(p_odenen, 2)::text, '?') || ' / ' || round(i.tutar, 2) || ' TL). Üyelik uzatılmadı; Shopier panelinden '
      || p_odeme_no || ' numaralı siparişi iade edin.', 'kart_eksik:' || i.id);
    return jsonb_build_object('durum', 'eksik');
  end if;
  r := uyelik_uzat(i.uye_id, i.tutar, 'kart', istanbul_bugun(), 'shopier:' || p_odeme_no);
  update odeme_istekleri set durum = 'odendi', odeme_no = p_odeme_no, sonuc_at = now() where id = i.id;
  return r;
end $$;
revoke execute on function public.odeme_tamamla(text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.odeme_tamamla(text, text, numeric, numeric) to service_role;

create or replace function public.destek_tamamla(p_token text, p_odeme_no text, p_odenen numeric, p_komisyon numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d destekler;
begin
  select * into d from destekler where token = p_token for update;
  if d.id is null then raise exception 'Destek isteği bulunamadı.'; end if;
  if d.durum = 'odendi' then return jsonb_build_object('tekrar', true); end if;
  if d.durum = 'basarisiz' and d.odeme_no = p_odeme_no then return jsonb_build_object('durum', 'eksik', 'tekrar', true); end if;
  if p_odenen is null or round(p_odenen, 2) < round(d.tutar, 2) then
    update destekler set durum = 'basarisiz', odeme_no = p_odeme_no, sonuc_at = now(),
      hata = left('Eksik ödeme: ' || coalesce(round(p_odenen, 2)::text, '?') || ' TL geldi, ' || round(d.tutar, 2) || ' TL bekleniyordu. Shopier''den iade edilmeli.', 500)
      where id = d.id;
    perform yoneticilere_uyari('Kartla destek ödemesi eksik geldi (' || coalesce(round(p_odenen, 2)::text, '?') || ' / ' || round(d.tutar, 2)
      || ' TL). Muhasebeye yazılmadı; Shopier panelinden ' || p_odeme_no || ' numaralı siparişi iade edin.', 'destek_eksik:' || d.id);
    return jsonb_build_object('durum', 'eksik');
  end if;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (istanbul_bugun(), 'gelir', d.tutar, 'banka', 'Destek', 'Kartla destek · Shopier sipariş ' || p_odeme_no,
            'shopier:' || p_odeme_no, true, 'kart');
  update destekler set durum = 'odendi', odeme_no = p_odeme_no, sonuc_at = now() where id = d.id;
  return jsonb_build_object('tutar', d.tutar);
end $$;
revoke execute on function public.destek_tamamla(text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.destek_tamamla(text, text, numeric, numeric) to service_role;

-- ---------- 2. İndirim kodu: IP başına sayaç ----------
alter table public.indirim_denemeleri add column if not exists ip text;
create index if not exists indirim_denemeleri_ip_zaman on public.indirim_denemeleri (ip, at);

-- İstemci IP'sinin özeti (PostgREST isteğinin başlıklarından; Supabase Cloudflare arkasında, cf-connecting-ip'yi istemci
-- değiştiremez). Ham IP saklanmaz.
create or replace function public.istemci_ip_ozeti() returns text
  language plpgsql stable security definer set search_path = public, extensions as $$
declare
  b json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(b ->> 'cf-connecting-ip', split_part(coalesce(b ->> 'x-forwarded-for', ''), ',', 1), '');
begin
  if trim(v_ip) = '' then return 'bilinmiyor'; end if;
  return left(encode(digest('fc-indirim|' || trim(v_ip), 'sha256'), 'hex'), 32);
end $$;
revoke execute on function public.istemci_ip_ozeti() from public, anon, authenticated;

-- Sayaçsız iç denetim (bilet açarken; kod satırı çağıranda kilitli)
create or replace function public.indirim_kodu_durum_(p_kod text)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  k indirim_kodlari;
  bekleyen int;
begin
  select * into k from indirim_kodlari where kod = upper(trim(coalesce(p_kod, '')));
  if k.kod is not null and k.sinir is not null then
    select count(*) into bekleyen from bilet_istekleri
      where indirim_kodu = k.kod and durum = 'bekliyor' and (yuklendi or created_at > now() - interval '24 hours');
  end if;
  if k.kod is null or not k.aktif or (k.son_tarih is not null and k.son_tarih < istanbul_bugun())
     or (k.sinir is not null and k.kullanilan + coalesce(bekleyen, 0) >= k.sinir) then
    return jsonb_build_object('gecerli', false);
  end if;
  return jsonb_build_object('gecerli', true, 'kod', k.kod, 'tur', k.tur, 'deger', k.deger);
end $$;
revoke execute on function public.indirim_kodu_durum_(text) from public, anon, authenticated;

-- Ziyaretçinin denemesi: IP başına 10 dakikada 30 hatalı deneme (bütün site için ayrıca 10 dakikada 2000 üst sınır:
-- tablo şişmesin)
create or replace function public.indirim_kodu_bak(p_kod text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip text := istemci_ip_ozeti();
  r jsonb;
begin
  if (select count(*) from indirim_denemeleri d where d.ip = v_ip and d.at > now() - interval '10 minutes') >= 30
     or (select count(*) from indirim_denemeleri where at > now() - interval '10 minutes') >= 2000 then
    raise exception 'Çok fazla deneme yapıldı; birkaç dakika sonra tekrar dene.';
  end if;
  r := indirim_kodu_durum_(p_kod);
  if not coalesce((r ->> 'gecerli')::boolean, false) then
    insert into indirim_denemeleri (ip) values (v_ip);
    delete from indirim_denemeleri where at < now() - interval '1 day';
  end if;
  return r;
end $$;
revoke execute on function public.indirim_kodu_bak(text) from public;
grant execute on function public.indirim_kodu_bak(text) to anon, authenticated, service_role;

do $$
declare
  tanim text := pg_get_functiondef('public.bilet_istegi_ac_yol(text,text,text,jsonb,uuid,text,text,text)'::regprocedure);
  eski constant text := 'kd := indirim_kodu_bak(p_kod);';
begin
  if position(eski in tanim) = 0 then raise exception 'indirim satırı bulunamadı'; end if;
  execute replace(tanim, eski, 'kd := indirim_kodu_durum_(p_kod);');
end $$;

-- ---------- 3. Tanışma kartları ----------
create table if not exists public.tanisma_kartlari (
  no text primary key check (no ~ '^[A-Z0-9-]{3,30}$'),
  kullanildi_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tanisma_kartlari enable row level security;
drop policy if exists yonetici_tanisma_kartlari on public.tanisma_kartlari;
create policy yonetici_tanisma_kartlari on public.tanisma_kartlari for select to authenticated using (yonetici_mi());

-- Yönetim: basılı kart numaralarını ekler (satır, virgül ya da boşlukla ayrılmış); var olanlar atlanır
create or replace function public.tanisma_kartlari_ekle(p_metin text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  eklenen int := 0;
  n int;
  x text;
begin
  if not yonetici_mi() then raise exception 'Yetkiniz yok.'; end if;
  foreach x in array regexp_split_to_array(upper(coalesce(p_metin, '')), '[\s,;]+') loop
    continue when x = '' or x !~ '^[A-Z0-9-]{3,30}$';
    insert into tanisma_kartlari (no) values (x) on conflict do nothing;
    get diagnostics n = row_count;
    eklenen := eklenen + n;
  end loop;
  return jsonb_build_object('eklenen', eklenen, 'toplam', (select count(*) from tanisma_kartlari),
                            'bos', (select count(*) from tanisma_kartlari where kullanildi_at is null));
end $$;
revoke execute on function public.tanisma_kartlari_ekle(text) from public, anon;
grant execute on function public.tanisma_kartlari_ekle(text) to authenticated;

create or replace function public.tanisma_kart_ozeti()
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'Yetkiniz yok.'; end if;
  return jsonb_build_object('toplam', (select count(*) from tanisma_kartlari),
                            'bos', (select count(*) from tanisma_kartlari where kullanildi_at is null));
end $$;
revoke execute on function public.tanisma_kart_ozeti() from public, anon;
grant execute on function public.tanisma_kart_ozeti() to authenticated;

-- ---------- 4. Tek tip yanıt: e-posta şablonları ----------
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('zaten_kayitli', 'Zaten kaydın var',
  'Siteden aynı e-postayla yeniden başvuru gelince gider (ekranda herkese aynı yanıt gösterilir).', true, null,
  'Forest Club Urla: bu e-postayla kaydın var 🌲', 'Merhaba {ad},

Bu e-posta adresiyle Forest Club Urla''da zaten bir kaydın var, yeni başvuruya gerek yok.

Üye paneline bu e-postayla giriş yapabilirsin: https://www.forestcluburla.com/uye/
Ödemen eksikse dekontunu buradan iletebilirsin: {odemeLinki}

Bu başvuruyu sen yapmadıysan bu e-postayı yok sayabilirsin.

Ormanda görüşmek üzere,
Forest Club Urla', array['ad','odemeLinki']::text[]) on conflict (id) do nothing;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('tanisma_olmadi', 'Tanışma rezervasyonu yapılamadı',
  'Tanışma rezervasyonu verilemeyince gider (zaten üye, ya da bilet / e-posta daha önce kullanılmış). Ekranda herkese aynı yanıt gösterilir.', true, null,
  'Forest Club Urla tanışma rezervasyonun', 'Merhaba {ad},

{etkinlik} için tanışma rezervasyonunu yapamadık: {neden}

Sorun olduğunu düşünüyorsan bu e-postayı yanıtlayarak bize yazabilirsin.

Forest Club Urla', array['ad','etkinlik','neden']::text[]) on conflict (id) do nothing;

create or replace function public.basvuru_yap(p_ad text, p_eposta text, p_tel text, p_kosul boolean, p_dogal boolean,
                                              p_kvkk boolean, p_foto boolean default false)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  ad text := trim(p_ad);
  yeni_id bigint;
  var_olan uyeler;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  if not (p_kosul and p_dogal and p_kvkk) then raise exception 'Devam etmek için üç metni de onayla.'; end if;
  select * into var_olan from uyeler where eposta = ep;
  if var_olan.id is not null then
    -- Ekranda herkese aynı yanıt; kayıtlı adrese "zaten kaydın var" maili (günde bir kez)
    perform eposta_ekle('zaten_kayitli', ep, jsonb_build_object('ad', var_olan.ad),
                        'zaten_kayitli:' || var_olan.id || ':' || istanbul_bugun(), var_olan.id);
    return 'tamam';
  end if;
  insert into uyeler (ad, eposta, tel, durum, basvuru_tarihi, nereden_duydu, foto_izni)
    values (ad, ep, left(trim(p_tel), 30), 'basvuru', istanbul_bugun(), 'Site başvurusu', coalesce(p_foto, false))
    returning id into yeni_id;
  perform eposta_ekle('basvuru', ep, jsonb_build_object('ad', ad), 'basvuru:' || yeni_id, yeni_id);
  return 'tamam';
exception when unique_violation then
  if exists (select 1 from uyeler where eposta = ep) then return 'tamam'; end if;
  raise;
end $$;
revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) to service_role;

create or replace function public.tanisma_rezervasyon(p_ad text, p_eposta text, p_tel text, p_referans text, p_bilet_no text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public
  as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  ad text := trim(coalesce(p_ad, ''));
  ref text := trim(coalesce(p_referans, ''));
  v_no text := upper(regexp_replace(trim(coalesce(p_bilet_no, '')), '\s+', '', 'g'));
  e etkinlikler;
  yeni_kod text;
  bilet_id bigint;
  neden text;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if length(ref) < 3 or length(ref) > 120 then raise exception 'Bileti veren kişinin adını ve soyadını yaz.'; end if;
  if ref ~* '(https?:|www\.|://|[@/\\<>]|[[:alnum:]-]+\.[[:alpha:]]{2,})' then raise exception 'Bileti veren kişinin yalnız adını ve soyadını yaz.'; end if;
  if v_no !~ '^[A-Z0-9-]{3,30}$' then raise exception 'Tanışma bileti numarasını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;  -- aynı anda gelen rezervasyonlar kontenjanı aşmasın
  if e.id is null or not tanisma_acik_mi(e) then
    raise exception 'Bu etkinlik şu an tanışma rezervasyonuna açık değil; listedeki etkinliklerden birini seç.';
  end if;
  -- Kart listesi yüklendiyse numara listede ve kullanılmamış olmalı (liste boşsa eski davranış: biçim yeter)
  if exists (select 1 from tanisma_kartlari)
     and not exists (select 1 from tanisma_kartlari k where k.no = v_no and k.kullanildi_at is null)
     and not exists (select 1 from tanisma_biletleri where upper(bilet_no) = v_no) then
    raise exception 'Bu tanışma bileti numarası geçerli değil; kartındaki numarayı kontrol et.';
  end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then
    neden := 'bu e-posta adresi zaten Forest Club üyesi; tanışma biletine gerek yok, etkinliğe üye olarak kaydolabilirsin.';
  elsif exists (select 1 from tanisma_biletleri where lower(eposta) = ep) then
    neden := 'bu e-posta adresiyle daha önce tanışma rezervasyonu yapılmış (tanışma bileti bir kez kullanılır).';
  elsif exists (select 1 from tanisma_biletleri where upper(bilet_no) = v_no) then
    neden := 'bu tanışma bileti numarası daha önce kullanılmış.';
  end if;
  if neden is not null then
    -- Ekranda herkese aynı yanıt; neden yalnız bu adrese e-postayla (günde bir kez)
    perform eposta_ekle('tanisma_olmadi', ep, jsonb_build_object('ad', ad, 'etkinlik', e.ad, 'neden', neden),
                        'tanisma_olmadi:' || md5(ep) || ':' || istanbul_bugun(), null, e.id);
    return 'verildi';
  end if;
  loop
    yeni_kod := yeni_bilet_kodu();
    exit when not exists (select 1 from tanisma_biletleri where kod = yeni_kod);
  end loop;
  insert into tanisma_biletleri (ad, eposta, tel, referans, bilet_no, alinis, etkinlik_id, durum, kod)
    values (ad, ep, left(trim(p_tel), 30), ref, v_no, istanbul_bugun(), e.id, 'bekliyor', yeni_kod) returning id into bilet_id;
  update tanisma_kartlari k set kullanildi_at = now() where k.no = v_no;
  perform eposta_ekle('tanisma', ep,
                      jsonb_build_object('ad', ad, 'biletKodu', yeni_kod, 'etkinlik', e.ad, 'tarih', tr_tarih(e.tarih), 'saat', coalesce(e.saat, '')),
                      'tanisma:' || bilet_id, null, e.id);
  return 'verildi';
end $$;
revoke execute on function public.tanisma_rezervasyon(text, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.tanisma_rezervasyon(text, text, text, text, text, bigint) to service_role;

-- Dekont ve kartla aidat adımları: "başvuru yok" ile "üyelik aktif" aynı nötr metinle döner
do $$
declare
  f record;
  tanim text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.prosrc like '%bir başvuru bulamadık%' or p.prosrc like '%Başvurun bulunamadı%'
                                           or p.prosrc like '%Üyeliğin zaten aktif%') loop
    tanim := pg_get_functiondef(f.oid);
    tanim := replace(tanim, 'Bu e-posta ile bir başvuru bulamadık. Başvuruda yazdığın adresi yaz.',
                     'Bu e-postayla şu an işlem yapamıyoruz. Başvuruda yazdığın adresi yaz; sorun sürerse bize yaz.');
    tanim := replace(tanim, 'Başvurun bulunamadı; formu yeniden gönder.',
                     'Bu e-postayla şu an kartla ödeme açılamıyor; üye panelinden devam edebilir ya da bize yazabilirsin.');
    tanim := replace(tanim, 'Üyeliğin zaten aktif; yenilemeyi üye panelinden yapabilirsin.',
                     'Bu e-postayla şu an kartla ödeme açılamıyor; üye panelinden devam edebilir ya da bize yazabilirsin.');
    execute tanim;
  end loop;
end $$;

-- ---------- 5. KVKK rıza kayıtları ----------
create table if not exists public.riza_kayitlari (
  id bigint generated always as identity primary key,
  eposta text not null,
  tur text not null check (tur in ('kvkk', 'kosul', 'dogal', 'foto')),
  metin_surumu text not null,
  kaynak text not null,
  ref text,
  onay_at timestamptz not null default now()
);
create index if not exists riza_kayitlari_eposta on public.riza_kayitlari (lower(eposta));
alter table public.riza_kayitlari enable row level security;
drop policy if exists yonetici_riza on public.riza_kayitlari;
create policy yonetici_riza on public.riza_kayitlari for select to authenticated using (yonetici_mi());

-- Metin sürümü: gizlilik / KVKK, üyelik koşulları ve doğal alan metinleri değişince bu tarih güncellenir
create or replace function public.riza_metin_surumu() returns text language sql immutable as $$ select '2026-11-09' $$;
revoke execute on function public.riza_metin_surumu() from public, anon, authenticated;

-- Formlar yalnız onay kutuları işaretliyse kayıt açar (işlevler denetliyor); kayıt açıldığında onay da yazılır
create or replace function public.riza_yaz_uye() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.durum = 'basvuru' and new.eposta is not null then
    insert into riza_kayitlari (eposta, tur, metin_surumu, kaynak, ref)
      select new.eposta, t, riza_metin_surumu(), coalesce(new.nereden_duydu, 'başvuru'), 'uye:' || new.id
      from unnest(case when new.foto_izni then array['kvkk', 'kosul', 'dogal', 'foto'] else array['kvkk', 'kosul', 'dogal'] end) t;
  end if;
  return new;
end $$;
drop trigger if exists riza_uye on public.uyeler;
create trigger riza_uye after insert on public.uyeler for each row execute function public.riza_yaz_uye();

create or replace function public.riza_yaz_kvkk() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.eposta is null then return new; end if;
  insert into riza_kayitlari (eposta, tur, metin_surumu, kaynak, ref)
    values (new.eposta, 'kvkk', riza_metin_surumu(), tg_argv[0], tg_argv[0] || ':' || new.id);
  return new;
end $$;
drop trigger if exists riza_gonullu on public.gonulluler;
create trigger riza_gonullu after insert on public.gonulluler for each row execute function public.riza_yaz_kvkk('gonullu');
drop trigger if exists riza_dugun on public.dugun_talepleri;
create trigger riza_dugun after insert on public.dugun_talepleri for each row execute function public.riza_yaz_kvkk('dugun');
revoke execute on function public.riza_yaz_uye() from public, anon, authenticated;
revoke execute on function public.riza_yaz_kvkk() from public, anon, authenticated;
