-- Forest Club Urla: son büyük denetimin sunucu düzeltmeleri (03.11.2026)
--   1. Kartla (Shopier) ödenen bilet: ödeme geldiğinde etkinlik hâlâ yayında, geçmemiş ve yer varsa kesinleşir. Yoksa
--      (dolu / iptal / geçmiş / tutar tutmuyor / tutar okunamadı) istek "reddedildi" olur, ödeme kaydı tutulur, alıcıya
--      "ücretin iade edilecek" maili, yöneticilere "Shopier'den iade et" uyarısı gider. Bildirim tekrar denenmez.
--   2. Havale: dekont yüklenirken (bilet_kaydet) yer yeniden denetlenir; aynı anda açılan istekler son yerleri aşamaz.
--      İptal edilmiş / geçmiş etkinliğin bekleyen bileti onaylanamaz.
--   3. Üye, üyelere ücretli (tam / %50) etkinliğe "Geliyorum" ile kayıt olamaz ve kapıdan üye karekoduyla giremez:
--      bilet alması gerekir. Üye indirimi (%50) bir etkinlikte üye başına bir kez uygulanır.
--   4. İptal / erteleme duyurusu bilet alanlara da gider (onaylı ya da incelemedeki bilet istekleri).
--   5. Bekleme listesinden yükseltme incelemedeki biletleri de sayar.
--   6. Üyeliğin bitiş günü dahildir: üye bitiş tarihinde de aktiftir (kayıt, kutlama, gece "doldu" işi, dondurma).
--   7. İndirim kodu: kullanım sınırı bekleyen istekleri de sayar ve kod satırı kilitlenir (yarışla aşılmaz); yanlış
--      kod denemeleri sayılır, 10 dakikada 30 yanlış denemeden sonra denetim bir süre durur (kaba kuvvet).
--   8. Havale dekontunun tutarı yönetimdeki aidat ayarından (sabit 3.000 değil).
--   9. IP sayacı: formda eksik alan yüzünden reddedilen deneme sayaçtan düşer (istek_iade; form-gonder çağırır).

-- ---------- Ortak: sepetteki her etkinlik için yer / durum denetimi (etkinlik satırları kilitlenir) ----------
-- Dönüş: null (sorun yok) ya da kişiye gösterilecek neden
create or replace function public.bilet_yer_sorunu(p_kalemler jsonb)
  returns text language plpgsql security definer set search_path = public as $$
declare
  k jsonb;
  e etkinlikler;
begin
  for k in select * from jsonb_array_elements(p_kalemler) loop
    select * into e from etkinlikler where id = (k ->> 'etkinlik_id')::bigint for update;
    if e.id is null or e.durum = 'iptal' then return coalesce(e.ad, 'Etkinlik') || ' iptal edildi'; end if;
    if e.durum <> 'yayinda' then return e.ad || ' şu an satışta değil'; end if;
    if e.tarih < istanbul_bugun() then return e.ad || ' tarihi geçti'; end if;
    if (k ->> 'adet')::int > e.kontenjan - etkinlik_dolu(e.id) - e.satilan_bilet - bilet_bekleyen(e.id) then
      return e.ad || ' için yeterli yer kalmadı';
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.bilet_yer_sorunu(jsonb) from public, anon, authenticated;

-- Yöneticilere tek satırlık uyarı ("saglik" şablonu)
create or replace function public.yoneticilere_uyari(p_metin text, p_anahtar text)
  returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select y.user_id, u.email from yoneticiler y join auth.users u on u.id = y.user_id loop
    perform eposta_ekle('saglik', r.email, jsonb_build_object('ozet', '• ' || p_metin), p_anahtar || ':' || r.user_id);
  end loop;
end $$;
revoke execute on function public.yoneticilere_uyari(text, text) from public, anon, authenticated;

-- ---------- 1. Kart ödemesi ----------
create or replace function public.bilet_kart_odendi(p_id bigint, p_siparis text, p_tutar numeric)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i bilet_istekleri;
  sorun text;
