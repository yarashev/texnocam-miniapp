# UzCam — Narx boshqaruvi talablari
Sana: 2026-10-30
Holat: foydalanuvchi talabi qayd etilgan; ushbu hujjat yangi funksiyalar ishlayotganini anglatmaydi. Joriy ish muhiti unavailable bo‘lgani uchun amalga oshirish va sinash yakunlanmagan.

## Foydalanuvchi so‘rovi
Super Admin katalogning asosiy narxiga qo‘shiladigan ustamani belgilaydi. Dastlabki ustama 30%. Foiz saqlanganda tegishli mahsulotlar narxlari avtomatik o‘zgaradi. Admin panelda har kategoriya/bo‘lim uchun alohida foiz va qo‘lda narx kiritishga mo‘ljallangan alohida bo‘lim bo‘lishi kerak.

## Amaldagi koddan aniqlangan holat
- backend/pricing.js: 0–300% ustamani tekshirish, sourcePrice × rate × (1 + markup / 100) hisoblash mavjud.
- server.js: Super Admin-only GET/PUT /api/settings/pricing mavjud. PUT manba narxi va kursi mavjud, o‘chirilmagan mahsulotlarni qayta hisoblaydi.
- backend/product-manager.js: mahsulotni manba narxi yoki qo‘lda sotuv narxi bilan saqlash bor. Tannarx oddiy admin va mijozdan yashiriladi.
- Kategoriya bo‘yicha alohida ustama siyosati va yagona to‘liq narx boshqaruvi oynasi hali qo‘shilmagan.
- Boshlang‘ich katalogning aksar source_price qiymatlari bo‘sh. Amaldagi sotuv narxlari allaqachon ustamali bo‘lishi mumkin. Sotuv narxini qayta “asosiy narx” deb olish yoki uni taxminiy 1.3 ga bo‘lib tannarx deb yozish mumkin emas.

## Amalga oshirish uchun kelishilgan yo‘nalish
1. Admin panelda faqat Super Adminga ko‘rinadigan “Narx boshqaruvi” bo‘limi.
2. Umumiy ustama: standart 30%; foizni tekshirish va saqlash.
3. Har bir faol kategoriya/bo‘limga mustaqil foiz; bo‘sh qoldirilsa umumiy foizdan foydalanish.
4. Alohida “Qo‘lda narx” oynasi: model/ID orqali qidirish, asosiy katalog narxi, hisoblangan sotuv narxi va yakuniy qo‘lda sotuv narxini ajratib ko‘rsatish.
5. Ustuvorlik: qo‘lda belgilangan yakuniy narx > kategoriya foizi > umumiy foiz.
6. Qo‘lda belgilangan narxni foiz yangilanishi bosib ketmasligi. Avtomatik rejimga qaytarish ochiq amal bo‘lishi.
7. Saqlashdan oldin nechta mahsulot o‘zgarishi va eski/yangi narxlar ko‘rsatiladigan oldindan hisoblash.
8. Asosiy narxi yo‘q mahsulotlar alohida sanaladi va ro‘yxatda ko‘rsatiladi; ularga taxminiy narx hisoblanmaydi.
9. Qayta hisoblash har doim asosiy narxdan boshlanadi. Ustama oldingi ustama ustiga qo‘shilmaydi.
10. Misol: asosiy narx 100 000 so‘m, ustama 30% -> sotuv 130 000 so‘m. Foiz 40% bo‘lsa sotuv 140 000 so‘m bo‘ladi.
11. Sozlamalar va qayta hisoblash bitta tranzaksiyada; parallel mahsulot/ustama tahrirlari bir-birini buzmasligi kerak.
12. O‘zgarish tarixida kim, qachon, qaysi qoida yoki mahsulotni va eski/yangi sotuv narxini o‘zgartirgani saqlanishi.
13. Mijoz va oddiy admin API javobiga tannarx, kurs va maxfiy ustama tafsilotlari chiqmasligi.
14. Oldin tasdiqlangan buyurtma/order snapshot narxlari o‘zgarmasligi.

## Tekshiruvlar
- Super Admin ruxsatlari; oddiy admin va mijoz narx qoidalarini o‘zgartira olmaydi.
- Umumiy 30%, kategoriya override, override olib tashlash va qo‘lda narx ustuvorligi.
- Takroriy saqlash ustamani ko‘paytirib yubormasligi.
- Asosiy narx yo‘q holat, valyuta kursi, bo‘sh/manfiy/yaroqsiz foiz va narxlar.
- Tranzaksiya rollback, parallel o‘zgarishlar, restartdan keyingi saqlanish.
- PostgreSQL va SQLite; mavjud katalog, savat va buyurtma testlari.
- Admin interfeysi va mijoz katalogida yakuniy narx tekshiruvi.

## Davom ettirish
Avval joriy main va loyiha arxivini o‘qish, ish muhitini tiklash, keyin kodni alohida branchda amalga oshirib test qilish. Ushbu talabni mavjud narxlar o‘zgartirildi yoki yangi panel tayyor deb talqin qilmang.
