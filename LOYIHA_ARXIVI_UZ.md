# UzCam Mini App — loyiha va suhbat arxivi

**Arxiv sanasi:** 2026-10-26  
**Maqsad:** keyingi suhbatda loyiha tarixi, kelishilgan talablar, hozirgi kod/deploy holati va navbatdagi ishlar bir fayldan tez tushunilishi. Bu hujjat chatning so‘zma-so‘z stenogrammasi emas; muhim qarorlar va bajarilgan ishlar jamlanmasi.

---

## 1. Loyiha nima?

UzCam — Telegram bot va Telegram Mini App orqali videokuzatuv kameralari, kabellar va kamera tizimiga tegishli elektronika sotiladigan savdo tizimi. Dastlab loyiha TexnoCam/TexnoCam nomi bilan yuritilgan; foydalanuvchi uni to‘liq **UzCam** deb o‘zgartirishni tanlagan.

- **Telegram bot:** `@UzCambot` (BotFather orqali yaratilgan).
- **Mini App / xizmat manzili:** https://texnocam-miniapp.onrender.com
- **GitHub:** `yarashev/texnocam-miniapp`, asosiy tarmoq `main`.
- **Render xizmati:** Node.js Web Service; joriy ishchi loyiha shu repo bilan bog‘langan.
- GitHub repo’ni Private qilish tasdiqlangan. Hozirgi GitHub visibility holatini alohida tekshirish kerak; arxiv uni tekshirildi deb da’vo qilmaydi.

### Brend va dizayn qarorlari

- Qisqa, esda qoladigan savdo nomi: **UzCam**.
- Kamera linzasi/korpusidan ilhomlangan original UzCam belgisi; EZVIZ yoki Hikvision logotipini ko‘chirib ishlatmaslik.
- EZVIZ/ColorVu kayfiyatiga mos, sokin yashil/oq palitra; juda o‘tkir ko‘k ranglardan qochish.
- Mahsulot rasmlari ixcham kartalarda to‘liq ko‘rinishi, buzilgan yoki “quti” o‘rnini bosuvchi belgilar imkon qadar tuzatilishi kerak.

## 2. Mahsulotlar va narx qoidalari

Kelishilgan asosiy katalog bo‘limlari:

- EZVIZ
- Hikvision
- Dahua
- NeoCam
- Xitoy kameralar
- Kabel
- Elektronika va kamera tizimiga tegishli apparatlar/aksessuarlar

Katalog narxlari imkon qadar arzonidan boshlanadi. Mijoz filtrlarda arzon, o‘rtacha va qimmat narx guruhini tanlashi, brend va model/mahsulot nomi bo‘yicha tez qidiruv kerak. Qidiruvda modelning bosh harflari, birinchi harflar va raqamlar yordam berishi ko‘zda tutilgan.

Narx siyosati:

1. Yetkazib beruvchi/tannarx narxiga 30% ustama qo‘shiladi.
2. Valyutadagi narxlar so‘mga bugungi almashuv kursi asosida aylantiriladi; ustamani Super Admin sozlaydi.
3. Tannarx, manba narxi, kurs va ustama hisoboti faqat Super Admin uchun. Mijozlar, oddiy adminlar va ishchilar faqat sotuv narxini ko‘rishi kerak.
4. Narxlar qo‘lda o‘zgartirilganda yoki kurs yangilanganda o‘zgarish tarixi saqlanishi rejalashtirilgan.
5. `backend/catalog.json` faqat mijozga ko‘rinadigan sotuv narxlarini seed qiladi; maxfiy tannarxni GitHub’ga qo‘shmaslik kerak.

Manba kataloglari sifatida EZVIZ, KSS va NeoCam prayslari ko‘rib chiqilgan. Rasm va katalog ma’lumotlarini import qilish hamda noto‘g‘ri/bo‘sh rasmlarni tozalash alohida ish.

## 3. Mijoz buyurtmasi bo‘yicha kelishuvlar

