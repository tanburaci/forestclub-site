// Forest Club Urla · deneme sitesi ayarları. Bu anahtar herkese açık olabilir (tarayıcı anahtarı); veriyi satır bazlı
// yetki (RLS) korur. Gizli anahtar (service_role) asla buraya yazılmaz.
window.FC_AYAR = {
  supabaseUrl: 'https://gflabqnazkstsyafzdmn.supabase.co',
  supabaseAnahtar: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbGFicW5hemtzdHN5YWZ6ZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDg4MzUsImV4cCI6MjEwODYyNDgzNX0.bcPcUPsLdtZlYfL5ryRxcIGOzHa7GDEKyCkB1KH5upo',
  // Üyelik ödemesi (iyzico gelene kadar havale / EFT; Sheets'teki AYAR.ODEME_BILGISI ile aynı)
  // true: üye girişinde demo hesap düğmeleri görünür (yalnız tasarım denemesi için; yayında false)
  deneme: false,
  // Cloudflare Turnstile site anahtarı (herkese açık; widget "Forest Club site": forestcluburla.com, www, netlify.app).
  // Eşi olan gizli anahtar yalnız Supabase secret TURNSTILE_SECRET'ta durur.
  turnstile: '0x4AAAAAAFpdoJpz9qwNv9_6',
  odeme: { tutar: '3.000 TL', alici: 'Pelin Küçükali', iban: 'TR59 0015 7000 0000 0205 1344 62' },
  // Biz Kimiz? › "WhatsApp'tan yaz": ziyaretçi kime yazacağını seçer
  whatsapp: [{ ad: 'Pelin', tel: '05435926654' }, { ad: 'Ezgi', tel: '05350359146' }],
  varliklar: {"09cc16aa1ae206085d823afc71a12cbc":".png","13cd5d40ec72babb0ede65e7c529ea2c":".png","1446f01d4f1e77e517c2b5c1ed9e8882":".png","21f9a70f4149cb87ce1caef24700cf9a":".png","266b2fee3867ac4f10190915272a365d":".png","2d66519eea65172f811d22ca45b24ba8":".png","3b52b2466eccbf7d67e3f442a8c334db":".png","3b54d5caa0b5ce9d252bbae5a6d5034c":".png","426f104f4634b69c53f59c397459ea29":".png","49a6d3a14dbcdce5ef3a64ccb68bdce2":".png","4ccaae261599786f1f538343780d636f":".jpg","4e4d833ecbf362b1068dc27f6db3c2fd":".mp4","5c9344a739e115de8ef68ca564188862":".png","5d4246c48f300edcce7178b1c6845750":".png","66c22f4b913a96253872f2eb6bbbc983":".png","7ace25b1e01f5deeaf99b9c072450d33":".png","aacfc64535d44efe49b190182753b4af":".png","acaed3103dfa47cef8b422e632322b0a":".png","b4b99c2884885ec7d8214ca36c5b035c":".png","c463507a24078de0e5fe3e7fff489eed":".png","c7a89dd60f2523087967c3301c3cfbe5":".jpg","ca1f7d65879a852b330638a3d90c2a27":".png","ca4f609e6cc9c7e8bcb930a27ed75853":".png","cbb059eb53122ae42a4dc504fb4b08c4":".png","d31fdc6aa4ecdc79c9a06e2844e7231c":".png","eea337c24718ad425209ba54852b6984":".png"},
};
// Aylık duyuru (ana sayfadaki sarı yuvarlak rozet ve etkinliklerin üstündeki şerit): yönetim › Etkinlikler'den
// ayarlanır (ayarlar.aylik_duyuru). Yazılarda {ay} seçilen ayla değişir. Tıklayınca: Açık Çağrı formu, üye formu
// (/form/?id=) ya da tam ekran resim (ör. ayın programı).
window.FC_AYLIK = {
  varsayilan: { goster: true, ay: 'Kasım', ust: '{ay} programı için', ana: 'AÇIK ÇAĞRI!', alt: 'Fikrin mi var? Tıkla ✨', tur: 'cagri', formId: '', resim: '' },
  aylar: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  oku(deger) { return { ...this.varsayilan, ...(deger && typeof deger === 'object' ? deger : {}) }; },
  doldur(metin, ay) { return String(metin || '').replace(/\{ay\}/g, ay || ''); },
};
