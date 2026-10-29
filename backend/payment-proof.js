export const MAX_PAYMENT_PROOF_BYTES = 3 * 1024 * 1024;

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function detectImageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

export function parsePaymentProof(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('To‘lov chekini yuklang');
  }
  const contentType = String(input.contentType || '').toLowerCase();
  if (!allowedTypes.has(contentType)) throw invalid('Chek faqat PNG, JPG yoki WEBP formatida bo‘lsin');
  const base64 = input.base64;
  const maxEncodedLength = Math.ceil(MAX_PAYMENT_PROOF_BYTES / 3) * 4;
  if (typeof base64 !== 'string' || !base64) throw invalid('To‘lov chekini yuklang');
  if (base64.length > maxEncodedLength) throw invalid('Chek hajmi 3 MB dan oshmasin', 413);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw invalid('Chek fayli noto‘g‘ri');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_PAYMENT_PROOF_BYTES || bytes.toString('base64') !== base64) {
    throw invalid('Chek fayli bo‘sh yoki hajmi noto‘g‘ri');
  }
  if (detectImageType(bytes) !== contentType) throw invalid('Chek faylining turi mazmuniga mos kelmadi');
  return { contentType, bytes };
}
