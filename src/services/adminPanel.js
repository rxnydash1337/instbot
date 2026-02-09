/** Админ панель для управления настройками постов */
import crypto from 'crypto';
import express from 'express';
import InstagramService from './instagramService.js';
import PostSettingsService from './postSettingsService.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

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
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.instagramService = instagramService;
    this.telegramBotService = telegramBotService;
    this.postSettingsService = new PostSettingsService();
    this.server = null;
    this.port = config.admin.port || 3002;
    this.password = config.admin.password || 'admin';
    this.sessions = new Set();
  }

  checkAuth(req, res, next) {
    const publicPaths = ['/login', '/admin/login.html', '/admin/style.css'];
    if (publicPaths.includes(req.path) || req.path === '/api/login') {
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
    return res.redirect('/login');
  }

  setupRoutes() {
    this.app.use(this.checkAuth.bind(this));

    this.app.use('/admin', express.static('public/admin'));
    this.app.use(express.static('public'));

    this.app.get('/login', (req, res) => {
      res.sendFile('login.html', { root: 'public/admin' });
    });

    this.app.post('/api/login', (req, res) => {
      const { username, password } = req.body || {};
      const p = (process.env.ADMIN_PASSWORD || '').trim();
      const adminPassword = p || config.admin.password || 'admin';
      if (username === 'admin' && password && password === adminPassword) {
        const token = crypto.randomBytes(32).toString('hex');
        this.sessions.add(token);
        res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE / 1000}`);
        return res.json({ success: true });
      }
      res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    });

    this.app.post('/api/logout', (req, res) => {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE];
      if (token) this.sessions.delete(token);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
      res.json({ success: true });
    });

    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public/admin' });
    });

    // API: Получить все посты (при недоступности Instagram — пустой массив)
    this.app.get('/api/posts', async (req, res) => {
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
    this.app.get('/api/words', (req, res) => {
      res.json(this.postSettingsService.getAllWordSettings());
    });

    this.app.post('/api/words', (req, res) => {
      const { codeWord, telegramMessage, redirectUrl, enabled } = req.body || {};
      const word = (codeWord || '').trim();
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
      });
      if (success) {
        res.json({ success: true, message: 'Сохранено' });
      } else {
        res.status(500).json({ error: 'Ошибка сохранения' });
      }
    });

    this.app.delete('/api/words/:id', (req, res) => {
      const { id } = req.params;
      const success = this.postSettingsService.deleteWordSettings(id);
      if (success) {
        res.json({ success: true, message: 'Удалено' });
      } else {
        res.status(404).json({ error: 'Не найдено' });
      }
    });

    // API: Получить настройки поста
    this.app.get('/api/posts/:postId/settings', (req, res) => {
      const { postId } = req.params;
      const settings = this.postSettingsService.getPostSettings(postId);
      res.json(settings || {});
    });

    // API: Сохранить настройки поста
    this.app.post('/api/posts/:postId/settings', (req, res) => {
      const { postId } = req.params;
      const { codeWord, commentReply, directReply, redirectUrl, telegramMessage, enabled } = req.body;

      if (!codeWord) {
        return res.status(400).json({ error: 'Кодовое слово обязательно' });
      }

      // Если не указан redirectUrl, формируем из Telegram бота
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
      });

      if (success) {
        res.json({ success: true, message: 'Настройки сохранены' });
      } else {
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
      }
    });

    // API: Получить информацию о Telegram боте
    this.app.get('/api/telegram/info', (req, res) => {
      if (!this.telegramBotService || !this.telegramBotService.getBotUrl) {
        return res.json({ available: false });
      }
      
      const botUrl = this.telegramBotService.getBotUrl();
      const botUsername = this.telegramBotService.getBotUsername();
      
      res.json({
        available: true,
        botUrl,
        botUsername,
      });
    });

    // API: Удалить настройки поста
    this.app.delete('/api/posts/:postId/settings', (req, res) => {
      const { postId } = req.params;
      const success = this.postSettingsService.deletePostSettings(postId);
      if (success) {
        res.json({ success: true, message: 'Настройки удалены' });
      } else {
        res.status(404).json({ error: 'Настройки не найдены' });
      }
    });
  }

  start() {
    this.setupRoutes();
    
    this.server = this.app.listen(this.port, () => {
      const pwdSet = !!(process.env.ADMIN_PASSWORD || '').trim();
      logger.info(`Админ панель: ${config.publicUrl}`);
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

