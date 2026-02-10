/**
 * Безопасность: заголовки, rate limit, валидация.
 */

const RATE_WINDOW_MS = 60 * 1000;       // 1 мин для join
const RATE_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 мин для login
const RATE_JOIN_MAX = 20;                // запросов на создание платежа с одного IP
const RATE_LOGIN_MAX = 5;                // попыток входа с одного IP

const joinCounts = new Map();
const loginCounts = new Map();

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function cleanupMap(map, windowMs) {
  const now = Date.now();
  for (const [key, v] of map.entries()) {
    if (v.resetAt < now) map.delete(key);
  }
}

/** Rate limit: не более N запросов за окно (по IP) */
export function rateLimitJoin(req, res, next) {
  const ip = getClientIp(req);
  cleanupMap(joinCounts, RATE_WINDOW_MS);
  const rec = joinCounts.get(ip) || { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };
  rec.count++;
  joinCounts.set(ip, rec);
  if (rec.count > RATE_JOIN_MAX) {
    return res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже.' });
  }
  next();
}

export function rateLimitLogin(req, res, next) {
  const ip = getClientIp(req);
  cleanupMap(loginCounts, RATE_LOGIN_WINDOW_MS);
  const rec = loginCounts.get(ip) || { count: 0, resetAt: Date.now() + RATE_LOGIN_WINDOW_MS };
  rec.count++;
  loginCounts.set(ip, rec);
  if (rec.count > RATE_LOGIN_MAX) {
    return res.status(429).json({ success: false, error: 'Слишком много попыток входа. Подождите 15 минут.' });
  }
  next();
}

/** Сбросить счётчик попыток входа для IP (после успешного входа) */
export function clearLoginAttempts(req) {
  const ip = getClientIp(req);
  loginCounts.delete(ip);
}

/** Заголовки безопасности для всех ответов */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
}

/** Ограничение размера JSON body (уже через express.json({ limit }), вызывать до роутов) */
export const jsonBodyLimit = '50kb';

/** Валидация: код доступа (только для webhook/query) */
export function isValidAccessCode(code) {
  return typeof code === 'string' && /^[a-z2-9]{8,20}$/i.test(code.trim());
}

/** Валидация: сумма платежа (руб) */
export function isValidAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n >= 1 && n <= 9999999.99;
}

/** Валидация: tariffId */
export function isValidTariffId(id) {
  return typeof id === 'string' && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}

/** Валидация: описание платежа */
export function sanitizeDescription(desc) {
  if (desc == null) return '';
  const s = String(desc).trim();
  return s.slice(0, 500);
}

/** Валидация: postId только цифры */
export function sanitizePostId(postId) {
  const s = String(postId || '').trim();
  return /^\d+$/.test(s) ? s : null;
}

/** Валидация: id кодового слова (word:xxx) для delete */
export function sanitizeWordId(id) {
  const s = String(id || '').trim();
  return /^word:[a-z0-9_-]+$/i.test(s) && s.length <= 80 ? s : null;
}