- Mijoz savatdagi mahsulotlarni buyurtmani tasdiqlashdan oldin qo‘sha/o‘chira va miqdorini o‘zgartira oladi.
- Yetkazish manziliga olib borish: telefon raqami maydonida `+998` prefiksi avtomatik turishi; manzil va qo‘shimcha ko‘rsatma olinishi kerak.
- BTS pochta: mutlaqo bepul; oluvchining ism-familiyasi, telefon raqami, yetkazish/BTS manzili va kerakli qo‘shimcha ma’lumoti so‘raladi.
- Buyurtma odatda 3 kun ichida yetkazilishi aytilgan.
- To‘lov karta yoki Paynet QR orqali. Berilgan Paynet QR rasmi/ma’lumoti prototipga kiritilgan; haqiqiy to‘lovni avtomatik aniqlash va buyurtmaga bog‘lash hali backendda bajarilmagan.
- To‘lov isboti admin tomonidan ko‘rib chiqilib tasdiqlanishi kerak.
- To‘lov tasdiqlangach, mijoz yuklab oladigan elektron nakladnoy/chek shakllantirish rejalashtirilgan.
- Mijoz Telegram ID/telefon bilan aniqlanib, xaridlar tarixi va bot orqali admin bilan chatga ega bo‘lishi kerak.

## 4. Rollar va ish jarayoni

### Super Admin

Bitta asosiy Super Admin bo‘ladi. U xodimlar, rollar, sozlamalar, kontent va tizim siyosatini to‘liq boshqaradi. Super Admin Telegram ID Render’da `SUPER_ADMIN_TELEGRAM_ID` kalitida saqlanadi. Haqiqiy ID shaxsiy identifikator bo‘lgani uchun arxivga kiritilmagan.

### Admin

Rejalashtirilgan vakolatlar: mahsulot joylash/tahrirlash, kelishilgan doirada narxlarni yangilash, mijoz savollariga javob va to‘lovni tasdiqlash. Tannarx va maxfiy narx ma’lumotlari ko‘rinmasligi kerak.

### Ishchi / usta

- To‘lovi tasdiqlangan, hali hech kim bron qilmagan xizmat buyurtmalari barcha faol ishchilarga ko‘rinadi.
- Birinchi bo‘lib bron qilgan ishchiga buyurtma biriktiriladi; boshqa ishchilar undan keyin bron qila olmaydi.
- Mijozning kontakti va manzili faqat biriktirilgan ishchiga ochilishi kerak.
- Ishchi xizmat haqini mijoz bilan mustaqil kelishadi; bu mahsulot to‘lovidan alohida qayd qilinadi.
- Super Admin va tegishli adminlarga bron qilingan ishchilar ro‘yxati/nazorati ko‘rinadi.

## 5. Botning hozirgi ishlashi

Telegram webhook Render xizmat ishga tushganda o‘rnatiladi. Muhit o‘zgaruvchilari:

- `TELEGRAM_BOT_TOKEN` — maxfiy; uni chatga, skrinshotga yoki GitHub’ga chiqarmang.
- `SUPER_ADMIN_TELEGRAM_ID` — Super Admin Telegram ID.
- `RENDER_EXTERNAL_URL` va `PORT` Render tomonidan beriladi.

Botning amaldagi menyu imkoniyatlari kodda:

- `/start`, `/menu`, `/help`
- Mini App katalogini ochish
- EZVIZ promo ma’lumotini ko‘rsatish
- Admin kiritgan YouTube videolarni ko‘rsatish
- Admin kiritgan yangiliklarni ko‘rsatish
- **👷 Ustalar** — Mini App’dagi ustalar bo‘limini ochish
- **💬 Admin bilan aloqa** — mijoz xabarini Super Admin’ga nusxa qilib yuborish; Super Admin o‘sha nusxaga Telegram’da Reply qiladi, javobi mijozga qaytadi. Mijoz `/stop` bilan suhbatni tugatadi.
- Noma’lum matn yuborilganda yo‘l-yo‘riq va asosiy menyu qayta chiqadi.

