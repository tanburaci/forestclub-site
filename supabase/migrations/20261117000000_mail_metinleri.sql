-- Forest Club Urla: e-posta şablonlarının yeni metinleri (17.11.2026, "sen" dili; kulübün gönderdiği metinler).
-- Hem güncel metin hem "İlk hâline döndür" metni değişir. Hoş geldin mailindeki şifre bağlantısı ({sifreLinki}) korunur.
update public.eposta_sablonlari set konu = $k$Welcome to Forest Club Urla 🌲$k$, metin = $m$WELCOME TO FOREST CLUB URLA.

Merhaba {ad},

Artık sen de Forest Club'ın bir parçasısın.

Burası doğanın içinde buluşmak, yeni şeyler denemek, birlikte üretmek ve bazen de sadece durup birbirimizi dinlemek için oluşturduğumuz bir alan.

Üyeliğinle birlikte Breakfast Club, Sunset Club ve topluluğumuza özel buluşmalara katılabilir, atölyelerimizden %50 indirimle yararlanabilirsin.

Küçük bir not: Buluşmalarımız sınırlı kontenjanla gerçekleşiyor. Katılmak istediğin ders ve etkinlikler için WhatsApp topluluğumuzdaki Reservation grubundan yerini ayırman gerekiyor.

Programımızı ve yeni buluşmaları da topluluğumuzdan takip edebilirsin.

Üye paneline ilk girişin için şifreni buradan belirle:
{sifreLinki}
(Bağlantı tek kullanımlık; süresi dolarsa üye girişinde "Şifremi unuttum" de.)

İyi ki yollarımız kesişti.
Ağaçların altında görüşmek üzere.

We listen carefully.
To the trees. To the music. To each other.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Welcome to Forest Club Urla 🌲$k$, varsayilan_metin = $m$WELCOME TO FOREST CLUB URLA.

Merhaba {ad},

Artık sen de Forest Club'ın bir parçasısın.

Burası doğanın içinde buluşmak, yeni şeyler denemek, birlikte üretmek ve bazen de sadece durup birbirimizi dinlemek için oluşturduğumuz bir alan.

Üyeliğinle birlikte Breakfast Club, Sunset Club ve topluluğumuza özel buluşmalara katılabilir, atölyelerimizden %50 indirimle yararlanabilirsin.

Küçük bir not: Buluşmalarımız sınırlı kontenjanla gerçekleşiyor. Katılmak istediğin ders ve etkinlikler için WhatsApp topluluğumuzdaki Reservation grubundan yerini ayırman gerekiyor.

Programımızı ve yeni buluşmaları da topluluğumuzdan takip edebilirsin.

Üye paneline ilk girişin için şifreni buradan belirle:
{sifreLinki}
(Bağlantı tek kullanımlık; süresi dolarsa üye girişinde "Şifremi unuttum" de.)

İyi ki yollarımız kesişti.
Ağaçların altında görüşmek üzere.

We listen carefully.
To the trees. To the music. To each other.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'onay';
update public.eposta_sablonlari set konu = $k$Başvurun bize ulaştı 🌿$k$, metin = $m$Merhaba {ad},

Forest Club'a katılmak istediğin için teşekkür ederiz.

Başvurun bize ulaştı. Şimdi geriye yalnızca üyelik ödemenin tamamlanması kaldı.

Ödemeni havale/EFT yoluyla gerçekleştirebilir, dekontunu aşağıdaki bağlantıdan paylaşabilirsin:
{odemeLinki}

Ödemen onaylandığında 30 günlük üyelik süren başlayacak.

Yakında aynı masanın etrafında buluşmak dileğiyle.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Başvurun bize ulaştı 🌿$k$, varsayilan_metin = $m$Merhaba {ad},

Forest Club'a katılmak istediğin için teşekkür ederiz.

Başvurun bize ulaştı. Şimdi geriye yalnızca üyelik ödemenin tamamlanması kaldı.

Ödemeni havale/EFT yoluyla gerçekleştirebilir, dekontunu aşağıdaki bağlantıdan paylaşabilirsin:
{odemeLinki}

Ödemen onaylandığında 30 günlük üyelik süren başlayacak.

Yakında aynı masanın etrafında buluşmak dileğiyle.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'basvuru';
update public.eposta_sablonlari set konu = $k$Üyeliğin {bitis} tarihinde sona eriyor 🌿$k$, metin = $m$Merhaba {ad},

Forest Club üyeliğinin bu dönemi {bitis} tarihinde sona eriyor.

Yeni buluşmalar, yeni sesler ve paylaşacak daha çok şey var.

