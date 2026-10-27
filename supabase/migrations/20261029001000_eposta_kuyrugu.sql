-- Forest Club Urla: otomatik e-postalar (29.10.2026). Mailler önce eposta_kuyrugu'na yazılır, "eposta-gonder" Edge
-- Function her dakika (pg_cron) sırası gelenleri Resend ile gönderir. Kuyruğa yazanlar:
--   başvuru        basvuru_yap (siteden ya da Açık Çağrı'dan yeni başvuru)
--   ödeme onayı    uyelik_uzat (dekont onayı, elden ödeme, ileride kart)
--   yenileme       gunluk_epostalar(): bitişe şablondaki gün (3) kala, her sabah 09.00
--   hatırlatma     gunluk_epostalar(): etkinliğe şablondaki gün kala, kayıtlı üyelere
-- Aynı mail iki kez gitmez (tekil anahtar). Demo adreslerine (ornek.com, example.*) hiçbir zaman gönderilmez:
-- kuyruğa "atlandi" olarak yazılır, Edge Function da ayrıca denetler.

create table if not exists public.eposta_kuyrugu (
  id bigint generated always as identity primary key,
  sablon text not null references public.eposta_sablonlari (id),
  alici text not null,
  uye_id bigint references public.uyeler (id) on delete set null,
  etkinlik_id bigint references public.etkinlikler (id) on delete set null,
  veri jsonb not null default '{}',                -- şablondaki {ad}, {bitis}, {etkinlik} … değerleri
  tekil text not null unique,                      -- basvuru:12 · onay:34 · yenileme:12:2026-11-26 · hatirlatma:7:12:2026-11-30
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'gonderiliyor', 'gonderildi', 'atlandi', 'hata')),
  deneme int not null default 0,
  son_hata text,
  saglayici_id text,                               -- Resend ileti numarası
  zaman timestamptz not null default now(),        -- bu andan sonra gönderilir (hata sonrası bekleme)
  kilit_at timestamptz,
  gonderim_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists eposta_kuyrugu_sira on public.eposta_kuyrugu (zaman, id) where durum = 'bekliyor';
alter table public.eposta_kuyrugu enable row level security;
drop policy if exists yonetici_okur on public.eposta_kuyrugu;
create policy yonetici_okur on public.eposta_kuyrugu for select to authenticated using (public.yonetici_mi());

create or replace function public.demo_adres_mi(p_eposta text) returns boolean
  language sql immutable as $$ select coalesce(trim(p_eposta), '') ~* '@(ornek\.com|example\.(com|org|net))$' $$;

-- 7 Kasım 2026, Cumartesi
create or replace function public.tr_tarih(p date) returns text
  language sql immutable as $$
    select extract(day from p)::int || ' '
           || (array['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'])[extract(month from p)::int]
           || ' ' || extract(year from p)::int || ', '
           || (array['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'])[extract(dow from p)::int + 1]
  $$;

-- Kuyruğa ekler. Şablon kapalıysa eklemez (null); demo adresi "atlandi" olarak yazılır; tekil anahtar varsa
-- yeniden eklemez (null). Dönüş: kuyruk numarası
create or replace function public.eposta_ekle(p_sablon text, p_alici text, p_veri jsonb, p_tekil text,
                                              p_uye bigint default null, p_etkinlik bigint default null)
  returns bigint language plpgsql security definer set search_path = public as $$
declare
  alici text := lower(trim(coalesce(p_alici, '')));
  yeni bigint;
begin
  if not exists (select 1 from eposta_sablonlari where id = p_sablon and acik) then return null; end if;
  if alici = '' then return null; end if;
  insert into eposta_kuyrugu (sablon, alici, uye_id, etkinlik_id, veri, tekil, durum, son_hata)
    values (p_sablon, alici, p_uye, p_etkinlik, coalesce(p_veri, '{}'), p_tekil,
            case when demo_adres_mi(alici) then 'atlandi' else 'bekliyor' end,
            case when demo_adres_mi(alici) then 'Demo adresi: gönderilmez.' end)
    on conflict (tekil) do nothing
    returning id into yeni;
  return yeni;
