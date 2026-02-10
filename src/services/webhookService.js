/** Сервис для обработки webhook от Instagram Messaging API */
import express from 'express';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';
import { securityHeaders, jsonBodyLimit } from '../utils/security.js';
import MessagingAPI from './messagingAPI.js';
import PostSettingsService from './postSettingsService.js';
import { isReplied, markReplied } from './repliedUsersStore.js';

class WebhookService {
  constructor(postSettingsService, telegramBotService) {
    this.app = express();
    this.app.use(securityHeaders);
    this.app.use(express.json({ limit: jsonBodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
    this.messagingAPI = new MessagingAPI();
    this.postSettingsService = postSettingsService || new PostSettingsService();
    this.telegramBotService = telegramBotService;
    this.server = null;
    this.port = config.webhook.port || 3001;
    this.verifyToken = config.webhook.verifyToken || 'your_verify_token';
  }

  setupRoutes() {
    // Верификация webhook (для первоначальной настройки)
    this.app.get('/webhook', (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === this.verifyToken) {
        logger.info('Webhook верифицирован');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    });

    // Обработка входящих сообщений
    this.app.post('/webhook', (req, res) => {
      const body = req.body;

      if (body.object === 'instagram') {
        body.entry?.forEach((entry) => {
          const messaging = entry.messaging;
          if (messaging) {
            messaging.forEach((event) => {
              this.handleMessage(event);
            });
          }
        });
      }

      res.status(200).send('OK');
    });

    // Healthcheck
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });
  }

  async handleMessage(event) {
    try {
      const senderId = event.sender?.id;
      const message = event.message;
      const messageId = message?.mid;

      if (!senderId || !message || !messageId) {
        return;
      }

      // Дубликат webhook-события
      if (this.messagingAPI.isProcessed(messageId)) {
        return;
      }

      // Пользователь уже получал ответ — один раз навсегда
      if (isReplied(senderId)) {
        return;
      }

      const messageText = message.text || '';

      // Проверяем кодовое слово по всем активным постам
      const codeWordMatch = this.postSettingsService.checkCodeWord(messageText);

      if (codeWordMatch) {
        const { settings, codeWord } = codeWordMatch;
        
        // Формируем URL для Telegram бота с кодовым словом
        let buttonUrl = settings.redirectUrl;
        if (this.telegramBotService && this.telegramBotService.getBotStartUrl) {
          const telegramUrl = this.telegramBotService.getBotStartUrl(codeWord);
          if (telegramUrl) {
            buttonUrl = telegramUrl;
          }
        }
        
        // Отправляем ответ с кнопкой
        const success = await this.messagingAPI.sendMessageWithButton(
          senderId,
          settings.directReply,
          'Инструкция',
          buttonUrl
        );

        if (success) {
          this.messagingAPI.markAsProcessed(messageId);
          markReplied(senderId);
          logger.info(`Обработано сообщение ${messageId} от ${senderId} с кодовым словом "${codeWord}" (пост: ${codeWordMatch.postId})`);
        }
      }
    } catch (error) {
      logger.error('Ошибка обработки сообщения через webhook', error);
    }
  }

  start() {
    this.setupRoutes();
    
    this.server = this.app.listen(this.port, () => {
      logger.info(`Webhook сервер запущен на порту ${this.port}`);
      logger.info(`Webhook URL: ${config.webhook.webhookUrl}`);
      logger.info(`Verify Token: ${this.verifyToken}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      logger.info('Webhook сервер остановлен');
    }
  }
}

export default WebhookService;

