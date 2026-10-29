-- Forest Club Urla: maillerde WhatsApp kalmasın (20.11.2026). Yer ayırma üye panelindeki "Randevu oluştur" ile
-- (hoş geldin mailinde; 20261119 uygulanmadıysa da düzelir), soru / sorun için kulübün e-posta adresi. Yalnız bu
-- cümleler değişir; yönetim panelinde metnin geri kalanına yapılmış düzenlemeler korunur.
create or replace function pg_temp.duzelt(m text) returns text language sql as $$
  select replace(replace(replace(replace(m,
    'Katılmak istediğin ders ve etkinlikler için WhatsApp topluluğumuzdaki Reservation grubundan yerini ayırman gerekiyor.',
    'Katılmak istediğin ders ve etkinlikler için üye panelinde etkinliğin altındaki “Randevu oluştur”a basarak yerini ayırman gerekiyor.'),
    'Programımızı ve yeni buluşmaları da topluluğumuzdan takip edebilirsin.',
    'Programımızı ve yeni buluşmaları da üye panelinden takip edebilirsin: https://www.forestcluburla.com/uye'),
    'Bir soru ya da sorun olursa WhatsApp topluluğumuz üzerinden bize ulaşabilirsin.',
    'Bir soru ya da sorun olursa forestcluburla@gmail.com adresine yazabilirsin.'),
    'Bir sorun yaşarsan WhatsApp topluluğumuzdan bize yazabilirsin, birlikte çözeriz.',
    'Bir sorun yaşarsan forestcluburla@gmail.com adresine yazabilirsin, birlikte çözeriz.')
$$;
update public.eposta_sablonlari
  set metin = pg_temp.duzelt(metin), varsayilan_metin = pg_temp.duzelt(varsayilan_metin)
  where metin <> pg_temp.duzelt(metin) or varsayilan_metin is distinct from pg_temp.duzelt(varsayilan_metin);
