import { readFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('./product-specifications.json', import.meta.url), 'utf8'));
if (!Array.isArray(source)) throw new Error('Product specifications must be an array');

function foldModel(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/([0-9]),(?=[0-9])/g, '$1.')
    .replace(/[^\p{L}\p{N}.]/gu, '');
}

export function normalizeProductModel(value) {
  return foldModel(value);
}

function modelTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/([0-9]),(?=[0-9])/g, '$1.')
    .match(/[\p{L}\p{N}]+(?:\.[\p{N}]+)?/gu) || [];
}

const byModel = new Map();
const byFirstNameToken = new Map();
for (const entry of source) {
  if (!entry || typeof entry.model !== 'string' || typeof entry.specification !== 'string' || !entry.specification.trim()) {
    throw new Error('Invalid product specification record');
  }
  const key = normalizeProductModel(entry.model);
  if (!key || byModel.has(key)) throw new Error('Duplicate or empty product model in specifications');
  byModel.set(key, entry.specification);

  const tokens = modelTokens(entry.model);
  if (tokens.length < 2 || tokens.join('').length < 4) continue;
  const matches = byFirstNameToken.get(tokens[0]) || [];
  matches.push({ tokens, specification: entry.specification, length: tokens.join('').length });
  byFirstNameToken.set(tokens[0], matches);
}

function containsTokens(nameTokens, modelTokensToFind, start) {
  return modelTokensToFind.every((token, index) => nameTokens[start + index] === token);
}

export function getProductSpecification(model, name = '') {
  const exact = byModel.get(normalizeProductModel(model));
  if (exact) return exact;

  const nameTokens = modelTokens(name);
  let bestScore = [0, 0];
  let bestSpecification = '';
  let ambiguous = false;
  for (let start = 0; start < nameTokens.length; start++) {
    for (const candidate of byFirstNameToken.get(nameTokens[start]) || []) {
      if (!containsTokens(nameTokens, candidate.tokens, start)) continue;
      const score = [candidate.tokens.length, candidate.length];
      if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
        bestScore = score;
        bestSpecification = candidate.specification;
        ambiguous = false;
      } else if (score[0] === bestScore[0] && score[1] === bestScore[1] && candidate.specification !== bestSpecification) {
        ambiguous = true;
      }
    }
  }
  return ambiguous ? '' : bestSpecification;
}