Mijoz xabari yuborildi degan tasdiqni olishi uchun Telegram API admin chatiga xabarni qabul qilgan bo‘lishi kerak. Admin xabarni **BotFather**dan emas, aynan o‘z akkauntidagi `@UzCambot` chatidan izlashi kerak; Super Admin avval botga Start bergan bo‘lishi lozim.

## 6. Hozirgi ishlaydigan kod bo‘limlari

### Mini App

- Katalog, kategoriya/brend/narx filtrlari, qidiruv, savat va checkout prototipi.
- Bosh sahifada admin boshqaradigan EZVIZ promo; narx va rasm katalog mahsulotidan olinadi.
- Bosh sahifada admin yoqib qo‘ygan YouTube video kartalari va yangiliklar.
- Profil oynasi Telegram Mini App `initData` orqali foydalanuvchini backendga tasdiqlatadi; admin/ishchi bo‘lsa boshqaruv paneliga kirish tugmasi chiqadi.
- Ustalar bo‘limi `#workers` manzili orqali ochiladi; faol va ommaga ochiq ustalar kartalari ko‘rsatiladi.

### Admin panel

Telegram Mini App ichida profil belgisi → **Boshqaruv paneli**. Admin preview route server sessiyasi bilan himoyalangan.

Super Admin panelida hozir backendga ulangan bo‘limlar:

- Bosh sahifa kontenti: promo matni/mahsulot, YouTube linklari, yangiliklar.
- Adminlar va ishchilar: Telegram ID bilan Admin yoki Ishchi qo‘shish, rol almashtirish, faolsizlantirish/faollashtirish.
- Usta profili: ism-familiya, telefon, Telegram username, ish staji, profil rasmi uchun HTTPS URL, xizmat narxlari/izoh, ommaga ko‘rsatish.

Usta profili to‘liq bo‘lmasa, “Ustalar katalogida ko‘rsatish”ni o‘chirib yashirin saqlash mumkin. Profil e’lon qilinishidan oldin ism-familiya, telefon, Telegram username, rasm havolasi va xizmat narxlari to‘ldiriladi. Telefon va username mijozlarga ko‘rinadi; username `https://t.me/...` chat tugmasiga aylanadi. Hozir rasm faylini bevosita yuklash emas, ommaga ochiq HTTPS rasm havolasi ishlatiladi.

### Backend va API

- Node.js 24+; SQLite Node’ning `node:sqlite` moduli orqali.
- `/api/health` — holat, `/api/products` — faol mahsulotlar.
- `/api/session` — Telegram `initData` verifikatsiyasi va imzolangan admin sessiyasi.
- `/api/home-content` — promo/video/yangilik; admin/superadmin sessiyasi bilan save.
- `/api/staff` GET/POST, `/api/staff/:telegramId` PATCH — Super Admin-only xodim boshqaruvi.
- `/api/workers` GET — mijozlarga ko‘rinadigan faol usta profillari.
- `/api/workers/:telegramId` PUT — Super Admin-only usta profili tahriri.
- `/telegram/webhook` — Telegram bot update’lari, secret token bilan tekshiriladi.
- `backend/schema.sql` yangi jadvallarni yaratadi; katalog birinchi ishga tushishda `backend/catalog.json`dan seed bo‘ladi.

## 7. Hali tayyor bo‘lmagan / demo holatdagi qismlar

Admin interfeysida demo ko‘rinishlar bor. Quyidagilarni haqiqiy ishga tayyor deb hisoblamang:

