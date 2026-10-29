-- Forest Club Urla: sitede WhatsApp numarası gösterilmez (22.11.2026). İletişim ayarındaki numara silinir; topluluk
-- bağlantısı kalır. Mail şablonlarında numara geçiyorsa (yönetimden eklenmişse) o satırlar da temizlenir.
update public.ayarlar set deger = deger - 'whatsapp' where anahtar = 'iletisim' and deger ? 'whatsapp';
update public.eposta_sablonlari
  set metin = regexp_replace(metin, '(\+?90[ ]?)?0?5(35|43)[ ]?(035|592)[ ]?(91|66)[ ]?(46|54)', 'forestcluburla@gmail.com', 'g')
  where metin ~ '5(35|43)[ ]?(035|592)';
