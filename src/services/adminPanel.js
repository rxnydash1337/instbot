/** Админ панель — доступ только по секретному пути (ADMIN_PATH), не по /admin */
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import InstagramService from './instagramService.js';
import PostSettingsService from './postSettingsService.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';
import { securityHeaders, clearLoginAttempts, sanitizePostId, sanitizeWordId } from '../utils/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const uploadsDir = path.join(projectRoot, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 6) || '.bin';
    const safeExt = /^\.(jpe?g|png|gif|webp|pdf)$/.test(ext) ? ext : '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_MIMES.includes(mime)) return cb(null, true);
    cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP) и PDF'));
  },
});

const SESSION_COOKIE = 'admin_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((s) => {
      const eq = s.trim().indexOf('=');
      const k = eq >= 0 ? s.slice(0, eq).trim() : s.trim();
      const v = eq >= 0 ? s.slice(eq + 1).trim() : '';
      return [decodeURIComponent(k), decodeURIComponent(v)];
    })
  );
}

class AdminPanel {
  constructor(instagramService, telegramBotService) {
    this.app = express();
    this.app.use(express.json({ limit: '100kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '100kb' }));
    this.instagramService = instagramService;
    this.telegramBotService = telegramBotService;
    this.postSettingsService = new PostSettingsService();
    this.server = null;
    this.port = config.admin.port || 3002;
    this.password = config.admin.password || 'admin';
    this.adminPath = (config.admin.path || 'x7k2m9p').replace(/^\/+|\/+$/g, '') || 'x7k2m9p';
    this.basePath = '/' + this.adminPath;
    this.sessions = new Set();
  }

  checkAuth(req, res, next) {
    // Без авторизации: страница входа, API входа и вся статика /admin/* (все .js, .css и т.д.)
    if (req.path === '/login' || req.path === '/api/login' || req.path.startsWith('/admin/')) {
      return next();
    }
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token && this.sessions.has(token)) {
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    return res.redirect(this.basePath + '/login');
  }

  setupRoutes() {
    // Любой запрос не под секретным путём — 404 (на bazkod.ru не светим админку)
    this.app.use((req, res, next) => {
      const path = (req.path || '').replace(/^\/+/, '').replace(/\/+$/, '');
      const isUnderSecret = path === this.adminPath || path.startsWith(this.adminPath + '/');
      if (!isUnderSecret) {
        return res.status(404).end();
      }
      next();
    });

    const router = express.Router({ mergeParams: true });

    router.use(securityHeaders);
    router.use(this.checkAuth.bind(this));

    router.use('/admin', express.static('public/admin'));
    router.use(express.static('public'));

    router.get('/login', (req, res) => {
      res.sendFile('login.html', { root: 'public/admin' });
    });

    router.post('/api/login', (req, res) => {
      const { username, password } = req.body || {};
      const p = (process.env.ADMIN_PASSWORD || '').trim();
      const adminPassword = p || config.admin.password || 'admin';
      if (username === 'admin' && password && password === adminPassword) {
        clearLoginAttempts(req);
        const token = crypto.randomBytes(32).toString('hex');
        this.sessions.add(token);
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=${this.basePath}; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE / 1000}${secure}`);
        return res.json({ success: true });
      }
      res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    });

    router.post('/api/logout', (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE];
      if (token) this.sessions.delete(token);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=${this.basePath}; HttpOnly; Max-Age=0`);
      res.json({ success: true });
    });

    router.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public/admin' });
    });

    router.post('/api/upload', (req, res, next) => {
      upload.single('file')(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: err.message || 'Недопустимый тип или размер файла' });
        }
        if (!req.file) {
          return res.status(400).json({ error: 'Файл не выбран' });
        }
        const url = `${config.publicUrl.replace(/\/$/, '')}/uploads/${req.file.filename}`;
        res.json({ url });
      });
    });

    // API: Получить все посты (при недоступности Instagram — пустой массив)
    router.get('/api/posts', async (req, res) => {
      try {
        const posts = await this.instagramService.getRecentPosts(50);
        const settings = this.postSettingsService.getAllSettings();
        const postsWithSettings = posts.map(post => ({
          id: post.id,
          caption: post.caption || '',
          permalink: post.permalink || '',
          timestamp: post.timestamp || '',
          mediaType: post.media_type || 'IMAGE',
          settings: settings[post.id] || null,
        }));
        res.json(postsWithSettings);
      } catch (error) {
        logger.error('Ошибка получения постов (Instagram недоступен)', error);
        res.json([]);
      }
    });

    // API: Кодовые слова без Instagram (?start=слово)
    router.get('/api/words', (req, res) => {
      res.json(this.postSettingsService.getAllWordSettings());
    });

    router.post('/api/words', (req, res) => {
      const { codeWord, telegramMessage, redirectUrl, enabled, telegramMedia, telegramButtons } = req.body || {};
      const word = (codeWord || '').trim().slice(0, 100);
      if (!word) {
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }
      let finalRedirectUrl = redirectUrl;
      if (!finalRedirectUrl && this.telegramBotService?.getBotStartUrl) {
        finalRedirectUrl = this.telegramBotService.getBotStartUrl(word);
      }
      const success = this.postSettingsService.setWordSettings(word, {
        telegramMessage,
        redirectUrl: finalRedirectUrl,
        enabled: enabled !== false,
        telegramMedia: telegramMedia && telegramMedia.url ? telegramMedia : null,
        telegramButtons: Array.isArray(telegramButtons) ? telegramButtons : [],
      });
      if (success) {
        res.json({ success: true, message: 'Сохранено' });
      } else {
        res.status(500).json({ error: 'Ошибка сохранения' });
      }
    });

    router.delete('/api/words/:id', (req, res) => {
      const id = sanitizeWordId(req.params.id);
      if (!id) return res.status(404).json({ error: 'Не найдено' });
      const success = this.postSettingsService.deleteWordSettings(id);
      if (success) {
        res.json({ success: true, message: 'Удалено' });
      } else {
        res.status(404).json({ error: 'Не найдено' });
      }
    });

    // API: Получить настройки поста
    router.get('/api/posts/:postId/settings', (req, res) => {
      const postId = sanitizePostId(req.params.postId);
      if (!postId) return res.status(404).json({ error: 'Не найдено' });
      const settings = this.postSettingsService.getPostSettings(postId);
      res.json(settings || {});
    });

    // API: Сохранить настройки поста
    router.post('/api/posts/:postId/settings', (req, res) => {
      const postId = sanitizePostId(req.params.postId);
      if (!postId) return res.status(404).json({ error: 'Не найдено' });
      const { codeWord, commentReply, directReply, redirectUrl, telegramMessage, enabled, telegramMedia, telegramButtons } = req.body;

      if (!codeWord) {
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }

      let finalRedirectUrl = redirectUrl;
      if (!finalRedirectUrl && this.telegramBotService && this.telegramBotService.getBotStartUrl) {
        finalRedirectUrl = this.telegramBotService.getBotStartUrl(codeWord);
      }

      const success = this.postSettingsService.setPostSettings(postId, codeWord, {
        commentReply,
        directReply,
        redirectUrl: finalRedirectUrl,
        telegramMessage,
        enabled,
        telegramMedia: telegramMedia && telegramMedia.url ? telegramMedia : null,
        telegramButtons: Array.isArray(telegramButtons) ? telegramButtons : [],
      });

      if (success) {
        res.json({ success: true, message: 'Настройки сохранены' });
      } else {
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
      }
    });

    // API: Получить информацию о Telegram боте
    router.get('/api/telegram/info', (req, res) => {
      if (!this.telegramBotService || typeof this.telegramBotService.getBotUrl !== 'function') {
        return res.json({ available: false });
      }
      const botUrl = this.telegramBotService.getBotUrl();
      const botUsername = this.telegramBotService.getBotUsername();
      const available = !!(botUrl && botUsername);
      res.json({
        available,
        botUrl: available ? botUrl : null,
        botUsername: available ? botUsername : null,
      });
    });

    // API: Удалить настройки поста
    router.delete('/api/posts/:postId/settings', (req, res) => {
      const postId = sanitizePostId(req.params.postId);
      if (!postId) return res.status(404).json({ error: 'Не найдено' });
      const success = this.postSettingsService.deletePostSettings(postId);
      if (success) {
        res.json({ success: true, message: 'Настройки удалены' });
      } else {
        res.status(404).json({ error: 'Настройки не найдены' });
      }
    });

    this.app.use(this.basePath, router);
  }

  start() {
    this.setupRoutes();
    
    this.server = this.app.listen(this.port, () => {
      const pwdSet = !!(process.env.ADMIN_PASSWORD || '').trim();
      const adminUrl = `${config.publicUrl}${this.basePath}`;
      logger.info(`Админ панель только по секретному пути: ${adminUrl}`);
      if (!pwdSet) logger.warn('ADMIN_PASSWORD не задан — используется admin');
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      logger.info('Админ панель остановлена');
    }
  }

  getPostSettingsService() {
    return this.postSettingsService;
  }
}

export default AdminPanel;

