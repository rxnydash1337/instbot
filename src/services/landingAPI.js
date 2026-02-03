/** API для одностраничного сайта */
import express from 'express';
import { logger } from '../utils/logger.js';

class LandingAPI {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.server = null;
    this.port = 3003;
  }

  setupRoutes() {
    // Статические файлы
    this.app.use('/landing', express.static('public/landing'));
    this.app.use(express.static('public'));

    // Главная страница лендинга
    this.app.get('/landing', (req, res) => {
      res.sendFile('index.html', { root: 'public/landing' });
    });

    // API: Получить основной контент
    this.app.get('/api/landing/content', (req, res) => {
      // TODO: Загрузить из БД или файла
      res.json({
        title: '',
        subtitle: '',
        price: '',
        'access-note': '',
        'gift-title': '',
        'reviews-title': '',
        'included-title': '',
        'for-whom-title': '',
        'footer-text': '',
      });
    });

    // API: Обработка присоединения
    this.app.post('/api/landing/join', async (req, res) => {
      try {
        // TODO: Обработать платеж, создать заказ и т.д.
        logger.info('Join request:', req.body);
        res.json({
          success: true,
          message: 'Обработка запроса...',
          // redirect: '/payment',
        });
      } catch (error) {
        logger.error('Ошибка обработки присоединения', error);
        res.status(500).json({ error: 'Ошибка обработки запроса' });
      }
    });

    // API: Получить информацию о подарке
    this.app.get('/api/landing/gift', (req, res) => {
      // TODO: Загрузить из БД
      res.json({
        title: '',
        description: '',
      });
    });

    // API: Получить отзывы
    this.app.get('/api/landing/reviews', (req, res) => {
      // TODO: Загрузить из БД
      res.json([]);
    });

    // API: Получить что входит
    this.app.get('/api/landing/included', (req, res) => {
      // TODO: Загрузить из БД
      res.json([]);
    });

    // API: Получить для кого
    this.app.get('/api/landing/for-whom', (req, res) => {
      // TODO: Загрузить из БД
      res.json([]);
    });

    // API: Получить статистику
    this.app.get('/api/landing/stats', (req, res) => {
      // TODO: Загрузить из БД
      res.json([]);
    });
  }

  start() {
    this.setupRoutes();
    
    this.server = this.app.listen(this.port, () => {
      logger.info(`Landing API запущен на порту ${this.port}`);
      logger.info(`Лендинг доступен: http://localhost:${this.port}/landing`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      logger.info('Landing API остановлен');
    }
  }
}

export default LandingAPI;

