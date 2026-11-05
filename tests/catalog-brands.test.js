import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/catalog-brands.js';

const { defaults, matchesSection } = globalThis.UzCamBrandConfig;
const hardDrives = defaults.find(section => section.id === 'hard-drives');

test('hard drive section contains hard disks and USB flash drives only', () => {
  const products = [
    { id: 1, name: 'HDD 500GB', model: 'HDD 500GB', category: 'Xotira qurilmalari' },
    { id: 2, name: 'SEAGATE SKYHAWK HDD-4TB', model: 'ST4000', category: 'Xotira qurilmalari' },
    { id: 3, name: 'WD HDD 10TB HC330', model: 'WD HDD 10TB', category: 'Xotira qurilmalari' },
    { id: 4, name: 'Флешка 128гб', model: 'Флешка 128гб', category: 'Xotira qurilmalari' },
    { id: 5, name: 'USB Flash Drive 64GB', model: 'USB Flash Drive', category: 'Xotira qurilmalari' }
  ];
  assert.deepEqual(products.map(product => matchesSection(product, hardDrives)), [true, true, true, true, true]);
});

test('hard drive section excludes NVRs, cameras and generic intercom storage', () => {
  const products = [
    { name: 'HL-NVR-464MH-K', model: 'HL-NVR-464MH-K HDD support', description: 'HDD', category: 'Xotira qurilmalari' },
    { name: 'DS-7608NXI-K1', model: 'DS-7608NXI-K1', description: 'PoE', category: 'Xotira qurilmalari' },
    { name: 'DS-2CD2043G2-I', model: 'DS-2CD2043G2-I', category: 'Xotira qurilmalari' },
    { name: 'Накопитель для домофон', model: 'Накопитель для домофон', category: 'Xotira qurilmalari' }
  ];
  assert.deepEqual(products.map(product => matchesSection(product, hardDrives)), [false, false, false, false]);
});
