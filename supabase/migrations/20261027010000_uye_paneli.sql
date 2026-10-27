-- Forest Club Urla: üye paneli kuralları (27.10.2026). Üye yalnız kendi kaydını görür; etkinliğe katılma / vazgeçme
-- ve profil kaydı sunucuda kurala bağlanır (kontenjan, bekleme listesi, aktif üyelik).

create or replace function public.istanbul_bugun() returns date
  language sql stable as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

-- Etkinliklerin doluluğu (kişi bilgisi yok, yalnız sayılar): herkes görebilir
create or replace function public.etkinlik_doluluk()
  returns table (etkinlik_id bigint, kayitli int, bekleme int)
  language sql stable security definer set search_path = public as $$
    select e.id,
           (count(*) filter (where k.durum = 'kayitli'))::int,
           (count(*) filter (where k.durum = 'bekleme'))::int
    from etkinlikler e left join etkinlik_kayitlari k on k.etkinlik_id = e.id
    group by e.id
  $$;
grant execute on function public.etkinlik_doluluk() to anon, authenticated;

-- Üyenin "Geliyorum / Gelemeyeceğim / bekleme listesi" isteği. Dönüş: {durum, sira}
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
    if mevcut.durum = 'kayitli' then
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
grant execute on function public.etkinlik_kaydi(bigint, text) to authenticated;

-- Üye profilini kaydeder (yalnız kendi kaydı; ad, e-posta, üyelik tarihleri değiştirilemez)
create or replace function public.profil_kaydet(p_tel text, p_dogum date, p_kutlama boolean, p_foto boolean,
                                                p_ilgi text[], p_ozel jsonb)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update uyeler set tel = nullif(trim(p_tel), ''), dogum_gunu = p_dogum, kutlama_izni = p_kutlama,
                    foto_izni = p_foto, ilgi_alanlari = coalesce(p_ilgi, '{}'), ozel_gunler = coalesce(p_ozel, '[]')
    where user_id = auth.uid();
  if not found then raise exception 'Üye kaydı bulunamadı.'; end if;
end $$;
grant execute on function public.profil_kaydet(text, date, boolean, boolean, text[], jsonb) to authenticated;

revoke execute on function public.etkinlik_kaydi(bigint, text) from anon, public;
revoke execute on function public.profil_kaydet(text, date, boolean, boolean, text[], jsonb) from anon, public;
