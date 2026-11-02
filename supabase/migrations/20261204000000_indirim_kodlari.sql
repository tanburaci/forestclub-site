-- Forest Club Urla: bilet sepetinde indirim kodu (02.11.2026). Yönetici kodu ekler: yüzde (%1–99) ya da TL; isteğe bağlı
-- son tarih ve kullanım sınırı. Kod sepetteki toplamdan (üye fiyatı uygulandıktan sonra) düşer; indirim kalemlere
-- oranla dağıtılır ki muhasebeye her etkinliğin gerçek geliri yazılsın. Kullanım, bilet kesinleşince sayılır.
create table if not exists public.indirim_kodlari (
  kod text primary key check (kod ~ '^[A-Z0-9-]{3,30}$'),
  tur text not null check (tur in ('yuzde', 'tl')),
  deger numeric(10, 2) not null check (deger > 0 and (tur <> 'yuzde' or deger < 100)),
  son_tarih date,
  sinir int check (sinir is null or sinir > 0),       -- en çok kaç sepette kullanılır (boş: sınırsız)
  kullanilan int not null default 0,
  aktif boolean not null default true,
  aciklama text,
  created_at timestamptz not null default now()
);
alter table public.indirim_kodlari enable row level security;
drop policy if exists yonetici_tam on public.indirim_kodlari;
create policy yonetici_tam on public.indirim_kodlari for all to authenticated using (public.yonetici_mi()) with check (public.yonetici_mi());
revoke all on public.indirim_kodlari from anon;

alter table public.bilet_istekleri
  add column if not exists indirim_kodu text references public.indirim_kodlari (kod) on update cascade,
  add column if not exists kod_indirimi numeric(10, 2) not null default 0;

-- Kod geçerli mi (sepette "Uygula"): yalnız tür ve değer döner; geçersizse tek tip hata (kod tahmini kolaylaşmasın)
create or replace function public.indirim_kodu_bak(p_kod text)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare k indirim_kodlari;
begin
  select * into k from indirim_kodlari where kod = upper(trim(coalesce(p_kod, '')));
  if k.kod is null or not k.aktif or (k.son_tarih is not null and k.son_tarih < istanbul_bugun())
     or (k.sinir is not null and k.kullanilan >= k.sinir) then
    raise exception 'Bu indirim kodu geçerli değil.';
  end if;
  return jsonb_build_object('kod', k.kod, 'tur', k.tur, 'deger', k.deger);
end $$;
revoke execute on function public.indirim_kodu_bak(text) from public;
grant execute on function public.indirim_kodu_bak(text) to anon, authenticated;

-- Yol seçimli bilet isteği + indirim kodu (form-gonder, service_role)
drop function if exists public.bilet_istegi_ac_yol(text, text, text, jsonb, uuid, text, text);
create or replace function public.bilet_istegi_ac_yol(p_ad text, p_eposta text, p_tel text, p_kalemler jsonb, p_user uuid, p_dosya text, p_yol text,
                                                      p_kod text default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  k jsonb;
  kd jsonb;
  toplam numeric;
  ind numeric := 0;
  kalan numeric;
  pay numeric;
  yeni jsonb := '[]';
  n int := 0;
  adet_kalem int;
begin
  if p_yol not in ('havale', 'kart', 'nakit') then raise exception 'Ödeme yolu geçersiz.'; end if;
  if p_yol = 'nakit' and (select count(*) from bilet_istekleri where eposta = lower(trim(p_eposta)) and odeme_yolu = 'nakit'
                           and yuklendi and durum = 'bekliyor') >= 2 then
    raise exception 'Bu e-posta için girişte ödenecek iki rezervasyon var. Biri sonuçlanınca yenisini yapabilirsin.';
  end if;
  if nullif(trim(coalesce(p_kod, '')), '') is not null then kd := indirim_kodu_bak(p_kod); end if;
  r := bilet_istegi_ac(p_ad, p_eposta, p_tel, p_kalemler, p_user, p_dosya);
  toplam := (r ->> 'tutar')::numeric;
  if kd is not null then
    ind := case when kd ->> 'tur' = 'yuzde' then round(toplam * (kd ->> 'deger')::numeric / 100) else least((kd ->> 'deger')::numeric, toplam) end;
    if ind >= toplam then raise exception 'Bu indirim kodu bu sepette kullanılamaz.'; end if;
    -- İndirim kalemlere tutarlarıyla orantılı dağıtılır; kuruş farkı son kaleme
    kalan := ind;
    adet_kalem := jsonb_array_length(r -> 'kalemler');
    for k in select * from jsonb_array_elements(r -> 'kalemler') loop
      n := n + 1;
      pay := case when n = adet_kalem then kalan else round(ind * (k ->> 'tutar')::numeric / toplam, 2) end;
      kalan := kalan - pay;
      yeni := yeni || (k || jsonb_build_object('kod_indirimi', pay, 'tutar', (k ->> 'tutar')::numeric - pay));
    end loop;
    r := r || jsonb_build_object('tutar', toplam - ind, 'kalemler', yeni, 'kod_indirimi', ind, 'indirim_kodu', kd ->> 'kod');
  end if;
  update bilet_istekleri set odeme_yolu = p_yol, yuklendi = (p_yol = 'nakit'),
    tutar = toplam - ind, kalemler = coalesce(r -> 'kalemler', kalemler),
    indirim_kodu = kd ->> 'kod', kod_indirimi = ind
    where id = (r ->> 'id')::bigint;
  return r || jsonb_build_object('yol', p_yol);
end $$;
revoke execute on function public.bilet_istegi_ac_yol(text, text, text, jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.bilet_istegi_ac_yol(text, text, text, jsonb, uuid, text, text, text) to service_role;

-- Kullanım bilet kesinleşince sayılır (havale onayı, kart ödemesi)
create or replace function public.indirim_kodu_say() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.indirim_kodu is not null and new.durum = 'onaylandi' and old.durum is distinct from 'onaylandi' then
    update indirim_kodlari set kullanilan = kullanilan + 1 where kod = new.indirim_kodu;
  end if;
  return new;
end $$;
revoke execute on function public.indirim_kodu_say() from public, anon, authenticated;
drop trigger if exists indirim_kodu_say on public.bilet_istekleri;
create trigger indirim_kodu_say after update of durum on public.bilet_istekleri for each row execute function public.indirim_kodu_say();