begin
  select * into i from bilet_istekleri where id = p_id for update;
  if i.id is null or i.odeme_yolu <> 'kart' then raise exception 'Kart ödemeli bilet isteği bulunamadı.'; end if;
  if i.durum = 'onaylandi' or (i.durum = 'reddedildi' and i.shopier_siparis is not null) then
    return jsonb_build_object('durum', i.durum, 'zaten', true);
  end if;
  if length(trim(coalesce(p_siparis, ''))) < 3 then raise exception 'Sipariş numarası eksik.'; end if;
  if i.durum <> 'bekliyor' then
    sorun := 'istek daha önce sonuçlanmıştı';
  elsif p_tutar is null then
    sorun := 'ödenen tutar okunamadı';
  elsif round(p_tutar, 2) <> round(i.tutar, 2) then
    sorun := 'ödenen tutar (' || round(p_tutar, 2) || ' TL) istekle (' || round(i.tutar, 2) || ' TL) eşleşmiyor';
  else
    sorun := bilet_yer_sorunu(i.kalemler);
  end if;
  update bilet_istekleri set yuklendi = true, shopier_siparis = trim(p_siparis), odendi_at = now() where id = i.id;
  if sorun is null then return bilet_onayla_(i.id, null); end if;
  -- Ödeme alındı ama bilet verilemiyor: kayıt kalır, alıcıya ve yöneticilere haber, iade elle (Shopier paneli)
  update bilet_istekleri set durum = 'reddedildi', karar_at = now(),
    sonuc = left('Kart ödemesi alındı, bilet verilemedi: ' || sorun || '. Shopier''den iade edilmeli (sipariş ' || trim(p_siparis) || ').', 300)
    where id = i.id;
  perform eposta_ekle('bilet_red', i.eposta, jsonb_build_object('ad', i.ad,
    'neden', 'Kartla ödemen bize ulaştı ama biletini veremedik: ' || sorun || '. Ücretin aynı karta iade edilecek; birkaç iş günü içinde hesabında görürsün.'),
    'bilet_red:' || i.id, i.uye_id);
  perform yoneticilere_uyari('Kartla ödenen bilet isteği #' || i.id || ' (' || i.ad || ', ' || i.tutar || ' TL) kesinleşemedi: ' || sorun
    || '. Shopier panelinden ' || trim(p_siparis) || ' numaralı siparişi iade edin.', 'kart_iade:' || i.id);
  return jsonb_build_object('durum', 'iade', 'neden', sorun);
