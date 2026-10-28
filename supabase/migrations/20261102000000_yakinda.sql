-- Forest Club Urla: "Yakında" modu ve site duyurusu (02.11.2026).
--   · yakinda: açıkken sitede "Yakında açılıyoruz" şeridi çıkar; üyelik başvurusu, tanışma bileti ve bilet satışı
--     kapalıdır (form-gonder de reddeder). Yönetim › İletişim › Site durumu'ndan tek tıkla kapatılır.
--   · site_duyurusu: sitenin en üstündeki sarı duyuru (iptal / erteleme). Boşsa görünmez.
insert into public.ayarlar (anahtar, deger, herkese_acik) values
  ('yakinda', 'true', true),
  ('site_duyurusu', '""', true)
  on conflict (anahtar) do nothing;
