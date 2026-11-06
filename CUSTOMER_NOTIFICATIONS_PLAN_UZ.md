# UzCam — mijozlar uchun Telegram xabarnoma tizimi (2-variant)

## Maqsad
Buyurtma va to'lov holatlaridagi muhim o'zgarishlarni mijozga Telegram bot orqali shaxsiy yuborish, Mini App ichida xabarlar tarixini ko'rsatish va yetkazilmagan xabarlarni navbatda saqlab qayta yuborish.

## Audit xulosasi (2026-11-06)
- `POST /api/orders` buyurtmani `orders`, `order_items`, `payments` jadvallariga tranzaksiya ichida yozadi.
- Mijoz Telegram ID `users.telegram_id` da mavjud; Telegram Mini App initData serverda tekshiriladi.
- Yangi buyurtma haqida Super Adminga `sendMessage` yuboriladi.
- Buyurtma yaratilganda mijozga avtomatik shaxsiy xabar yuborilmaydi.
- Botning `/start` handleri hozircha menyu ko'rsatadi, lekin mijozning bot orqali xabar olishga tayyorligini bazada qayd etmaydi.
- `support_threads` va `support_message_links` admin bilan ikki tomonlama yozishma uchun ishlaydi; bu buyurtma xabarnomalaridan alohida qoladi.
- Buyurtma/to'lov holati va admin endpointlari mavjud; xabarnoma triggerlari ularning tranzaksiya va yakuniy holatiga bog'lanishi kerak.
- SQLite va PostgreSQL (Supabase) bir xil schema/migration yo'lini qo'llaydi. Yangi jadvallar ikkala DB uchun ham qo'shilishi shart.

## Xabarnoma hodisalari
1. `order_created` — buyurtma qabul qilindi.
2. `order_confirmed` — buyurtma admin tomonidan tasdiqlandi (amaldagi status modelida qaysi o'tish tasdiq ekanini audit bilan aniqlab bog'lash).
3. `payment_confirmed` — to'lov tasdiqlandi.
4. `payment_rejected` — to'lov rad etildi.
5. `order_preparing` — buyurtma tayyorlanmoqda (status o'tishi mavjud bo'lsa).
6. `order_out_for_delivery` — yetkazishga chiqarildi (status o'tishi mavjud bo'lsa).
7. `order_completed` — buyurtma yakunlandi.
8. `order_cancelled` — buyurtma bekor qilindi.

Faqat real mavjud status o'tishlari trigger qilinadi. Hozirgi modelda `pending_payment`, `paid`, `assigned`, `in_service`, `completed`, `cancelled` hamda payment `pending`, `proof_submitted`, `confirmed`, `rejected`, `refunded` qiymatlari bor. "Tayyorlanmoqda"/"yetkazilmoqda" uchun alohida statuslar kerak bo'lsa, bu alohida schema/UI o'zgarishi sifatida baholanadi; mavjud statuslarni noto'g'ri talqin qilmaymiz.

## Arxitektura
### 1. Telegramga ruxsat/opt-in
- `/start` yoki `/start <payload>` kelganda Telegram private chat ID ni tekshirib, mijozning bot bilan aloqa boshlaganini DBda qayd etish.
- Bot mijozga birinchi bo'lib yozolmaydi: mijoz botni avval ishga tushirishi kerak.
- Bot bloklangan yoki chat mavjud bo'lmasa, xabarnoma `failed` holatida qoladi; sabab va qayta urinish siyosati yoziladi.
- Telegram ID ni mijozning ishonchli Mini App initData identifikatori bilan moslashtirish; faqat client yuborgan IDga ishonmaslik.

### 2. Outbox / xabarnoma tarixi
Yangi `notifications` jadvali:
- id, customer_id, order_id, event_type, channel, message_text/payload_json
- status: pending/sending/sent/failed
- attempts, next_attempt_at, last_error, created_at, sent_at
- idempotency_key UNIQUE — bir status o'tishi uchun dublikat xabarni oldini olish.