end $$;
revoke execute on function public.bilet_kart_odendi(bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.bilet_kart_odendi(bigint, text, numeric) to service_role;

-- ---------- 2. Havale: dekont yüklenirken yer yeniden denetlenir ----------
create or replace function public.bilet_kaydet(p_id bigint, p_eposta text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare
  i bilet_istekleri;
  sorun text;
begin
  select * into i from bilet_istekleri where id = p_id and eposta = lower(trim(p_eposta)) for update;
  if i.id is null or i.created_at < now() - interval '24 hours'
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = i.dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  if i.yuklendi then return 'tamam'; end if;
  sorun := bilet_yer_sorunu(i.kalemler);
  if sorun is not null then
    raise exception 'Üzgünüz, % (sen ödeme yaparken doldu). Havale yaptıysan bize yaz; ücretin iade edilir.', sorun;
  end if;
  update bilet_istekleri set yuklendi = true where id = i.id;
  return 'tamam';
end $$;
revoke execute on function public.bilet_kaydet(bigint, text) from public, anon, authenticated;
grant execute on function public.bilet_kaydet(bigint, text) to service_role;

-- Yönetici onayı: iptal edilmiş / geçmiş etkinliğin isteği onaylanamaz (yer zaten bu istek için ayrılmış durumda)
create or replace function public.bilet_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i bilet_istekleri;
  e etkinlikler;
  k jsonb;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into i from bilet_istekleri where id = p_id for update;
  if i.id is null or not i.yuklendi then raise exception 'Bilet isteği bulunamadı.'; end if;
  if i.durum <> 'bekliyor' then raise exception 'Bu istek zaten sonuçlandı.'; end if;
  if i.odeme_yolu = 'kart' then raise exception 'Kartla ödenen biletler kendiliğinden kesinleşir.'; end if;
  if not p_onay then
    update bilet_istekleri set durum = 'reddedildi', sonuc = nullif(left(trim(coalesce(p_not, '')), 300), ''), karar_at = now(), karar_veren = auth.uid()
      where id = i.id;
    perform eposta_ekle('bilet_red', i.eposta, jsonb_build_object('ad', i.ad, 'neden',
      coalesce(nullif(trim(p_not), ''), case when i.odeme_yolu = 'nakit' then 'Rezervasyon iptal edildi.' else 'Dekont ödemeyle eşleşmedi.' end)),
      'bilet_red:' || i.id, i.uye_id);
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  for k in select * from jsonb_array_elements(i.kalemler) loop
    select * into e from etkinlikler where id = (k ->> 'etkinlik_id')::bigint for update;
    if e.id is null or e.durum = 'iptal' then
      raise exception '% iptal edildi; bu isteği reddedin (havale yapıldıysa iade edin).', coalesce(e.ad, 'Etkinlik');
    end if;
    if e.tarih < istanbul_bugun() then raise exception '% tarihi geçti; bu isteği reddedin.', e.ad; end if;
  end loop;
  return bilet_onayla_(i.id, auth.uid());
end $$;
revoke execute on function public.bilet_karar(bigint, boolean, text) from public, anon;
grant execute on function public.bilet_karar(bigint, boolean, text) to authenticated;

-- ---------- 3 + 6. Üyenin katılımı: ücretli etkinlik bilet ister; bitiş günü dahil ----------
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
    if u.bitis is null or u.bitis < istanbul_bugun() then raise exception 'Üyeliğin aktif değil.'; end if;
    if u.durum = 'donduruldu' then raise exception 'Üyeliğin dondurulmuş; katılmak için “Erken dön”e bas.'; end if;
    if mevcut.uye_id is not null then
      return jsonb_build_object('durum', mevcut.durum, 'sira', mevcut.sira);
    end if;
    if e.bilet_fiyati is not null and e.uyelere is distinct from 'ucretsiz' then
      raise exception 'Bu etkinlik üyelere de ücretli; katılmak için bilet al.';
    end if;
    if etkinlik_dolu(e.id) < e.kontenjan - e.satilan_bilet - bilet_bekleyen(e.id) then
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

-- ---------- 5 + 6. Bekleme listesinden yükseltme ----------
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
  dolu := etkinlik_dolu(e.id) + bilet_bekleyen(e.id);
  for r in select k.uye_id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id
           where k.etkinlik_id = e.id and k.durum = 'bekleme' and u.bitis >= istanbul_bugun() and u.durum <> 'donduruldu'
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

-- ---------- 3. Kapıda üye karekodu: üyelere ücretli etkinlikte bilet kodu gerekir ----------
-- giris_kontrol ve giris_kaydet'in üye kolu, kayıtlı ama henüz girmemiş üyeyi ücretli etkinlikte geri çevirir
do $$
declare
  f text;
  tanim text;
  yeni text;
  eski_satir constant text := $s$  if k.durum <> 'kayitli' then raise exception '% bekleme listesinde; kaydı kesinleşmemiş.', u.ad; end if;$s$;
  ek constant text := $s$
  if not k.geldi and exists (select 1 from etkinlikler x where x.id = p_etkinlik and x.bilet_fiyati is not null and x.uyelere is distinct from 'ucretsiz') then
    raise exception 'Bu etkinlik üyelere de ücretli; % bilet kodunu (FC-B-…) okutmalı.', u.ad;
  end if;$s$;
begin
  foreach f in array array['giris_kontrol(bigint,text)', 'giris_kaydet(bigint,text)'] loop
    tanim := pg_get_functiondef(('public.' || f)::regprocedure);
    yeni := replace(tanim, eski_satir, eski_satir || ek);
    if yeni = tanim then raise exception 'giriş denetimi eklenemedi: %', f; end if;
    execute yeni;
  end loop;
end $$;

-- ---------- 6. Bitiş günü dahil: diğer işlevlerde "bitis > bugün" → "bitis >= bugün" ----------
do $$
declare
  f text;
  tanim text;
  yeni text;
begin
  foreach f in array array['uye_durumlarini_guncelle()', 'gunluk_epostalar()', 'uyelik_dondur(integer)', 'dondurma_bitir()',
                           'dondurmalari_sonlandir()', 'bilet_istegi_ac(text,text,text,jsonb,uuid,text)'] loop
    tanim := pg_get_functiondef(('public.' || f)::regprocedure);
    yeni := tanim;
    yeni := regexp_replace(yeni, 'bitis > (istanbul_bugun\(\)|bugun)', 'bitis >= \1', 'g');
    yeni := regexp_replace(yeni, 'bitis <= istanbul_bugun\(\)', 'bitis < istanbul_bugun()', 'g');
    yeni := replace(yeni, 'bitis - kalan > istanbul_bugun()', 'bitis - kalan >= istanbul_bugun()');
    if yeni = tanim then raise exception 'bitiş denetimi değişmedi: %', f; end if;
    execute yeni;
  end loop;
end $$;

-- ---------- 3. Üye indirimi (%50) bir etkinlikte üye başına bir kez ----------
do $$
declare
  tanim text := pg_get_functiondef('public.bilet_istegi_ac(text,text,text,jsonb,uuid,text)'::regprocedure);
  eski constant text := $s$indirim := case when aktif and e.uyelere = 'yuzde50' then round(e.bilet_fiyati / 2) else 0 end;$s$;
  yeni constant text := $s$indirim := case when aktif and e.uyelere = 'yuzde50' and not exists (
      select 1 from bilet_istekleri x, jsonb_array_elements(x.kalemler) xk
      where x.uye_id = u.id and (x.durum = 'onaylandi' or (x.durum = 'bekliyor' and (x.yuklendi or x.created_at > now() - interval '24 hours')))
        and (xk ->> 'etkinlik_id')::bigint = e.id and (xk ->> 'indirim')::numeric > 0)
    then round(e.bilet_fiyati / 2) else 0 end;$s$;
begin
  if position(eski in tanim) = 0 then raise exception 'üye indirimi satırı bulunamadı'; end if;
  execute replace(tanim, eski, yeni);
end $$;

-- ---------- 4. İptal / erteleme duyurusu bilet alanlara da ----------
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
    -- Aynı e-postaya tek mail (üye hem kayıtlı hem bilet almışsa)
    for r in select distinct on (lower(x.eposta)) x.* from (
               select 1 as oncelik, 'u' || u.id as anahtar, u.id as uye_id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id
                 where k.etkinlik_id = e.id
               union all
               select 2, 't' || t.id, null, t.ad, t.eposta from tanisma_biletleri t where t.etkinlik_id = e.id and t.durum = 'bekliyor'
               union all
               select 3, 'b' || i.id, i.uye_id, i.ad, i.eposta from bilet_istekleri i
                 where (i.durum = 'onaylandi' or (i.durum = 'bekliyor' and i.yuklendi))
                   and exists (select 1 from jsonb_array_elements(i.kalemler) ik where (ik ->> 'etkinlik_id')::bigint = e.id)
             ) x
             where x.eposta not like 'silindi-%'
             order by lower(x.eposta), x.oncelik loop
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

-- ---------- 7. İndirim kodu: sınır yarışı ve kaba kuvvet ----------
create table if not exists public.indirim_denemeleri (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
alter table public.indirim_denemeleri enable row level security;
revoke all on public.indirim_denemeleri from anon, authenticated;
create index if not exists indirim_denemeleri_at on public.indirim_denemeleri (at);

-- Sepette "Uygula": geçersizse {gecerli: false} döner (hata fırlatmaz ki yanlış deneme kaydı kalsın)
create or replace function public.indirim_kodu_bak(p_kod text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  k indirim_kodlari;
  bekleyen int;
begin
  if (select count(*) from indirim_denemeleri where at > now() - interval '10 minutes') >= 30 then
    raise exception 'Çok fazla deneme yapıldı; birkaç dakika sonra tekrar dene.';
  end if;
  select * into k from indirim_kodlari where kod = upper(trim(coalesce(p_kod, '')));
  if k.kod is not null and k.sinir is not null then
    select count(*) into bekleyen from bilet_istekleri
      where indirim_kodu = k.kod and durum = 'bekliyor' and (yuklendi or created_at > now() - interval '24 hours');
  end if;
  if k.kod is null or not k.aktif or (k.son_tarih is not null and k.son_tarih < istanbul_bugun())
     or (k.sinir is not null and k.kullanilan + coalesce(bekleyen, 0) >= k.sinir) then
    insert into indirim_denemeleri default values;
    delete from indirim_denemeleri where at < now() - interval '1 day';
    return jsonb_build_object('gecerli', false);
  end if;
  return jsonb_build_object('gecerli', true, 'kod', k.kod, 'tur', k.tur, 'deger', k.deger);
end $$;
revoke execute on function public.indirim_kodu_bak(text) from public;
grant execute on function public.indirim_kodu_bak(text) to anon, authenticated, service_role;

-- bilet_istegi_ac_yol: kod satırı kilitlenir (aynı anda iki sepet son kullanımı alamaz); geçersiz kod hata verir.
-- Ziyaretçi nakit isteği açamaz (form-gonder de reddeder).
do $$
declare
  tanim text := pg_get_functiondef('public.bilet_istegi_ac_yol(text,text,text,jsonb,uuid,text,text,text)'::regprocedure);
  eski constant text := $s$if nullif(trim(coalesce(p_kod, '')), '') is not null then kd := indirim_kodu_bak(p_kod); end if;$s$;
  yeni constant text := $s$if nullif(trim(coalesce(p_kod, '')), '') is not null then
    perform 1 from indirim_kodlari where kod = upper(trim(p_kod)) for update;
    kd := indirim_kodu_bak(p_kod);
    if not coalesce((kd ->> 'gecerli')::boolean, false) then raise exception 'Bu indirim kodu geçerli değil.'; end if;
  end if;$s$;
begin
  if position(eski in tanim) = 0 then raise exception 'indirim satırı bulunamadı'; end if;
  execute replace(tanim, eski, yeni);
end $$;

-- ---------- 8. Dekont tutarı aidat ayarından ----------
alter table public.dekontlar alter column tutar set default coalesce(
  case when public.ayar('aidat') #>> '{}' ~ '^[0-9]+(\.[0-9]+)?$' then (public.ayar('aidat') #>> '{}')::numeric end, 3000);

-- ---------- 9. IP sayacından düşme (form-gonder, service_role) ----------
create or replace function public.istek_iade(p_anahtar text, p_tur text)
  returns void language sql security definer set search_path = public as $$
    update istek_sayaci set adet = adet - 1 where anahtar = p_anahtar and tur = p_tur and saat = date_trunc('hour', now()) and adet > 0
  $$;
revoke execute on function public.istek_iade(text, text) from public, anon, authenticated;
grant execute on function public.istek_iade(text, text) to service_role;

-- ---------- 10. KVKK: anonimleştirmenin kapsamı ----------
-- Üye anonimleştirilince (e-postası silindi-…@silindi.invalid olur) aynı kişinin diğer kayıtları da temizlenir:
-- gönüllü başvurusu silinir; düğün talebi / daveti, Açık Çağrı başvurusu, tanışma biletindeki telefon ve referans,
-- bilet isteklerindeki dekont dosyası (depodaki dosya gece temizliğinde silinir) anonimleşir. Üyelik pasif olur.
create or replace function public.kvkk_ek_temizlik() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  takma text := new.ad;
  ep text := lower(old.eposta);
  tel_rakam text := right(regexp_replace(coalesce(old.tel, ''), '\D', '', 'g'), 10);
begin
  delete from gonulluler where lower(eposta) = ep;
  update dugun_davetleri set ad = takma, notlar = null where talep_id in (select id from dugun_talepleri where lower(eposta) = ep);
  update dugun_talepleri set ad = takma, eposta = new.eposta, tel = 'silindi', notlar = null, yonetici_notu = null where lower(eposta) = ep;
  update acik_cagri set ad = takma, iletisim = 'silindi'
    where lower(iletisim) like '%' || ep || '%'
       or (length(tel_rakam) = 10 and regexp_replace(iletisim, '\D', '', 'g') like '%' || tel_rakam || '%');
  update tanisma_biletleri set tel = null, referans = null where eposta = new.eposta;
  update bilet_istekleri set dosya = 'silindi' where (uye_id = new.id or eposta = new.eposta) and dosya like 'yeni/%';
  update uyeler set aidat_muaf = false, durum = 'doldu', bitis = least(coalesce(bitis, istanbul_bugun() - 1), istanbul_bugun() - 1)
    where id = new.id;
  return new;
end $$;
revoke execute on function public.kvkk_ek_temizlik() from public, anon, authenticated;
drop trigger if exists kvkk_ek_temizlik on public.uyeler;
create trigger kvkk_ek_temizlik after update of eposta on public.uyeler
  for each row when (new.eposta like 'silindi-%@silindi.invalid' and old.eposta not like 'silindi-%@silindi.invalid')
  execute function public.kvkk_ek_temizlik();

-- Denetim kayıtları: ada göre silme yalnız o ad başka bir üyede yoksa (aynı adlı üyenin kayıtları silinmesin)
do $$
declare
  tanim text := pg_get_functiondef('public.uye_anonimlestir(bigint)'::regprocedure);
  eski constant text := 'or strpos(degisen::text, u.ad) > 0';
  yeni constant text := 'or (strpos(degisen::text, u.ad) > 0 and not exists (select 1 from uyeler x where x.ad = u.ad and x.id <> u.id))';
begin
  if position(eski in tanim) = 0 then raise exception 'anonimleştirme satırı bulunamadı'; end if;
  execute replace(tanim, eski, yeni);
end $$;

-- ---------- 11. KVKK: veri kopyası eksiksiz ----------
create or replace function public.veri_kopyasi(p_uye bigint default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  tel_rakam text;
begin
  if p_uye is null then select * into u from uyeler where user_id = auth.uid();
  elsif yonetici_mi() then select * into u from uyeler where id = p_uye;
  else raise exception 'Bu işlem yalnız yönetici içindir.';
  end if;
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  tel_rakam := right(regexp_replace(coalesce(u.tel, ''), '\D', '', 'g'), 10);
  return jsonb_build_object(
    'olusturma', now(),
    'uye', to_jsonb(u) - 'user_id' - 'yonetici_notu',
    'odemeler', coalesce((select jsonb_agg(to_jsonb(o) - 'uye_id' order by o.tarih) from odemeler o where o.uye_id = u.id), '[]'),
    'kart_odeme_istekleri', coalesce((select jsonb_agg(jsonb_build_object('tutar', x.tutar, 'durum', x.durum, 'odeme_no', x.odeme_no, 'tarih', x.created_at) order by x.created_at)
                                      from odeme_istekleri x where x.uye_id = u.id), '[]'),
    'etkinlik_kayitlari', coalesce((select jsonb_agg(jsonb_build_object('etkinlik', e.ad, 'tarih', e.tarih, 'durum', k.durum, 'geldi', k.geldi) order by e.tarih)
                                    from etkinlik_kayitlari k join etkinlikler e on e.id = k.etkinlik_id where k.uye_id = u.id), '[]'),
    'bilet_istekleri', coalesce((select jsonb_agg(jsonb_build_object('ad', i.ad, 'eposta', i.eposta, 'tel', i.tel, 'kalemler', i.kalemler, 'tutar', i.tutar,
                                   'odeme_yolu', i.odeme_yolu, 'durum', i.durum, 'sonuc', i.sonuc, 'tarih', i.created_at,
                                   'biletler', (select coalesce(jsonb_agg(jsonb_build_object('kod', b.kod, 'etkinlik_id', b.etkinlik_id, 'durum', b.durum)), '[]') from biletler b where b.istek_id = i.id))
                                   order by i.created_at)
                                 from bilet_istekleri i where i.uye_id = u.id or i.eposta = u.eposta), '[]'),
    'dekontlar', coalesce((select jsonb_agg(jsonb_build_object('tarih', d.odeme_tarihi, 'tutar', d.tutar, 'durum', d.durum, 'sonuc', d.sonuc) order by d.id)
                           from dekontlar d where d.uye_id = u.id), '[]'),
    'dondurmalar', coalesce((select jsonb_agg(to_jsonb(x) - 'uye_id' order by x.id) from uyelik_dondurmalari x where x.uye_id = u.id), '[]'),
    'anketler', coalesce((select jsonb_agg(to_jsonb(a) - 'uye_id') from anket_yanitlari a where a.uye_id = u.id), '[]'),
    'formlar', coalesce((select jsonb_agg(jsonb_build_object('form', f.baslik, 'cevaplar', y.cevaplar, 'tarih', y.updated_at) order by y.created_at)
                         from form_yanitlari y join formlar f on f.id = y.form_id where y.uye_id = u.id or (y.uye_id is null and y.eposta = u.eposta)), '[]'),
    'tanisma_biletleri', coalesce((select jsonb_agg(to_jsonb(t) - 'id') from tanisma_biletleri t where lower(t.eposta) = u.eposta), '[]'),
    'gonullu_basvurulari', coalesce((select jsonb_agg(to_jsonb(g) - 'id' order by g.created_at) from gonulluler g where lower(g.eposta) = u.eposta), '[]'),
    'dugun_talepleri', coalesce((select jsonb_agg(to_jsonb(d) - 'id' - 'yonetici_notu' - 'davet_id' order by d.created_at) from dugun_talepleri d where lower(d.eposta) = u.eposta), '[]'),
    'acik_cagri', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'notlar' order by c.created_at) from acik_cagri c
                            where lower(c.iletisim) like '%' || u.eposta || '%'
                               or (length(tel_rakam) = 10 and regexp_replace(c.iletisim, '\D', '', 'g') like '%' || tel_rakam || '%')), '[]'),
    'gonderilen_mailler', coalesce((select jsonb_agg(jsonb_build_object('sablon', q.sablon, 'durum', q.durum, 'tarih', q.created_at) order by q.id)
                                    from eposta_kuyrugu q where q.alici = u.eposta), '[]'));
end $$;
revoke execute on function public.veri_kopyasi(bigint) from public, anon;
grant execute on function public.veri_kopyasi(bigint) to authenticated;
