# Forest Club Urla · deneme sitesi

Yayında değil. Tasarım demosundaki (claude.ai Design) sayfaların gerçek veriye bağlanmış hali.

- `deneme-site/` statik site (Netlify): `index.html` site, `/uye` üye paneli, `/yonetim` yönetici paneli, `/dekont` dekont yükleme.
  - `js/dc.js` tasarım sayfalarını (`sayfalar/*.dc.html`) çalıştıran küçük motor
  - `js/ortak.js` Supabase bağlantısı, giriş/çıkış, dekont yükleme
  - `js/yonetim.js`, `js/uye.js`, `js/site.js`, `js/dekont.js` sayfaların veri katmanı
  - `js/ayar.js` Supabase adresi ve **tarayıcı (anon) anahtarı**; gizli anahtar asla bu depoda değildir
- `supabase/migrations/` veritabanı şeması, satır bazlı yetki (RLS) kuralları ve sunucu işlevleri
- `supabase/seed_demo.sql` yalnız deneme projesine yüklenen ÖRNEK veri (gerçek kişi yok)
- `supabase/functions/` Edge Function'lar: `form-gonder` (anonim formlar: Turnstile + IP başına sınır, dekont için imzalı
  yükleme adresi), `eposta-gonder` (e-posta kuyruğunu Resend ile gönderir), `dekont-temizle` (kayda bağlanmamış dosyalar),
  `odeme-baslat` / `odeme-donus` (iyzico ile kartla aidat; `ayarlar.kart_odeme` açıkken)
- `supabase/aktarim/` Google Sheets → veritabanı aktarımı: `csv_sql.mjs` (CSV → SQL), `02_aktar.sql`, `03_dogrula.sql`
- `supabase/tests/` veritabanı güvenlik testleri (pgTAP): `supabase test db`
- `araclar/dc_derle.mjs` tasarım sayfalarının betiğini `sayfalar/*.dc.js` dosyalarına çıkarır. **Bir `.dc.html` değişince
  `node araclar/dc_derle.mjs` çalıştırılıp çıkan `.dc.js` de eklenir** (CI denetler; CSP'de `unsafe-eval` yok)
- `testler/` tarayıcı testleri (Playwright; Supabase sahte, CSP uygulanmış): `cd testler && npm ci && npm run tarayici`
- `.github/workflows/ci.yml` her PR'da: sözdizimi, sayfa betikleri, Edge Function tür denetimi, göçler + pgTAP, tarayıcı testleri

Yönetim paneli iki adımlı girişle açılır (şifre / e-posta bağlantısı + doğrulama uygulaması kodu). Yönetici eklemek ya da
çıkarmak yalnız Supabase SQL Editor'dan: `insert into yoneticiler (user_id, ad) values ('<auth kullanıcı id>', 'Ad');`.
Telefonu kaybeden yönetici: Supabase › Authentication › Users › kullanıcı › MFA faktörünü sil; ilk girişte yeniden kurar.

Ödeme: IBAN + dekont; iyzico (kartla aidat) yönetim panelinden açılınca kart da. Gerçek veri (Google Sheets) yayın günü boş veritabanına aktarılacak.