Bizimle devam etmek istersen üyeliğini aşağıdaki bağlantıdan yenileyebilirsin:
{odemeLinki}

Üyeliğini erken yenilersen kalan günlerin korunur; yeni dönemin mevcut üyeliğinin bitişinden sonra başlar.

Aynı masada yeniden buluşmak üzere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$, varsayilan_konu = $k$Üyeliğin {bitis} tarihinde sona eriyor 🌿$k$, varsayilan_metin = $m$Merhaba {ad},

Forest Club üyeliğinin bu dönemi {bitis} tarihinde sona eriyor.

Yeni buluşmalar, yeni sesler ve paylaşacak daha çok şey var.

Bizimle devam etmek istersen üyeliğini aşağıdaki bağlantıdan yenileyebilirsin:
{odemeLinki}

Üyeliğini erken yenilersen kalan günlerin korunur; yeni dönemin mevcut üyeliğinin bitişinden sonra başlar.

Aynı masada yeniden buluşmak üzere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$ where id = 'yenileme';
update public.eposta_sablonlari set konu = $k$Ormanda yeni bir buluşma: {etkinlik} 🌲$k$, metin = $m$Merhaba {ad},

Ormanda yeni bir buluşma var.
Bu kez {etkinlik} için bir araya geliyoruz.

Ne zaman?
{tarih} · {saat}

Nerede?
{yer}

Birlikte deneyimlemek, paylaşmak ve biraz da günlük hayatın ritminden uzaklaşmak için seni de bekliyoruz.

Kontenjanımız sınırlı. Katılmak istersen üye panelinden yerini ayırabilirsin.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Ormanda yeni bir buluşma: {etkinlik} 🌲$k$, varsayilan_metin = $m$Merhaba {ad},

Ormanda yeni bir buluşma var.
Bu kez {etkinlik} için bir araya geliyoruz.

Ne zaman?
{tarih} · {saat}

Nerede?
{yer}

Birlikte deneyimlemek, paylaşmak ve biraz da günlük hayatın ritminden uzaklaşmak için seni de bekliyoruz.

Kontenjanımız sınırlı. Katılmak istersen üye panelinden yerini ayırabilirsin.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'duyuru';
update public.eposta_sablonlari set konu = $k${etkinlik} yaklaşıyor 🌲$k$, metin = $m$Merhaba {ad},

{etkinlik} buluşmamız yaklaşıyor.
Bir küçük hatırlatma bırakalım istedik.

{tarih} · {saat}
{yer}

Girişte üye panelindeki QR kodunu göstermen yeterli.

Planların değiştiyse panelinden “Gelemeyeceğim” seçeneğini işaretleyebilirsin. Böylece yerini bekleyen başka biriyle paylaşabiliriz.

Görüşmek üzere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$, varsayilan_konu = $k${etkinlik} yaklaşıyor 🌲$k$, varsayilan_metin = $m$Merhaba {ad},

{etkinlik} buluşmamız yaklaşıyor.
Bir küçük hatırlatma bırakalım istedik.

{tarih} · {saat}
{yer}

Girişte üye panelindeki QR kodunu göstermen yeterli.

Planların değiştiyse panelinden “Gelemeyeceğim” seçeneğini işaretleyebilirsin. Böylece yerini bekleyen başka biriyle paylaşabiliriz.

Görüşmek üzere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$ where id = 'hatirlatma';
update public.eposta_sablonlari set konu = $k$Yer açıldı: {etkinlik} 🎉$k$, metin = $m$Merhaba {ad},

Güzel bir haberimiz var.

{etkinlik} buluşmamızda bir yer açıldı ve kaydını oluşturduk.

{tarih} · {saat}

Artık sen de bizimlesin.

Katılamayacak olursan üye panelinden “Gelemeyeceğim” seçeneğini işaretlemeni rica ediyoruz. Böylece bu yer başka birine geçebilir.

Ağaçların altında görüşürüz.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Yer açıldı: {etkinlik} 🎉$k$, varsayilan_metin = $m$Merhaba {ad},

Güzel bir haberimiz var.

{etkinlik} buluşmamızda bir yer açıldı ve kaydını oluşturduk.

{tarih} · {saat}

Artık sen de bizimlesin.

Katılamayacak olursan üye panelinden “Gelemeyeceğim” seçeneğini işaretlemeni rica ediyoruz. Böylece bu yer başka birine geçebilir.

Ağaçların altında görüşürüz.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'bekleme';
update public.eposta_sablonlari set konu = $k${etkinlik} hakkında bir güncelleme$k$, metin = $m$Merhaba {ad},