Xabarnoma yozuvi biznes tranzaksiyasi bilan bir DB tranzaksiyada yaratiladi. Telegram API chaqiruvi tranzaksiyadan tashqarida bajariladi. Shuning uchun Telegram vaqtincha ishlamasa ham xabar yo'qolmaydi.

### 3. Yetkazish va qayta urinish
- Pending navbatni serverdagi xavfsiz worker qayta ishlaydi.
- Telegram API javobini tekshirish; token/chat ID yoki bloklash xatolarini qayd etish.
- Vaqtinchalik xatolarda chegaralangan exponential backoff; doimiy xatolarda failed holat.
- Bir xabarning parallel ikki marta yuborilishiga qarshi atomar claim va idempotency.
- Muvaffaqiyatli yuborilganda sent_at yozish.
- Render restartida pending xabarlar DBdan davom ettiriladi.

### 4. Mini App xabarlar tarixi
- Telegram initData bilan himoyalangan `GET /api/notifications` endpointi.
- Faqat joriy Telegram foydalanuvchisining xabarlari qaytariladi; boshqa mijoz ID sini so'rovdan qabul qilmaydi.
- O'qilgan/o'qilmagan holati uchun `read_at` (yoki is_read) maydoni.
- Mini App profil yoki buyurtmalar bo'limida xabarlar ro'yxati, vaqt va buyurtma raqami ko'rsatiladi.

### 5. Trigger nuqtalari
- `POST /api/orders`: order yaratish tranzaksiyasida `order_created` outbox yozuvi.
- Payment confirm/reject endpointi: holat muvaffaqiyatli o'zgargan tranzaksiyada tegishli event.
- Buyurtma statusini o'zgartiruvchi admin/worker endpointlari: faqat haqiqiy oldingi→yangi status farqi bo'lsa event.
- Mavjud Super Admin xabari saqlanadi; mijoz xabarnomasi unga qo'shimcha bo'ladi.

## Xavfsizlik va ma'lumotlar
- Bot token faqat server envda qoladi.
- Mini App endpointi initData HMAC tekshiruvisiz ishlamaydi.
- Mijoz faqat o'z notification tarixini ko'radi.
- Xabar matniga maxfiy to'lov isboti yoki keraksiz shaxsiy ma'lumotlar kiritilmaydi.
- Arxiv/saqlash siyosati bilan muvofiqlashtirish; operatsiyalar arxivining 2 yillik talabini o'zgartirmaslik.

## Amalga oshirish bosqichlari
1. Audit va status xaritasi — bajarildi (dastlabki kod auditi; status endpointlari bo'yicha testlar bilan yakuniy tasdiq kerak).
2. SQLite + PostgreSQL schema/migration va notification outbox moduli.
3. Telegram /start opt-in va queue worker/retry.
4. Buyurtma/to'lov/status triggerlari.
5. Himoyalangan Mini App tarix API va mobil interfeys.
6. Unit/integration testlar: dublikat, /start bo'lmagan, Telegram 429/5xx, bot bloklangan, retry, foydalanuvchilararo ma'lumot ajratilishi.
7. PR ko'rigi; alohida tasdiqsiz merge yoki deploy qilinmaydi.

## Qabul mezonlari
- Mijoz /start qilgan bo'lsa, buyurtma yaratilganda shaxsiy Telegram xabar oladi.
- /start qilmagan bo'lsa, buyurtma baribir saqlanadi va xabarnoma pending/failed holatida ko'rinadi; buyurtma API yiqilmaydi.
- Payment confirm/reject va real status o'zgarishlari bitta marta xabar beradi.
- Telegram API vaqtincha ishlamasa, xabar yo'qolmaydi va retry qilinadi.
- Mini App faqat joriy foydalanuvchining xabarlarini ko'rsatadi.
- SQLite va PostgreSQL testlari o'tadi.
- Deploy faqat alohida foydalanuvchi ko'rsatmasidan keyin.