- Mahsulotni to‘liq backenddan qo‘shish/tahrirlash, Excel import, rasm fayllarini ishonchli hostingga yuklash.
- CBU kursini avtomatik olish, narxlarni serverda qayta hisoblash va narx tarixi.
- Buyurtma yaratish, inventar, to‘lov isbotini saqlash va haqiqiy admin tasdig‘i.
- Dinamik Paynet QR/to‘lov tranzaksiyasi bilan order bog‘lash.
- Elektron nakladnoy/chek PDF chiqarish.
- Buyurtma asosida ishchini bron qilish UI/API (bazadagi atomik claim yordamchi funksiyasi mavjud, lekin barcha endpoint/flow ulanmagan).
- Admin vakolatlarini mayda ruxsatlar bo‘yicha to‘liq boshqarish, audit/monitoring UI.
- Yangiliklar uchun alohida bosiladigan URL maydoni yo‘q; video tavsiyalar esa YouTube URL oladi.
- Usta rasmi hozir to‘g‘ridan-to‘g‘ri upload emas, HTTPS manzil sifatida kiritiladi.

## 8. Eng muhim operatsion xavf: ma’lumotlar bazasi

Hozirgi loyiha `.data/texnocam.sqlite` lokal SQLite faylidan foydalanadi. Render’dagi hozirgi xizmat Free instance bo‘lgani uchun mahalliy fayl tizimi vaqtinchalik: spin-down, restart yoki redeploy’da SQLite ichidagi adminlar, ustalar, homepage kontenti va boshqa ma’lumotlar yo‘qolishi mumkin. Render Free Postgres bo‘lsa ham u muddati cheklangan; uzoq muddatli savdo uchun mos, doimiy database tanlash va SQLite’dan migratsiya qilish zarur. Haqiqiy mijoz/ishchi ma’lumotini kiritishdan avval shu bosqichni yakunlash kerak.

## 9. GitHub/Render ish tartibi

1. Lokal o‘zgarishlarni GitHub Desktop’dagi **Changes** bo‘limidan ko‘ring.
2. `Summary` maydoniga qisqa commit nomi yozing; o‘zgargan fayllar tanlangan bo‘lishi kerak.
3. **Commit … files to main** bosing, so‘ng **Push origin**.
4. Render’da `texnocam-miniapp` → **Deploys** sahifasida deploy **Live** bo‘lguncha kuting. Auto Deploy bo‘lmasa **Manual Deploy → Deploy latest commit** tanlang.
5. Eng so‘nggi kod ushbu arxiv yozilgan vaqtda `main` va `origin/main`da teng: `d078b8d` — `Ustalar katalogi va profil boshqaruvini qo‘shish`. Render’dagi commit shu hashga yetganini tekshirish kerak.
6. Telegram Mini App eski ko‘rinsa, uni to‘liq yoping/qayta oching yoki brauzerda `Ctrl+F5` qiling.
7. Health: `https://texnocam-miniapp.onrender.com/api/health`.

## 10. Muhim suhbatlar xronologiyasi

- Bot nomi variantlari muhokama qilinib, UzCam tanlangan; kamera va elektronika savdosiga mos professional ko‘rinish so‘ralgan.
- Mini App katalogi 10 ta variantdan saralanib, 06-uslub tanlangan; katalog ixcham grid, kichik ammo to‘liq ko‘rinadigan rasmlar va brend/mahsulot qidiruviga moslangan.
- Katalog EZVIZ, Hikvision, Dahua, NeoCam, Xitoy kameralar, kabel va elektronika bo‘limlariga ajratilishi kelishilgan.
- 30% ustama, so‘mda narxlash, tannarxni faqat Super Admin ko‘rishi, arzonidan sort va narx darajalari so‘ralgan.
- Savat, Paynet QR, telefon `+998`, manzil, bepul BTS pochta, 3 kunlik yetkazish haqida talablar berilgan.
- Super Admin/admin/ishchi vakolatlari, to‘lovni tasdiqlash va bron qilinadigan ish buyurtmalari ishlab chiqish rejasi sifatida belgilangan.
- Render + GitHub orqali backendni ishga chiqarish bosqichlari o‘tilgan. `api/health` va `api/products` endpointlari tekshirilgan.
- BotFather’da `@UzCambot` uchun katalog/mini-app URL bog‘langan. Botning webhook, menyu, kontent, admin chat va ustalar katalogi bosqichlari qo‘shilgan.
- Usta katalogi talabi: ism-familiya, ish staji, telefon, Telegram orqali chat, rasm, xizmat narxlari. Shu talab `worker_profiles` jadvali, API, admin formasi, mijoz kartalari va bot menyusiga bog‘langan.

