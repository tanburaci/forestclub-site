-- Forest Club Urla: sitede WhatsApp numarası gösterilmez (22.11.2026). İletişim ayarındaki numara silinir; topluluk
-- bağlantısı kalır. Mail şablonlarında numara geçiyorsa (yönetimden eklenmişse) o satırlar da temizlenir.
update public.ayarlar set deger = deger - 'whatsapp' where anahtar = 'iletisim' and deger ? 'whatsapp';
update public.eposta_sablonlari
  set metin = regexp_replace(metin, '(\+?90[ ]?)?0?5[0-9]{2}[ ]?[0-9]{3}[ ]?[0-9]{2}[ ]?[0-9]{2}', 'forestcluburla@gmail.com', 'g')
  where metin ~ '5[0-9]{2}[ ]?[0-9]{3}';
