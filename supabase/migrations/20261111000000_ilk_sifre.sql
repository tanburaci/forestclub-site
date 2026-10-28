-- Forest Club Urla: hoş geldin mailinde şifre belirleme bağlantısı (11.11.2026). eposta-gonder, metinde {sifreLinki}
-- görünce alıcıya tek kullanımlık bağlantı üretir (hesap yoksa davet, varsa şifre sıfırlama); üye tıklayınca üye
-- panelinde doğrudan yeni şifresini belirler, ikinci bir mail beklemez. Yönetici metni değiştirdiyse yalnız alan eklenir.
update public.eposta_sablonlari
  set metin = replace(metin, E'Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.',
                      E'Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.\n\nÜye panelinize ilk girişiniz için şifrenizi buradan belirleyin:\n{sifreLinki}\n(Bağlantı tek kullanımlıktır; süresi dolarsa üye girişinde "Şifremi unuttum" deyin.)')
  where id = 'onay' and position('{sifreLinki}' in metin) = 0
    and position(E'Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.' in metin) > 0;
update public.eposta_sablonlari
  set varsayilan_metin = replace(varsayilan_metin, E'Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.',
                      E'Güncel programımızı ve duyurularımızı WhatsApp topluluğumuzdan takip edebilirsiniz.\n\nÜye panelinize ilk girişiniz için şifrenizi buradan belirleyin:\n{sifreLinki}\n(Bağlantı tek kullanımlıktır; süresi dolarsa üye girişinde "Şifremi unuttum" deyin.)')
  where id = 'onay' and position('{sifreLinki}' in varsayilan_metin) = 0;
update public.eposta_sablonlari set alanlar = array_append(alanlar, 'sifreLinki')
  where id = 'onay' and not ('sifreLinki' = any (alanlar));
