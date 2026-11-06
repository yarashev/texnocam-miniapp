# UzCam — ish rejasi va tizim arxitekturasi

## Maqsad

Telegram Mini App, Android ilova va admin panel bir xil backend hamda bitta markaziy PostgreSQL bazasi bilan ishlaydi. Hozir AI API ulanmaydi: keyinchalik alohida adapter/modul orqali qo‘shiladi, AI ishlamasligi asosiy savdo jarayonlarini to‘xtatmasligi kerak.

## O‘zgarmas xavfsizlik qoidalari

1. Ishlar alohida feature branchda bajariladi; `main` ga bevosita yozilmaydi.
2. Production bazaga migratsiya yoki ma’lumot o‘chirishdan oldin backup, migratsiya rejasi va qaytarish rejasi talab qilinadi.
3. Telegram `initData` serverda tekshiriladi. Frontend yuborgan Telegram ID yoki rolga ishonilmaydi.
4. Tannarx, moliya va xodimlarning shaxsiy ma’lumotlari faqat kerakli rolga ochiladi.
5. Har bir muhim o‘zgarish audit jurnaliga yoziladi.
6. AI yoki avtomatik agent keyinchalik ham to‘lov, narx, o‘chirish va xodim huquqlarini inson tasdig‘isiz o‘zgartirmaydi.
7. Maxfiy kalitlar faqat server environment sozlamalarida turadi.

## Ma’lumotlar oqimi

```text
Android ilova ─┐
Telegram Mini App ─┼── HTTPS API ── Backend ── PostgreSQL
Admin panel ─────┘                   ├── Rasm ombori
                                     ├── Telegram Bot
                                     └── Audit / monitoring
```

Barcha klientlar bir xil API kontraktidan foydalanadi. Klientlar bir-biriga yoki bazaga to‘g‘ridan-to‘g‘ri ulanmaydi.

## Admin panel navigatsiyasi

| Guruh | Bo‘lim | Holat / keyingi ish |
|---|---|---|
| Umumiy | Dashboard | Haqiqiy bazadan KPI va oxirgi buyurtmalarni chiqarish |
| Savdo | Buyurtmalar va to‘lovlar | API mavjud; oqim va UI sinovdan o‘tkaziladi |
| Katalog | Mahsulotlar | CRUD mavjud; saqlash va ruxsatlar sinovi |
| Katalog | Brendlar va kategoriyalar | Brend API mavjud; kategoriyalar UI to‘liq ulanmagan |
| Katalog | Narxlar va valyuta | Ustama mavjud; CBU kursini olish keyingi ish |
| Mijozlar | Mijozlar va murojaatlar | Hozirgi ayrim ekranlar demo; haqiqiy API bilan almashtirilmaguncha demo deb belgilanadi |
| Xodimlar | Adminlar va ustalar | Xodim API mavjud; usta buyurtma bron qilish oqimi to‘liq ulanmagan |
| Ombor | Qoldiq, kirim, chiqim, rezerv | Hozircha qurilmagan; alohida DB modeli va API kerak |
| Hisobotlar | Savdo, foyda, xodim samaradorligi | Hozircha qisman; faqat mavjud ma’lumotdan hisoblanadi |
| Tizim | Rollar, audit, backup, integratsiyalar | Ruxsatlar va audit bazasi mavjud; boshqaruv UI bosqichma-bosqich |
| AI (keyin) | Admin yordamchi, mahsulot aniqlash, konsultant, kuzatuv | API hozir ulanmaydi; keyingi bosqich |

## Amalga oshirish bosqichlari

### 0. Poydevor va tekshiruv
- Repository, API route, DB schema, migratsiya, deploy va test holatini xaritalash.
- CI orqali Node 24.15 da syntax check va testlarni avtomatik ishga tushirish.
- Demo ekranlarni haqiqiy funksiyalardan aniq ajratish.

### 1. Bitta ma’lumotlar bazasi
- PostgreSQL/Supabase production ulanishini tekshirish.
- Jadvallar, foreign key, indeks, tranzaksiya, RLS va auditni tekshirish.
- SQLite backup/import yo‘lini faqat zarurat bo‘lsa ishlatish; mavjud ma’lumot ustiga import qilmaslik.

### 2. Backend kontraktlari
- Mijoz, buyurtma, to‘lov, xodim, usta va katalog API’larini yakunlash.
- Role-based access control va server-side validation.
- Ombor harakatlari uchun tranzaksiyali model va audit.

### 3. Admin panel
- Navigatsiyani vazifalar bo‘yicha guruhlash.
- Demo ma’lumotlarni olib tashlash; API ulanmagan bo‘limlarni aniq belgilash yoki vaqtincha yashirish.
- Dashboardni real DB agregatlariga ulash.
- Mobil ekranda ham boshqarish imkonini tekshirish.

### 4. Klientlar
- Telegram Mini App va Android uchun bitta API.
- Session, xatolik, offline/timeout va versiya mosligini tekshirish.

### 5. Sifat va deploy
- Unit/integration test, xavfsizlik va ma’lumot yaxlitligi tekshiruvi.
- Preview/staging deploy; health check va real smoke test.
- Production deploy faqat backup va rollback tayyor bo‘lganda.

### 6. AI integratsiyasi (keyin)
- AI provider adapter, limit, xarajat nazorati va audit.
- AI taklif beradi; xavfli amallar uchun inson tasdig‘i shart.

## Hozirgi auditdan aniqlangan holat

- Backend Node.js; PostgreSQL konfiguratsiyasi bo‘lsa PostgreSQL, aks holda lokal SQLite ishlatadi.
- PostgreSQL mavjud bo‘lganda xato yuz bersa SQLite’ga yashirin fallback qilinmaydi.
- Telegram session tekshiruvi va admin/worker rollari mavjud.
- Katalog CRUD, mahsulot rasmi, xodim boshqaruvi, promo kontent, buyurtma ro‘yxati va to‘lov tasdig‘i uchun backend yo‘llari mavjud.
- Admin HTML ichida statik demo KPI, mijoz/murojaat jadvali va ishchi bron qilish simulyatsiyasi bor. Ularni real ma’lumot sifatida ko‘rsatmaslik kerak.
- README’da buyurtma/to‘lov/ustalar/valyuta va ayrim admin jarayonlari hali demo yoki tugallanmagan deb ko‘rsatilgan. Kod va hujjat bir-biriga moslashtiriladi.

Bu hujjat ish davomida yangilanadi; undagi “mavjud” degani production’da tasdiqlangan degani emas — deploydan keyin alohida smoke test kerak.
