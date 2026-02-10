/** API для одностраничного сайта */
import express from 'express';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';
import { YooKassaService } from './yookassaService.js';
import * as paidAccessStore from './paidAccessStore.js';

class LandingAPI {
  constructor(paidAccessStoreRef = null) {
    this.app = express();
    this.server = null;
    this.port = 3003;
    this.paidAccessStore = paidAccessStoreRef || paidAccessStore;
    this.yookassa = new YooKassaService(this.paidAccessStore);
    // ЮKassa webhook должен получать сырой body для проверки подписи (если понадобится)
    this.app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
    this.app.use(express.urlencoded({ extended: true }));
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

    // API: Присоединиться к курсу = оплата через ЮKassa (тариф из модалки)
    this.app.post('/api/landing/join', async (req, res) => {
      try {
        const { amount, tariffId, description } = req.body || {};
        logger.info('Join (payment) request:', { amount, tariffId, ...req.body });
        const payment = await this.yookassa.createPayment({
          amount: amount ? Number(amount) : undefined,
          tariffId: tariffId || undefined,
          description: description || undefined,
        });
        const redirectUrl = payment?.confirmationUrl || process.env.PAYMENT_URL || '/payment';
        res.json({
          success: true,
          message: payment ? 'Переход к оплате...' : 'Переход на страницу оплаты...',
          redirect: redirectUrl,
        });
      } catch (error) {
        logger.error('Ошибка оплаты / присоединения', error);
        res.status(500).json({ error: 'Ошибка обработки запроса' });
      }
    });

    // После успешной оплаты ЮKassa редиректит сюда (?code=ACCESS_CODE) — ведём в бота для активации доступа
    this.app.get('/payment/success', (req, res) => {
      const code = (req.query.code || '').trim();
      const baseUrl = process.env.REDIRECT_URL || 'https://t.me/instbotqqetest123_bot';
      const telegramUrl = code ? `${baseUrl}?start=${encodeURIComponent(code)}` : baseUrl;
      res.redirect(telegramUrl);
    });

    // Пользователь отменил оплату
    this.app.get('/payment/cancel', (req, res) => {
      res.redirect(config.publicUrl + '/landing');
    });

    // Webhook ЮKassa: уведомление об успешной оплате
    this.app.post('/payment/webhook/yookassa', (req, res) => {
      res.sendStatus(200);
      const body = req.body || {};
      if (body.type !== 'notification' || body.event !== 'payment.succeeded') return;
      const obj = body.object || {};
      const accessCode = obj.metadata?.access_code;
      if (!accessCode) return;
      this.paidAccessStore.markPaid(accessCode);
      logger.info('ЮKassa webhook: оплата подтверждена, код доступа', accessCode);
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
      logger.info(`Лендинг: ${config.publicUrl}/landing`);
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

