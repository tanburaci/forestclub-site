-- Forest Club Urla · 13.11.2026 denetim düzeltmeleri
-- 1. Tek tip yanıt (dekont, kartla aidat): ekranda herkese aynı yanıt, ayrıntı yalnız o adrese e-postayla
-- 2. Etkinlik saati: "24.30" gibi yanlış saat saatlik işi bozmasın; "19:00" da okunsun; kayıtta denetlensin
-- 3. Sınırlı indirim kodu: yarıda bırakılan kart ödemesi kodu 24 saat kilitlemesin; site geneli kilit yok
-- 4. Etkinlik envanteri düşümleri İstanbul tarihiyle
-- 5. Etkinlik iptalinde ödenmiş biletler için yöneticiye iade uyarısı
-- 6. Shopier'den bizim olmayan / tanınmayan ödeme gelirse yöneticiye uyarı
-- 7. Eski iyzico işlevleri kaldırıldı (kart ödemeleri 02.11.2026'dan beri Shopier)

-- ---------- 1. Tek tip yanıt ----------
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('dekont_bulunamadi', 'Dekont: başvuru bulunamadı',
  'Siteden başvurusu olmayan bir e-postayla dekont gelince gider (ekranda herkese aynı yanıt gösterilir).', true, null,
  'Forest Club Urla: dekontun kaydedilemedi', 'Merhaba,

Bu e-posta adresiyle Forest Club Urla''ya bir dekont gönderildi, ama bu adresle bir başvuru bulamadık; dekont kaydedilmedi.

Başvuruda hangi e-postayı yazdıysan dekontu o adresle yeniden gönderebilirsin: {odemeLinki}
Henüz başvurmadıysan önce buradan başvurabilirsin: https://www.forestcluburla.com/uyelik/

Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.

Forest Club Urla', array['odemeLinki']::text[]) on conflict (id) do nothing;

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('kart_bilgi', 'Kartla aidat açılamadı',
  'Siteden kartla aidat istenip açılamayınca gider (başvuru yok ya da üyelik zaten aktif). Ekranda herkese aynı yanıt gösterilir.', true, null,
  'Forest Club Urla: kartla ödeme', 'Merhaba,

Bu e-posta adresiyle kartla üyelik ödemesi istendi ama açamadık: {neden}

Üye paneline bu e-postayla giriş yapabilirsin: https://www.forestcluburla.com/uye/

Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.

Forest Club Urla', array['neden']::text[]) on conflict (id) do nothing;

create or replace function public.dekont_yukleme_ac(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Başvuruda yazdığın e-postayı yaz.'; end if;
  if p_dosya !~ '^yeni/[A-Za-z0-9._-]{8,200}$' then raise exception 'Dosya adı geçersiz.'; end if;
  if (select count(*) from dekont_yuklemeleri y where y.eposta = ep and y.created_at > now() - interval '1 hour'
        and not exists (select 1 from dekontlar d where d.dosya = y.dosya)) >= 5 then
    raise exception 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.';
  end if;
  select * into u from uyeler where eposta = ep for update;
  -- Başvurusu olmayan adrese de yükleme hakkı verilir (ekranda fark olmasın); kaydı dekont_kaydet açmaz, e-posta gider
  if u.id is not null and (select count(*) from dekontlar where uye_id = u.id and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için incelemede bekleyen iki dekont var. Biri sonuçlanınca yenisini gönderebilirsin.';
  end if;
  insert into dekont_yuklemeleri (dosya, eposta) values (p_dosya, ep);
  return 'tamam';
end $$;
revoke execute on function public.dekont_yukleme_ac(text, text) from public, anon, authenticated;
grant execute on function public.dekont_yukleme_ac(text, text) to service_role;

create or replace function public.dekont_kaydet(p_eposta text, p_dosya text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
begin
  if not exists (select 1 from dekont_yuklemeleri where dosya = p_dosya and eposta = ep and created_at > now() - interval '24 hours')
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = p_dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  select * into u from uyeler where eposta = ep for update;  -- aynı e-postayla aynı anda gelen iki kayıt sınırı aşmasın
  if u.id is null then
    -- Ekranda herkese aynı yanıt; "başvuru bulunamadı" yalnız bu adrese (günde bir kez). Dosya 24 saat sonra
    -- dekont-temizle ile silinir (kayda bağlanmadı).
    perform eposta_ekle('dekont_bulunamadi', ep, '{}'::jsonb, 'dekont_bulunamadi:' || md5(ep) || ':' || istanbul_bugun());
    return 'tamam';
  end if;
  if exists (select 1 from dekontlar where dosya = p_dosya) then return 'tamam'; end if;
  if (select count(*) from dekontlar where uye_id = u.id and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için incelemede bekleyen iki dekont var. Biri sonuçlanınca yenisini gönderebilirsin.';
  end if;
  insert into dekontlar (uye_id, eposta, ad, odeme_tarihi, dosya) values (u.id, ep, u.ad, istanbul_bugun(), p_dosya);
  return 'tamam';
end $$;
revoke execute on function public.dekont_kaydet(text, text) from public, anon, authenticated;
grant execute on function public.dekont_kaydet(text, text) to service_role;

-- Kartla aidat: açılamazsa {"eposta": true} döner (ekranda "e-postana bilgi gönderdik"), neden yalnız e-postayla
create or replace function public.uyelik_kart_ac(p_eposta text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(coalesce(p_eposta, '')));
  u uyeler;
  neden text;
begin
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  select * into u from uyeler where eposta = ep;
  if u.id is null then
    neden := 'bu adresle bir başvuru bulamadık. Önce https://www.forestcluburla.com/uyelik/ sayfasından başvurabilirsin.';
  elsif u.bitis is not null and u.bitis > istanbul_bugun() + 7 then
    neden := 'üyeliğin zaten aktif; yenilemeyi üye panelinden yapabilirsin.';
  end if;
  if neden is not null then
    perform eposta_ekle('kart_bilgi', ep, jsonb_build_object('neden', neden), 'kart_bilgi:' || md5(ep) || ':' || istanbul_bugun(), u.id);
    return jsonb_build_object('eposta', true);
  end if;
  return odeme_istegi_ac(u.id);
end $$;
revoke execute on function public.uyelik_kart_ac(text) from public, anon, authenticated;
grant execute on function public.uyelik_kart_ac(text) to service_role;

-- ---------- 2. Etkinlik saati ----------
-- Saatin başındaki "19.00" ya da "19:00" okunur; geçersizse (24.30, 18.60) 10:00 sayılır, hata vermez
create or replace function public.saat_oku(p_saat text) returns time language sql immutable as $$
  select make_time(m[1]::int, m[2]::int, 0)
    from regexp_match(coalesce(p_saat, ''), '^\s*(\d{1,2})[.:](\d{2})') m
   where m[1]::int < 24 and m[2]::int < 60
$$;
-- Kayıt denetiminde (check) yönetici oturumuyla çalışır; ziyaretçiye kapalı
revoke execute on function public.saat_oku(text) from public, anon;
grant execute on function public.saat_oku(text) to authenticated, service_role;

create or replace function public.etkinlik_baslangic(e etkinlikler) returns timestamptz
  language sql stable set search_path = public as $$
    select (e.tarih + coalesce(saat_oku(e.saat), time '10:00')) at time zone 'Europe/Istanbul'
  $$;
revoke execute on function public.etkinlik_baslangic(etkinlikler) from public, anon, authenticated;

-- Kayıtta: saat rakamla başlıyorsa geçerli olmalı (aralık "19.00–01.00" serbest; ilk saat denetlenir).
-- Eski kayıtlar bozmasın diye NOT VALID (yalnız yeni / değişen satırlar denetlenir).
alter table public.etkinlikler drop constraint if exists etkinlik_saat_gecerli;
alter table public.etkinlikler add constraint etkinlik_saat_gecerli
  check (saat is null or saat !~ '^\s*\d' or saat_oku(saat) is not null) not valid;

-- ---------- 3. İndirim kodu ----------
-- Bekleyen istek sınırdan yer tutar: dekont yüklendiyse, havalede 24 saat, kartta 30 dakika (Shopier penceresi kapatılırsa
-- kod herkese kilitlenmesin)
create or replace function public.indirim_kodu_durum_(p_kod text)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  k indirim_kodlari;
  bekleyen int;
begin
  select * into k from indirim_kodlari where kod = upper(trim(coalesce(p_kod, '')));
  if k.kod is not null and k.sinir is not null then
    select count(*) into bekleyen from bilet_istekleri
      where indirim_kodu = k.kod and durum = 'bekliyor'
        and (yuklendi
             or (odeme_yolu = 'kart' and created_at > now() - interval '30 minutes')
             or (odeme_yolu is distinct from 'kart' and created_at > now() - interval '24 hours'));
  end if;
  if k.kod is null or not k.aktif or (k.son_tarih is not null and k.son_tarih < istanbul_bugun())
     or (k.sinir is not null and k.kullanilan + coalesce(bekleyen, 0) >= k.sinir) then
    return jsonb_build_object('gecerli', false);
  end if;
  return jsonb_build_object('gecerli', true, 'kod', k.kod, 'tur', k.tur, 'deger', k.deger);
end $$;
revoke execute on function public.indirim_kodu_durum_(text) from public, anon, authenticated;

-- IP başına 10 dakikada 30 hatalı deneme. Site geneli kilit kaldırıldı (dönen IP'lerle herkes kilitlenmesin);
-- tablo bir günden eski kayıtları silerek küçük kalır.
create or replace function public.indirim_kodu_bak(p_kod text)
  returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip text := istemci_ip_ozeti();
  r jsonb;
begin
  if (select count(*) from indirim_denemeleri d where d.ip = v_ip and d.at > now() - interval '10 minutes') >= 30 then
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

-- ---------- 4. Envanter düşümü İstanbul tarihiyle (00:00–03:00 arası kayıt dünün tarihini almasın) ----------
alter table public.envanter_dusumleri alter column tarih set default istanbul_bugun();

-- ---------- 5. Etkinlik iptali: ödenmiş biletler için iade uyarısı ----------
create or replace function public.iptal_iade_uyarisi() returns trigger language plpgsql security definer set search_path = public as $$
declare
  liste text;
  adet int;
begin
  select count(*), string_agg(i.ad || ' (' || i.eposta || ', ' || i.tutar || ' TL, ' || coalesce(i.odeme_yolu, 'havale')
                                || case when jsonb_array_length(i.kalemler) > 1 then ', sepette başka etkinlik de var' else '' end || ')',
                              '; ' order by i.id)
    into adet, liste
    from bilet_istekleri i
   where i.durum = 'onaylandi'
     and exists (select 1 from jsonb_array_elements(i.kalemler) ik where (ik ->> 'etkinlik_id')::bigint = new.id);
  if adet > 0 then
    perform yoneticilere_uyari(tr_tarih(old.tarih) || ' tarihli ' || new.ad || ' iptal edildi: ' || adet
                               || ' ödenmiş bilet iade bekliyor. İadeyi yapınca muhasebeye de işleyin. ' || liste,
                               'iptal_iade:' || new.id || ':' || extract(epoch from now())::bigint);
  end if;
  return new;
end $$;
revoke execute on function public.iptal_iade_uyarisi() from public, anon, authenticated;
drop trigger if exists iptal_iade on public.etkinlikler;
create trigger iptal_iade after update of durum on public.etkinlikler
  for each row when (new.durum = 'iptal' and old.durum is distinct from 'iptal') execute function public.iptal_iade_uyarisi();

-- ---------- 6. Shopier'den tanınmayan ödeme ----------
create or replace function public.shopier_tanimsiz_odeme(p_siparis text, p_tutar numeric)
  returns void language plpgsql security definer set search_path = public as $$
begin
  perform yoneticilere_uyari('Shopier''den ödenmiş bir sipariş geldi ama bizdeki hiçbir bilet / üyelik / destek isteğiyle eşleşmedi '
                             || '(sipariş ' || p_siparis || ', ' || coalesce(p_tutar::text, '?') || ' TL). Shopier panelinden bakıp '
                             || 'kişiye elle işlem yapın ya da iade edin.', 'shopier_tanimsiz:' || p_siparis);
end $$;
revoke execute on function public.shopier_tanimsiz_odeme(text, numeric) from public, anon, authenticated;
grant execute on function public.shopier_tanimsiz_odeme(text, numeric) to service_role;

-- ---------- 7. Eski iyzico işlevleri ----------
drop function if exists public.odeme_basarisiz(text, text);
drop function if exists public.destek_basarisiz(text, text);
