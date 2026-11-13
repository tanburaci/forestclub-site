-- Forest Club Urla · etkinlik ürünlerinde standda kartla (POS) ödeme yok (13.11.2026): yeni siparişte "pos" kabul edilmez.
-- Eski kayıtlar için tablo kuralı ('pos' değeri) dokunulmadan kalır.
do $$
declare
  tanim text := pg_get_functiondef('public.urun_siparisi_ac(bigint,text,text,text,jsonb,text,text)'::regprocedure);
  eski constant text := 'p_yol not in (''kart'', ''havale'', ''nakit'', ''pos'')';
  yeni constant text := 'p_yol not in (''kart'', ''havale'', ''nakit'')';
begin
  if position(eski in tanim) = 0 then raise exception 'ödeme yolu satırı bulunamadı'; end if;
  execute replace(tanim, eski, yeni);
end $$;
