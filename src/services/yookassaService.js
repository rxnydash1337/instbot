/**
 * ЮKassa: создание платежа для оплаты курса.
 * Документация: https://yookassa.ru/developers/api
 */
import { logger } from '../utils/logger.js';

const YOOKASSA_API = 'https://api.yookassa.ru/v3';

function generateAccessCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class YooKassaService {
  constructor(paidAccessStore = null) {
    this.shopId = process.env.YOOKASSA_SHOP_ID || '';
    this.secretKey = process.env.YOOKASSA_SECRET_KEY || '';
    this.paidAccessStore = paidAccessStore;
    this.enabled = !!(this.shopId && this.secretKey);
    if (!this.enabled) {
      logger.warn('ЮKassa: YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не заданы, оплата отключена');
    }
  }

  _authHeader() {
    const token = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  /**
   * Создать платёж. Возвращает { paymentId, confirmationUrl } или null при ошибке.
   * @param {Object} opts - amount (руб), description, returnUrl (успех), cancelUrl (отмена)
   */
  async createPayment(opts = {}) {
    if (!this.enabled) return null;

    const amount = opts.amount ?? parseFloat(process.env.COURSE_PRICE) || 0;
    const tariffId = opts.tariffId || '';
    const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const accessCode = generateAccessCode();
    const returnUrl = opts.returnUrl || process.env.PAYMENT_SUCCESS_URL || `${publicUrl}/payment/success?code=${accessCode}`;
    const description = opts.description || process.env.COURSE_PAYMENT_DESCRIPTION || 'Оплата курса «Базовый код спокойствия»';

    const value = String(Number(amount).toFixed(2));
    if (Number(value) <= 0) {
      logger.warn('ЮKassa: сумма платежа должна быть > 0');
      return null;
    }

    if (this.paidAccessStore) {
      this.paidAccessStore.addPending(accessCode, { amount: Number(value), tariffId });
    }

    const idempotenceKey = `join-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const body = {
      amount: { value, currency: 'RUB' },
      payment_method_data: { type: 'bank_card' },
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      capture: true,
      description,
      metadata: {
        source: 'landing_join',
        access_code: accessCode,
        tariff_id: tariffId || '',
      },
    };

    try {
      const res = await fetch(`${YOOKASSA_API}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
          ...this._authHeader(),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        logger.error('ЮKassa createPayment error:', data);
        return null;
      }

      const confirmationUrl = data.confirmation?.confirmation_url || null;
      if (!confirmationUrl) {
        logger.error('ЮKassa: в ответе нет confirmation_url', data);
        return null;
      }

      logger.info('ЮKassa: платёж создан', data.id, 'code:', accessCode);
      return {
        paymentId: data.id,
        confirmationUrl,
        accessCode,
        status: data.status,
      };
    } catch (err) {
      logger.error('ЮKassa createPayment exception', err);
      return null;
    }
  }
}
