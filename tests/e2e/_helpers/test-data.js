/**
 * Test data factory для E2E тестів.
 * Генерує унікальні дані щоб уникнути collision при паралельних запусках.
 */

function randomDigits(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
}

function randomLetters(length) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters[Math.floor(Math.random() * letters.length)];
  }
  return result;
}

/**
 * Генерує валідну warranty registration data.
 * Серійник: HE + 2 літери + 6 цифр (наприклад: HEAB123456)
 * Телефон: +380XXXXXXXXX (UA mobile)
 */
export function generateWarrantyData(overrides = {}) {
  const timestamp = Date.now();
  return {
    firstName: 'Тест',
    lastName: `E2E-${timestamp}`,
    phone: `+38050${randomDigits(7)}`,
    email: `e2e-${timestamp}@playwright.test`,
    model: 'Hecht 5474',
    serialNumber: `HE${randomLetters(2)}${randomDigits(6)}`,
    purchaseDate: '2026-04-01',
    ...overrides,
  };
}

/**
 * Test SC credentials (production test user — pre-launch cleanup ~10-12.05).
 * Master Doc v1.3 розділ 8.4 #2.
 */
export const TEST_SC = {
  username: 'testsc',
  // password у GitHub Actions secret: TEST_SC_PASSWORD
};

/**
 * URLs (відносно baseURL з playwright.config.js).
 */
export const URLS = {
  home: '/',
  privacy: '/privacy',
  terms: '/umovi-pryymky',
  legal: '/pravova-informatsiya',
  adminLogin: '/admin',
  scPanel: '/admin/service-panel',
};
