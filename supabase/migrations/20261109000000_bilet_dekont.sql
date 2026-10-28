-- Forest Club Urla: etkinlik bileti havale + dekontla (09.11.2026). Sepet (sitede ya da üye panelinde) bir bilet isteği
-- açar: sunucu tutarı hesaplar ve yerleri ayırır, kişi IBAN'a öder ve dekontu yükler. Yönetici Başvurular'da onaylayınca
-- her kişi için bir bilet kodu (FC-B-XXXXXX) üretilir, e-postayla gider, muhasebeye "Etkinlik katılım ücreti" yazılır.
-- Kapıda bilet kodu da okutulur. Üyelere %50'li etkinlikte bir bilet yarı fiyat (yalnız oturumu doğrulanmış aktif üyeye).
create table if not exists public.bilet_istekleri (
  id bigint generated always as identity primary key,
  uye_id bigint references public.uyeler (id) on delete set null,
  ad text not null,
  eposta text not null,
  tel text,
  kalemler jsonb not null,                         -- [{etkinlik_id, adet, birim, indirim, tutar}]
  tutar numeric(10, 2) not null check (tutar > 0),
  dosya text not null unique,                      -- dekont: depoda yeni/…
  yuklendi boolean not null default false,         -- dekont yüklenmeden istek yer ayırmaz, yöneticiye görünmez
  durum dekont_durum not null default 'bekliyor',
  sonuc text,
  karar_at timestamptz,
  karar_veren uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists bilet_istekleri_eposta on public.bilet_istekleri (eposta, created_at);

create table if not exists public.biletler (
  kod text primary key,                            -- FC-B-XXXXXX
  istek_id bigint not null references public.bilet_istekleri (id) on delete cascade,
  etkinlik_id bigint not null references public.etkinlikler (id),
  ad text not null,
  durum text not null default 'gecerli' check (durum in ('gecerli', 'geldi')),
  created_at timestamptz not null default now()
);

alter table public.bilet_istekleri enable row level security;
alter table public.biletler enable row level security;
drop policy if exists yonetici_tam on public.bilet_istekleri;
create policy yonetici_tam on public.bilet_istekleri for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop policy if exists yonetici_tam on public.biletler;
create policy yonetici_tam on public.biletler for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
drop trigger if exists denetim on public.bilet_istekleri;
create trigger denetim after insert or update or delete on public.bilet_istekleri for each row execute function public.denetle();

-- Bir etkinlikte dekontu yüklenmiş, karar bekleyen isteklerin ayırdığı yer
create or replace function public.bilet_bekleyen(p_etkinlik bigint) returns int
  language sql stable security definer set search_path = public as $$
    select coalesce(sum((k ->> 'adet')::int), 0)::int
    from bilet_istekleri i, jsonb_array_elements(i.kalemler) k
    where i.yuklendi and i.durum = 'bekliyor' and (k ->> 'etkinlik_id')::bigint = p_etkinlik
  $$;
revoke execute on function public.bilet_bekleyen(bigint) from public, anon, authenticated;

-- İstek açar (form-gonder, service_role). p_kalemler: [{etkinlik, adet}]; p_user: doğrulanmış oturum (yoksa null).
-- Dönüş: {id, tutar, kalemler}
create or replace function public.bilet_istegi_ac(p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_user uuid, p_dosya text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  u uyeler;
  aktif boolean := false;
  k jsonb;
  e etkinlikler;
  adet int;
  indirim numeric;
  kalemler jsonb := '[]';
  toplam numeric := 0;
  gorulen bigint[] := '{}';
  yeni_id bigint;
begin
  if length(trim(coalesce(p_ad, ''))) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if p_dosya !~ '^yeni/[A-Za-z0-9._-]{8,200}$' then raise exception 'Dosya adı geçersiz.'; end if;
  if jsonb_typeof(p_kalemler) <> 'array' or jsonb_array_length(p_kalemler) not between 1 and 5 then raise exception 'Sepetin boş.'; end if;
  if (select count(*) from bilet_istekleri where eposta = ep and yuklendi and durum = 'bekliyor') >= 3 then
    raise exception 'Bu e-posta için incelemede bekleyen üç bilet isteği var. Biri sonuçlanınca yenisini gönderebilirsin.';
  end if;
  if (select count(*) from bilet_istekleri where eposta = ep and not yuklendi and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Çok fazla deneme yapıldı; bir saat sonra tekrar dene.';
  end if;
  if p_user is not null then
    select * into u from uyeler where user_id = p_user;
    aktif := u.id is not null and u.bitis > istanbul_bugun() and u.durum <> 'donduruldu';
  end if;
  -- Telefon: girişli üyede profildeki yeter
  if length(regexp_replace(coalesce(nullif(trim(p_tel), ''), u.tel, ''), '\D', '', 'g')) < 10 or length(p_tel) > 40 then
    raise exception 'Telefon numaranı yaz.';
  end if;
  for k in select * from jsonb_array_elements(p_kalemler) loop
    adet := case when jsonb_typeof(k -> 'adet') = 'number' then (k ->> 'adet')::int else 0 end;
    if adet not between 1 and 10 then raise exception 'Bir etkinlik için en çok 10 bilet alınabilir.'; end if;
    select * into e from etkinlikler where id = (k ->> 'etkinlik')::bigint for update;  -- aynı anda gelen istekler kontenjanı aşmasın
    if e.id is null or e.id = any (gorulen) or e.durum <> 'yayinda' or e.tarih < istanbul_bugun() or e.bilet_fiyati is null then
      raise exception 'Sepetteki bir etkinlik için bilet alınamıyor; sayfayı yenile.';
    end if;
    gorulen := gorulen || e.id;
    if adet > e.kontenjan - etkinlik_dolu(e.id) - e.satilan_bilet - bilet_bekleyen(e.id) then
      raise exception '% için yeterli yer kalmadı.', e.ad;
    end if;
    -- Üyelere ücretsiz etkinlikte üye kendi yerini "Geliyorum" ile alır; sepetteki biletler misafir (tam fiyat)
    indirim := case when aktif and e.uyelere = 'yuzde50' then round(e.bilet_fiyati / 2) else 0 end;
    kalemler := kalemler || jsonb_build_object('etkinlik_id', e.id, 'adet', adet, 'birim', e.bilet_fiyati, 'indirim', indirim,
                                               'tutar', adet * e.bilet_fiyati - indirim);
    toplam := toplam + adet * e.bilet_fiyati - indirim;
  end loop;
  insert into bilet_istekleri (uye_id, ad, eposta, tel, kalemler, tutar, dosya)
    values (u.id, trim(p_ad), ep, coalesce(nullif(trim(p_tel), ''), u.tel), kalemler, toplam, p_dosya)
    returning id into yeni_id;
  return jsonb_build_object('id', yeni_id, 'tutar', toplam, 'kalemler', kalemler);
end $$;
revoke execute on function public.bilet_istegi_ac(text, text, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.bilet_istegi_ac(text, text, text, jsonb, uuid, text) to service_role;

-- Dekont yüklendi (form-gonder, service_role): istek 24 saat içinde açılmış ve dosya depoda olmalı
create or replace function public.bilet_kaydet(p_id bigint, p_eposta text)
  returns text language plpgsql security definer set search_path = public, storage as $$
declare i bilet_istekleri;
begin
  select * into i from bilet_istekleri where id = p_id and eposta = lower(trim(p_eposta)) for update;
  if i.id is null or i.created_at < now() - interval '24 hours'
     or not exists (select 1 from storage.objects where bucket_id = 'dekontlar' and name = i.dosya) then
    raise exception 'Dekont dosyası yüklenemedi; tekrar dene.';
  end if;
  if not i.yuklendi then update bilet_istekleri set yuklendi = true where id = i.id; end if;
  return 'tamam';
end $$;
revoke execute on function public.bilet_kaydet(bigint, text) from public, anon, authenticated;
grant execute on function public.bilet_kaydet(bigint, text) to service_role;

create or replace function public.yeni_bilet_satis_kodu() returns text
  language sql volatile as $$ select 'FC-B-' || substr(yeni_bilet_kodu(), 6) $$;
revoke execute on function public.yeni_bilet_satis_kodu() from public, anon, authenticated;

-- Yönetici kararı. Onay: kodlar, satılan bilet sayısı, muhasebe, "bilet" maili. Red: gerekçeli "bilet_red" maili.
create or replace function public.bilet_karar(p_id bigint, p_onay boolean, p_not text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i bilet_istekleri;
  k jsonb;
  e etkinlikler;
  yeni_kod text;
  kodlar text[];
  satirlar text[] := '{}';
  toplam_adet int := 0;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into i from bilet_istekleri where id = p_id for update;
  if i.id is null or not i.yuklendi then raise exception 'Bilet isteği bulunamadı.'; end if;
  if i.durum <> 'bekliyor' then raise exception 'Bu istek zaten sonuçlandı.'; end if;
  if not p_onay then
    update bilet_istekleri set durum = 'reddedildi', sonuc = nullif(left(trim(coalesce(p_not, '')), 300), ''), karar_at = now(), karar_veren = auth.uid()
      where id = i.id;
    perform eposta_ekle('bilet_red', i.eposta, jsonb_build_object('ad', i.ad, 'neden', coalesce(nullif(trim(p_not), ''), 'Dekont ödemeyle eşleşmedi.')),
                        'bilet_red:' || i.id, i.uye_id);
    return jsonb_build_object('durum', 'reddedildi');
  end if;
  for k in select * from jsonb_array_elements(i.kalemler) loop
    select * into e from etkinlikler where id = (k ->> 'etkinlik_id')::bigint for update;
    kodlar := '{}';
    for n in 1 .. (k ->> 'adet')::int loop
      loop
        yeni_kod := yeni_bilet_satis_kodu();
        exit when not exists (select 1 from biletler b where b.kod = yeni_kod);
      end loop;
      insert into biletler (kod, istek_id, etkinlik_id, ad) values (yeni_kod, i.id, e.id, i.ad);
      kodlar := kodlar || yeni_kod;
    end loop;
    update etkinlikler set satilan_bilet = satilan_bilet + (k ->> 'adet')::int where id = e.id;
    if (k ->> 'tutar')::numeric > 0 then
      insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, etkinlik_id, aciklama, belge, otomatik, odeme)
        values (istanbul_bugun(), 'gelir', (k ->> 'tutar')::numeric, 'banka', 'Etkinlik katılım ücreti', e.id,
                'Bilet · ' || i.ad || ' · ' || (k ->> 'adet') || ' kişi', 'bilet:' || i.id, true, 'havale');
    end if;
    satirlar := satirlar || (e.ad || ' · ' || tr_tarih(e.tarih) || coalesce(' · ' || e.saat, '') || E'\n' || array_to_string(kodlar, E'\n'));
    toplam_adet := toplam_adet + (k ->> 'adet')::int;
  end loop;
  update bilet_istekleri set durum = 'onaylandi', sonuc = toplam_adet || ' bilet', karar_at = now(), karar_veren = auth.uid() where id = i.id;
  perform eposta_ekle('bilet', i.eposta, jsonb_build_object('ad', i.ad, 'biletler', array_to_string(satirlar, E'\n\n')), 'bilet:' || i.id, i.uye_id);
  return jsonb_build_object('durum', 'onaylandi', 'adet', toplam_adet);
end $$;
revoke execute on function public.bilet_karar(bigint, boolean, text) from public, anon;
grant execute on function public.bilet_karar(bigint, boolean, text) to authenticated;

-- Dekont artıkları: bilet isteğine bağlı dosyalar da silinmez
create or replace function public.dekont_artiklari(p_adet int default 500)
  returns setof text language sql stable security definer set search_path = public, storage as $$
    select o.name from storage.objects o
    where o.bucket_id = 'dekontlar' and o.name like 'yeni/%' and o.created_at < now() - interval '24 hours'
      and not exists (select 1 from public.dekontlar d where d.dosya = o.name)
      and not exists (select 1 from public.bilet_istekleri b where b.dosya = o.name and b.yuklendi)
    order by o.created_at
    limit p_adet
  $$;
revoke execute on function public.dekont_artiklari(int) from public, anon, authenticated;
grant execute on function public.dekont_artiklari(int) to service_role;

-- Kapıda giriş: üye karekodu (FC-U-…), tanışma bileti (FC-T-…) ya da satın alınan bilet (FC-B-…)
create or replace function public.giris_kaydet(p_etkinlik bigint, p_kod text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  metin text := upper(coalesce(p_kod, ''));
  v_kod text;
  u uyeler;
  k etkinlik_kayitlari;
  b tanisma_biletleri;
  s biletler;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  v_kod := substring(metin from 'FC-B-[A-Z0-9]{6}');
  if v_kod is not null then
    select * into s from biletler where kod = v_kod for update;
    if s.kod is null then raise exception '% koduyla bir bilet yok.', v_kod; end if;
    if s.etkinlik_id is distinct from p_etkinlik then
      raise exception 'Bu bilet başka bir etkinlik için (%).', (select tr_tarih(tarih) || ' ' || ad from etkinlikler where id = s.etkinlik_id);
    end if;
    if s.durum = 'geldi' then return jsonb_build_object('ad', s.ad, 'bilet', true, 'tanisma', false, 'zaten', true); end if;
    update biletler set durum = 'geldi' where kod = s.kod;
    return jsonb_build_object('ad', s.ad, 'bilet', true, 'tanisma', false, 'zaten', false);
  end if;
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
  if v_kod is null then raise exception 'Kod okunamadı; FC-U-0001, FC-T-XXXXXX ya da FC-B-XXXXXX biçiminde olmalı.'; end if;
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

-- KVKK: anonimleştirilen üyenin bilet isteklerinden ad, e-posta, telefon silinir
create or replace function public.bilet_anonimlestir() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update bilet_istekleri set ad = new.ad, eposta = new.eposta, tel = null where uye_id = new.id or eposta = old.eposta;
  update biletler set ad = new.ad where istek_id in (select id from bilet_istekleri where uye_id = new.id or eposta = new.eposta);
  return new;
end $$;
revoke execute on function public.bilet_anonimlestir() from public, anon, authenticated;
drop trigger if exists bilet_anonimlestir on public.uyeler;
create trigger bilet_anonimlestir after update of eposta on public.uyeler
  for each row when (new.eposta like 'silindi-%@silindi.invalid' and old.eposta not like 'silindi-%@silindi.invalid')
  execute function public.bilet_anonimlestir();

insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('bilet', 'Bilet onaylandı', 'Yönetici bir bilet dekontunu onaylayınca alıcıya gider.', true, null, 'Biletleriniz hazır 🎟️',
   E'Merhaba {ad},\n\nDekontunuz onaylandı, biletleriniz hazır! 🌿\n\n{biletler}\n\nGirişte her kişi için bilet kodunu göstermeniz yeterli.\n\nSizi ağaçların altında görmek için sabırsızlanıyoruz.\n\nWe listen carefully.\nTo the trees. To the music. To each other.\n\nSevgiler,\nForest Club Urla\nGatherings in Nature. 🌲',
   array['ad', 'biletler']),
  ('bilet_red', 'Bilet dekontu onaylanamadı', 'Yönetici bir bilet dekontunu reddedince alıcıya gider.', true, null, 'Bilet dekontunuz hakkında',
   E'Merhaba {ad},\n\nBilet için gönderdiğiniz dekontu maalesef onaylayamadık:\n{neden}\n\nTakıldığınız bir nokta olursa WhatsApp topluluğumuzdan bize yazabilirsiniz; birlikte çözeriz. 🌿\n\nSevgiler,\nForest Club Urla\nGatherings in Nature. 🌲',
   array['ad', 'neden'])
  on conflict (id) do nothing;
update public.eposta_sablonlari set varsayilan_konu = konu, varsayilan_metin = metin where varsayilan_konu is null;
