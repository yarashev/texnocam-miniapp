export function normalizeMarkupPercent(value) {
  if (value === null || value === undefined || String(value).trim() === '') throw Object.assign(new RangeError('Ustama 0–300 foiz oralig‘ida bo‘lishi kerak'), { statusCode: 400 });
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 300) throw Object.assign(new RangeError('Ustama 0–300 foiz oralig‘ida bo‘lishi kerak'), { statusCode: 400 });
  return Math.round(percent * 100) / 100;
}
export function calculateSalePrice(sourcePrice, rate, markupPercent) {
  const cost = Number(sourcePrice), exchangeRate = Number(rate), markup = normalizeMarkupPercent(markupPercent);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) throw Object.assign(new RangeError('Manba narxi va valyuta kursini tekshiring'), { statusCode: 400 });
  const price = Math.round(cost * exchangeRate * (1 + markup / 100));
  if (!Number.isSafeInteger(price) || price <= 0 || price > 1e12) throw Object.assign(new RangeError('Hisoblangan sotuv narxi ruxsat etilgan chegaradan tashqarida'), { statusCode: 400 });
  return price;
}
