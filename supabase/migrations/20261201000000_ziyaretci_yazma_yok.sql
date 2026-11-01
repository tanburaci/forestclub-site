-- Forest Club Urla: ziyaretçi (anon) public tablolara doğrudan yazamaz (01.11.2026, güvenlik denetimi).
-- Supabase varsayılanı anon'a her tabloda insert/update/delete verir; asıl koruma satır güvenliği (RLS) ve ziyaretçinin
-- hiçbir tabloda yazma politikası yok. Bu ikinci kilit: ileride bir tabloda RLS unutulsa da ziyaretçi yazamaz.
-- Ziyaretçi yazmaları (başvuru, Açık Çağrı, dekont, bilet…) form-gonder üzerinden service_role ile yapılır; okuma
-- yetkileri (etkinlikler, ayarlar, düğün kataloğu) değişmez. Dosya deposu (storage) bu şemada değil, etkilenmez.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
