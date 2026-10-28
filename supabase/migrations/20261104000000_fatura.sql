-- Forest Club Urla: gelirlerin fatura takibi (04.11.2026). Faturalar GİB e-Arşiv portalından elle kesilir; yönetim ›
-- Muhasebe'de her gelirin yanında "Kesildi" (fatura no ve tarihiyle) ya da "Gerekmez" işaretlenir. Boş = kesilecek.
alter table public.muhasebe_hareketleri
  add column if not exists fatura_durum text check (fatura_durum in ('kesildi', 'gerekmez')),
  add column if not exists fatura_no text check (length(fatura_no) <= 60),
  add column if not exists fatura_tarih date;
