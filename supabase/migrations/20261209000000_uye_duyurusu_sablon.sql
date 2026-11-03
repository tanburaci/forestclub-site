-- Forest Club Urla (03.11.2026): üyelere duyuru kendi şablonunu kullanır. 20261207'de "duyuru" kimliği zaten
-- "Etkinlik duyurusu" şablonuna aitti (on conflict do nothing), bu yüzden serbest duyuru eski etkinlik şablonuyla
-- ({tarih}/{saat}/{yer} boş) gitti. Yeni kimlik: uye_duyuru. Etkinlik duyurusu şablonuna dokunulmaz.
insert into public.eposta_sablonlari (id, ad, ne_zaman, acik, gun, konu, metin, alanlar) values
  ('uye_duyuru', 'Üyelere duyuru', 'Yönetici İletişim › Üyelere duyuru ile gönderince gider.', true, null, '{konu}',
   E'Merhaba {ad},\n\n{metin}{etkinlik}\n\nForest Club Urla', array['ad', 'konu', 'metin', 'etkinlik'])
  on conflict (id) do update set konu = excluded.konu, metin = excluded.metin, alanlar = excluded.alanlar, ad = excluded.ad,
                                 ne_zaman = excluded.ne_zaman, acik = true;

create or replace function public.uye_duyurusu_gonder(p_hedef text, p_konu text, p_metin text, p_etkinlik bigint default null)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := trim(coalesce(p_konu, ''));
  m text := trim(coalesce(p_metin, ''));
  ek text;
  d bigint;
  u uyeler;
  n int := 0;
begin
  if not yonetici_mi() then raise exception 'Bu işlem yalnız yönetici içindir.'; end if;
  if p_hedef not in ('aktif', 'pasif', 'hepsi') then raise exception 'Kime gideceğini seç.'; end if;
  if length(k) < 3 or length(k) > 150 then raise exception 'Konu 3–150 karakter olmalı.'; end if;
  if length(m) < 10 or length(m) > 5000 then raise exception 'Metin 10–5000 karakter olmalı.'; end if;
  if (select count(*) from uye_duyurulari where created_at > now() - interval '1 day') >= 10 then
    raise exception 'Bugün çok fazla duyuru gönderildi; yarın tekrar dene.';
  end if;
  ek := uye_duyurusu_etkinlik_metni(p_etkinlik);
  insert into uye_duyurulari (hedef, konu, metin, gonderen, etkinlik_id) values (p_hedef, k, m, auth.uid(), p_etkinlik) returning id into d;
  for u in select * from uye_duyurusu_alicilar(p_hedef) loop
    if eposta_ekle('uye_duyuru', u.eposta, jsonb_build_object('ad', split_part(u.ad, ' ', 1), 'konu', k, 'metin', m, 'etkinlik', ek),
                   'uye_duyuru:' || d || ':' || u.id, u.id, p_etkinlik) is not null then
      n := n + 1;
    end if;
  end loop;
  update uye_duyurulari set alici = n where id = d;
  return jsonb_build_object('id', d, 'alici', n);
end $$;
revoke execute on function public.uye_duyurusu_gonder(text, text, text, bigint) from public, anon;
grant execute on function public.uye_duyurusu_gonder(text, text, text, bigint) to authenticated;