## 11. Keyingi davom ettirish uchun navbat

**Eng avval:** Render deploy commit `d078b8d`ni ishlatayotganini tekshirish va Mini App’da `👷 Ustalar` bo‘limini ochish. Super Admin panelidan test/draft usta profilini qo‘shib, yashirin yoki ommaviy holatini tekshirish.

**Keyingi muhim texnik qadam:** doimiy PostgreSQL yoki boshqa mos database tanlash, barcha SQLite API/schema’ni ko‘chirish va Render Free filesystem yo‘qolish xavfini bartaraf etish. Shundan so‘ng buyurtma/to‘lov, CBU kursi, mahsulot CRUD/import va e-chek ishlarini birma-bir backendga ulash.

---

**Xavfsizlik:** bot tokeni, Paynetning maxfiy credential’lari, `.env`, karta yoki shaxsiy maxfiy kalitlarni ushbu arxivga va GitHub’ga hech qachon yozmang. Arxivda faqat kalit NOMLARI keltirilgan.


## 2026-10-26 — Supabase ulanishiga tayyorgarlik yakuni

Oracle ro‘yxatdan o‘tish muammolaridan keyin Supabase Free tanlandi; bir hafta sinovdan keyin tarif qo‘lda baholanadi. uzcam loyihasida 001-schema.sql foydalanuvchi tomonidan muvaffaqiyatli bajarildi. Render’da DATABASE_URL Session pooler (5432) manzili va baza paroli kiritildi, lekin hali saqlash/deploy tasdiqlanmagan. Maxfiy qiymatlar ushbu faylda yozilmagan.

Foydalanuvchi amaldagi Render’da faqat dastlabki katalog borligini, qo‘shimcha mahsulot/admin/usta/kontent kiritilmaganini tasdiqladi. Kod DATABASE_URL bilan PostgreSQL’ga ulanish, asinxron SQL, RLS, versiyali migratsiya va 2141 mahsulotning bir martalik seedini bajaradi. PostgreSQL uzilganda SQLite fallback yo‘q. Rasmlar PostgreSQL’da doimiy saqlanadi; ixtiyoriy SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY bilan yangi rasmlar Storage’ga yuboriladi. Ulanish /api/health da databaseEngine va imageStorage orqali ko‘rinadi.

Mahalliy tekshiruvlar: npm test — 6 test o‘tdi (PostgreSQL WASM/PGlite, import, CRUD/ruxsatlar, RLS, rasm, Telegram sessiya/staff/home/worker HTTP API, restart va xatoda yopilish). Mobile brauzer sinovi ham o‘tdi. Haqiqiy Supabase paroli/TLS ulanishi tekshirilmagan; bu Render deploydan keyingi bosqich.

Keyingi qadam: GitHub Desktop’da o‘zgarishlarni commit/push, Render’da DATABASE_URL ni Save/rebuild/deploy, health’da databaseEngine: postgres tekshirish. Ko‘rsatma: SUPABASE_UTISH_UZ.md. SQLite zaxira/import vositalari qo‘shildi, backups/ va node_modules/ Git’dan chiqarildi.

### 2026-10-26 — Supabase TLS xatosi

DATABASE_URL saqlanib deploy boshlangan, lekin Render SELF_SIGNED_CERT_IN_CHAIN bilan to‘xtadi. backend/postgres-tls.js va rasmiy CA backend/certs/ ichiga qo‘shildi. SSL tekshiruvi o‘chirilmagan. 7 mahalliy test o‘tdi. Haqiqiy pooler bilan parolsiz TLS sinovi muvaffaqiyatli, noto‘g‘ri hostname rad etildi. GitHub push va yangi Render deploy hali foydalanuvchi tomonidan bajarilishi kerak. Haqiqiy baza login/SQL/health hali tasdiqlanmagan.


