-- Forest Club Urla: üye kodu ve üye girişi (28.10.2026).
-- Üye kodu artık max(id)+1 ile değil bir sayaçla (uye_kod_seq) üretilir: aynı anda gelen iki başvuru aynı kodu almaz,
-- Sheets'ten taşınan eski kodlarla çakışmaz. Üye, e-postasına gelen tek kullanımlık bağlantıyla girince uye_bagla()
-- kendi e-postasıyla açılmış başvuruyu hesabına bağlar.

create sequence if not exists public.uye_kod_seq as bigint minvalue 1;

-- Sayaç mevcut en büyük kodun arkasından devam eder (kayıt yoksa 1'den başlar).
-- Sheets aktarımından sonra aynı satır yeniden çalıştırılmalı.
select setval('public.uye_kod_seq',
              greatest(coalesce((select max((substring(kod from '^FC-U-(\d+)$'))::bigint) from public.uyeler), 0), 1),
              exists (select 1 from public.uyeler where kod ~ '^FC-U-\d+$'));

-- FC-U-0001 … FC-U-9999, sonrası FC-U-10000 (lpad dört haneyi aşan sayıyı kesmesin)
create or replace function public.yeni_uye_kodu() returns text
  language sql volatile set search_path = public as $$
    select 'FC-U-' || case when n < 10000 then lpad(n::text, 4, '0') else n::text end
    from (select nextval('public.uye_kod_seq') as n) s
  $$;
revoke execute on function public.yeni_uye_kodu() from public, anon, authenticated;

alter table public.uyeler alter column kod set default public.yeni_uye_kodu();

-- Başvuru: kod varsayılandan (sayaçtan) gelir; kurallar öncekiyle aynı
create or replace function public.basvuru_yap(p_ad text, p_eposta text, p_tel text, p_kosul boolean, p_dogal boolean,
                                              p_kvkk boolean, p_foto boolean default false)
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(p_eposta));
  ad text := trim(p_ad);
begin
  if length(ad) < 3 or length(ad) > 120 then raise exception 'Adını ve soyadını yaz.'; end if;
  if ep !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(ep) > 160 then raise exception 'Geçerli bir e-posta yaz.'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) < 10 then raise exception 'Telefon numaranı yaz.'; end if;
  if not (p_kosul and p_dogal and p_kvkk) then raise exception 'Devam etmek için üç metni de onayla.'; end if;
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  insert into uyeler (ad, eposta, tel, durum, basvuru_tarihi, nereden_duydu, foto_izni)
    values (ad, ep, left(trim(p_tel), 30), 'basvuru', istanbul_bugun(), 'Site başvurusu', coalesce(p_foto, false));
  return 'tamam';
exception when unique_violation then
  -- aynı e-postayla aynı anda iki başvuru: ikincisi "zaten kayıtlı" sayılır (kod çakışması ise hata olarak kalır)
  if exists (select 1 from uyeler where eposta = ep) then return 'kayitli'; end if;
  raise;
end $$;
revoke execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) from public;
grant execute on function public.basvuru_yap(text, text, text, boolean, boolean, boolean, boolean) to anon, authenticated;

-- Üye girişi: giriş yapan kişinin (doğrulanmış) e-postasıyla açılmış, henüz kimseye bağlanmamış başvuruyu ona bağlar.
-- Yalnız kendi e-postası: auth.email() oturumdan gelir, istemci başka adres veremez. Dönüş: üye kodu ya da null
-- (bu e-postayla başvuru yok).
create or replace function public.uye_bagla()
  returns text language plpgsql security definer set search_path = public as $$
declare
  ep text := lower(trim(auth.email()));
  u uyeler;
begin
  if auth.uid() is null or ep is null or ep = '' then raise exception 'Önce giriş yap.'; end if;
  -- Şifreyle açılıp e-postası doğrulanmamış hesap başkasının başvurusunu alamasın
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'E-posta adresin doğrulanmamış. E-postana gelen bağlantıyla gir.';
  end if;
  select * into u from uyeler where user_id = auth.uid();
  if u.id is not null then return u.kod; end if;
  update uyeler set user_id = auth.uid() where eposta = ep and user_id is null returning * into u;
  return u.kod;
end $$;
revoke execute on function public.uye_bagla() from public, anon;
grant execute on function public.uye_bagla() to authenticated;
