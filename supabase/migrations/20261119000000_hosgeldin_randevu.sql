-- Forest Club Urla: hoş geldin maili yer ayırmayı sitedeki gibi anlatır (19.11.2026). Eski metin WhatsApp'taki
-- Reservation grubunu gösteriyordu; yer artık üye panelinde "Randevu oluştur" ile ayrılır. Yalnız o iki cümle
-- değişir (yönetim panelinde metnin geri kalanına yapılmış düzenlemeler korunur).
update public.eposta_sablonlari set
  metin = replace(replace(metin,
    'Katılmak istediğin ders ve etkinlikler için WhatsApp topluluğumuzdaki Reservation grubundan yerini ayırman gerekiyor.',
    'Katılmak istediğin ders ve etkinlikler için üye panelinde etkinliğin altındaki “Randevu oluştur”a basarak yerini ayırman gerekiyor.'),
    'Programımızı ve yeni buluşmaları da topluluğumuzdan takip edebilirsin.',
    'Programımızı ve yeni buluşmaları da üye panelinden takip edebilirsin: https://www.forestcluburla.com/uye'),
  varsayilan_metin = replace(replace(varsayilan_metin,
    'Katılmak istediğin ders ve etkinlikler için WhatsApp topluluğumuzdaki Reservation grubundan yerini ayırman gerekiyor.',
    'Katılmak istediğin ders ve etkinlikler için üye panelinde etkinliğin altındaki “Randevu oluştur”a basarak yerini ayırman gerekiyor.'),
    'Programımızı ve yeni buluşmaları da topluluğumuzdan takip edebilirsin.',
    'Programımızı ve yeni buluşmaları da üye panelinden takip edebilirsin: https://www.forestcluburla.com/uye')
  where id = 'onay';
