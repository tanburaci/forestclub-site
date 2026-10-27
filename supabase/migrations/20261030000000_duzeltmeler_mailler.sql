-- Forest Club Urla: düzeltmeler ve eksik mailler (30.10.2026).
--   · "Müzik" etkinlik türü (panel formunda vardı, veritabanında yoktu)
--   · bekleme listesinden yükseltme tek işlevde (bekleme_yukselt): kontenjan ve satılan bilet sayılır, yalnız aktif
--     üye yükselir, yükselene "yer açıldı" maili gider; panelin kontenjan ve yoklama değişiklikleri sunucuda
--   · iptal / erteleme duyurusu kayıtlılara ve bekleme listesine mail olarak gider
--   · dekont reddinde gerekçeli mail; doğum günü ve özel gün kutlamaları
--   · üye durumu her sabah bitişe göre güncellenir; sistem sağlık özeti (sorun varsa yöneticilere mail)
--   · yöneticiye: kendine deneme maili, hatalı maili yeniden deneme, şablonun ilk metnine dönme

alter type public.etkinlik_tur add value if not exists 'muzik';

-- Şablonların ilk metni ("İlk hâline döndür" bunu geri yazar)
alter table public.eposta_sablonlari add column if not exists varsayilan_konu text, add column if not exists varsayilan_metin text;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('dekont_red', 'Dekont onaylanamadı', 'Yönetici bir dekontu reddedince üyeye gider.', true, null, 'Dekontun hakkında',
   E'Merhaba {ad},\n\nGönderdiğin dekontu onaylayamadık: {neden}\n\nÖdemeni kontrol edip dekontu yeniden yükleyebilirsin: {odemeLinki}\n\nSorun olursa WhatsApp’tan yazabilirsin.\n\nForest Club Urla',
   array['ad', 'neden', 'odemeLinki']),
  ('saglik', 'Sistem uyarısı (yöneticilere)', 'Otomatik işlerde sorun görülürse her sabah yöneticilere gider.', true, null,
   'Forest Club sitesi: otomatik işlerde sorun var',
   E'Merhaba,\n\nSon 24 saatte otomatik işlerde sorun görüldü:\n\n{ozet}\n\nAyrıntı yönetici panelinde, E-postalar sekmesinde.\n\nForest Club Urla sitesi',
   array['ozet'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where varsayilan_konu is null;

-- Şifre maillerini Supabase Auth gönderir (SMTP ayarı); bu şablon kullanılmıyor
update public.eposta_sablonlari
  set acik = false, ne_zaman = 'Kullanılmıyor: giriş ve şifre maillerini Supabase Auth gönderir (Authentication → SMTP).'
  where id = 'sifre' and ne_zaman = 'Üye “İlk girişim / şifremi unuttum” deyince gider.';

-- Bir etkinliğin kayıt durumu (panel kendi listesini bununla eşitler): {kontenjan, kayitli[], bekleme[], gelen[]}
create or replace function public.kayit_listesi(p_etkinlik bigint)
  returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
      'kontenjan', e.kontenjan,
      'kayitli', coalesce((select jsonb_agg(k.uye_id order by k.created_at) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'kayitli'), '[]'),
      'bekleme', coalesce((select jsonb_agg(k.uye_id order by k.sira, k.created_at) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'bekleme'), '[]'),
      'gelen', coalesce((select jsonb_agg(k.uye_id) from etkinlik_kayitlari k where k.etkinlik_id = e.id and k.durum = 'kayitli' and k.geldi), '[]'))
    from etkinlikler e where e.id = p_etkinlik
  $$;
revoke execute on function public.kayit_listesi(bigint) from public, anon, authenticated;

-- Bekleme listesinden yükseltme: yer oldukça (kontenjan − satılan bilet) sıradaki AKTİF üye kayda geçer ve "yer açıldı"
-- maili kuyruğa yazılır. Üyeliği aktif olmayan sırada kalır. Dönüş: yükselen kişi sayısı
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
  select count(*) into dolu from etkinlik_kayitlari where etkinlik_id = e.id and durum = 'kayitli';
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
  -- bekleme sırası 1'den yeniden
  update etkinlik_kayitlari k set sira = s.yeni
    from (select uye_id, row_number() over (order by sira, created_at) as yeni from etkinlik_kayitlari
          where etkinlik_id = e.id and durum = 'bekleme') s
    where k.etkinlik_id = e.id and k.uye_id = s.uye_id;
  return n;
end $$;
revoke execute on function public.bekleme_yukselt(bigint) from public, anon, authenticated;

-- Üyenin "Geliyorum / Gelemeyeceğim / bekleme listesi" isteği: vazgeçince yükseltmeyi bekleme_yukselt yapar
create or replace function public.etkinlik_kaydi(p_etkinlik bigint, p_istek text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  e etkinlikler;
  mevcut etkinlik_kayitlari;
  dolu int;
begin
  select * into u from uyeler where user_id = auth.uid();
  if u.id is null then raise exception 'Üye kaydı bulunamadı.'; end if;
  select * into e from etkinlikler where id = p_etkinlik for update;  -- aynı anda iki kayıt kontenjanı aşmasın
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
  if e.tarih < istanbul_bugun() then raise exception 'Bu etkinlik geçti.'; end if;
  select * into mevcut from etkinlik_kayitlari where etkinlik_id = e.id and uye_id = u.id;

  if p_istek = 'katil' then
    if e.durum <> 'yayinda' then raise exception 'Bu etkinlik iptal edildi ya da yayında değil.'; end if;
    if u.bitis is null or u.bitis <= istanbul_bugun() then raise exception 'Üyeliğin aktif değil.'; end if;
    if mevcut.uye_id is not null then
      return jsonb_build_object('durum', mevcut.durum, 'sira', mevcut.sira);
    end if;
    select count(*) into dolu from etkinlik_kayitlari where etkinlik_id = e.id and durum = 'kayitli';
    if dolu < e.kontenjan - e.satilan_bilet then
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

-- Panel: kontenjan değişince bekleme listesinden yükseltme sunucuda. Dönüş: kayit_listesi
create or replace function public.kontenjan_degistir(p_etkinlik bigint, p_kontenjan int)
  returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_kontenjan is null or p_kontenjan < 1 or p_kontenjan > 2000 then raise exception 'Kontenjan 1 ile 2000 arasında olmalı.'; end if;
  update etkinlikler set kontenjan = p_kontenjan where id = p_etkinlik;
  if not found then raise exception 'Etkinlik bulunamadı.'; end if;
  perform bekleme_yukselt(p_etkinlik);
  return kayit_listesi(p_etkinlik);
end $$;
revoke execute on function public.kontenjan_degistir(bigint, int) from public, anon;
grant execute on function public.kontenjan_degistir(bigint, int) to authenticated;

-- Panel: yoklamada "geldi / gelmedi" (yalnız kayıtlı üye). Dönüş: kayit_listesi
create or replace function public.yoklama_isaretle(p_etkinlik bigint, p_uye bigint, p_geldi boolean)
  returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  update etkinlik_kayitlari set geldi = coalesce(p_geldi, false)
    where etkinlik_id = p_etkinlik and uye_id = p_uye and durum = 'kayitli';
  if not found then raise exception 'Bu kişi bu etkinliğe kayıtlı değil.'; end if;
  return kayit_listesi(p_etkinlik);
end $$;
revoke execute on function public.yoklama_isaretle(bigint, bigint, boolean) from public, anon;
grant execute on function public.yoklama_isaretle(bigint, bigint, boolean) to authenticated;

-- İptal / erteleme: kayıtlılara ve bekleme listesine duyuru maili (p_duyuru boşsa kısa bir metin yazılır).
-- Dönüş: {durum, tarih, eski_tarih, kisi, mail}
drop function if exists public.etkinlik_durum_degistir(bigint, text, date, text);
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
    for r in select u.id, u.ad, u.eposta from etkinlik_kayitlari k join uyeler u on u.id = k.uye_id where k.etkinlik_id = e.id loop
      if eposta_ekle('iptal', r.eposta, jsonb_build_object('ad', r.ad, 'etkinlik', e.ad, 'duyuru', duyuru),
                     'iptal:' || e.id || ':' || r.id || ':' || extract(epoch from e.durum_degisti_at)::bigint, r.id, e.id) is not null then
        mail := mail + 1;
      end if;
    end loop;
  end if;
  return jsonb_build_object('durum', e.durum, 'tarih', e.tarih, 'eski_tarih', e.eski_tarih,
                            'kisi', (select count(*) from etkinlik_kayitlari where etkinlik_id = e.id), 'mail', mail);
end $$;
revoke execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) from public, anon;
grant execute on function public.etkinlik_durum_degistir(bigint, text, date, text, text) to authenticated;

-- Dekont kararı: reddedilene gerekçeli mail. Dönüş: {durum, bitis}
create or replace function public.dekont_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d dekontlar;
  r jsonb;
  neden text := nullif(left(trim(coalesce(p_not, '')), 500), '');
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into d from dekontlar where id = p_id for update;
  if d.id is null then raise exception 'Dekont bulunamadı.'; end if;
  if d.durum <> 'bekliyor' then raise exception 'Bu dekont için karar zaten verilmiş.'; end if;
  if not p_onay then
    update dekontlar set durum = 'reddedildi', sonuc = neden, karar_at = now(), karar_veren = auth.uid() where id = d.id;
    perform eposta_ekle('dekont_red', d.eposta,
                        jsonb_build_object('ad', d.ad, 'neden', coalesce(neden, 'Dekonttaki bilgiler ödemeyle eşleşmedi.')),
                        'dekont_red:' || d.id, d.uye_id);
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  r := uyelik_uzat(d.uye_id, d.tutar, 'havale', istanbul_bugun(), 'dekont:' || d.id);
  update dekontlar set durum = 'onaylandi', karar_at = now(), karar_veren = auth.uid(),
                       sonuc = to_char(istanbul_bugun(), 'DD.MM.YYYY') || ' · bitiş ' || to_char((r ->> 'bitis')::date, 'DD.MM.YYYY')
    where id = d.id;
  return jsonb_build_object('durum', 'onaylandi', 'bitis', r -> 'bitis');
end $$;
revoke execute on function public.dekont_karar(bigint, boolean, text) from public, anon;
grant execute on function public.dekont_karar(bigint, boolean, text) to authenticated;

-- Her sabah: yenileme, etkinlik hatırlatması, doğum günü ve özel gün (kutlama izni olan aktif üyeler).
-- 29 Şubat doğanlar artık yılı olmayan yıllarda 28 Şubat'ta kutlanır. Dönüş: {yenileme, hatirlatma, dogumgunu, ozelgun}
create or replace function public.gunluk_epostalar()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bugun date := istanbul_bugun();
  ay_gun text := to_char(istanbul_bugun(), 'MM-DD');
  artik_yil boolean := (extract(year from istanbul_bugun())::int % 4 = 0 and extract(year from istanbul_bugun())::int % 100 <> 0)
                       or extract(year from istanbul_bugun())::int % 400 = 0;
  g_yenileme int;
  g_hatirlatma int;
  n_yenileme int := 0;
  n_hatirlatma int := 0;
  n_dogum int := 0;
  n_ozel int := 0;
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
  return jsonb_build_object('yenileme', n_yenileme, 'hatirlatma', n_hatirlatma, 'dogumgunu', n_dogum, 'ozelgun', n_ozel);
end $$;
revoke execute on function public.gunluk_epostalar() from public, anon, authenticated;
grant execute on function public.gunluk_epostalar() to service_role;

-- Bitişi geçen "aktif" üyeler "doldu" olur (panel ve SQL artık aynı durumu görür). Dönüş: değişen üye sayısı
create or replace function public.uye_durumlarini_guncelle()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update uyeler set durum = 'doldu' where durum = 'aktif' and (bitis is null or bitis <= istanbul_bugun());
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.uye_durumlarini_guncelle() from public, anon, authenticated;

-- Sağlık özeti: son 24 saatte kalıcı hataya düşen mail, 30 dakikadır bekleyen mail (gönderici çalışmıyor),
-- başarısız zamanlanmış iş, hata dönen Edge Function çağrısı, eksik Vault ayarı. Yönetici panelde görür; zamanlayıcı da
-- sorun varsa yöneticilere mail atar.
create or replace function public.saglik_ozeti()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hata int;
  bekleyen int;
  cron_hata int := null;
  edge_hata int := null;
  vault_eksik boolean := null;
  satirlar text[] := '{}';
begin
  if auth.uid() is not null and not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select count(*) into hata from eposta_kuyrugu where durum = 'hata' and coalesce(kilit_at, created_at) > now() - interval '24 hours';
  select count(*) into bekleyen from eposta_kuyrugu where durum = 'bekliyor' and zaman < now() - interval '30 minutes';
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
  if coalesce(cron_hata, 0) > 0 then satirlar := satirlar || (cron_hata || ' zamanlanmış iş başarısız oldu.'); end if;
  if coalesce(edge_hata, 0) > 0 then satirlar := satirlar || (edge_hata || ' Edge Function çağrısı hata döndü.'); end if;
  if vault_eksik then satirlar := satirlar || 'Vault ayarları (fc_proje_url, fc_zamanlayici_anahtari) eksik: mailler ve temizlik çalışmıyor.'::text; end if;
  return jsonb_build_object('sorun', cardinality(satirlar) > 0, 'satirlar', to_jsonb(satirlar),
                            'mail_hata', hata, 'mail_bekleyen', bekleyen, 'cron_hata', cron_hata, 'edge_hata', edge_hata);
end $$;
revoke execute on function public.saglik_ozeti() from public, anon;
grant execute on function public.saglik_ozeti() to authenticated;

-- Her sabah (pg_cron): üye durumları, günlük mailler, sorun varsa yöneticilere sağlık uyarısı
create or replace function public.gunluk_isler()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
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
  return jsonb_build_object('durum_degisen', durum, 'mailler', mailler, 'saglik', saglik);
end $$;
revoke execute on function public.gunluk_isler() from public, anon, authenticated;
select cron.schedule('fc-gunluk-epostalar', '0 6 * * *', $$select public.gunluk_isler()$$);

-- Gönderim sonucu: 'ertele' (Resend sınırı: deneme sayılmaz, bir dakika sonra) ve 'kalici' (geçersiz adres gibi,
-- yeniden denenmez) eklendi
create or replace function public.eposta_sonuc(p_id bigint, p_durum text, p_hata text default null, p_saglayici text default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if p_durum = 'gonderildi' then
    update eposta_kuyrugu set durum = 'gonderildi', gonderim_at = now(), saglayici_id = p_saglayici, son_hata = null where id = p_id;
  elsif p_durum = 'atlandi' then
    update eposta_kuyrugu set durum = 'atlandi', son_hata = left(p_hata, 500) where id = p_id;
  elsif p_durum = 'ertele' then
    update eposta_kuyrugu set durum = 'bekliyor', deneme = greatest(deneme - 1, 0), zaman = now() + interval '1 minute',
                              son_hata = left(p_hata, 500) where id = p_id;
  elsif p_durum = 'kalici' then
    update eposta_kuyrugu set durum = 'hata', son_hata = left(p_hata, 500) where id = p_id;
  elsif p_durum = 'hata' then
    update eposta_kuyrugu
      set durum = case when deneme >= 5 then 'hata' else 'bekliyor' end,
          zaman = now() + make_interval(mins => power(2, least(deneme, 5))::int),
          son_hata = left(p_hata, 500)
      where id = p_id;
  else
    raise exception 'Geçersiz durum.';
  end if;
end $$;
revoke execute on function public.eposta_sonuc(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.eposta_sonuc(bigint, text, text, text) to service_role;

-- Yönetici: hataya düşmüş maili yeniden sıraya alır
create or replace function public.eposta_yeniden_dene(p_id bigint)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  update eposta_kuyrugu set durum = 'bekliyor', deneme = 0, zaman = now(), son_hata = null
    where id = p_id and durum = 'hata' and not demo_adres_mi(alici);
  if not found then raise exception 'Bu mail yeniden denenemez.'; end if;
end $$;
revoke execute on function public.eposta_yeniden_dene(bigint) from public, anon;
grant execute on function public.eposta_yeniden_dene(bigint) to authenticated;

-- Yönetici: şablonu örnek bilgilerle kendi adresine gönderir (bir dakika içinde gelir). Dönüş: kuyruk numarası
create or replace function public.eposta_deneme(p_sablon text)
  returns bigint language plpgsql security definer set search_path = public as $$
declare
  alici text := lower(trim(auth.email()));
  yarin date := istanbul_bugun() + 3;
  n bigint;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if not exists (select 1 from eposta_sablonlari where id = p_sablon and acik) then
    raise exception 'Şablon kapalı: önce “Otomatik gönderilsin”i açın.';
  end if;
  if demo_adres_mi(alici) then raise exception 'Demo adresine mail gönderilmez.'; end if;
  n := eposta_ekle(p_sablon, alici,
                   jsonb_build_object('ad', 'Deniz', 'bitis', to_char(yarin, 'DD.MM.YYYY'), 'kod', 'FC-U-0001',
                                      'etkinlik', 'Breakfast Club', 'tarih', tr_tarih(yarin), 'saat', '10.00', 'yer', 'Pinya, Urla',
                                      'duyuru', 'Örnek duyuru metni.', 'neden', 'Örnek gerekçe.', 'ozelGun', 'Evlilik yıldönümü',
                                      'biletKodu', 'FC-T-ORNEK', 'ozet', '• Örnek uyarı'),
                   'deneme:' || p_sablon || ':' || auth.uid() || ':' || extract(epoch from clock_timestamp())::bigint);
  return n;
end $$;
revoke execute on function public.eposta_deneme(text) from public, anon;
grant execute on function public.eposta_deneme(text) to authenticated;