Bazen planlar değişebiliyor.

{etkinlik} buluşmamızla ilgili bir güncellemeyi seninle paylaşmak istiyoruz.

{duyuru}

Anlayışın için teşekkür ederiz.

Bir soru ya da sorun olursa WhatsApp topluluğumuz üzerinden bize ulaşabilirsin.

Başka bir buluşmada görüşmek üzere.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k${etkinlik} hakkında bir güncelleme$k$, varsayilan_metin = $m$Merhaba {ad},

Bazen planlar değişebiliyor.

{etkinlik} buluşmamızla ilgili bir güncellemeyi seninle paylaşmak istiyoruz.

{duyuru}

Anlayışın için teşekkür ederiz.

Bir soru ya da sorun olursa WhatsApp topluluğumuz üzerinden bize ulaşabilirsin.

Başka bir buluşmada görüşmek üzere.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'iptal';
update public.eposta_sablonlari set konu = $k${etkinlik} nasıldı? 🌿$k$, metin = $m$Merhaba {ad},

{etkinlik} buluşmasında bizimle olduğun için teşekkür ederiz.

Forest Club'ı birlikte oluşturuyoruz. Bu yüzden senin deneyimin, düşüncelerin ve önerilerin bizim için değerli.

En çok neyi sevdin?
Bir sonraki buluşmada neyi farklı yapabiliriz?

Üye panelinden deneyimini 1–5 arasında değerlendirebilir ve birkaç cümle bırakabilirsin.

Buluşmadan fotoğraflar da panelinde seni bekliyor.

We listen carefully.
To each other, too.

Sevgiler,
Forest Club Urla 🌲$m$, varsayilan_konu = $k${etkinlik} nasıldı? 🌿$k$, varsayilan_metin = $m$Merhaba {ad},

{etkinlik} buluşmasında bizimle olduğun için teşekkür ederiz.

Forest Club'ı birlikte oluşturuyoruz. Bu yüzden senin deneyimin, düşüncelerin ve önerilerin bizim için değerli.

En çok neyi sevdin?
Bir sonraki buluşmada neyi farklı yapabiliriz?

Üye panelinden deneyimini 1–5 arasında değerlendirebilir ve birkaç cümle bırakabilirsin.

Buluşmadan fotoğraflar da panelinde seni bekliyor.

We listen carefully.
To each other, too.

Sevgiler,
Forest Club Urla 🌲$m$ where id = 'anket';
update public.eposta_sablonlari set konu = $k$İlk buluşman bizden: biletin hazır 🎟️$k$, metin = $m$Merhaba {ad},

Tanışmak için güzel bir fırsatımız var.

Seni Forest Club'daki ilk buluşmana davet ediyoruz.

{etkinlik}
{tarih} · {saat}

Tanışma biletin: {biletKodu}

Bu bilet sana özel, ücretsiz ve tek kullanımlık. Yalnızca belirtilen buluşmada geçerli.

Geldiğinde bilet kodunu göstermen yeterli.

Bir kahve, güzel bir sohbet, belki yeni bir arkadaşlık.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$İlk buluşman bizden: biletin hazır 🎟️$k$, varsayilan_metin = $m$Merhaba {ad},

Tanışmak için güzel bir fırsatımız var.

Seni Forest Club'daki ilk buluşmana davet ediyoruz.

{etkinlik}
{tarih} · {saat}

Tanışma biletin: {biletKodu}

Bu bilet sana özel, ücretsiz ve tek kullanımlık. Yalnızca belirtilen buluşmada geçerli.

Geldiğinde bilet kodunu göstermen yeterli.

Bir kahve, güzel bir sohbet, belki yeni bir arkadaşlık.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'tanisma';
update public.eposta_sablonlari set konu = $k$Dekontun hakkında$k$, metin = $m$Merhaba {ad},

Üyelik ödemen için gönderdiğin dekontu kontrol ettik ancak henüz onaylayamadık.

Nedeni: {neden}

Bilgilerini kontrol ederek dekontunu aşağıdaki bağlantıdan yeniden yükleyebilirsin:
{odemeLinki}

Bir sorun yaşarsan bize yazabilirsin, birlikte çözeriz.

Sevgiler,
Forest Club Urla 🌲$m$, varsayilan_konu = $k$Dekontun hakkında$k$, varsayilan_metin = $m$Merhaba {ad},

Üyelik ödemen için gönderdiğin dekontu kontrol ettik ancak henüz onaylayamadık.

Nedeni: {neden}

Bilgilerini kontrol ederek dekontunu aşağıdaki bağlantıdan yeniden yükleyebilirsin:
{odemeLinki}