end $$;
revoke execute on function public.eposta_ekle(text, text, jsonb, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.eposta_ekle(text, text, jsonb, text, bigint, bigint) to service_role;

-- Başvuru: kurallar öncekiyle aynı; yeni başvuruya "başvuru alındı" maili kuyruğa yazılır
create or replace function public.basvuru_yap(p_ad text, p_eposta text, p_tel text, p_kosul boolean, p_dogal boolean,
                                              p_kvkk boolean, p_foto boolean default false)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  ad text := trim(p_ad);
  yeni_id bigint;
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  if not (p_kosul and p_dogal and p_kvkk) then raise exception 'Devam etmek için üç metni de onayla.'; end if;
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  insert into uyeler (ad, eposta, tel, durum, basvuru_tarihi, nereden_duydu, foto_izni)
    values (ad, ep, left(trim(p_tel), 30), 'basvuru', istanbul_bugun(), 'Site başvurusu', coalesce(p_foto, false))
    returning id into yeni_id;
  perform eposta_ekle('basvuru', ep, jsonb_build_object('ad', ad), 'basvuru:' || yeni_id, yeni_id);
  return 'tamam';
exception when unique_violation then
  -- aynı e-postayla aynı anda iki başvuru: ikincisi "zaten kayıtlı" sayılır (kod çakışması ise hata olarak kalır)
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  raise;
end $$;
revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) to service_role;

-- Üyelik uzatma: öncekiyle aynı; ödeme işlenince "ödeme alındı" maili kuyruğa yazılır
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
  select * into u from uyeler where id = p_uye for update;  -- aynı üyeye aynı anda iki ödeme günleri ezmesin
  if u.id is null then raise exception 'Üye bulunamadı.'; end if;
  select id into odeme_id from odemeler where ref = p_ref;
  if odeme_id is not null then
    return jsonb_build_object('bitis', u.bitis, 'odeme_id', odeme_id, 'hareket_id', null, 'ref', p_ref, 'tekrar', true);
  end if;
  yeni_bitis := greatest(coalesce(u.bitis, istanbul_bugun()), istanbul_bugun()) + 30;
  update uyeler set baslangic = coalesce(baslangic, tarih), bitis = yeni_bitis, durum = 'aktif' where id = u.id;
  insert into odemeler (uye_id, tarih, tutar, yol, aciklama, ref)
    values (u.id, tarih, p_tutar, p_yol,
            case p_yol when 'havale' then 'Dekont onayı · 30 gün' when 'elden' then 'Elden ödeme · 30 gün' else 'Kart · 30 gün' end,
            p_ref)
    returning id into odeme_id;
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (tarih, 'gelir', p_tutar, case when p_yol = 'elden' then 'nakit'::kasa else 'banka'::kasa end, 'Aidat',
            'Aidat · ' || u.ad, p_ref, true, p_yol)
    returning id into hareket_id;
  perform eposta_ekle('onay', u.eposta, jsonb_build_object('ad', u.ad, 'bitis', to_char(yeni_bitis, 'DD.MM.YYYY'), 'kod', u.kod),
                      'onay:' || odeme_id, u.id);
  return jsonb_build_object('bitis', yeni_bitis, 'odeme_id', odeme_id, 'hareket_id', hareket_id, 'ref', p_ref, 'tekrar', false);
end $$;
revoke execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) from public, anon, authenticated;
grant execute on function public.uyelik_uzat(bigint, numeric, odeme_yolu, date, text) to service_role;

-- Her sabah (pg_cron): yenileme ve etkinlik hatırlatmaları. Pencere "bugünden sonra, şablondaki gün içinde":
-- bir sabah kaçarsa ertesi sabah yine yazılır; tekil anahtar ikinci kez yazmayı önler. Dönüş: {yenileme, hatirlatma}
create or replace function public.gunluk_epostalar()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bugun date := istanbul_bugun();
  g_yenileme int;
  g_hatirlatma int;
  n_yenileme int := 0;
  n_hatirlatma int := 0;
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
  return jsonb_build_object('yenileme', n_yenileme, 'hatirlatma', n_hatirlatma);
end $$;
revoke execute on function public.gunluk_epostalar() from public, anon, authenticated;
grant execute on function public.gunluk_epostalar() to service_role;

-- Gönderici için: sırası gelen en çok p_adet maili "gonderiliyor" yapıp şablonuyla döndürür. 15 dakikadır
-- "gonderiliyor"da kalanlar (işlev yarıda kesildiyse) önce sıraya geri alınır.
create or replace function public.eposta_sirasi_al(p_adet int default 40)
  returns table (id bigint, sablon text, alici text, veri jsonb, deneme int, konu text, metin text, acik boolean)
  language sql security definer set search_path = public as $$
    update eposta_kuyrugu set durum = 'bekliyor' where durum = 'gonderiliyor' and kilit_at < now() - interval '15 minutes';
    with secilen as (
      select q.id from eposta_kuyrugu q
      where q.durum = 'bekliyor' and q.zaman <= now()
      order by q.zaman, q.id
      limit p_adet
      for update skip locked
    )
    update eposta_kuyrugu q set durum = 'gonderiliyor', deneme = q.deneme + 1, kilit_at = now()
      from secilen, eposta_sablonlari s
      where q.id = secilen.id and s.id = q.sablon
      returning q.id, q.sablon, q.alici, q.veri, q.deneme, s.konu, s.metin, s.acik;
  $$;
