import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const localizationSource = readFileSync(new URL('../assets/i18n.js', import.meta.url), 'utf8');

function loadLocalization(initialLanguage = 'uz') {
  const values = new Map([['uzcam-language', initialLanguage]]);
  const document = {
    title: 'UzCam — Elektronika va xavfsizlik',
    documentElement: { lang: 'uz' },
    body: null,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const window = {
    addEventListener() {},
    dispatchEvent() {},
    UzCamI18n: null
  };
  class MutationObserver {
    observe() {}
  }
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  vm.runInNewContext(localizationSource, {
    window,
    document,
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value)
    },
    MutationObserver,
    CustomEvent
  });
  return { api: window.UzCamI18n, document, values };
}

test('language selection persists and provides Russian UI strings and counts', () => {
  const { api, document, values } = loadLocalization();

  assert.equal(api.translate('Savatcha'), 'Savatcha');
  assert.equal(api.setLanguage('ru'), 'ru');
  assert.equal(document.documentElement.lang, 'ru');
  assert.equal(values.get('uzcam-language'), 'ru');
  assert.equal(api.translate('Savatcha'), 'Корзина');
  assert.equal(api.translate('1 ta mahsulot'), '1 товар');
  assert.equal(api.translate('4 ta mahsulot'), '4 товара');
  assert.equal(api.translate('12 ta mahsulot'), '12 товаров');
  assert.equal(api.translate('2 ta kamera'), '2 камеры');
  assert.equal(api.translate('Narx: Arzon'), 'Цена: Дешёвые');
  assert.equal(api.translate('3 ta bo‘lim'), '3 раздела');
  assert.equal(api.translate('2 dona'), '2 шт.');
  assert.equal(api.translate('Tapo · Arzonidan'), 'Tapo · Сначала дешевле');

  const restored = loadLocalization('ru');
  assert.equal(restored.api.language, 'ru');
  assert.equal(restored.document.documentElement.lang, 'ru');
});

test('specifications translate common English and Russian characteristics while preserving model identifiers', () => {
  const { api } = loadLocalization();
  const specification = 'High quality imaging with 4 MP resolution; DC12V&PoE; CS-H6C Pro';

  assert.match(api.translateSpecification(specification, 'uz'), /4 MP tasvir aniqligida/);
  assert.match(api.translateSpecification(specification, 'uz'), /DC 12 V va PoE/);
  assert.match(api.translateSpecification(specification, 'uz'), /CS-H6C Pro/);
  assert.equal(
    api.translateSpecification('Цветное ночное видение; Панорамный вид.', 'uz'),
    'Rangli tungi tasvir; Panoramali ko‘rinish.'
  );
  const ezvizSpecification = api.translateSpecification(
    'Разрешение 5MP 3K. Панорамный вид. Режим патрулирования. Сенсорная кнопка вызова. Интеллектуальное обнаружение формы человека.',
    'uz'
  );
  assert.match(ezvizSpecification, /tasvir aniqligi 5MP 3K/);
  assert.match(ezvizSpecification, /Patrul rejimi/);
  assert.match(ezvizSpecification, /Sensorli chaqiruv tugmasi/);
  assert.match(ezvizSpecification, /Odam gavdasini aqlli aniqlash/);
  assert.doesNotMatch(ezvizSpecification, /Панорамный вид|Режим патрулирования|Сенсорная кнопка вызова/);
  assert.match(api.translateSpecification(specification, 'ru'), /Высококачественное изображение с разрешением 4 Мп/);

  const tapoSpecification = 'Умная поворотно-наклонная Wi-Fi камера Спецификация: 1080p, 2,4 ГГц, горизонтально 360º Особенности: поворотно-наклонная, интеллектуальное обнаружение и уведомления (движение, люди, идентификация детского плача), отслеживание движения, звуковая и световая сигнализация, удаленное управление, двусторонняя аудиосвязь, Голосовое управление (поддержка Google Assistant и Amazon Alexa), локальная запись на карту microSD (до 512 ГБ), Мобильное приложение Tapo App, ночное видение (до 12 м)';
  const translatedTapo = api.translateSpecification(tapoSpecification, 'uz');
  assert.match(translatedTapo, /Aqlli buriluvchi Wi-Fi kamera/);
  assert.match(translatedTapo, /aqlli aniqlash va xabarnomalar/);
  assert.match(translatedTapo, /tungi ko‘rish \(12 m gacha\)/);
  assert.doesNotMatch(translatedTapo, /Спецификация|Особенности|движение|люди|ночное видение/);
});