## 2026-10-26 — Kategoriyalar ixchamlashtirildi

Foydalanuvchi talabi: Quvvat/UPS/Aksessuarlar bitta; Domofon/Kirish nazorati bitta; Ovozli ogohlantirish Signalizatsiyaga; Asboblar Elektronikaga. Aqlli uy’dagi mavjud 18 mahsulot foydalanuvchining aniq javobiga ko‘ra saqlanadi, yangilari qo‘lda kiritiladi.

14 kategoriya 10 taga birlashtirildi. Dastlabki katalogda jami 2141 mahsulot saqlangan. Yangi sonlar: Quvvat, UPS va aksessuarlar 219; Domofon va kirish nazorati 320; Signalizatsiya va yong‘in xavfsizligi 308; Elektronika 198; Aqlli uy 18. Boshqa bo‘limlar o‘zgarmagan.

assets/category-config.js umumiy nomlar va eski aliaslarni belgilaydi. backend/category-management.js bir martalik, tranzaksiyali migratsiya bilan faqat category_id ni almashtiradi; narx, rasm, visibility, o‘chirish holati va mahsulot ID’lari saqlanadi. Eski bo‘limlar inactive qilinadi. Migratsiya PostgreSQL va SQLite’ga qo‘llanadi; qayta deploy qo‘lda keyin o‘zgartirilgan kategoriyalarni qaytarmaydi. Katalog API kategoriya nomlarini ham beradi; admin mahsulot formasi yangi kategoriyalarni oladi, eski nom bilan so‘rov kelsa yangisiga moslanadi.

Mahalliy 9 ta test o‘tdi; 320/390/768 px brauzerda filtr sonlari, eski bo‘limlar yo‘qligi, Aqlli uy 18 ta, gorizontal toshish yo‘qligi va script xatolari tekshirildi. Preview: http://127.0.0.1:31317/#catalog (faqat shu kompyuterda, test SQLite bazasi). Jonli Supabase’da kategoriya ko‘chishi yangi commit push/deploydan keyin bajariladi.


## 2026-10-26 — Ikonkali filtrlar va aloqa telefoni

Brend va narx selectlari ixcham bitta qatorga almashtirildi: chapda Brend ikonka, o‘ngda Filtr ikonka, o‘rtada foydalanuvchi tasdiqlagan +998 50 855 41 87 telefon raqami (tel: havola). Brend oynasida qidiruv va brend tugmalari, narx oynasida arzonidan/arzon/o‘rtacha/qimmat tanlovlari bor. Tanlangan filtrlar kichik yozuvda ko‘rinadi. Escape/tashqariga bosish bilan yopiladi; narx tanlovida klaviatura strelkalari ishlaydi.

assets/catalog-controls.js ochilish, tanlash, yopilish va telefon formatini boshqaradi. Mavjud katalog qidiruvi va narx saralash mantiqi saqlandi. Bosh sahifa kontentiga contactPhone qo‘shildi; server raqamni tekshiradi va E.164 formatida saqlaydi. Admin panel → Bosh sahifa kontenti → Promo banner va aloqa → Aloqa telefon raqami orqali o‘zgartiriladi. Bo‘sh qoldirish telefonni yashiradi. Eski klient contactPhone yubormasa saqlangan raqam saqlanib qoladi.

9 ta avtomatik test (shu jumladan aloqa raqamining validatsiya, saqlash, bo‘shatish va restartdan keyingi holati) o‘tdi. Brauzerda 320/390/768 px bo‘yicha menyular, qidiruv, narx, reset, keyboard, tel havola va sig‘ish tekshirildi. Mahalliy preview o‘sha 31317 portda. O‘zgarishlar hali GitHub push/deploy talab qiladi; kategoriya birlashtirish o‘zgarishlari ham shu ishchi papkada turibdi.


