/** Админ панель для управления настройками постов */
import express from 'express';
import InstagramService from './instagramService.js';
import PostSettingsService from './postSettingsService.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

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
  }

  checkAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
      return res.status(401).send('Требуется авторизация');
    }
    const [, base64] = auth.split(' ');
    const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
    if (user === 'admin' && pass === this.password) {
      return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Неверный пароль');
  }

  setupRoutes() {
    this.app.use(this.checkAuth.bind(this));

    this.app.use('/admin', express.static('public/admin'));
    this.app.use(express.static('public'));

    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: 'public/admin' });
    });

    // API: Получить все посты
    this.app.get('/api/posts', async (req, res) => {
      try {
        const posts = await this.instagramService.getRecentPosts(50);
        const settings = this.postSettingsService.getAllSettings();

        // Добавляем настройки к постам
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
        logger.error('Ошибка получения постов', error);
        res.status(500).json({ error: 'Ошибка получения постов' });
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
      logger.info(`Админ панель запущена на порту ${this.port}`);
      logger.info(`Админ панель: ${config.publicUrl}`);
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

