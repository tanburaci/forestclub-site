-- Forest Club Urla: üye paneli "Randevularım" (24.11.2026). Üye kendi biletlerinin kodlarını görür (karekod olarak):
-- satın aldığı (onaylı) biletler ve dekontu incelemede olan istekler. Girişte okutulan bilet ("geldi") listeden düşer.
create or replace function public.uye_biletlerim() returns table (kod text, etkinlik_id bigint, durum text)
  language sql stable security definer set search_path = public
  as $$
    with ben as (select id, eposta from uyeler where user_id = auth.uid())
    select b.kod, b.etkinlik_id, 'bilet'::text
      from biletler b join bilet_istekleri i on i.id = b.istek_id, ben
      where (i.uye_id = ben.id or lower(i.eposta) = ben.eposta) and b.durum is distinct from 'geldi'
    union all
    select null::text, (k ->> 'etkinlik_id')::bigint, 'inceleniyor'::text
      from bilet_istekleri i, ben, jsonb_array_elements(i.kalemler) k
      where (i.uye_id = ben.id or lower(i.eposta) = ben.eposta) and i.yuklendi and i.durum = 'bekliyor'
  $$;
revoke execute on function public.uye_biletlerim() from public, anon;
grant execute on function public.uye_biletlerim() to authenticated;
