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
  varliklar: {"09cc16aa1ae206085d823afc71a12cbc":".png","13cd5d40ec72babb0ede65e7c529ea2c":".png","1446f01d4f1e77e517c2b5c1ed9e8882":".png","21f9a70f4149cb87ce1caef24700cf9a":".png","266b2fee3867ac4f10190915272a365d":".png","2d66519eea65172f811d22ca45b24ba8":".png","3b52b2466eccbf7d67e3f442a8c334db":".png","3b54d5caa0b5ce9d252bbae5a6d5034c":".png","426f104f4634b69c53f59c397459ea29":".png","49a6d3a14dbcdce5ef3a64ccb68bdce2":".png","4ccaae261599786f1f538343780d636f":".jpg","4e4d833ecbf362b1068dc27f6db3c2fd":".mp4","5c9344a739e115de8ef68ca564188862":".png","5d4246c48f300edcce7178b1c6845750":".png","66c22f4b913a96253872f2eb6bbbc983":".png","7ace25b1e01f5deeaf99b9c072450d33":".png","aacfc64535d44efe49b190182753b4af":".png","acaed3103dfa47cef8b422e632322b0a":".png","b4b99c2884885ec7d8214ca36c5b035c":".png","c463507a24078de0e5fe3e7fff489eed":".png","c7a89dd60f2523087967c3301c3cfbe5":".jpg","c6dc84158c4bd70f7f5d1022943f4ffd":".jpg","ca1f7d65879a852b330638a3d90c2a27":".png","ca4f609e6cc9c7e8bcb930a27ed75853":".png","cbb059eb53122ae42a4dc504fb4b08c4":".png","d31fdc6aa4ecdc79c9a06e2844e7231c":".png","eea337c24718ad425209ba54852b6984":".png"},
};
// Aylık duyuru (ana sayfadaki sarı yuvarlak rozet ve etkinliklerin üstündeki şerit): yönetim › Etkinlikler'den
// ayarlanır (ayarlar.aylik_duyuru). Yazılarda {ay} seçilen ayla değişir. Tıklayınca: Açık Çağrı formu, üye formu
// (/form/?id=) ya da tam ekran resim (ör. ayın programı).
window.FC_AYLIK = {
  varsayilan: { goster: true, ay: 'Kasım', ust: '{ay} programı için', ana: 'AÇIK ÇAĞRI!', alt: 'Fikrin mi var? Tıkla ✨', tur: 'cagri', formId: '', resim: '', renk: 'sari' },
  // Rozet rengi (pastel); yazılar her zaman siyah
  renkler: [{ id: 'sari', ad: 'Sarı', kod: '#F6C945' }, { id: 'seftali', ad: 'Şeftali', kod: '#F9C6A6' }, { id: 'nane', ad: 'Nane', kod: '#BFE6CC' },
    { id: 'lila', ad: 'Lila', kod: '#D8C9F1' }, { id: 'mavi', ad: 'Gök mavisi', kod: '#BFDDF4' }],
  renkKodu(id) { return (this.renkler.find((r) => r.id === id) || this.renkler[0]).kod; },
  aylar: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
  oku(deger) { return { ...this.varsayilan, ...(deger && typeof deger === 'object' ? deger : {}) }; },
  doldur(metin, ay) { return String(metin || '').replace(/\{ay\}/g, ay || ''); },
};

// Düğün kataloğu: ürün gruplarının sırası, hangi adımda göründüğü (masa / alan) ve fotoğrafı olmayan kalemin çizimi.
// Listede olmayan yeni bir grup masa adımında, alfabetik olarak sonda görünür.
window.FC_DUGUN = {
  masaGruplari: ['Masa', 'Örtü', 'Peçete', 'Tabak ve supla', 'Çatal bıçak', 'Bardak', 'Sofra servisi', 'Çiçek', 'Masa üstü süs', 'Mum', 'Masa kartı', 'Sandalye', 'Sandalye süsü'],
  alanGruplari: ['Nikah alanı', 'Karşılama', 'Lounge', 'Işıklandırma', 'Gölgelik ve çadır', 'Bar ve içecek', 'Pasta ve tatlı sunumu', 'Fotoğraf köşesi', 'Çocuk köşesi',
    'Tabela ve yönlendirme', 'Misafir konforu', 'Kâğıt ürünler', 'Altyapı'],
  cizim: { Masa: 'masa', Örtü: 'ortu', Peçete: 'pecete', 'Tabak ve supla': 'tabak', 'Çatal bıçak': 'catal', Bardak: 'bardak', Çiçek: 'cicek', Mum: 'mum',
    'Masa kartı': 'kart', Sandalye: 'sandalye', 'Sandalye süsü': 'cicek', 'Nikah alanı': 'kemer', Karşılama: 'pano', Lounge: 'lounge', Işıklandırma: 'fener', Altyapı: 'isik',
    'Sofra servisi': 'tabak', 'Masa üstü süs': 'cicek', 'Gölgelik ve çadır': 'konak', 'Bar ve içecek': 'kokteyl', 'Pasta ve tatlı sunumu': 'pasta',
    'Fotoğraf köşesi': 'foto', 'Çocuk köşesi': 'parti', 'Tabela ve yönlendirme': 'pano', 'Misafir konforu': 'lounge', 'Kâğıt ürünler': 'kart' },
  turCizim: { mekan: 'mekan', bolum: 'kemer', menu: 'yemek', konsept: 'konsept-kir', urun: 'masa', ekstra: 'isik' },
  resim(k) { return k.resim || `/dugun/cizim/${(k.tur === 'urun' && this.cizim[k.grup]) || this.turCizim[k.tur] || 'mekan'}.svg`; },
  alanMi(grup) { return this.alanGruplari.includes(grup); },
  // Grupları sabit sıraya, bilinmeyenleri sona (alfabetik) dizer
  sirala(gruplar) {
    const hepsi = [...this.masaGruplari, ...this.alanGruplari];
    const yer = (g) => (hepsi.includes(g) ? hepsi.indexOf(g) : 1000);
    return [...gruplar].sort((a, b) => yer(a) - yer(b) || a.localeCompare(b, 'tr'));
  },
};
