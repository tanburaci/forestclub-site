-- Forest Club Urla: kapıda karekodla giriş ve etkinlik iptali / ertelemesi sunucuda (28.10.2026).
-- Karekod artık listedeki sıraya göre değil uyeler.kod ile eşleşir. Kayıt, tanışma bileti ve doluluk yalnız yayındaki
-- etkinlikler için geçerlidir.

alter table public.etkinlikler
  add column if not exists eski_tarih date,                 -- ertelenen etkinliğin önceki tarihi
  add column if not exists durum_neden text,                -- iptal / erteleme nedeni
  add column if not exists durum_degisti_at timestamptz;

-- Kapıda giriş (yalnız yönetici): okutulan metindeki FC-U-… kodu bu etkinliğe kayıtlı üyeyle eşleşirse geldi yazılır.
-- Üye panelindeki karekod "FC-U-0001-1026" biçimindedir; baştaki üye kodu alınır. Dönüş: {ad, uye_id, zaten}
create or replace function public.giris_kaydet(p_etkinlik bigint, p_kod text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_kod text := substring(upper(coalesce(p_kod, '')) from 'FC-U-\d+');
  u uyeler;
  k etkinlik_kayitlari;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if v_kod is null then raise exception 'Kod okunamadı; FC-U-0001 biçiminde olmalı.'; end if;
  select * into u from uyeler where kod = v_kod;
  if u.id is null then raise exception '% koduyla bir üye yok.', v_kod; end if;
  select * into k from etkinlik_kayitlari where etkinlik_id = p_etkinlik and uye_id = u.id for update;
  if k.uye_id is null then raise exception '% bu etkinliğe kayıtlı değil.', u.ad; end if;
  if k.durum <> 'kayitli' then raise exception '% bekleme listesinde; kaydı kesinleşmemiş.', u.ad; end if;
  if k.geldi then return jsonb_build_object('ad', u.ad, 'uye_id', u.id, 'zaten', true); end if;
  update etkinlik_kayitlari set geldi = true where etkinlik_id = p_etkinlik and uye_id = u.id;
  return jsonb_build_object('ad', u.ad, 'uye_id', u.id, 'zaten', false);
end $$;
revoke execute on function public.giris_kaydet(bigint, text) from public, anon;
grant execute on function public.giris_kaydet(bigint, text) to authenticated;

-- İptal / erteleme (yalnız yönetici). p_durum: 'iptal' | 'ertelendi' | 'yayinda' (iptali geri al).
-- Ertelenen etkinlik yeni tarihiyle yayında kalır (kayıtlar taşınır); önceki tarih eski_tarih'te durur.
-- Kayıtlılara mail henüz gitmez (e-posta kuyruğu gelince bağlanacak). Dönüş: {durum, tarih, eski_tarih, kisi}
create or replace function public.etkinlik_durum_degistir(p_id bigint, p_durum text, p_yeni_tarih date, p_neden text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e etkinlikler;
  neden text := nullif(left(trim(coalesce(p_neden, '')), 300), '');
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  select * into e from etkinlikler where id = p_id for update;
  if e.id is null then raise exception 'Etkinlik bulunamadı.'; end if;
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
  return jsonb_build_object('durum', e.durum, 'tarih', e.tarih, 'eski_tarih', e.eski_tarih,
                            'kisi', (select count(*) from etkinlik_kayitlari where etkinlik_id = e.id));
end $$;
revoke execute on function public.etkinlik_durum_degistir(bigint, text, date, text) from public, anon;
grant execute on function public.etkinlik_durum_degistir(bigint, text, date, text) to authenticated;

-- Doluluk: yalnız yayındaki etkinlikler (taslak / iptal sayıları dışarı görünmesin)
create or replace function public.etkinlik_doluluk()
  returns table (etkinlik_id bigint, kayitli int, bekleme int)
  language sql stable security definer set search_path = public as $$
    select e.id,
           (count(*) filter (where k.durum = 'kayitli'))::int,
           (count(*) filter (where k.durum = 'bekleme'))::int
    from etkinlikler e left join etkinlik_kayitlari k on k.etkinlik_id = e.id
    where e.durum = 'yayinda'
    group by e.id
  $$;
grant execute on function public.etkinlik_doluluk() to anon, authenticated;

-- Üyenin "Geliyorum / Gelemeyeceğim / bekleme listesi" isteği: katılım yalnız yayındaki etkinliğe
-- (vazgeçmek her zaman serbest). Dönüş: {durum, sira}
create or replace function public.etkinlik_kaydi(p_etkinlik bigint, p_istek text)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uyeler;
  e etkinlikler;
  mevcut etkinlik_kayitlari;
  dolu int;
  sonraki etkinlik_kayitlari;
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
    if mevcut.durum = 'kayitli' and e.durum = 'yayinda' then
      -- yer açıldı: bekleme listesindeki ilk kişi kayda geçer (gerçekte "yer açıldı" maili gider)
      select * into sonraki from etkinlik_kayitlari
        where etkinlik_id = e.id and durum = 'bekleme' order by sira limit 1;
      if sonraki.uye_id is not null then
        update etkinlik_kayitlari set durum = 'kayitli', sira = null where etkinlik_id = e.id and uye_id = sonraki.uye_id;
      end if;
    end if;
    -- bekleme sırası 1'den yeniden
    update etkinlik_kayitlari k set sira = s.yeni
      from (select uye_id, row_number() over (order by sira) as yeni from etkinlik_kayitlari
            where etkinlik_id = e.id and durum = 'bekleme') s
      where k.etkinlik_id = e.id and k.uye_id = s.uye_id;
    return jsonb_build_object('durum', 'yok');
  end if;
  raise exception 'Geçersiz istek.';
end $$;
revoke execute on function public.etkinlik_kaydi(bigint, text) from public, anon;
grant execute on function public.etkinlik_kaydi(bigint, text) to authenticated;

-- Tanışma bileti: yalnız yayındaki, yaklaşan buluşma için
create or replace function public.tanisma_bileti_al(p_ad text, p_eposta text, p_etkinlik bigint)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  e etkinlikler;
begin
  if length(trim(p_ad)) < 2 or length(p_ad) > 120 then raise exception 'Adını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  select * into e from etkinlikler where id = p_etkinlik;
  if e.id is null or e.tarih < istanbul_bugun() or e.durum <> 'yayinda' then
    raise exception 'Bu buluşma için bilet alınamıyor.';
  end if;
  if exists (select 1 from uyeler where eposta = ep and baslangic is not null) then return 'uye'; end if;
  if exists (select 1 from tanisma_biletleri where lower(eposta) = ep) then return 'kullanilmis'; end if;
  insert into tanisma_biletleri (ad, eposta, alinis, etkinlik_id, durum) values (trim(p_ad), ep, istanbul_bugun(), e.id, 'bekliyor');
  return 'verildi';
end $$;
revoke execute on function public.tanisma_bileti_al(text, text, bigint) from public;
grant execute on function public.tanisma_bileti_al(text, text, bigint) to anon, authenticated;
