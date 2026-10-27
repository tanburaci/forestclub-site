-- Forest Club Urla: Google Sheets aktarımı için kaynak işareti (29.10.2026). Sheets'ten gelen dekont ve Açık Çağrı
-- satırları "kaynak" ile tanınır; aktarım betiği (supabase/aktarim) tekrar çalışınca aynı satırı ikinci kez yazmaz.
alter table public.dekontlar add column if not exists kaynak text unique;    -- sheets:dekont:<özet>
alter table public.acik_cagri add column if not exists kaynak text unique;   -- sheets:cagri:<özet>
