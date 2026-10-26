# UzCam: Supabase ulanishi

Holat: kod tayyor. DATABASE_URL bo‘lsa backend PostgreSQL ishlatadi; bo‘lmasa eski SQLite rejimi ishlaydi. Supabase’ga haqiqiy ulanish Render deploy’dan keyin tekshiriladi.

## Hozirgi loyiha uchun ishga tushirish

Foydalanuvchi amaldagi Render’da faqat dastlabki katalog borligini tasdiqladi. Shuning uchun yangi Supabase bazasi backend/catalog.json dagi 2141 mahsulot bilan birinchi ishga tushishda to‘ldiriladi. Mahsulot ID’lari saqlanadi. Keyingi ishga tushishlarda tahrirlar ustiga dastlabki katalog qayta yozilmaydi.

1. GitHub Desktop’da shu loyiha o‘zgarishlarini commit qiling va Push origin bosing. Summary: Supabase bazasiga ulanish qo‘shildi.
2. Render Environment’da DATABASE_URL qiymatida Session pooler URI va haqiqiy, URL formatiga kodlangan baza paroli borligini tekshiring. 5432 port ishlatiladi. Havolani chat yoki GitHub’ga yubormang.
3. Save, rebuild, and deploy bosing. Build command npm install yoki npm ci bo‘lsin; Start command npm start.
4. /api/health ni oching. databaseEngine: postgres va database: connected chiqishi kerak. imageStorage: postgres chiqsa yangi rasmlar ham PostgreSQL’da saqlanadi.
5. Telegram’da botdan Mini App’ni oching, Super Admin sifatida mahsulot tahrirlang, rasm yuklang, xodim qo‘shib ko‘ring. Render’da qayta deploy qilib ma’lumotlar saqlanganini tekshiring.

TELEGRAM_BOT_TOKEN va SUPER_ADMIN_TELEGRAM_ID o‘z qiymatlari bilan qoladi. Parollar yoki tokenlar frontendga qo‘yilmaydi. /api/health ulanishni har so‘rovda tekshiradi. PostgreSQL ishlamasa server bo‘sh SQLite bazasiga o‘tmaydi.

## Rasmlar

Faqat DATABASE_URL bilan ham yangi rasmlar product_image_files jadvalida doimiy saqlanadi va /uploads/ orqali beriladi. Bu rasmlar Supabase bazaning hajm limitini ishlatadi. GitHub’dagi katalog rasmlari assets/ papkasida qoladi.

Alohida Supabase Storage uchun Render’da quyidagi ikkita server sozlamasini birga qo‘shish mumkin:

- SUPABASE_URL — Supabase loyiha HTTPS URL manzili.
- SUPABASE_SERVICE_ROLE_KEY — faqat server uchun service_role yoki server secret key; anon/publishable kalit emas.
- SUPABASE_STORAGE_BUCKET — ixtiyoriy, odatda product-images.

product-images ombori oldingi 001-schema.sql bilan yaratilgan. Public bucket faqat mahsulot rasmlari uchun; to‘lov isbotlarini unga qo‘ymang. Kalit sozlansa yangi yuklashlar Storage API orqali bajariladi. Storage xatosida yashirincha vaqtinchalik diskka yozilmaydi. Avval PostgreSQL’da saqlangan rasmlar o‘z havolalari bilan ochilaveradi. Ular avtomatik Storage’ga ko‘chirilmaydi.

## Ma’lumotli SQLite bazani ko‘chirish kerak bo‘lsa

Deploydan OLDIN eski bazaning o‘z muhitida npm run backup:sqlite -- backups/uzcam.json buyrug‘ini ishga tushiring va zaxirani tashqariga saqlang. UZCAM_DATA_DIR eski ma’lumotlar joyini ko‘rsatadi. Eksport ma’lumotlarni SQLite read transaction ichida izchil oladi; yozishni vaqtincha to‘xtatib, rasmlar ham yakunlanganiga ishonch hosil qiling. Zaxira ichida shaxsiy ma’lumot va tannarx bo‘lishi mumkin, GitHub’ga chiqarmang.

Yangi, hali katalog yuklanmagan PostgreSQL bazasi uchun DATABASE_URL bilan npm run import:postgres -- <private-backup.json> ni ishga tushiring. Import faqat bo‘sh bazaga bajariladi; mavjud mahsulot/foydalanuvchilar ustiga yozilmaydi. Xato bo‘lsa barcha yozuvlar tranzaksiya bilan bekor qilinadi. Importdan keyin UZCAM_IMPORT_FILE env’ini olib tashlang. Server shu bazani ishga tushirib ishlatadi. Backup mahsulot ID’lari, tannarx, xodimlar, sozlamalar, chat bog‘lanishlari va uploads rasmlarini saqlaydi.

Render Free eski disk fayllarini restart/redeploydan keyin yo‘qotishi mumkin. Ushbu vositalar allaqachon yo‘qolgan ma’lumotni tiklay olmaydi.

## Tekshiruvlar

npm test: PostgreSQL dvigateli (PGlite) ichida sxema, 2141 mahsulot importi, ID sequence, CRUD, tannarx ruxsatlari, parallel dublikatlar, tranzaksiya rollback, RLS/anon/authenticated cheklovlari, rasm saqlash va qayta initialization tekshiriladi. Storage API testi mahalliy soxta HTTP javoblari bilan kontraktni tekshiradi; haqiqiy Supabase Storage integratsiyasi emas. Haqiqiy Supabase TLS/parol ulanishi Render’da tekshirilishi kerak.

Bir haftalik Free sinovda Database/Storage sarfi va bot javob vaqtini kuzating. Supabase pullik bo‘lishi Render Free uyqusini bekor qilmaydi. Rejani bir hafta oxirida qo‘lda baholaymiz; avtomatik pullik obuna yoki reminder sozlanmagan.

Rasmiy manbalar:
https://supabase.com/docs/guides/database/connecting-to-postgres
https://supabase.com/docs/guides/storage/security/access-control
https://node-postgres.com/features/transactions