## 2026-10-30 — Mahsulot oynasi, katalog rasmlari va deploy yakuni

### Amaldagi loyiha va manbalar
- Brend: UzCam; GitHub repozitoriy nomi o‘zgarmagan: `yarashev/texnocam-miniapp`, asosiy tarmoq `main`.
- Jonli sayt: https://texnocam-miniapp.onrender.com/ ; katalog bo‘limlari: `#catalog-categories`.
- Render xizmati: `texnocam-miniapp`; `main`ga commit kelganda avtomatik deploy yoqilgan.
- Oxirgi jonli texnik commit: `ca9d5c460d8c52b8a8ffb700ad6b52e37600731b` — reviewed product images delivery/cache va ixcham rasm o‘lchamlari.
- Render deploy `dep-dbi65p8473hc73ems9l0` LIVE holatida tekshirildi. `/api/health`: database connected, PostgreSQL va PostgreSQL image storage.
- Arxivga keyin qo‘shilgan faqat hujjat commitlari `[skip render]` bilan yuborilishi mumkin; ular jonli texnik commitdan oldinda bo‘lishi normal.

### Mahsulot oynasi
- Katalog kartasini bosish yoki klaviatura orqali ochish: katta rasm, model, brend, kategoriya, mavjud tavsif va sotuv narxi.
- Rasm bosilganda to‘liq kattalashtirish oynasi ochiladi.
- Pastda doim ko‘rinadigan “Savatga qo‘shish” tugmasi.
- Pastga surilganda 12 tagacha o‘xshash mahsulot; ularni ochish va savatga qo‘shish mumkin.
- `assets/product-detail.js` va `assets/product-detail.css` boshqaradi.
- Katalogdagi rasm joyi 110–150 px; mahsulot oynasida 190–260 px. User talabi: rasm joyi juda katta bo‘lmasin; PNG ham mumkin.
- Rasm asl nisbatida ko‘rsatiladi. Grid ichidagi rasmning ortiqcha cho‘zilishi aniq chegaralar bilan tuzatildi.

### Barcha rasmlar bo‘yicha tekshiruv (30.10.2026 dagi snapshot)
Jami 2142 ta ommaviy mahsulot tekshirildi:
- 2050 ta almashtirish tayyorlangan va saytga chiqarilgan: 7 ta lokal 600×600 EZVIZ PNG va 2043 ta tekshirilgan manba rasmi.
- 11 ta mavjud, yaxshiroq yoki admin tanlagan rasm saqlangan.
- 81 ta hal etilmagan holat qo‘lda tekshirish ro‘yxatiga ajratilgan: aniq model/manba topilmagan, rasm kichik, manba ochilmagan, variant noaniq yoki rasm modelga mos emas.
- Manbalar: EZVIZ rasmiy platformasi, TP-Link/Tapo rasmiy platformasi va KSS ochiq distribyutor katalogi. Aniq model, MP/variant va to‘plam sonini saqlash muhim; taxminiy boshqa model rasmi qo‘yilmaydi.
- User ruxsati: sifati yaxshi va modeli mos mavjud rasmlarni tekshirib, o‘z holida qoldirish mumkin.
- Kirill model nomlari bir-biriga aralashmasligi va adminning mustaqil yuklagan rasmi almashtirilmasligi testlarda tekshirildi.
- Linkff switch ID 884 va 885 uchun yetkazib beruvchi manbasidagi rasm noto‘g‘ri; bu almashtirishlar rad etilgan. ID 77 CPU-card uchun mavjud rasm ham qo‘lda tekshirishga ajratilgan.
- To‘liq holatlar, manbalar, o‘lchamlar va SHA-256: `assets/product-image-audit.json`.
- Qo‘shimcha rasmiy/qo‘lda tekshirilgan manbalar: `assets/official-products/reviewed-sources.json`.
- 7 lokal PNG va ularning manbalari: `assets/official-products/`.
- Xaritalash: `assets/reviewed-product-images.js`, `assets/product-images.js`.
- Qayta tekshirish/yig‘ish skriptlari: `scripts/audit-product-images.py`, `scripts/build-product-image-map.py`; Python Pillow va requests kerak. Xom kataloglar va yuklash keshi faqat Git’dan chiqarilgan `.data/image-review`da.