Bir sorun yaşarsan bize yazabilirsin, birlikte çözeriz.

Sevgiler,
Forest Club Urla 🌲$m$ where id = 'dekont_red';
update public.eposta_sablonlari set konu = $k$İyi ki doğdun {ad}! 🎂$k$, metin = $m$Merhaba {ad},

Bugün senin günün.

Yeni yaşında daha çok keşif, güzel karşılaşmalar, uzun sohbetler ve kendine ayırdığın zamanlar olsun.

Belki bir ağacın gölgesinde, belki uzun bir masanın etrafında, belki de hiç beklemediğin bir anda.

İyi ki doğdun.

Sevgiler,
Forest Club Urla 🌲$m$, varsayilan_konu = $k$İyi ki doğdun {ad}! 🎂$k$, varsayilan_metin = $m$Merhaba {ad},

Bugün senin günün.

Yeni yaşında daha çok keşif, güzel karşılaşmalar, uzun sohbetler ve kendine ayırdığın zamanlar olsun.

Belki bir ağacın gölgesinde, belki uzun bir masanın etrafında, belki de hiç beklemediğin bir anda.

İyi ki doğdun.

Sevgiler,
Forest Club Urla 🌲$m$ where id = 'dogumgunu';
update public.eposta_sablonlari set konu = $k$Kutlu olsun {ad} 🌿$k$, metin = $m$Merhaba {ad},

{ozelGun} kutlu olsun.

Birlikte olmanın, paylaşmanın ve birbirimizi dinlemenin değerini hatırladığımız nice güzel günlere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$, varsayilan_konu = $k$Kutlu olsun {ad} 🌿$k$, varsayilan_metin = $m$Merhaba {ad},

{ozelGun} kutlu olsun.

Birlikte olmanın, paylaşmanın ve birbirimizi dinlemenin değerini hatırladığımız nice güzel günlere.

Sevgiler,
Forest Club Urla
We listen carefully.$m$ where id = 'ozelgun';
update public.eposta_sablonlari set konu = $k$Silme talebin tamamlandı$k$, metin = $m$Merhaba {ad},

Kişisel verilerinin silinmesine ilişkin talebin doğrultusunda gerekli işlemleri tamamladık.

Mevzuat gereği saklanması zorunlu olan kayıtlar, ilgili yasal süreler boyunca korunmaya devam edecektir.

Bizimle geçirdiğin zaman için teşekkür ederiz.

Yolun yeniden ormana düşerse karşılaşmak dileğiyle.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Silme talebin tamamlandı$k$, varsayilan_metin = $m$Merhaba {ad},

Kişisel verilerinin silinmesine ilişkin talebin doğrultusunda gerekli işlemleri tamamladık.

Mevzuat gereği saklanması zorunlu olan kayıtlar, ilgili yasal süreler boyunca korunmaya devam edecektir.

Bizimle geçirdiğin zaman için teşekkür ederiz.

Yolun yeniden ormana düşerse karşılaşmak dileğiyle.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'veri_talebi';
update public.eposta_sablonlari set konu = $k$Biletlerin hazır 🎟️$k$, metin = $m$Merhaba {ad},

Dekontun onaylandı, biletlerin hazır.

{biletler}

Girişte her kişi için bilet kodunu göstermen yeterli.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$, varsayilan_konu = $k$Biletlerin hazır 🎟️$k$, varsayilan_metin = $m$Merhaba {ad},

Dekontun onaylandı, biletlerin hazır.

{biletler}

Girişte her kişi için bilet kodunu göstermen yeterli.

See you under the trees.

Sevgiler,
Forest Club Urla
Gatherings in Nature. 🌲$m$ where id = 'bilet';
update public.eposta_sablonlari set konu = $k$Bilet dekontun hakkında$k$, metin = $m$Merhaba {ad},

Bilet için gönderdiğin dekontu kontrol ettik ancak henüz onaylayamadık.

Nedeni: {neden}

Bir sorun yaşarsan WhatsApp topluluğumuzdan bize yazabilirsin, birlikte çözeriz.

Sevgiler,
Forest Club Urla 🌲$m$, varsayilan_konu = $k$Bilet dekontun hakkında$k$, varsayilan_metin = $m$Merhaba {ad},

Bilet için gönderdiğin dekontu kontrol ettik ancak henüz onaylayamadık.

Nedeni: {neden}

Bir sorun yaşarsan WhatsApp topluluğumuzdan bize yazabilirsin, birlikte çözeriz.

Sevgiler,
Forest Club Urla 🌲$m$ where id = 'bilet_red';
