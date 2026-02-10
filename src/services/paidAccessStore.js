/**
 * Хранилище оплат и доступа к курсу по коду из ЮKassa.
 * Код передаётся в return_url и в боте ?start=CODE — по нему выдаём полный доступ.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const storeFile = path.join(projectRoot, 'data', 'paid-access.json');

function ensureDataDir() {
  const dataDir = path.dirname(storeFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function load() {
  try {
    if (fs.existsSync(storeFile)) {
      return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    }
  } catch (e) {
    logger.warn('paidAccessStore load error', e);
  }
  return { payments: {} };
}

function save(data) {
  ensureDataDir();
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf8');
}

let state = load();

function persist() {
  save(state);
}

/** Добавить ожидающий платёж (до редиректа на ЮKassa) */
export function addPending(accessCode, { amount, tariffId }) {
  state.payments[accessCode] = {
    status: 'pending',
    amount,
    tariffId,
    createdAt: new Date().toISOString(),
  };
  persist();
}

/** Отметить платёж как оплаченный (вызов из webhook ЮKassa) */
export function markPaid(accessCode) {
  if (!state.payments[accessCode]) {
    state.payments[accessCode] = { status: 'pending', amount: 0, tariffId: '', createdAt: new Date().toISOString() };
  }
  state.payments[accessCode].status = 'paid';
  state.payments[accessCode].paidAt = new Date().toISOString();
  persist();
}

/** Оплачен ли код (после webhook) */
export function isPaid(accessCode) {
  return state.payments[accessCode]?.status === 'paid';
}

/** Активировать код для chatId (один код = один пользователь). Возвращает true, если активация прошла. */
export function activateCode(accessCode, chatId) {
  const p = state.payments[accessCode];
  if (!p || p.status !== 'paid') return false;
  if (p.chatId) return p.chatId === String(chatId); // уже активирован этим юзером
  p.chatId = String(chatId);
  persist();
  return true;
}

/** Есть ли у этого chatId полный доступ к курсу */
export function hasAccess(chatId) {
  const id = String(chatId);
  return Object.values(state.payments).some(p => p.status === 'paid' && p.chatId === id);
}

/** Данные по коду (для логов) */
export function getPayment(accessCode) {
  return state.payments[accessCode] || null;
}

export default {
  addPending,
  markPaid,
  isPaid,
  activateCode,
  hasAccess,
  getPayment,
};