### Rasm yetkazishdagi topilgan muammo va tuzatish
Dastlabki deployda ayrim tashqi rasm manbalari brauzerda ochilmadi va past sifatli eski rasmga qaytdi. Shu sababli yakuniy versiya rasmlarni to‘g‘ridan-to‘g‘ri uchinchi tomon saytiga hotlink qilish o‘rniga saytning o‘z endpointi orqali beradi:
- `GET /api/reviewed-product-images/:id/:sha256Prefix`.
- Faqat oldindan tasdiqlangan model/manba ro‘yxatidagi HTTPS manzillar; erkin URL-proxy emas.
- SHA-256 tekshiruvi, rasm formati/hajmi chegarasi, redirectni rad etish, timeout, parallel yuklash va navbat chegaralari.
- 32 MiB bilan chegaralangan xotira keshi va bir xil rasm uchun birgalikdagi yuklash; fayl tizimiga doimiy saqlash talab qilinmaydi.
- Manba ochilmasa eski rasmga bir marta qaytadi; admin tanlagan rasmlar ustuvor.
- `backend/reviewed-images.js` va `server.js` endpointni boshqaradi.
- Jonli brauzerda Hikvision ID 196 va 175 ning 800 px rasmlari yuklangani, katalogdagi ko‘rinadigan rasm balandligi 148 px ekani tekshirildi.
- HTTP tekshiruv: ID 196 — 800×605, ID 175 — 800×800, Tapo ID 1557 — 590×590; barchasi 200 va kutilgan checksumga mos.
- Mahsulot narxlari, ID’lari va database’dagi admin rasm tanlovlari qayta yozilmagan.

### 81 model uchun qo‘lda ishlash PDF
- Fayl: `UzCam_81_model_tekshiruv.pdf`.
- 9 sahifa; 81 modelning raqami, mahsulot ID, brend, to‘liq model va tekshirish sababi.
- Har mahsulotga “Yangi rasm havolasi / izoh” tahrirlanadigan maydon va “OK” checkbox: jami 162 ta interaktiv maydon.
- PDF’ni kompyuterda to‘ldirish yoki chop etib qo‘lda belgilash mumkin. Tayyor fayl foydalanuvchiga berilgan.
- Ro‘yxatni keyin qayta yaratishda statuslardan quyidagilarni chiqarib tashlash kerak: `replacement-ready`, `replacement-ready-local`, `keep-existing-quality`, `keep-source-not-better`, `keep-custom-image`. Ushbu snapshotda qolganlari aniq 81 ta.
- Keyingi muhim ish: shu 81 modelning aniq rasm/variantlarini qo‘lda tekshirish, topilgan rasmlarni mahsulot ID bo‘yicha joylash va statuslarni yangilash.

### Tekshiruv va davom ettirish
- Yakuniy `npm test`: 41 ta test muvaffaqiyatli. UI’da yangi rasmlar, mahsulot ma’lumotlari va ixcham ko‘rinish tekshirildi.
- PR #5 (mahsulot oynasi) va PR #6 (butun katalog rasmlari) main’ga birlashtirilgan. Rasm yetkazishning yakuniy tuzatishi yuqoridagi `ca9d5c4` commitida.
- Keyingi suhbatda ushbu arxiv va joriy repository holatini o‘qib davom etish kerak. Eski arxiv bosqichlari keyingi yangilanishlar bilan eskirgan bo‘lishi mumkin.
- Bot tokeni, DATABASE_URL, parollar yoki boshqa maxfiy ma’lumotlarni arxivga/GitHub’ga qo‘shmang.

