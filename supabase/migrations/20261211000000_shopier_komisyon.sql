-- Shopier kart komisyonu (09.11.2026): her Shopier kart ödemesinde kesinti muhasebeye "Kart komisyonu" gideri olarak
-- kendiliğinden yazılır. Oran, o ayın Shopier satış toplamına göre dilimden seçilir (TL işlem; döviz kullanılmıyor):
--   2.200.000+ %2,99 · 1.200.000+ %3,49 · 450.000+ %3,99 · 250.000+ %4,49 · 90.000+ %4,99 · 25.000+ %5,49 · altı %5,99
-- ve her işleme +0,49 TL. Ay toplamına bu satış da dahildir. Aynı sipariş ikinci kez gelirse yazılmaz.

create table if not exists public.shopier_komisyonlar (
  siparis    text primary key,
  tarih      date not null,
  tutar      numeric(12,2) not null,
  oran       numeric(5,2) not null,
  komisyon   numeric(12,2) not null,
  neden      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.shopier_komisyonlar enable row level security;  -- politika yok: yalnız sunucu (service_role)

create or replace function public.shopier_oran(p_aylik numeric)
  returns numeric language sql immutable as $$
    select case
      when p_aylik >= 2200000 then 2.99
      when p_aylik >= 1200000 then 3.49
      when p_aylik >= 450000  then 3.99
      when p_aylik >= 250000  then 4.49
      when p_aylik >= 90000   then 4.99
      when p_aylik >= 25000   then 5.49
      else 5.99
    end
  $$;

create or replace function public.shopier_komisyon_yaz(p_siparis text, p_tutar numeric, p_neden text)
  returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_bugun date := istanbul_bugun();
  v_aylik numeric;
  v_oran numeric;
  v_kom numeric;
  v_var numeric;
begin
  if p_siparis is null or coalesce(p_tutar, 0) <= 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtext('shopier_komisyon'));
  select komisyon into v_var from shopier_komisyonlar where siparis = p_siparis;
  if v_var is not null then return v_var; end if;  -- aynı sipariş ikinci kez: yazılmaz
  select coalesce(sum(tutar), 0) + p_tutar into v_aylik from shopier_komisyonlar
    where date_trunc('month', tarih) = date_trunc('month', v_bugun);
  v_oran := shopier_oran(v_aylik);
  v_kom := round(p_tutar * v_oran / 100 + 0.49, 2);
  insert into shopier_komisyonlar (siparis, tarih, tutar, oran, komisyon, neden)
    values (p_siparis, v_bugun, p_tutar, v_oran, v_kom, coalesce(p_neden, ''));
  insert into muhasebe_hareketleri (tarih, tur, tutar, kasa, kategori, aciklama, belge, otomatik, odeme)
    values (v_bugun, 'gider', v_kom, 'banka', 'Kart komisyonu',
            'Shopier komisyonu (%' || replace(v_oran::text, '.', ',') || ' + 0,49 TL) · ' || coalesce(p_neden, '') || ' ' || p_siparis,
            'shopier:' || p_siparis, true, 'kart');
  return v_kom;
end $$;
revoke execute on function public.shopier_komisyon_yaz(text, numeric, text) from public, anon, authenticated;
grant execute on function public.shopier_komisyon_yaz(text, numeric, text) to service_role;
