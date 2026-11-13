(() => {
  'use strict';

  const copy = new Map([
    ['UzCam — Elektronika va xavfsizlik', 'UzCam — электроника и безопасность'],
    ['EZVIZ · AQLLI VIDEOKUZATUV', 'EZVIZ · УМНОЕ ВИДЕОНАБЛЮДЕНИЕ'],
    ['EZVIZ · VIDEOKUZATUV', 'EZVIZ · ВИДЕОНАБЛЮДЕНИЕ'],
    ['HIKVISION · VIDEOKUZATUV', 'HIKVISION · ВИДЕОНАБЛЮДЕНИЕ'],
    ['DAHUA · VIDEOKUZATUV', 'DAHUA · ВИДЕОНАБЛЮДЕНИЕ'],
    ['NEOCAM · VIDEOKUZATUV', 'NEOCAM · ВИДЕОНАБЛЮДЕНИЕ'],
    ['AQLLI VIDEOKUZATUV', 'УМНОЕ ВИДЕОНАБЛЮДЕНИЕ'],
    ['VIDEOKUZATUV', 'ВИДЕОНАБЛЮДЕНИЕ'],
    ['Uyingizni EZVIZ bilan himoyalang', 'Защитите дом с EZVIZ'],
    ['CS-H1C (1080P) — uy va biznes uchun aqlli kamera.', 'CS-H1C (1080P) — интеллектуальная камера для дома и бизнеса.'],
    ['Kameralarni ko‘rish →', 'Смотреть камеры →'],
    ['Uy uchun EZVIZ kameralari', 'Камеры EZVIZ для дома'],
    ['Katalogdan ko‘rish →', 'Смотреть в каталоге →'],
    ['Do‘kon uchun Hikvision', 'Hikvision для магазина'],
    ['Dahua kameralarini ko‘ring', 'Посмотрите камеры Dahua'],
    ['NeoCam kameralarini ko‘ring', 'Посмотрите камеры NeoCam'],
    ['Ko‘proq mahsulot', 'Показать ещё товары'],
    ['UzCam kamera belgisi', 'Логотип камеры UzCam'],
    ['UzCam bilan bog‘lanish: +998 50 855 41 87', 'Связаться с UzCam: +998 50 855 41 87'],
    ['Tezkor kategoriyalar', 'Быстрые категории'],
    ['Kamera tanlash', 'Выбрать камеру'],
    ['Usta chaqirish', 'Вызвать мастера'],
    ['Tayyor to‘plamlar', 'Готовые комплекты'],
    ['Qulay tanlov', 'Удобный выбор'],
    ['Tayyor yechimlar', 'Готовые решения'],
    ['Uy uchun kamera', 'Камера для дома'],
    ['Uy xavfsizligi uchun tayyor tanlov', 'Готовое решение для безопасности дома'],
    ['Do‘kon uchun yechim', 'Решение для магазина'],
    ['Kamera va yozuv tizimini tanlang', 'Выберите камеру и систему записи'],
    ['UzCam afzalliklari', 'Преимущества UzCam'],
    ['Original mahsulot', 'Оригинальная продукция'],
    ['Tekshirilgan brendlar', 'Проверенные бренды'],
    ['Kafolat', 'Гарантия'],
    ['Ishonchli xarid', 'Надёжная покупка'],
    ['Tez yetkazish', 'Быстрая доставка'],
    ['Qulay buyurtma', 'Удобное оформление заказа'],
    ['Tavsiya etilgan ustalar', 'Рекомендуемые мастера'],
    ['Barchasi →', 'Все →'],
    ['Katalog →', 'Каталог →'],
    ['Uy uchun 2 ta Wi-Fi kamera', '2 Wi-Fi-камеры для дома'],
    ['Do‘kon uchun 4 ta Wi-Fi kamera', '4 Wi-Fi-камеры для магазина'],
    ['O‘rnatish, xotira kartasi va yetkazish alohida', 'Установка, карта памяти и доставка оплачиваются отдельно'],
    ['To‘plamni savatga qo‘shish', 'Добавить комплект в корзину'],
    ['Reyting', 'Рейтинг'],
    ['Kamera', 'Камера'],
    ['Kameralar', 'Камеры'],
    ['kameralari', 'камеры'],
    ['kameralarini ko‘ring', 'смотрите камеры'],
    ['Dahua NVR', 'Видеорегистраторы Dahua'],
    ['Tarmoq uskunalari', 'Сетевое оборудование'],
    ['Kabel va optika', 'Кабели и оптика'],
    ['Xotira qurilmalari', 'Устройства хранения данных'],
    ['Quvvat, UPS va aksessuarlar', 'Питание, ИБП и аксессуары'],
    ['Domofon va kirish nazorati', 'Домофоны и контроль доступа'],
    ['Signalizatsiya va yong‘in xavfsizligi', 'Сигнализация и пожарная безопасность'],
    ['Aqlli uy', 'Умный дом'],
    ['Elektronika', 'Электроника'],
    ['Aksessuarlar', 'Аксессуары'],
    ['Quvvat va UPS', 'Питание и ИБП'],
    ['Domofonlar', 'Домофоны'],
    ['Kirish nazorati', 'Контроль доступа'],
    ['Ovozli ogohlantirish', 'Голосовое оповещение'],
    ['Asboblar', 'Инструменты'],
    ['Tarmoq', 'Сеть'],
    ['Kabel', 'Кабель'],
    ['Kamera reklamalari', 'Предложения камер'],
    ['Reklamalar. Chap va o‘ng tugmalari bilan almashtiring.', 'Реклама. Переключайте кнопками влево и вправо.'],
    ['Oldingi reklama', 'Предыдущая реклама'],
    ['Keyingi reklama', 'Следующая реклама'],
    ['Reklama tanlash', 'Выбрать рекламу'],
    ['Avtomatik almashishni to‘xtatish', 'Остановить автоматическую смену'],
    ['Avtomatik almashishni davom ettirish', 'Возобновить автоматическую смену'],
    ['Video tavsiyalar', 'Рекомендации видео'],
    ['YouTube’dan tanlangan videolar', 'Видео, выбранные на YouTube'],
    ['Yangiliklar', 'Новости'],
    ['Ustalar', 'Мастера'],
    ['Kamera o‘rnatish va sozlash', 'Установка и настройка камер'],
    ['Kamera, model yoki brend qidiring', 'Поиск камеры, модели или бренда'],
    ['Brendni tanlash', 'Выбрать бренд'],
    ['Brend', 'Бренд'],
    ['Narx filtrini ochish', 'Открыть фильтр цены'],
    ['Filtr', 'Фильтр'],
    ['Brend tanlash', 'Выбор бренда'],
    ['Brendni tanlang', 'Выберите бренд'],
    ['Brend oynasini yopish', 'Закрыть окно бренда'],
    ['Brendni qidirish', 'Поиск бренда'],
    ['Narx bo‘yicha', 'По цене'],
    ['Filtr oynasini yopish', 'Закрыть окно фильтра'],
    ['Narx tartibi', 'Порядок цен'],
    ['Brendni tanlang, so‘ng modelning harflari yoki raqamlarini yozing', 'Выберите бренд, затем введите буквы или цифры модели'],
    ['Barcha brendlar · Arzonidan', 'Все бренды · сначала дешёвые'],
    ['Barchasi · arzonidan', 'Все · сначала дешёвые'],
    ['Arzon', 'Дешёвые'],
    ['O‘rtacha', 'Средняя цена'],
    ['Qimmat', 'Дорогие'],
    ['Kategoriyalar', 'Категории'],
    ['Barchasi', 'Все'],
    ['‹ Kategoriyalar', '‹ Категории'],
    ['Mahsulotlar', 'Товары'],
    ['Mahsulotlar katalogi', 'Каталог товаров'],
    ['Bosh sahifa', 'Главная'],
    ['Katalog', 'Каталог'],
    ['Savatchani ochish', 'Открыть корзину'],
    ['Savatcha', 'Корзина'],
    ['Profil', 'Профиль'],
    ['Savatchaga qo‘shildi', 'Добавлено в корзину'],
    ['Asosiy navigatsiya', 'Основная навигация'],
    ['Profilni yopish', 'Закрыть профиль'],
    ['Yopish', 'Закрыть'],
    ['Rol:', 'Роль:'],
    ['Super admin', 'Суперадминистратор'],
    ['Telegram foydalanuvchisi', 'Пользователь Telegram'],
    ['Telefon:', 'Телефон:'],
    ['Usta kabinetini ochish', 'Открыть кабинет мастера'],
    ['Boshqaruv paneli rolingiz bo‘yicha ochiladi.', 'Панель управления доступна в соответствии с вашей ролью.'],
    ['Bu Telegram akkauntiga admin yoki ishchi ruxsati berilmagan.', 'Этой учётной записи Telegram не предоставлены права администратора или сотрудника.'],
    ['Backend sozlamalarini tekshiring.', 'Проверьте настройки сервера.'],
    ['Tekshirish bajarilmadi', 'Не удалось выполнить проверку'],
    ['Profil va boshqaruv paneli Telegram Mini App ichida ochilganda ishlaydi.', 'Профиль и панель управления доступны при открытии внутри Telegram Mini App.'],
    ['Telegram profilingiz tasdiqlanmadi.', 'Не удалось подтвердить профиль Telegram.'],
    ['Telegram profilini tekshirish uchun kuting…', 'Подождите, проверяем профиль Telegram…'],
    ['Boshqaruv panelini ochish', 'Открыть панель управления'],
    ['🔔 Buyurtma xabarlari', '🔔 Уведомления о заказах'],
    ['📦 Buyurtmalar', '📦 Заказы'],
    ['Savatchangiz hozircha bo‘sh 🛒', 'Ваша корзина пока пуста 🛒'],
    ['Mahsulot haqida', 'О товаре'],
    ['Mahsulot ma’lumotlari', 'Информация о товаре'],
    ['Texnik xususiyatlar', 'Технические характеристики'],
    ['Tavsif', 'Описание'],
    ['Brend', 'Бренд'],
    ['Model', 'Модель'],
    ['Kategoriya', 'Категория'],
    ['Ko‘rsatilmagan', 'Не указано'],
    ['Qo‘shimcha ma’lumot hali kiritilmagan.', 'Дополнительная информация пока не добавлена.'],
    ['O‘xshash mahsulotlar', 'Похожие товары'],
    ['Mos mahsulotlar yuklanmoqda…', 'Загружаем похожие товары…'],
    ['Mahsulot rasmini kattalashtirib ko‘rish', 'Увеличить изображение товара'],
    ['Mahsulot rasmi', 'Изображение товара'],
    ['Rasm mavjud emas', 'Изображение отсутствует'],
    ['Mahsulotni yopish', 'Закрыть товар'],
    ['Rasmni kattalashtirish', 'Увеличить изображение'],
    ['Rasmni yopish', 'Закрыть изображение'],
    ['Savatga qo‘shish', 'В корзину'],
    ['Savatchaga qo‘shish', 'Добавить в корзину'],
    ['Qo‘shildi ✓', 'Добавлено ✓'],
    ['Sotib olish', 'Купить'],
    ['Buyurtma berish', 'Оформить заказ'],
    ['Buyurtma', 'Заказ'],
    ['To‘lov', 'Оплата'],
    ['To‘lov usuli', 'Способ оплаты'],
    ['Yetkazib berish', 'Доставка'],
    ['Yetkazish', 'Доставка'],
    ['Manzil', 'Адрес'],
    ['Telefon', 'Телефон'],
    ['Ism-familiya', 'Имя и фамилия'],
    ['Buyurtmani tasdiqlash', 'Подтвердить заказ'],
    ['Buyurtma yuborildi', 'Заказ отправлен'],
    ['Buyurtmalarim', 'Мои заказы'],
    ['Buyurtma xabarlari', 'Уведомления о заказах'],
    ['Buyurtmalar tarixi', 'История заказов'],
    ['Hech qanday buyurtma topilmadi', 'Заказы не найдены'],
    ['Yuklanmoqda…', 'Загрузка…'],
    ['Qayta urinish', 'Повторить'],
    ['Batafsil', 'Подробнее'],
    ['Bekor qilish', 'Отмена'],
    ['Tasdiqlash', 'Подтвердить'],
    ['Ha', 'Да'],
    ['Yo‘q', 'Нет'],
    ['Mijoz ma’lumotlari', 'Данные клиента'],
    ['Xizmatlar', 'Услуги'],
    ['Tajriba', 'Опыт'],
    ['reyting', 'рейтинг'],
    ['yil tajriba', 'лет опыта'],
    ['Barcha', 'Все'],
    ['Jami', 'Итого'],
    ['Mahsulot nomi', 'Название товара'],
    ['Narxi', 'Цена'],
    ['Miqdor', 'Количество'],
    ['Soni', 'Количество'],
    ['Jami summa', 'Общая сумма'],
    ['Yetkazib berish manzili', 'Адрес доставки'],
    ['Manzilni kiriting', 'Введите адрес'],
    ['Ismingizni kiriting', 'Введите имя'],
    ['Telefon raqamingizni kiriting', 'Введите номер телефона'],
    ['Buyurtma holati', 'Статус заказа'],
    ['To‘lov kutilmoqda', 'Ожидается оплата'],
    ['To‘landi', 'Оплачено'],
    ['Yangi', 'Новый'],
    ['Qabul qilindi', 'Принят'],
    ['Yo‘lda', 'В пути'],
    ['Yetkazildi', 'Доставлен'],
    ['Bekor qilindi', 'Отменён'],
    ['Tilni tanlang', 'Выберите язык'],
    ['O‘zbekcha', 'Узбекский'],
    ['Ruscha', 'Русский'],
    ['Dashboard', 'Панель управления'],
    ['UzCam — Boshqaruv paneli', 'UzCam — панель управления'],
    ['UzCam Mini App', 'UzCam Mini App'],
    ['Boshqaruv paneli', 'Панель управления'],
    ['Boshqaruv paneli · v2', 'Панель управления · v2'],
    ['Boshqaruv markazi', 'Центр управления'],
    ['Admin', 'Администратор'],
    ['Adminlar', 'Администраторы'],
    ['Adminlar yuklanmoqda…', 'Загружаем администраторов…'],
    ['Adminlar tizim va savdo boshqaruvini olib boradi.', 'Администраторы управляют системой и продажами.'],
    ['BOSHQARUV', 'УПРАВЛЕНИЕ'],
    ['BOSHQARUV TIZIMI', 'СИСТЕМА УПРАВЛЕНИЯ'],
    ['ASOSIY', 'ОСНОВНОЕ'],
    ['KATALOG', 'КАТАЛОГ'],
    ['USTALAR', 'МАСТЕРА'],
    ['MIJOZLAR VA MUROJAATLAR', 'КЛИЕНТЫ И ОБРАЩЕНИЯ'],
    ['SAVDO VA BUYURTMALAR', 'ПРОДАЖИ И ЗАКАЗЫ'],
    ['SAYT VA MINI APP', 'САЙТ И MINI APP'],
    ['TAHLIL VA SOZLAMALAR', 'АНАЛИТИКА И НАСТРОЙКИ'],
    ['Analitika yuklanmoqda…', 'Загружаем аналитику…'],
    ['Analitika · oxirgi 30 kun', 'Аналитика · последние 30 дней'],
    ['Eng ko‘p ishlatiladigan amallar va bazadagi jonli ko‘rsatkichlar', 'Часто используемые действия и актуальные показатели базы данных'],
    ['Jonli ma’lumotlar', 'Актуальные данные'],
    ['Yangi buyurtmalar', 'Новые заказы'],
    ['Bugungi buyurtmalar', 'Заказы за сегодня'],
    ['Faol mahsulotlar', 'Активные товары'],
    ['Faol ustalar', 'Активные мастера'],
    ['Jami hodisalar', 'Всего событий'],
    ['So‘nggi buyurtmalar', 'Последние заказы'],
    ['Buyurtmalar', 'Заказы'],
    ['Buyurtmalar yuklanmoqda…', 'Загружаем заказы…'],
    ['Haqiqiy buyurtmalar yuklanmoqda…', 'Загружаем реальные заказы…'],
    ['Mahsulotlar yuklanmoqda…', 'Загружаем товары…'],
    ['Ustalar yuklanmoqda…', 'Загружаем мастеров…'],
    ['Mahsulotlar', 'Товары'],
    ['Katalog kategoriyalari', 'Категории каталога'],
    ['Brendlar va bo‘limlar', 'Бренды и разделы'],
    ['Qo‘shish, bittalab tahrirlash, yashirish va o‘chirish', 'Добавление, редактирование, скрытие и удаление товаров'],
    ['Katalog kartalari, ikonlar va mahsulotlar bilan bog‘lanishni boshqaring.', 'Управляйте карточками каталога, значками и связью с товарами.'],
    ['Katalog kartasi qanday ko‘rinishini sozlang.', 'Настройте внешний вид карточки каталога.'],
    ['Bo‘lim qo‘shish', 'Добавить раздел'],
    ['Bo‘lim nomi', 'Название раздела'],
    ['Bo‘lim turi', 'Тип раздела'],
    ['Bo‘limni o‘chirish mahsulotlarni o‘chirmaydi. Logotip o‘rniga sayt rangidagi ikon tanlashingiz mumkin.', 'Удаление раздела не удаляет товары. Вместо логотипа можно выбрать значок в цветах сайта.'],
    ['Mahsulot qo‘shish', 'Добавить товар'],
    ['Mahsulot qo‘shish/tahrirlash', 'Добавление/редактирование товара'],
    ['Katalogga yangi mahsulot kiritish', 'Добавить новый товар в каталог'],
    ['Mahsulot nomi yoki modelini qidiring...', 'Поиск по названию или модели товара…'],
    ['Mahsulot qidirish', 'Поиск товара'],
    ['Mahsulot haqida tekshirilgan ma’lumotlar', 'Проверенная информация о товаре'],
    ['Mahsulot nomi', 'Название товара'],
    ['Model / artikul', 'Модель / артикул'],
    ['Qisqa tavsif', 'Краткое описание'],
    ['Ma’lumot / xususiyatlar', 'Информация / характеристики'],
    ['Mahsulot rasmi', 'Изображение товара'],
    ['Rasm havolasi', 'Ссылка на изображение'],
    ['Rasm yuklash yoki almashtirish', 'Загрузить или заменить изображение'],
    ['Rasm, model, tavsif va sotuv narxi.', 'Изображение, модель, описание и цена продажи.'],
    ['JPG, PNG, WEBP · 3 MB gacha', 'JPG, PNG, WEBP · до 3 МБ'],
    ['PNG, JPG yoki WEBP, 3 MB gacha. Rasm bo‘lmasa tanlangan ikon ishlatiladi.', 'PNG, JPG или WEBP, до 3 МБ. Если изображения нет, используется выбранный значок.'],
    ['Katalogda ko‘rinadi', 'Видно в каталоге'],
    ['Katalogda ko‘rsatish', 'Показывать в каталоге'],
    ['Katalogda ko‘rinadigan bo‘limlar', 'Разделы, видимые в каталоге'],
    ['Katalog holati', 'Состояние каталога'],
    ['Kategoriya', 'Категория'],
    ['Barcha kategoriyalar', 'Все категории'],
    ['Barcha brendlar', 'Все бренды'],
    ['Barcha holatlar', 'Все статусы'],
    ['Eng yangilari', 'Сначала новые'],
    ['Narx: arzonidan', 'Цена: сначала дешевле'],
    ['Narx: qimmatidan', 'Цена: сначала дороже'],
    ['Nomi (A → Z)', 'Название (А → Я)'],
    ['Nomi (Z → A)', 'Название (Я → А)'],
    ['Brend (A → Z)', 'Бренд (А → Я)'],
    ['Brend bo‘yicha', 'По бренду'],
    ['Kalit so‘zlar bo‘yicha', 'По ключевым словам'],
    ['Saralash', 'Сортировка'],
    ['Filtrlash', 'Фильтрация'],
    ['Saralash va filtrlar faqat ko‘rinish tartibini o‘zgartiradi', 'Сортировка и фильтры меняют только порядок отображения'],
    ['Ko‘rsatish soni', 'Количество на странице'],
    ['Bir sahifadagi mahsulotlar soni', 'Количество товаров на странице'],
    ['Tartib', 'Порядок'],
    ['Narxi', 'Цена'],
    ['Sotuv narxi', 'Цена продажи'],
    ['Sotuv narxi (so‘m)', 'Цена продажи (сум)'],
    ['Manba narxi', 'Исходная цена'],
    ['Narx kiritish usuli', 'Способ ввода цены'],
    ['Manba narxidan hisoblash', 'Рассчитать по исходной цене'],
    ['Katalog narxi avtomatik olinadi', 'Цена каталога рассчитывается автоматически'],
    ['Valyuta', 'Валюта'],
    ['So‘m (UZS)', 'Сум (UZS)'],
    ['Mahsulot ustamasi', 'Наценка на товар'],
    ['Ustama foizi (%)', 'Процент наценки (%)'],
    ['Maxsus narx qoidasi:', 'Особое правило цены:'],
    ['Boshlang‘ich ustama 30%. O‘zgartirilganda manba narxi va kursi saqlangan mahsulotlarning sotuv narxi ham qayta hisoblanadi.', 'Начальная наценка — 30%. При её изменении пересчитывается цена продажи товаров с сохранённой исходной ценой и курсом.'],
    ['Avtomatik valyuta kursi', 'Автоматический валютный курс'],
    ['Hisoblash kursi', 'Расчётный курс'],
    ['CBU · USD → UZS', 'ЦБ · USD → UZS'],
    ['CBU javob bermasa oxirgi to‘g‘ri kursni saqlash', 'Если ЦБ не отвечает, сохранять последний корректный курс'],
    ['Rasmiy kurs har kuni tekshiriladi. Oxirgi yangilanish va kurs sanasi bu yerda ko‘rinadi.', 'Официальный курс проверяется ежедневно. Здесь отображаются дата курса и последнее обновление.'],
    ['Yangi CBU kursini avtomatik qo‘llash', 'Автоматически применять новый курс ЦБ'],
    ['Hozir tekshirish', 'Проверить сейчас'],
    ['Kursni yangilash', 'Обновить курс'],
    ['Oxirgi kurs: ulanmagan', 'Последний курс: не подключён'],
    ['Faqat Super Admin o‘zgartiradi', 'Изменяет только супер-администратор'],
    ['To‘lov usullari', 'Способы оплаты'],
    ['To‘lov va yetkazib berish holatlarini boshqaring', 'Управляйте статусами оплаты и доставки'],
    ['QR to‘lov', 'Оплата по QR-коду'],
    ['QR kodni yuklash — backend kerak', 'Загрузка QR-кода — требуется backend'],
    ['To‘lov kartasi va QR tasvirini Super Admin boshqaradi.', 'Картой оплаты и изображением QR-кода управляет супер-администратор.'],
    ['Yetkazish', 'Доставка'],
    ['Yetkazib berish', 'Доставка'],
    ['Buyurtma qabulida BTS tanlansa, yetkazish 0 so‘m', 'При выборе BTS при оформлении заказа доставка бесплатна'],
    ['Barcha yetkazish turlari', 'Все способы доставки'],
    ['BTS pochta', 'Почта BTS'],
    ['Buyurtma', 'Заказ'],
    ['Buyurtma / xizmat', 'Заказ / услуга'],
    ['Buyurtmalar tarixi va Telegram profillari', 'История заказов и профили Telegram'],
    ['Buyurtma raqami, mahsulot yoki telefon...', 'Номер заказа, товар или телефон…'],
    ['To‘lovlar', 'Платежи'],
    ['To‘lovlarni tekshirish', 'Проверка платежей'],
    ['To‘lov kutilayotganlarini ko‘rish', 'Показать ожидающие оплаты'],
    ['To‘lov kutilmoqda', 'Ожидается оплата'],
    ['To‘lov tasdiqlangach buyurtma barcha ishchilarga ko‘rinadi. Birinchi bo‘lib', 'После подтверждения оплаты заказ виден всем сотрудникам. Тому, кто первым нажмёт кнопку,'],
    ['tugmasini bosgan ishchiga biriktiriladi; keyin boshqa ishchilardan yashiriladi. Mijoz ma’lumotlari faqat bron qilgan ishchiga ochiladi.', 'назначается заказ; затем он скрывается от остальных сотрудников. Данные клиента доступны только назначенному сотруднику.'],
    ['Tasdiqlangan buyurtmani bron qilish', 'Забронировать подтверждённый заказ'],
    ['Bron kutayotganlar', 'Ожидают бронирования'],
    ['Bron qilingan buyurtmalar va xizmat haqi holati', 'Забронированные заказы и статус оплаты услуг'],
    ['Bron qilingan vaqt', 'Время бронирования'],
    ['Bron qilish', 'Забронировать'],
    ['To‘lovi tasdiqlangan va hali hech kim bron qilmagan buyurtmalar', 'Заказы с подтверждённой оплатой, ещё не забронированные сотрудником'],
    ['To‘lovi tasdiqlangan buyurtma ishchi bron qilgach shu ro‘yxatda ko‘rinadi. Xizmat haqi mahsulot to‘lovidan alohida kuzatiladi.', 'Заказ с подтверждённой оплатой появится в этом списке после бронирования сотрудником. Оплата услуги отслеживается отдельно от товара.'],
    ['Hozircha bron qilingan buyurtma yo‘q.', 'Пока нет забронированных заказов.'],
    ['Buyurtma olishga tayyor', 'Готов принять заказ'],
    ['Yangi buyurtmalar', 'Новые заказы'],
    ['Bugungi buyurtmalar', 'Заказы за сегодня'],
    ['Mijozlar', 'Клиенты'],
    ['Mijozlar ma’lumotlarini ko‘rish', 'Просмотр данных клиентов'],
    ['Mijoz aloqasi', 'Контакты клиента'],
    ['Mijoz katalogida ko‘rsatish', 'Показывать в каталоге клиентов'],
    ['Mijoz', 'Клиент'],
    ['Barcha mijozlar', 'Все клиенты'],
    ['Mijoz savollari', 'Вопросы клиентов'],
    ['Mijoz savollariga javob', 'Ответы на вопросы клиентов'],
    ['Savollar', 'Вопросы'],
    ['Savol', 'Вопрос'],
    ['Javobsiz', 'Без ответа'],
    ['Javob berildi', 'Есть ответ'],
    ['Javob berish', 'Ответить'],
    ['Telegram orqali kelgan murojaatlar', 'Обращения через Telegram'],
    ['Murojaat', 'Обращение'],
    ['Menga biriktirilgan', 'Назначенные мне'],
    ['Barcha ishchilar', 'Все сотрудники'],
    ['Ishchi', 'Сотрудник'],
    ['Usta', 'Мастер'],
    ['Ustalar katalogi', 'Каталог мастеров'],
    ['Usta qo‘shish', 'Добавить мастера'],
    ['Usta profili va xizmatlarini kiritish', 'Добавить профиль мастера и услуги'],
    ['Usta katalogida mijozlarga ko‘rinadigan profil ma’lumotlari.', 'Данные профиля мастера, видимые клиентам в каталоге.'],
    ['Ustalar mijoz buyurtmasini bajaradi; avatar, ish staji va xizmat ma’lumotlari shu yerda boshqariladi.', 'Мастера выполняют заказы клиентов; здесь управляются аватар, стаж и информация об услугах.'],
    ['Ustalar katalogida ko‘rsatish', 'Показывать в каталоге мастеров'],
    ['Faol ustalar', 'Активные мастера'],
    ['Ish staji', 'Стаж работы'],
    ['Ish staji (yil)', 'Стаж работы (лет)'],
    ['Xizmat haqi', 'Стоимость услуги'],
    ['Xizmat haqi mahsulot pulidan alohida', 'Стоимость услуги учитывается отдельно от товара'],
    ['Xizmatlar va narxlari', 'Услуги и цены'],
    ['Kamera o‘rnatish — 200 000 so‘m\nDVR sozlash — 150 000 so‘m', 'Установка камеры — 200 000 сум\nНастройка DVR — 150 000 сум'],
    ['Mijoz savollari', 'Вопросы клиентов'],
    ['Admin qo‘shish', 'Добавить администратора'],
    ['Xodim qo‘shish', 'Добавить сотрудника'],
    ['Telegram ID, ism va rolni kiriting.', 'Введите Telegram ID, имя и роль.'],
    ['Telegram ID, ism yoki telefon...', 'Telegram ID, имя или телефон…'],
    ['Xodimning Telegram ID raqami.', 'Telegram ID сотрудника.'],
    ['Telegram ID', 'Telegram ID'],
    ['Telegram username', 'Имя пользователя Telegram'],
    ['Telegram mijoz', 'Клиент Telegram'],
    ['Ism-familiya', 'Имя и фамилия'],
    ['Aloqa telefon raqami', 'Контактный номер телефона'],
    ['Telefon 1', 'Телефон 1'],
    ['Telefon 2 (ixtiyoriy)', 'Телефон 2 (необязательно)'],
    ['Telefon 3 (ixtiyoriy)', 'Телефон 3 (необязательно)'],
    ['Mas’ul ishchi', 'Ответственный сотрудник'],
    ['Barcha ishchilar', 'Все сотрудники'],
    ['Barcha yetkazish turlari', 'Все способы доставки'],
    ['Barcha holatlar', 'Все статусы'],
    ['Holat', 'Статус'],
    ['Holati', 'Статус'],
    ['Rol', 'Роль'],
    ['Roli:', 'Роль:'],
    ['Ruxsat siyosati', 'Политика доступа'],
    ['Ruxsatlar', 'Разрешения'],
    ['Maxfiy ma’lumotlar faqat ruxsatli ko‘rinishda', 'Конфиденциальные данные доступны только с соответствующими правами'],
    ['Buyurtma / xizmat', 'Заказ / услуга'],
    ['Biriktirilgan buyurtmalar', 'Назначенные заказы'],
    ['Ochiq xizmat buyurtmalari', 'Открытые заказы на услуги'],
    ['Faol', 'Активен'],
    ['O‘chirilgan', 'Удалён'],
    ['Yashirilgan', 'Скрыт'],
    ['Yashirilgan mahsulot mijoz katalogida ko‘rinmaydi. O‘chirilgan mahsulotni shu bo‘limdan tiklash mumkin.', 'Скрытый товар не виден в каталоге клиентов. Удалённый товар можно восстановить в этом разделе.'],
    ['Ma’lumotlar haqida', 'О данных'],
    ['Ma’lumotlar holati', 'Состояние данных'],
    ['Backend ulanmagan', 'Backend не подключён'],
    ['Backend ulangach kiritiladi', 'Будет добавлено после подключения backend'],
    ['Tizim sozlamalari', 'Настройки системы'],
    ['Sozlamalarni boshqarish', 'Управление настройками'],
    ['Hisobotlar va sozlamalar', 'Отчёты и настройки'],
    ['Hisobot yuklab olish', 'Скачать отчёт'],
    ['Promo banner va aloqa', 'Промо-баннер и контакты'],
    ['Promo banner, YouTube videolari va mijozlarga yangiliklarni boshqaring', 'Управляйте промо-баннерами, видео YouTube и новостями для клиентов'],
    ['Banner ustidagi yozuv', 'Текст на баннере'],
    ['Tugma yozuvi', 'Текст кнопки'],
    ['Sarlavha', 'Заголовок'],
    ['Kalit so‘zlar', 'Ключевые слова'],
    ['Mahsulotdagi brend nomlari', 'Названия брендов в товаре'],
    ['Bir nechta nomni vergul bilan ajrating. Mahsulotning Brend maydoni bilan solishtiriladi.', 'Разделите названия запятыми. Они сравниваются с полем «Бренд» товара.'],
    ['Brend va filtr ikonkalari o‘rtasida ko‘rinadi. Yashirish uchun bo‘sh qoldiring.', 'Отображается между брендом и значками фильтров. Оставьте пустым, чтобы скрыть.'],
    ['Nom, model, tavsif yoki kategoriya ichidagi so‘zlar. Vergul bilan ajrating.', 'Слова из названия, модели, описания или категории. Разделяйте запятыми.'],
    ['Ma’lumotlar holati', 'Состояние данных'],
    ['Bosh sahifa kontenti', 'Содержимое главной страницы'],
    ['Yangiliklar va e’lonlar', 'Новости и объявления'],
    ['YouTube video tavsiyalari', 'Рекомендации видео YouTube'],
    ['Video qo‘shish', 'Добавить видео'],
    ['Yangilik qo‘shish', 'Добавить новость'],
    ['Yangilanganda Super Admin’ga xabar berish', 'Уведомлять супер-администратора об обновлениях'],
    ['Ma’lumotlar haqida', 'О данных'],
    ['Saqlash', 'Сохранить'],
    ['O‘zgarishlarni saqlash', 'Сохранить изменения'],
    ['Yangilash', 'Обновить'],
    ['Bekor qilish', 'Отмена'],
    ['Yopish', 'Закрыть'],
    ['Amal', 'Действие'],
    ['Amallar', 'Действия'],
    ['Sana', 'Дата'],
    ['Vaqt', 'Время'],
    ['Jami', 'Всего'],
    ['Jami xarid', 'Сумма покупок'],
    ['Oxirgi xarid', 'Последняя покупка'],
    ['Yaqinda xarid qilganlar', 'Недавно купившие'],
    ['Bugun yaratilgan', 'Создано сегодня'],
    ['Kecha', 'Вчера'],
    ['Oxirgi yangilanganlar', 'Последние обновления'],
    ['Tekshirish kerak', 'Требует проверки'],
    ['Barchasini ko‘rish →', 'Показать все →'],
    ['Keyingi →', 'Далее →'],
    ['← Oldingi', '← Назад'],
    ['↻ Tozalash', '↻ Очистить'],
    ['Brend (A → Z)', 'Бренд (А → Я)'],
    ['Bepul', 'Бесплатно'],
    ['Ko‘rsatish soni', 'Количество отображаемых'],
    ['Rasm', 'Изображение'],
    ['Logotip yuklash', 'Загрузить логотип'],
    ['Logoni olib tashlash', 'Удалить логотип'],
    ['Ikonka', 'Значок'],
    ['Qo‘shimcha ma’lumot hali kiritilmagan.', 'Дополнительная информация пока не добавлена.'],
    ['Mini appga qaytish', 'Вернуться в Mini App'],
    ['Faqat Super Admin o‘zgartiradi', 'Изменяет только супер-администратор'],
    ['Rasm, model, tavsif va sotuv narxi.', 'Изображение, модель, описание и цена продажи.'],
    ['Masalan: Ali Valiyev', 'Например: Али Валиев'],
    ['Masalan: EZVIZ', 'Например: EZVIZ'],
    ['Masalan: 123456789', 'Например: 123456789'],
    ['EZVIZ kuzatuv kamerasi', 'Камера видеонаблюдения EZVIZ'],
    ['EZVIZ kuzatuv kamerasi · 1080P', 'Камера видеонаблюдения EZVIZ · 1080P'],
    ['EZVIZ kuzatuv kamerasi · 2MP', 'Камера видеонаблюдения EZVIZ · 2 Мп'],
    ['EZVIZ kuzatuv kamerasi · 3MP', 'Камера видеонаблюдения EZVIZ · 3 Мп'],
    ['EZVIZ kuzatuv kamerasi · 4MP', 'Камера видеонаблюдения EZVIZ · 4 Мп'],
    ['EZVIZ kuzatuv kamerasi · 5MP', 'Камера видеонаблюдения EZVIZ · 5 Мп'],
    ['EZVIZ kuzatuv kamerasi · 6MP', 'Камера видеонаблюдения EZVIZ · 6 Мп'],
    ['EZVIZ kuzatuv kamerasi · 8MP', 'Камера видеонаблюдения EZVIZ · 8 Мп'],
    ['EZVIZ quvvat va kamera aksessuari', 'Аксессуар EZVIZ для камер и питания'],
    ['Eshik oldini ko‘rish va mehmon bilan aloqa', 'Просмотр входа и связь с посетителями'],
    ['EZVIZ aqlli ekran', 'Умный экран EZVIZ'],
    ['EZVIZ aqlli eshik qulfi', 'Умный дверной замок EZVIZ'],
    ['EZVIZ aqlli uy qurilmasi', 'Устройство умного дома EZVIZ'],
    ['Kamera aksessuarlari', 'Аксессуары для камер'],
    ['Kamera uchun mos qurilmalar', 'Подходящие аксессуары для камеры'],
    ['Kameralar', 'Камеры'],
    ['Kameralarni ko‘rish', 'Смотреть камеры'],
    ['Katalogdan ko‘rish', 'Смотреть в каталоге'],
    ['Katalog formati noto‘g‘ri: products massivi topilmadi', 'Неверный формат каталога: список products не найден'],
    ['Katalogni yuklab bo‘lmadi', 'Не удалось загрузить каталог'],
    ['Katalog yuklanmoqda…', 'Загружаем каталог…'],
    ['Server katalogi bo‘sh qaytdi', 'Сервер вернул пустой каталог'],
    ['Mahsulot topilmadi 🔎', 'Товары не найдены 🔎'],
    ['Nomsiz mahsulot', 'Товар без названия'],
    ['Barcha mahsulotlar', 'Все товары'],
    ['Barcha brendlar', 'Все бренды'],
    ['Brend topilmadi', 'Бренд не найден'],
    ['Arzonidan', 'Сначала дешевле'],
    ['Barcha mahsulotlar arzon narxdan', 'Все товары сначала по возрастанию цены'],
    ['Narxi past mahsulotlar', 'Товары с низкой ценой'],
    ['O‘rtacha narxdagi mahsulotlar', 'Товары средней ценовой категории'],
    ['Qimmat mahsulotlar yuqorida', 'Сначала дорогие товары'],
    ['Kamera bilan birga kerak bo‘lishi mumkin', 'Может пригодиться вместе с камерой'],
    ['To‘plamni to‘ldiring va vaqtni tejang', 'Соберите комплект и сэкономьте время'],
    ['Brendlar va bo‘limlar', 'Бренды и разделы'],
    ['Mahsulot turlari', 'Типы товаров'],
    ['Kategoriya bo‘yicha tanlang', 'Выберите категорию'],
    ['Brendlarni yuklab bo‘lmadi. Sahifani yangilang.', 'Не удалось загрузить бренды. Обновите страницу.'],
    ['Bu bo‘limda mahsulotlar hali kiritilmagan.', 'В этом разделе пока нет товаров.'],
    ['Ko‘proq mahsulot', 'Показать ещё товары'],
    ['Hammasini o‘chirish', 'Удалить всё'],
    ['Savatchadagi barcha mahsulotlar o‘chirilsinmi?', 'Удалить все товары из корзины?'],
    ['Savatchaga qaytish', 'Вернуться в корзину'],
    ['Yetkazish ma’lumotlariga qaytish', 'Вернуться к данным доставки'],
    ['To‘lovga o‘tish', 'Перейти к оплате'],
    ['To‘lov qildim — buyurtmani yuborish', 'Я оплатил — отправить заказ'],
    ['QR kodni bankingiz yoki to‘lov ilovangiz orqali skanerlang. To‘lov summasini kiriting:', 'Отсканируйте QR-код в банковском приложении и введите сумму оплаты:'],
    ['Buyurtma saqlandi. To‘lov admin tomonidan tekshiriladi. Jami:', 'Заказ сохранён. Администратор проверит оплату. Итого:'],
    ['saqlandi. To‘lov admin tomonidan tekshiriladi. Jami:', 'сохранён. Администратор проверит оплату. Итого:'],
    ['Buyurtma №', 'Заказ №'],
    ['Buyurtma saqlanmoqda…', 'Сохраняем заказ…'],
    ['Buyurtmani saqlab bo‘lmadi', 'Не удалось сохранить заказ'],
    ['Buyurtma berish uchun mini-ilovani Telegram ichidan oching.', 'Чтобы оформить заказ, откройте Mini App в Telegram.'],
    ['Buyurtma 3 kun ichida manzilingizga yetkaziladi.', 'Заказ будет доставлен по вашему адресу в течение 3 дней.'],
    ['BTS pochta orqali yetkazib berish bepul. Yetkazish 3 kun ichida.', 'Доставка через почту BTS бесплатна и занимает до 3 дней.'],
    ['BTS bo‘limi nomi/manzili, mo‘ljal yoki izoh', 'Название/адрес отделения BTS, ориентир или комментарий'],
    ['BTS pochta manzili va qo‘shimcha ma’lumotlar', 'Адрес почты BTS и дополнительная информация'],
    ['Yetkazish manzili va qo‘shimcha ma’lumotlar', 'Адрес доставки и дополнительная информация'],
    ['Hozircha ommaga ochiq ustalar yo‘q. Tez orada qo‘shiladi.', 'Пока нет мастеров в открытом каталоге. Скоро они появятся.'],
    ['Ustalar ro‘yxatini yuklab bo‘lmadi.', 'Не удалось загрузить список мастеров.'],
    ['Ustalar yuklanmoqda…', 'Загружаем мастеров…'],
    ['Qayta yuklash', 'Загрузить снова'],
    ['Profil va boshqaruv paneli Telegram Mini App ichida ochilganda ishlaydi.', 'Профиль и панель управления доступны при открытии Mini App в Telegram.'],
    ['Telegram profilingiz tasdiqlanmadi.', 'Не удалось подтвердить профиль Telegram.'],
    ['Telegram profilingiz tekshirilmoqda…', 'Проверяем профиль Telegram…'],
    ['Buyurtmalar tarkibi', 'Состав заказа'],
    ['Buyurtma tarkibi', 'Состав заказа'],
    ['Sana:', 'Дата:'],
    ['Jami to‘lov', 'Итого к оплате'],
    ['To‘lov holati', 'Статус оплаты'],
    ['Buyurtma holatlari tarixi', 'История статусов заказа'],
    ['Buyurtma yaratildi', 'Заказ создан'],
    ['Holat yangilandi', 'Статус обновлён'],
    ['To‘lov holati yangilandi', 'Статус оплаты обновлён'],
    ['To‘lov tasdiqlandi', 'Оплата подтверждена'],
    ['To‘lov rad etildi', 'В оплате отказано'],
    ['Ustaga biriktirildi', 'Назначен мастеру'],
    ['Xizmat bajarilmoqda', 'Услуга выполняется'],
    ['Yakunlandi', 'Завершён'],
    ['Kutilmoqda', 'Ожидается'],
    ['Chek yuborildi', 'Чек отправлен'],
    ['Tasdiqlandi', 'Подтверждено'],
    ['Rad etildi', 'Отклонено'],
    ['Qaytarildi', 'Возвращено'],
    ['Yaratildi', 'Создан'],
    ['Buyurtmalarni ko‘rish uchun Mini App’ni Telegram ichidan oching.', 'Чтобы просмотреть заказы, откройте Mini App в Telegram.'],
    ['Buyurtmalarni yuklab bo‘lmadi', 'Не удалось загрузить заказы'],
    ['Yetkazib berish:', 'Доставка:'],
    ['Manzilga', 'По адресу'],
    ['Xabarnomalar yuklanmoqda…', 'Загружаем уведомления…'],
    ['Xabarnomalarni ko‘rish uchun UzCam Mini App’ni Telegram ichidan oching.', 'Чтобы просмотреть уведомления, откройте UzCam Mini App в Telegram.'],
    ['Telegram botda /start buyrug‘ini yuboring. Shundan keyin buyurtma xabarlari shaxsiy chatga yetkaziladi.', 'Отправьте команду /start боту Telegram, чтобы получать уведомления о заказах в личном чате.'],
    ['Hozircha buyurtma xabarlari yo‘q.', 'Пока нет уведомлений о заказах.'],
    ['Xabarnomalarni yuklab bo‘lmadi', 'Не удалось загрузить уведомления'],
    ['Yuborildi', 'Отправлено'],
    ['Yuborilmadi', 'Не отправлено'],
    ['Navbatda', 'В очереди'],
    ['Barchasini o‘qilgan deb belgilash', 'Отметить всё как прочитанное'],
    ['UzCam xabari', 'Сообщение UzCam'],
    ['Hozircha buyurtmalaringiz yo‘q.', 'У вас пока нет заказов.'],
    ['UZ', 'UZ'],
    ['RU', 'RU']
  ].map(([source, translated]) => [normalize(source), translated]));

  const specificationPhrases = {
    uz: [
      ['High quality imaging with 4 MP resolution', '4 MP tasvir aniqligida yuqori sifatli tasvir'],
      ['High quality imaging with 2 MP resolution', '2 MP tasvir aniqligida yuqori sifatli tasvir'],
      ['High quality imaging with 8 MP resolution', '8 MP tasvir aniqligida yuqori sifatli tasvir'],
      ['Умная поворотно-наклонная Wi-Fi камера', 'Aqlli buriluvchi Wi-Fi kamera'],
      ['Спецификация:', 'Xususiyatlari:'],
      ['Особенности:', 'Imkoniyatlari:'],
      ['Режим патрулирования', 'Patrul rejimi'],
      ['Сенсорная кнопка вызова', 'Sensorli chaqiruv tugmasi'],
      ['Интеллектуальное обнаружение формы человека', 'Odam gavdasini aqlli aniqlash'],
      ['Обнаружение формы человека с помощью искусственного интеллекта', 'Odam gavdasini sun’iy intellekt yordamida aniqlash'],
      ['Обнаружение формы человека/транспортного средства на основе искусственного интеллекта', 'Sun’iy intellekt asosida odam yoki transport vositasini aniqlash'],
      ['Распознавание формы человека/транспортного средства с помощью искусственного интеллекта', 'Sun’iy intellekt yordamida odam yoki transport vositasini tanish'],
      ['Два режима патрулирования для автоматической безопасности', 'Avtomatik xavfsizlik uchun ikkita patrul rejimi'],
      ['Двусторонний вызов с помощью сенсорной кнопки', 'Sensorli tugma orqali ikki tomonlama qo‘ng‘iroq'],
      ['Режим постоянного видео 2.0', 'Uzluksiz video rejimi 2.0'],
      ['Панорамный вид 360°', '360° panoramali ko‘rinish'],
      ['ИК-ночное видение', 'IR tungi tasvir'],
      ['Спящий режим для защиты конфиденциальности', 'Maxfiylikni himoya qilish uchun uyqu rejimi'],
      ['Улучшенный звукосниматель', 'Yaxshilangan ovoz qabul qilgich'],
      ['Всепогодный дизайн', 'Har qanday ob-havoga chidamli dizayn'],
      ['Технология видео H.265', 'H.265 video texnologiyasi'],
      ['2,4 ГГц', '2,4 GHz'],
      ['2.4 ГГц', '2,4 GHz'],
      ['поворотно-наклонная', 'buriluvchi va qiyalanuvchi'],
      ['интеллектуальное обнаружение и уведомления', 'aqlli aniqlash va xabarnomalar'],
      ['идентификация детского плача', 'chaqaloq yig‘isini aniqlash'],
      ['двусторонняя аудиосвязь', 'ikki tomonlama audio aloqa'],
      ['поддержка Google Assistant и Amazon Alexa', 'Google Assistant va Amazon Alexa yordamchilarini qo‘llab-quvvatlash'],
      ['горизонтально', 'gorizontal'],
      ['движение', 'harakat'],
      ['люди', 'odamlar'],
      ['Мобильное приложение', 'Mobil ilova'],
      ['ночное видение', 'tungi ko‘rish'],
      ['Панорамный охват 360°', '360° panoramali qamrov'],
      ['Автоматическое отслеживание', 'Avtomatik kuzatish'],
      ['видео H.265', 'H.265 video texnologiyasi'],
      ['Видеотехнология H.265', 'H.265 video texnologiyasi'],
      ['Неуправляемый', 'Boshqarilmaydigan'],
      ['Поддержка VESA wall mount', 'VESA devor kronshteynini qo‘llab-quvvatlaydi'],
      ['1/3" Progressive Scan CMOS', '1/3 dyuymli progressiv skanerlovchi CMOS datchigi'],
      ['1/1.8" Progressive Scan CMOS', '1/1,8 dyuymli progressiv skanerlovchi CMOS datchigi'],
      ['1/2.8" Progressive Scan CMOS', '1/2,8 dyuymli progressiv skanerlovchi CMOS datchigi'],
      ['1/3" Progressive CMOS', '1/3 dyuymli progressiv CMOS datchigi'],
      ['VCA functions', 'VCA tahlil funksiyalari'],
      ['H.265+/H.265/H.264+/H.264/MJPEG', 'H.265+/H.265/H.264+/H.264/MJPEG video formatlari'],
      ['H.265+/H.265/H.264+&H.264', 'H.265+/H.265/H.264+/H.264 video formatlari'],
      ['Efficient H.265+ compression technology', 'H.265+ samarali siqish texnologiyasi'],
      ['DC12V&PoE', 'DC 12 V va PoE quvvati'],
      ['DC12V & PoE', 'DC 12 V va PoE quvvati'],
      ['Built-in micro SD/SDHC/SDXC slot', 'microSD/SDHC/SDXC kartalari uchun ichki slot'],
      ['3 streams', '3 ta video oqimi'],
      ['0 lux with IR', 'IR yoritish bilan 0 lyuks'],
      ['0 lux with LED on', 'LED yoritgichi yoqilganda 0 lyuks'],
      ['High quality imaging with', 'yuqori sifatli tasvir,'],
      ['Support Human and Vehicle Detection', 'Odam va transport vositalarini aniqlashni qo‘llab-quvvatlaydi'],
      ['Human and Vehicle Detection', 'Odam va transport vositalarini aniqlash'],
      ['Smart Hybrid Light: advanced technology with long range', 'Smart Hybrid Light: uzoq masofali ilg‘or yoritish texnologiyasi'],
      ['Smart Hybrid Light: Integrates IR and White lights', 'Smart Hybrid Light: infraqizil va oq yoritishni birlashtiradi'],
      ['Water and dust resistant (IP67)', 'Suv va changdan himoya (IP67)'],
      ['IR or white light range: up to 30m', 'IR yoki oq yorug‘lik masofasi: 30 m gacha'],
      ['IR range: up to 30m', 'IR yoritish masofasi: 30 m gacha'],
      ['up to 30m', '30 m gacha'],
      ['up to 10m', '10 m gacha'],
      ['Working humidity', 'Ishlash namligi'],
      ['10% to 90% (No condensing)', '10% dan 90% gacha (kondensatsiyasiz)'],
      ['*power supply is not included', '*quvvat adapteri to‘plamga kirmaydi'],
      ['Support mobile monitoring via HiLookVision', 'HiLookVision orqali mobil kuzatuvni qo‘llab-quvvatlaydi'],
      ['support two-way audio', 'ikki tomonlama audioni qo‘llab-quvvatlaydi'],
      ['High quality imaging', 'Yuqori sifatli tasvir'],
      ['Color night vision', 'Rangli tungi tasvir'],
      ['Panoramic coverage', 'Panoramali qamrov'],
      ['Human and Vehicle Detection', 'Odam va transport vositalarini aniqlash'],
      ['HIK-Connect cloud service', 'HIK-Connect bulut xizmati'],
      ['Hik-Connect cloud service', 'Hik-Connect bulut xizmati'],
      ['Smart IR', 'Smart IR aqlli infraqizil yoritish'],
      ['Beamforming', 'Beamforming yo‘naltirilgan signal texnologiyasi'],
      ['MU-MIMO', 'MU-MIMO ko‘p foydalanuvchili uzatish texnologiyasi'],
      ['Band Steering', 'Wi-Fi diapazonini aqlli tanlash'],
      ['Airtime Fairness', 'Efirdan foydalanish vaqtini adolatli taqsimlash'],
      ['IGMP Snooping', 'IGMP trafikini kuzatish'],
      ['802.1Q VLAN', '802.1Q VLAN virtual tarmog‘i'],
      ['STP/RSTP/MSTP', 'STP/RSTP/MSTP tarmoq protokollari'],
      ['802.1p/DSCP QoS', '802.1p/DSCP QoS trafik ustuvorligi'],
      ['Load Balance', 'Yuklamani muvozanatlash'],
      ['250m long distance transmission', '250 m gacha uzoq masofaga uzatish'],
      ['1 SATA interface', '1 ta SATA interfeysi'],
      ['standalone 1U case', 'mustaqil 1U korpus'],
      ['indoor station', 'ichki stansiya'],
      ['удаленное управление', 'masofadan boshqarish'],
      ['мобильное приложение Tapo App', 'Tapo App mobil ilovasi'],
      ['мобильное приложение Omada App', 'Omada App mobil ilovasi'],
      ['Двусторонний разговор', 'Ikki tomonlama suhbat'],
      ['двустороннее аудио', 'ikki tomonlama audio'],
      ['Цветное ночное видение', 'Rangli tungi tasvir'],
      ['Умное цветное ночное видение', 'Aqlli rangli tungi tasvir'],
      ['Панорамный вид', 'Panoramali ko‘rinish'],
      ['Активная защита с сиреной и стробоскопом', 'Sirena va miltillovchi chiroq bilan faol himoya'],
      ['Поддерживает карты MicroSD (до 512 ГБ)', '512 GB gacha MicroSD kartalarini qo‘llab-quvvatlaydi'],
      ['Поддерживает карту MicroSD (до 512 ГБ)', '512 GB gacha MicroSD kartasini qo‘llab-quvvatlaydi'],
      ['локальная запись на карту microSD (до 512 ГБ)', 'microSD kartaga mahalliy yozuv (512 GB gacha)'],
      ['звуковая и световая сигнализация', 'ovozli va yorug‘lik signalizatsiyasi'],
      ['интеллектуальное обнаружение и уведомления', 'aqlli aniqlash va bildirishnomalar'],
      ['детекция человека и транспорта', 'odam va transport vositalarini aniqlash'],
      ['обнаружение громкого шума', 'baland shovqinni aniqlash'],
      ['защита от атмосферных воздействий', 'ob-havo ta’siridan himoya'],
      ['цветное ночное видение', 'rangli tungi tasvir'],
      ['отслеживание движения', 'harakatni kuzatish'],
      ['статическая маршрутизация', 'statik marshrutlash'],
      ['балансировка нагрузки', 'yuklamani muvozanatlash'],
      ['бесшовный роуминг', 'uzluksiz rouming'],
      ['голосовое управление', 'ovozli boshqaruv'],
      ['родительский контроль', 'ota-ona nazorati'],
      ['объектив', 'obyektiv'],
      ['разрешение', 'tasvir aniqligi'],
      ['ночное видение', 'tungi tasvir'],
      ['микрофон', 'mikrofon'],
      ['металлический корпус', 'metall korpus'],
      ['2.4 ГГц', '2,4 GHz'],
      ['50/60 Гц', '50/60 Hz'],
      ['защита от атмосферных воздействий IP65', 'ob-havo ta’siridan himoya IP65']
    ],
    ru: [
      ['EZVIZ kuzatuv kamerasi', 'Камера видеонаблюдения EZVIZ'],
      ['EZVIZ quvvat va kamera aksessuari', 'Аксессуар EZVIZ для камер и питания'],
      ['Eshik oldini ko‘rish va mehmon bilan aloqa', 'Просмотр входа и связь с посетителями'],
      ['EZVIZ aqlli ekran', 'Умный экран EZVIZ'],
      ['EZVIZ aqlli eshik qulfi', 'Умный дверной замок EZVIZ'],
      ['EZVIZ aqlli uy qurilmasi', 'Устройство умного дома EZVIZ'],
      ['High quality imaging with 4 MP resolution', 'Высококачественное изображение с разрешением 4 Мп'],
      ['High quality imaging with 2 MP resolution', 'Высококачественное изображение с разрешением 2 Мп'],
      ['High quality imaging with 8 MP resolution', 'Высококачественное изображение с разрешением 8 Мп'],
      ['Specification:', 'Характеристики:'],
      ['Features:', 'Особенности:'],
      ['Support VESA wall mount', 'Поддержка настенного крепления VESA'],
      ['Unmanaged', 'Неуправляемый'],
      ['Indoor', 'Внутренний'],
      ['Outdoor', 'Уличный'],
      ['Two-way audio', 'Двусторонняя аудиосвязь'],
      ['1/3" Progressive Scan CMOS', '1/3-дюймовая CMOS-матрица с прогрессивной развёрткой'],
      ['1/1.8" Progressive Scan CMOS', '1/1,8-дюймовая CMOS-матрица с прогрессивной развёрткой'],
      ['1/2.8" Progressive Scan CMOS', '1/2,8-дюймовая CMOS-матрица с прогрессивной развёрткой'],
      ['1/3" Progressive CMOS', '1/3-дюймовая CMOS-матрица с прогрессивной развёрткой'],
      ['VCA functions', 'Функции видеоаналитики VCA'],
      ['H.265+/H.265/H.264+/H.264/MJPEG', 'Видеоформаты H.265+/H.265/H.264+/H.264/MJPEG'],
      ['H.265+/H.265/H.264+&H.264', 'Видеоформаты H.265+/H.265/H.264+/H.264'],
      ['Efficient H.265+ compression technology', 'Эффективная технология сжатия H.265+'],
      ['DC12V&PoE', 'Питание DC 12 В и PoE'],
      ['DC12V & PoE', 'Питание DC 12 В и PoE'],
      ['Built-in micro SD/SDHC/SDXC slot', 'Встроенный слот для карт microSD/SDHC/SDXC'],
      ['3 streams', '3 видеопотока'],
      ['0 lux with IR', '0 лк при включённой ИК-подсветке'],
      ['0 lux with LED on', '0 лк при включённой LED-подсветке'],
      ['Support Human and Vehicle Detection', 'Поддержка обнаружения людей и транспортных средств'],
      ['Human and Vehicle Detection', 'Обнаружение людей и транспортных средств'],
      ['Smart Hybrid Light: advanced technology with long range', 'Smart Hybrid Light: передовая технология освещения с большим радиусом действия'],
      ['Smart Hybrid Light: Integrates IR and White lights', 'Smart Hybrid Light объединяет ИК- и белую подсветку'],
      ['Water and dust resistant (IP67)', 'Защита от воды и пыли (IP67)'],
      ['IR or white light range: up to 30m', 'Дальность ИК- или белой подсветки: до 30 м'],
      ['IR range: up to 30m', 'Дальность ИК-подсветки: до 30 м'],
      ['up to 30m', 'до 30 м'],
      ['up to 10m', 'до 10 м'],
      ['Working humidity', 'Рабочая влажность'],
      ['10% to 90% (No condensing)', 'От 10% до 90% (без конденсации)'],
      ['*power supply is not included', '*блок питания не входит в комплект'],
      ['Support mobile monitoring via HiLookVision', 'Поддержка мобильного мониторинга через HiLookVision'],
      ['support two-way audio', 'поддержка двусторонней аудиосвязи'],
      ['Color night vision', 'Цветное ночное видение'],
      ['Panoramic coverage', 'Панорамный обзор'],
      ['HIK-Connect cloud service', 'Облачный сервис HIK-Connect'],
      ['Hik-Connect cloud service', 'Облачный сервис Hik-Connect'],
      ['Smart IR', 'Интеллектуальная ИК-подсветка Smart IR'],
      ['Beamforming', 'Формирование направленного сигнала Beamforming'],
      ['MU-MIMO', 'Многопользовательская технология MU-MIMO'],
      ['Band Steering', 'Автоматический выбор диапазона Wi-Fi'],
      ['Airtime Fairness', 'Справедливое распределение эфирного времени'],
      ['IGMP Snooping', 'Отслеживание IGMP-трафика'],
      ['802.1Q VLAN', 'Виртуальная сеть 802.1Q VLAN'],
      ['STP/RSTP/MSTP', 'Сетевые протоколы STP/RSTP/MSTP'],
      ['802.1p/DSCP QoS', 'Приоритизация трафика 802.1p/DSCP QoS'],
      ['Load Balance', 'Балансировка нагрузки'],
      ['250m long distance transmission', 'Передача данных на расстояние до 250 м'],
      ['1 SATA interface', '1 интерфейс SATA'],
      ['standalone 1U case', 'Отдельный корпус формата 1U'],
      ['indoor station', 'Внутренняя станция'],
      ['мобильное приложение Tapo App', 'Мобильное приложение Tapo App'],
      ['мобильное приложение Omada App', 'Мобильное приложение Omada App'],
      ['голосовое управление', 'Голосовое управление'],
      ['2.4 ГГц', '2,4 ГГц']
    ]
  };

  const specificationWords = {
    uz: [
      ['Material', 'Material'],
      ['Aluminum Alloy', 'alyuminiy qotishmasi'],
      ['Plastic', 'plastik'],
      ['Height', 'balandligi'],
      ['Heigh', 'balandligi'],
      ['Dim', 'o‘lchami'],
      ['SIZE', 'o‘lcham'],
      ['Bot', 'pastki qismi'],
      ['Round', 'dumaloq'],
      ['dia', 'diametri'],
      ['Length', 'uzunligi'],
      ['Wideth', 'kengligi'],
      ['Width', 'kengligi'],
      ['Thickness', 'qalinligi'],
      ['Battery', 'akkumulyator'],
      ['Weight', 'og‘irligi'],
      ['Raise time', 'ko‘tarilish vaqti'],
      ['Start time', 'ishga tushish vaqti'],
      ['Remote control distance', 'masofadan boshqarish masofasi'],
      ['Body', 'korpus'],
      ['cold-rolled steel', 'sovuq prokatlangan po‘lat'],
      ['powder coated', 'kukunli qoplama bilan qoplangan'],
      ['Wireless Camera', 'simsiz kamera'],
      ['Baby Monitor', 'chaqaloq monitori'],
      ['Two-Way Audio', 'ikki tomonlama audio'],
      ['Lullabies', 'alla musiqalari'],
      ['Night Vision', 'tungi ko‘rish'],
      ['Long Range', 'uzoq masofa'],
      ['Temperature Display', 'haroratni ko‘rsatish'],
      ['Indoor Security Camera', 'ichki kuzatuv kamerasi'],
      ['Automatic Car Position Lock', 'avtomobil holatini avtomatik qulflash'],
      ['Power supply', 'quvvat adapteri'],
      ['camera', 'kamera'],
      ['Camera', 'kamera'],
      ['камера', 'kamera'],
      ['умная', 'aqlli'],
      ['поворотно-наклонная', 'buriluvchi va qiyalanuvchi'],
      ['горизонтально', 'gorizontal'],
      ['идентификация детского плача', 'chaqaloq yig‘isini aniqlash'],
      ['sensor', 'datchik'],
      ['Sensor', 'datchik'],
      ['lens', 'obyektiv'],
      ['Lens', 'obyektiv'],
      ['microphone', 'mikrofon'],
      ['Microphone', 'mikrofon'],
      ['speaker', 'karnay'],
      ['Speaker', 'karnay'],
      ['Wireless', 'simsiz'],
      ['detection', 'aniqlash'],
      ['Detection', 'aniqlash'],
      ['support', 'qo‘llab-quvvatlash'],
      ['Support', 'Qo‘llab-quvvatlash'],
      ['mobile', 'mobil'],
      ['Mobile', 'Mobil'],
      ['application', 'ilova'],
      ['Application', 'Ilova'],
      ['cloud service', 'bulut xizmati'],
      ['up to', 'gacha'],
      ['Up to', 'Gacha'],
      ['Working humidity', 'ishlash namligi'],
      ['Specification', 'xususiyatlari'],
      ['Features', 'imkoniyatlari'],
      ['Resolution', 'tasvir aniqligi'],
      ['Indoor', 'ichki'],
      ['Outdoor', 'tashqi'],
      ['Night', 'tungi'],
      ['Vision', 'ko‘rish'],
      ['Smart', 'aqlli'],
      ['Network', 'tarmoq'],
      ['Alarm', 'signalizatsiya'],
      ['Detection', 'aniqlash'],
      ['Power', 'quvvat'],
      ['удаленное управление', 'masofadan boshqarish'],
      ['мобильное приложение', 'mobil ilova'],
      ['голосовое управление', 'ovozli boshqaruv'],
      ['двусторонний разговор', 'ikki tomonlama suhbat'],
      ['двустороннее аудио', 'ikki tomonlama audio'],
      ['звуковая и световая сигнализация', 'ovozli va yorug‘lik signalizatsiyasi'],
      ['локальная запись', 'mahalliy yozuv'],
      ['встроенные', 'o‘rnatilgan'],
      ['встроенный', 'o‘rnatilgan'],
      ['микрофон', 'mikrofon'],
      ['динамик', 'karnay'],
      ['обнаружение', 'aniqlash'],
      ['человека', 'odamni'],
      ['транспорта', 'transport vositasini'],
      ['карты', 'kartalarini'],
      ['карта', 'kartani'],
      ['металлический', 'metall'],
      ['корпус', 'korpus'],
      ['объектив', 'obyektiv'],
      ['разрешение', 'tasvir aniqligi'],
      ['по горизонтали', 'gorizontal'],
      ['по вертикали', 'vertikal'],
      ['поворот', 'burilish'],
      ['бесшовный роуминг', 'uzluksiz rouming'],
      ['статическая маршрутизация', 'statik marshrutlash'],
      ['родительский контроль', 'ota-ona nazorati'],
      ['до', 'gacha']
    ],
    ru: [
      ['Material', 'Материал'],
      ['Aluminum Alloy', 'алюминиевый сплав'],
      ['Plastic', 'пластик'],
      ['Height', 'высота'],
      ['Heigh', 'высота'],
      ['Dim', 'размеры'],
      ['SIZE', 'размер'],
      ['Bot', 'нижняя часть'],
      ['Round', 'круглый'],
      ['dia', 'диаметр'],
      ['Length', 'длина'],
      ['Wideth', 'ширина'],
      ['Width', 'ширина'],
      ['Thickness', 'толщина'],
      ['Battery', 'аккумулятор'],
      ['Weight', 'вес'],
      ['Raise time', 'время подъёма'],
      ['Start time', 'время запуска'],
      ['Remote control distance', 'дальность дистанционного управления'],
      ['Body', 'корпус'],
      ['cold-rolled steel', 'холоднокатаная сталь'],
      ['powder coated', 'порошковое покрытие'],
      ['Wireless Camera', 'беспроводная камера'],
      ['Baby Monitor', 'видеоняня'],
      ['Two-Way Audio', 'двусторонняя аудиосвязь'],
      ['Lullabies', 'колыбельные мелодии'],
      ['Night Vision', 'ночное видение'],
      ['Long Range', 'большая дальность'],
      ['Temperature Display', 'отображение температуры'],
      ['Indoor Security Camera', 'внутренняя камера видеонаблюдения'],
      ['Automatic Car Position Lock', 'автоматическая блокировка положения автомобиля'],
      ['Power supply', 'блок питания'],
      ['camera', 'камера'],
      ['Camera', 'камера'],
      ['sensor', 'датчик'],
      ['Sensor', 'датчик'],
      ['lens', 'объектив'],
      ['Lens', 'объектив'],
      ['microphone', 'микрофон'],
      ['Microphone', 'микрофон'],
      ['speaker', 'динамик'],
      ['Speaker', 'динамик'],
      ['Wireless', 'беспроводной'],
      ['detection', 'обнаружение'],
      ['Detection', 'обнаружение'],
      ['support', 'поддержка'],
      ['Support', 'Поддержка'],
      ['mobile', 'мобильный'],
      ['Mobile', 'Мобильный'],
      ['application', 'приложение'],
      ['Application', 'Приложение'],
      ['cloud service', 'облачный сервис'],
      ['up to', 'до'],
      ['Up to', 'До'],
      ['Working humidity', 'Рабочая влажность'],
      ['Specification', 'характеристики'],
      ['Features', 'особенности'],
      ['Resolution', 'разрешение'],
      ['Night', 'ночное'],
      ['Vision', 'видение'],
      ['Smart', 'интеллектуальный'],
      ['Network', 'сетевой'],
      ['Alarm', 'сигнализация'],
      ['Power', 'питание'],
      ['управление', 'управление'],
      ['двусторонний разговор', 'двусторонняя связь'],
      ['двустороннее аудио', 'двусторонняя аудиосвязь'],
      ['звуковая и световая сигнализация', 'звуковая и световая сигнализация'],
      ['локальная запись', 'локальная запись'],
      ['встроенные', 'встроенные'],
      ['встроенный', 'встроенный'],
      ['микрофон', 'микрофон'],
      ['динамик', 'динамик'],
      ['обнаружение', 'обнаружение'],
      ['человека', 'человека'],
      ['транспорта', 'транспорта'],
      ['карты', 'карты'],
      ['карта', 'карту'],
      ['металлический', 'металлический'],
      ['корпус', 'корпус'],
      ['объектив', 'объектив'],
      ['разрешение', 'разрешение'],
      ['по горизонтали', 'по горизонтали'],
      ['по вертикали', 'по вертикали'],
      ['поворот', 'поворот'],
      ['бесшовный роуминг', 'бесшовный роуминг'],
      ['статическая маршрутизация', 'статическая маршрутизация'],
      ['родительский контроль', 'родительский контроль'],
      ['до', 'до']
    ]
  };

  const preparedSpecificationWords = Object.fromEntries(
    Object.entries(specificationWords).map(([language, words]) => [
      language,
      words.map(([source, translated]) => [
        new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(source)}(?=$|[^\\p{L}\\p{N}])`, 'giu'),
        translated
      ])
    ])
  );

  const preparedSpecificationPhrases = Object.fromEntries(
    Object.entries(specificationPhrases).map(([language, phrases]) => [
      language,
      phrases
        .map(([source, translated]) => [source, translated, new RegExp(escapeRegExp(source), 'gi')])
        .sort((a, b) => b[0].length - a[0].length)
    ])
  );

  function normalize(value) {
    return String(value).trim().replace(/[‘’ʻʼ`]/g, "'").replace(/\s+/g, ' ').toLowerCase();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function translateSpecification(value, language = currentLanguage) {
    let result = String(value || '');
    for (const [source, translated, pattern] of preparedSpecificationPhrases[language] || []) {
      result = result.replace(pattern, translated);
    }
    for (const [pattern, translated] of preparedSpecificationWords[language] || []) {
      result = result.replace(pattern, (_match, prefix) => prefix + translated);
    }

    if (language === 'uz') {
      result = result.replace(/High quality imaging with\s*(\d+)\s*MP resolution/gi, '$1 MP tasvir aniqligida yuqori sifatli tasvir');
      result = result.replace(/tungi (ko‘rish|tasvir)\s*\(gacha\s*(\d+)\s*м\)/gi, 'tungi ko‘rish ($2 m gacha)');
    } else {
      result = result.replace(/High quality imaging with\s*(\d+)\s*MP resolution/gi, 'Высококачественное изображение с разрешением $1 Мп');
    }
    return result;
  }

  function translate(value, language = currentLanguage) {
    const text = String(value ?? '');
    if (language !== 'ru') return text;
    const leading = text.match(/^\s*/)?.[0] || '';
    const trailing = text.match(/\s*$/)?.[0] || '';
    const trimmed = text.trim();
    const exact = copy.get(normalize(trimmed));
    if (exact) return leading + exact + trailing;

    if (trimmed.includes(' · ')) {
      return leading + trimmed.split(' · ').map(part => translate(part, language)).join(' · ') + trailing;
    }

    const productCount = trimmed.match(/^([\d\s.,]+)\s*ta\s+(mahsulot|kamera)$/i);
    if (productCount) {
      const count = Number(productCount[1].replace(/\s/g, '').replace(',', '.'));
      const integer = Number.isFinite(count) ? Math.abs(Math.trunc(count)) : 0;
      const lastTwo = integer % 100;
      const last = integer % 10;
      const isCamera = productCount[2].toLowerCase() === 'kamera';
      const noun = isCamera
        ? lastTwo >= 11 && lastTwo <= 14 ? 'камер' : last === 1 ? 'камера' : 'камеры'
        : lastTwo >= 11 && lastTwo <= 14 ? 'товаров' : last === 1 ? 'товар' : last >= 2 && last <= 4 ? 'товара' : 'товаров';
      return `${leading}${productCount[1].trim()} ${noun}${trailing}`;
    }

    const sectionCount = trimmed.match(/^([\d\s]+)\s*ta\s+bo‘lim$/i);
    if (sectionCount) {
      const count = Number(sectionCount[1].replace(/\s/g, '')) || 0;
      const lastTwo = count % 100;
      const last = count % 10;
      const noun = lastTwo >= 11 && lastTwo <= 14 ? 'разделов' : last === 1 ? 'раздел' : last >= 2 && last <= 4 ? 'раздела' : 'разделов';
      return `${leading}${sectionCount[1].trim()} ${noun}${trailing}`;
    }

    const experience = trimmed.match(/^([\d\s.,]+)\s*yil tajriba$/i);
    if (experience) {
      const years = Number(experience[1].replace(/\s/g, '').replace(',', '.'));
      const integer = Math.abs(Math.trunc(years));
      const lastTwo = integer % 100;
      const last = integer % 10;
      const noun = !Number.isInteger(years) ? 'года опыта'
        : lastTwo >= 11 && lastTwo <= 14 ? 'лет опыта'
          : last === 1 ? 'год опыта'
            : last >= 2 && last <= 4 ? 'года опыта' : 'лет опыта';
      return `${leading}${experience[1].trim()} ${noun}${trailing}`;
    }

    const avatar = trimmed.match(/^(.+?)\s+avatari$/i);
    if (avatar) return `${leading}Аватар ${avatar[1]}${trailing}`;

    const quantity = trimmed.match(/^([\d\s]+)\s+dona$/i);
    if (quantity) return `${leading}${quantity[1].trim()} шт.${trailing}`;
    const itemKinds = trimmed.match(/^([\d\s]+)\s+xil\s+mahsulot$/i);
    if (itemKinds) return `${leading}${itemKinds[1].trim()} вида товара${trailing}`;

    const dynamicLabels = [
      [/^Brend:\s*/i, 'Бренд: '],
      [/^Narx:\s*/i, 'Цена: '],
      [/^Sana:\s*/i, 'Дата: '],
      [/^Yetkazib berish:\s*/i, 'Доставка: '],
      [/^Joriy holat:\s*/i, 'Текущий статус: ']
    ];
    for (const [pattern, replacement] of dynamicLabels) {
      if (pattern.test(trimmed)) {
        const rest = trimmed.replace(pattern, '');
        return leading + replacement + translate(rest, language) + trailing;
      }
    }

    const currency = trimmed.match(/^(.+?)\s*so['’‘ʻʼ]?m$/i);
    if (currency) return `${leading}${currency[1].trim()} сум${trailing}`;
    return leading + trimmed + trailing;
  }

  let currentLanguage = 'uz';
  try {
    currentLanguage = localStorage.getItem('uzcam-language') === 'ru' ? 'ru' : 'uz';
  } catch {
    currentLanguage = 'uz';
  }
  document.documentElement.lang = currentLanguage;

  const originalText = new WeakMap();
  const lastText = new WeakMap();
  const originalAttributes = new WeakMap();
  const lastAttributes = new WeakMap();
  const originalTitle = document.title;

  function translateTextNode(node) {
    const current = node.nodeValue;
    if (!current || !current.trim()) return;
    const previousOutput = lastText.get(node);
    const source = previousOutput === current ? originalText.get(node) : current;
    const specification = node.parentElement?.closest?.('[data-i18n-spec]')?.dataset.i18nSpec;
    const translated = specification
      ? translateSpecification(specification, currentLanguage)
      : translate(source, currentLanguage);
    originalText.set(node, source);
    lastText.set(node, translated);
    if (translated !== current) node.nodeValue = translated;
  }

  function translateAttribute(element, name) {
    const current = element.getAttribute(name);
    if (!current) return;
    const previousOutput = lastAttributes.get(element)?.get(name);
    const source = previousOutput === current ? originalAttributes.get(element)?.get(name) : current;
    const translated = translate(source, currentLanguage);
    if (!originalAttributes.has(element)) originalAttributes.set(element, new Map());
    if (!lastAttributes.has(element)) lastAttributes.set(element, new Map());
    originalAttributes.get(element).set(name, source);
    lastAttributes.get(element).set(name, translated);
    if (translated !== current) element.setAttribute(name, translated);
  }

  function applyLanguage() {
    document.documentElement.lang = currentLanguage;
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, 4);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (parent && !parent.closest('script, style, noscript, textarea, [data-language-toggle]')) {
        translateTextNode(node);
      }
      node = walker.nextNode();
    }
    document.body.querySelectorAll('*').forEach(element => {
      if (element.closest('script, style, noscript, textarea, [data-language-toggle]')) return;
      ['aria-label', 'placeholder', 'title', 'alt'].forEach(name => translateAttribute(element, name));
    });
    document.title = translate(originalTitle, currentLanguage);
  }

  function updateLanguageButtons() {
    const switcher = document.querySelector('.language-switch');
    if (switcher) {
      switcher.setAttribute('aria-label', currentLanguage === 'ru' ? 'Выберите язык' : 'Tilni tanlang');
      const uzbek = switcher.querySelector('[data-language="uz"]');
      const russian = switcher.querySelector('[data-language="ru"]');
      uzbek?.setAttribute('aria-label', currentLanguage === 'ru' ? 'Узбекский' : 'O‘zbekcha');
      russian?.setAttribute('aria-label', currentLanguage === 'ru' ? 'Русский' : 'Ruscha');
    }
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === currentLanguage));
    });
  }

  function ensureLanguageSwitch() {
    if (!document.body || document.querySelector('.language-switch')) return;
    const switcher = document.createElement('nav');
    switcher.className = 'language-switch';
    switcher.setAttribute('aria-label', 'Tilni tanlang');
    switcher.setAttribute('data-language-toggle', '');
    switcher.innerHTML = '<button type="button" data-language="uz" aria-label="O‘zbekcha">UZ</button><button type="button" data-language="ru" aria-label="Ruscha">RU</button>';
    const host = document.querySelector('#home.top, .topbar, header');
    if (host) host.append(switcher);
    else document.body.prepend(switcher);
    updateLanguageButtons();
  }

  function setLanguage(language) {
    currentLanguage = language === 'ru' ? 'ru' : 'uz';
    try {
      localStorage.setItem('uzcam-language', currentLanguage);
    } catch {
      // The selected language still applies for this page when storage is unavailable.
    }
    ensureLanguageSwitch();
    updateLanguageButtons();
    applyLanguage();
    window.dispatchEvent(new CustomEvent('uzcam:languagechange', { detail: { language: currentLanguage } }));
    return currentLanguage;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-language]');
    if (button) setLanguage(button.dataset.language);
  });
  document.addEventListener('DOMContentLoaded', () => {
    ensureLanguageSwitch();
    applyLanguage();
  }, { once: true });
  window.addEventListener('storage', event => {
    if (event.key === 'uzcam-language' && event.newValue) setLanguage(event.newValue);
  });

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target);
      if (record.type === 'childList') {
        record.addedNodes.forEach(node => {
          if (node.nodeType === 3) translateTextNode(node);
          else if (node.nodeType === 1) {
            const walker = document.createTreeWalker(node, 4);
            let textNode = walker.nextNode();
            while (textNode) {
              if (!textNode.parentElement?.closest('script, style, noscript, textarea, [data-language-toggle]')) {
                translateTextNode(textNode);
              }
              textNode = walker.nextNode();
            }
            if (node.matches?.('*')) {
              ['aria-label', 'placeholder', 'title', 'alt'].forEach(name => translateAttribute(node, name));
              node.querySelectorAll?.('*').forEach(element => ['aria-label', 'placeholder', 'title', 'alt'].forEach(name => translateAttribute(element, name)));
            }
          }
        });
      }
      if (record.type === 'attributes') translateAttribute(record.target, record.attributeName);
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-label', 'placeholder', 'title', 'alt'],
    characterData: true,
    childList: true,
    subtree: true
  });

  window.UzCamI18n = {
    get language() { return currentLanguage; },
    setLanguage,
    translate,
    translateSpecification
  };
})();
