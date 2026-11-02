-- Forest Club Urla (02.11.2026):
--   · bilet_istek_durum: kartla ödeme Shopier'de ayrı pencerede yapılırken sitedeki sepet ödemenin gelip gelmediğini
--     sorar (istek numarası + e-posta birlikte doğru olmalı; yalnız durum döner, kişisel veri dönmez).
--   · giris_kontrol: kapıda iki aşamalı giriş. Karekod okutulunca önce kimin olduğu ve daha önce girip girmediği
--     gösterilir (hiçbir şey yazılmaz); yönetici "Girişi onayla"ya basınca giris_kaydet çağrılır.
create or replace function public.bilet_istek_durum(p_id bigint, p_eposta text)
  returns text language sql stable security definer set search_path = public as $$
  select case when durum = 'onaylandi' then 'onaylandi' when durum = 'reddedildi' then 'reddedildi' else 'bekliyor' end
    from bilet_istekleri where id = p_id and eposta = lower(trim(coalesce(p_eposta, '')));
$$;
revoke execute on function public.bilet_istek_durum(bigint, text) from public;
grant execute on function public.bilet_istek_durum(bigint, text) to anon, authenticated;

create or replace function public.giris_kontrol(p_etkinlik bigint, p_kod text)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
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
    select * into s from biletler where kod = v_kod;
    if s.kod is null then raise exception '% koduyla bir bilet yok.', v_kod; end if;
    if s.etkinlik_id is distinct from p_etkinlik then
      raise exception 'Bu bilet başka bir etkinlik için (%).', (select tr_tarih(tarih) || ' ' || ad from etkinlikler where id = s.etkinlik_id);
    end if;
    return jsonb_build_object('kod', s.kod, 'ad', s.ad, 'tur', 'bilet', 'zaten', s.durum = 'geldi');
  end if;
  v_kod := substring(metin from 'FC-T-[A-Z0-9]{6}');
  if v_kod is not null then
    select * into b from tanisma_biletleri where kod = v_kod;
    if b.id is null then raise exception '% koduyla bir tanışma bileti yok.', v_kod; end if;
    if b.etkinlik_id is distinct from p_etkinlik then
      raise exception 'Bu tanışma bileti başka bir buluşma için (%).', (select tr_tarih(tarih) || ' ' || ad from etkinlikler where id = b.etkinlik_id);
    end if;
    return jsonb_build_object('kod', b.kod, 'ad', b.ad, 'tur', 'tanisma', 'zaten', b.durum <> 'bekliyor');
  end if;
  v_kod := substring(metin from 'FC-U-\d+');
  if v_kod is null then raise exception 'Kod okunamadı; FC-U-0001, FC-T-XXXXXX ya da FC-B-XXXXXX biçiminde olmalı.'; end if;
  select * into u from uyeler where kod = v_kod;
  if u.id is null then raise exception '% koduyla bir üye yok.', v_kod; end if;
  select * into k from etkinlik_kayitlari where etkinlik_id = p_etkinlik and uye_id = u.id;
  if k.uye_id is null then raise exception '% bu etkinliğe kayıtlı değil.', u.ad; end if;
  if k.durum <> 'kayitli' then raise exception '% bekleme listesinde; kaydı kesinleşmemiş.', u.ad; end if;
  return jsonb_build_object('kod', u.kod, 'ad', u.ad, 'tur', 'uye', 'zaten', k.geldi);
end $$;
revoke execute on function public.giris_kontrol(bigint, text) from public, anon;
grant execute on function public.giris_kontrol(bigint, text) to authenticated;