revoke execute on function public.eposta_sirasi_al(int) from public, anon, authenticated;
grant execute on function public.eposta_sirasi_al(int) to service_role;

-- Gönderim sonucu. p_durum: 'gonderildi' | 'atlandi' | 'hata'. Hata 5 denemeye kadar 2, 4, 8, 16 dakika arayla yeniden denenir.
create or replace function public.eposta_sonuc(p_id bigint, p_durum text, p_hata text default null, p_saglayici text default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if p_durum = 'gonderildi' then
    update eposta_kuyrugu set durum = 'gonderildi', gonderim_at = now(), saglayici_id = p_saglayici, son_hata = null where id = p_id;
  elsif p_durum = 'atlandi' then
    update eposta_kuyrugu set durum = 'atlandi', son_hata = left(p_hata, 500) where id = p_id;
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

-- Varsayılan şablonlar (gerçek veritabanı boş başlar; yönetici panelinin E-postalar sekmesi bunları düzenler).
-- Var olan şablona dokunulmaz.
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('basvuru', 'Başvuru alındı', 'Siteden başvuru gelince gider.', true, null, 'Forest Club Urla başvurun bize ulaştı 🌲', 'Merhaba {ad},

Başvurun bize ulaştı, teşekkürler!

Üyeliğin ödemenle başlar. Ödemeyi henüz yapmadıysan havale/EFT ile ödeyip dekontunu şu sayfadan yükleyebilirsin: {odemeLinki}

Ormanda görüşmek üzere,
Forest Club Urla', array['ad','odemeLinki']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('onay', 'Ödeme alındı', 'Dekont onaylanınca ya da yönetici elden ödeme girince gider.', true, null, 'Welcome to Forest Club Urla 🌲', 'WELCOME TO FOREST CLUB URLA.

Merhaba,

Güzel bir haberimiz var! 🌿

Forest Club Urla üyeliğiniz onaylandı.

Artık siz de doğanın içinde bir araya gelen, birlikte üreten, keşfeden ve yeni karşılaşmalara alan açan topluluğumuzun bir parçasısınız.

Üyeliğiniz kapsamında;

•  Aylık Breakfast Club buluşmalarımıza,
•  Aylık Sunset Club etkinliklerimize,
•  Topluluğumuza özel buluşmalara katılabilir,
•  Özel atölyelerimizden %50 indirimle yararlanabilirsiniz.

Küçük bir hatırlatma:

Etkinliklerimiz ve derslerimiz sınırlı kontenjanla gerçekleşmektedir. Bu nedenle katılmak istediğiniz her buluşma ve ders öncesinde WhatsApp topluluğumuzdaki Reservation grubu üzerinden rezervasyon oluşturmanız zorunludur.

Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.

Sizi ağaçların altında görmek için sabırsızlanıyoruz.

We listen carefully.
To the trees. To the music. To each other.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲', array['ad','bitis']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('yenileme', 'Üyelik yenileme hatırlatması', 'Üyelik bitmeden önce gider.', true, 3, 'Üyeliğin {bitis} tarihinde bitiyor', 'Merhaba {ad},

Üyeliğin {bitis} tarihinde bitiyor. Devam etmek istersen havale/EFT ile ödeyip dekontunu şu sayfadan yükleyebilirsin: {odemeLinki}

Erken yenilersen kalan günlerin kaybolmaz.

Forest Club Urla', array['ad','bitis','odemeLinki']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('duyuru', 'Etkinlik duyurusu', 'Etkinlik “Hazır” olunca aktif üyelere gider.', true, null, 'Yeni etkinlik: {etkinlik}', 'Merhaba {ad},

{etkinlik} için seni bekliyoruz!

📅 {tarih}
🕘 {saat}
📍 {yer}

Forest Club Urla', array['ad','etkinlik','tarih','saat','yer']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('hatirlatma', 'Etkinlik hatırlatması', 'Etkinlikten önce o etkinliğe kayıtlı üyelere gider.', true, 3, 'Hatırlatma: {etkinlik} yaklaşıyor', 'Merhaba {ad},

{etkinlik} çok yakında: {tarih}, {saat}.

📍 {yer}

Forest Club Urla', array['ad','etkinlik','tarih','saat','yer']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('sifre', 'Geçici şifre', 'Üye “İlk girişim / şifremi unuttum” deyince gider.', true, null, 'Forest Club Urla geçici şifren', 'Merhaba {ad},

Geçici şifren: {kod}

Şifre 24 saat geçerli. Bununla girince kendi şifreni belirleyeceksin.

Bu isteği sen yapmadıysan bu maili yok sayabilirsin.

Forest Club Urla', array['ad','kod']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('dogumgunu', 'Doğum günü kutlaması', 'Üyenin doğum günü sabahı gider (üye izin verdiyse).', true, null, 'Doğum günün kutlu olsun {ad}! 🎂', 'Merhaba {ad},

Bugün senin günün! Forest Club ailesi olarak doğum gününü kutluyoruz. Nice ağaçlı, müzikli, güzel yıllara 🌲

Forest Club Urla', array['ad']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('ozelgun', 'Özel gün kutlaması', 'Üyenin profilindeki özel günlerde gider (üye izin verdiyse).', true, null, 'Kutlu olsun {ad} 🌿', 'Merhaba {ad},

{ozelGun} kutlu olsun! Bu güzel gününde seni düşündük.

Forest Club Urla', array['ad','ozelGun']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('tanisma', 'Tanışma bileti', 'Biri sitede tanışma biletini alınca gider.', true, null, 'İlk buluşman bizden: biletin hazır 🎟️', 'Merhaba {ad},

Forest Club Urla’ya hoş geldin! Tanışma biletin: {biletKodu}

{etkinlik} ({tarih}, {saat}) için yerin ayrıldı. Bilet ücretsiz, tek kullanımlık ve yalnız bu buluşmada geçerli; girişte kodunu göstermen yeterli.

Ormanda görüşmek üzere,
Forest Club Urla', array['ad','biletKodu','etkinlik','tarih','saat']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('iptal', 'Etkinlik iptal / erteleme', 'Yönetici “İptal / ertele” ile duyurunca kayıtlılara ve bekleme listesine gider.', true, null, '{etkinlik}: önemli değişiklik', 'Merhaba {ad},

{duyuru}

Sorun olursa WhatsApp’tan yazabilirsin.

Forest Club Urla', array['ad','etkinlik','duyuru']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('bekleme', 'Bekleme listesinden yer açıldı', 'Kayıtlı biri vazgeçince sıradaki kişiye gider.', true, null, 'Yer açıldı: {etkinlik} 🎉', 'Merhaba {ad},

Müjde! {etkinlik} ({tarih}, {saat}) için yer açıldı ve kaydın yapıldı. Gelemeyeceksen üye panelinden “Gelemeyeceğim” de ki yer sıradakine geçsin.

Forest Club Urla', array['ad','etkinlik','tarih','saat']::text[]) on conflict (id) do nothing;
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values ('anket', 'Etkinlik sonrası anket', 'Etkinlikten sonra gelenlere gider.', true, 1, '{etkinlik} nasıldı?', 'Merhaba {ad},

{etkinlik} için geldiğin için teşekkürler! Üye panelinden 1–5 arası puan verip bir cümle yazarsan bir sonrakini daha güzel yaparız. Fotoğraflar da panelde.

Forest Club Urla', array['ad','etkinlik']::text[]) on conflict (id) do nothing;

-- Demo verisinden gelen ve hiç düzenlenmemiş eski metinler güncellenir (kart yerine havale + dekont; ne zaman gittiği).
-- Yönetici metni değiştirdiyse dokunulmaz.
update public.eposta_sablonlari set ad = 'Başvuru alındı', ne_zaman = 'Siteden başvuru gelince gider.'
  where id = 'basvuru' and ne_zaman = 'Biri başvurup kartla ödemeyi tamamlamazsa gider.';
update public.eposta_sablonlari set metin = replace(metin, $e$Üyeliğin ödemenle başlar. Ödemeyi tamamlamadıysan şu bağlantıdan kartla ödeyebilirsin: {odemeLinki}$e$, $y$Üyeliğin ödemenle başlar. Ödemeyi henüz yapmadıysan havale/EFT ile ödeyip dekontunu şu sayfadan yükleyebilirsin: {odemeLinki}$y$)
  where id = 'basvuru' and position($e$Üyeliğin ödemenle başlar. Ödemeyi tamamlamadıysan şu bağlantıdan kartla ödeyebilirsin: {odemeLinki}$e$ in metin) > 0;
update public.eposta_sablonlari set metin = replace(metin, $e$Devam etmek istersen şu bağlantıdan kartla yenileyebilirsin: {odemeLinki}$e$, $y$Devam etmek istersen havale/EFT ile ödeyip dekontunu şu sayfadan yükleyebilirsin: {odemeLinki}$y$)
  where id = 'yenileme' and position($e$Devam etmek istersen şu bağlantıdan kartla yenileyebilirsin: {odemeLinki}$e$ in metin) > 0;
update public.eposta_sablonlari set ne_zaman = 'Dekont onaylanınca ya da yönetici elden ödeme girince gider.'
  where id = 'onay' and ne_zaman = 'Kartla ödeme geçince ya da yönetici elden ödeme girince gider.';
update public.eposta_sablonlari set ne_zaman = 'Etkinlikten önce o etkinliğe kayıtlı üyelere gider.'
  where id = 'hatirlatma' and ne_zaman = 'Etkinlikten önce aktif üyelere gider.';
