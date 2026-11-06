# UzCam — 2 yillik operatsiyalar arxivi

## Tasdiqlangan talablar
- Buyurtma va to'lov operatsiyalari 2 yil saqlanadi.
- Arxivda tasdiqlangan va tasdiqlanmagan/rad etilgan/bekor qilingan yozuvlar alohida filtrlab ko'rsatiladi.
- 2 yil muddati operatsiyaning `created_at` sanasidan hisoblanadi.
- 2 yil to'lgach operatsiya yozuvlari va ularga tegishli bog'langan yozuvlar butunlay o'chiriladi.
- Arxiv yozuvlarini oddiy admin tahrirlay olmaydi; har qanday ruxsat etilgan boshqaruv amali auditga yoziladi.
- Arxiv qidiruvi sana, buyurtma raqami, mijoz, to'lov holati va buyurtma holati bo'yicha ishlaydi.
- Arxivni ko'rish faqat admin/super_admin sessiyasi bilan ruxsat etiladi.

## Hozirgi bazadan aniqlangan tuzilma
- `orders`: buyurtma va mijoz/delivery ma'lumotlari.
- `order_items`: buyurtma tarkibi; `orders` o'chirilganda cascade bilan o'chadi.
- `payments`: to'lov yozuvi; `orders` o'chirilganda cascade bilan o'chadi.
- `work_claims`: buyurtmaga bog'langan ish biriktiruvi; cascade bilan o'chadi.
- `audit_log`: buyurtma raqami `entity_id` orqali qayd etilgan tarix; FK yo'q, shuning uchun tozalashda alohida o'chirilishi kerak.

## Arxiv tasnifi
- Tasdiqlangan: `payment_status = 'confirmed'` yoki yakunlangan operatsiya holati.
- Tasdiqlanmagan: `pending`, `proof_submitted`, `rejected`, `refunded`, `cancelled` va hali tasdiqlanmagan buyurtmalar.
- Asl `status` va `payment_status` qiymatlari o'zgartirilmaydi; arxiv bo'limi ularni guruhlab ko'rsatadi.

## Xavfsiz saqlash va o'chirish
- SQLite va PostgreSQL uchun bir xil retention xatti-harakati bo'lishi shart.
- Tozalash tranzaksiya ichida, partiyalar bilan bajariladi; faqat `created_at < cutoff` yozuvlar olinadi.
- Buyurtma raqami bo'yicha tegishli `audit_log` yozuvlari ham birga o'chiriladi.
- Tozalash takroran ishga tushsa ham xavfsiz/idempotent bo'lishi kerak.
- Ishga tushish vaqti, o'chirilgan yozuvlar soni va xatolar maxfiy ma'lumotlarsiz server logiga yoziladi.
- Har kuni bir marta tekshirish; server qayta ishga tushsa, o'tkazib yuborilgan muddatni keyingi ishga tushishda qoplaydi.
- Faqat buyurtma/to'lovga tegishli ma'lumotlar o'chiriladi; mijoz akkaunti, katalog, xodimlar va boshqa mustaqil ma'lumotlar o'chirilmaydi.
- Chek/rasm fayllari uchun alohida private storage tozalash adapteri kerak bo'ladi. Hozirgi schema'da `payments.proof_path` bor, lekin amaldagi chek yuklash oqimi tasdiqlanmadi; mavjud bo'lmagan fayl saqlash mexanizmi taxmin qilinmaydi.

## Qabul mezonlari
1. Tasdiqlangan va tasdiqlanmagan arxiv filtrlari to'g'ri natija qaytaradi.
2. Oddiy mijoz arxiv API'siga kira olmaydi; admin bo'lmagan sessiya 403 oladi.
3. 2 yildan yangi operatsiyalar hech qachon o'chirilmaydi.
4. 2 yildan eski buyurtma, item, payment, work_claim va bog'liq audit yozuvlari bitta tranzaksiyada o'chadi.
5. Chegara sanasidagi yozuvlar aniq cutoff qoidasi bilan test qilinadi.
6. SQLite va PostgreSQL testlari o'tadi.
7. Tozalash xatosi server ishga tushishini buzmaydi va keyingi urinishda davom etadi.
8. Mavjud eski buyurtmalar uchun migratsiya ma'lumot yo'qotmaydi.

## Amalga oshirish tartibi
1. Versioned PostgreSQL migration va SQLite additive schema.
2. Retention service + testlar.
3. Himoyalangan admin archive API.
4. Admin panelda arxiv bo'limi: tasdiqlangan/tasdiqlanmagan, qidiruv va sahifalash.
5. CI, PR review; production migratsiyasi faqat alohida backup va deploy tekshiruvidan keyin.
