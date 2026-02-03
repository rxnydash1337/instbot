/** Главный файл запуска бота */
import InstagramService from './services/instagramService.js';
import CommentMonitor from './monitors/commentMonitor.js';
import DirectMonitor from './monitors/directMonitor.js';
import TelegramBotService from './services/telegramBot.js';
import WebhookService from './services/webhookService.js';
import AdminPanel from './services/adminPanel.js';
import LandingAPI from './services/landingAPI.js';
import PostSettingsService from './services/postSettingsService.js';
import { logger } from './utils/logger.js';

class InstaBot {
  constructor() {
    this.instagramService = new InstagramService();
    this.postSettingsService = new PostSettingsService();
    this.commentMonitor = new CommentMonitor(this.instagramService, this.postSettingsService);
    this.directMonitor = new DirectMonitor(this.instagramService);
    this.telegramBot = new TelegramBotService(this.postSettingsService);
    this.webhookService = new WebhookService(this.postSettingsService, this.telegramBot);
    this.adminPanel = new AdminPanel(this.instagramService, this.telegramBot);
    this.landingAPI = new LandingAPI();
  }

  async start() {
    try {
      logger.info('Запуск Instagram бота...');

      // Вход в Instagram
      const loggedIn = await this.instagramService.login();
      if (!loggedIn) {
        logger.error('Не удалось войти в Instagram. Проверьте учетные данные.');
        process.exit(1);
      }

      // Запуск мониторинга комментариев
      await this.commentMonitor.start();

      // Запуск мониторинга директов (через Graph API, если доступно)
      await this.directMonitor.start();

      // Запуск webhook сервера для Messaging API
      this.webhookService.start();

      // Запуск админ панели
      this.adminPanel.start();

      // Запуск Landing API
      this.landingAPI.start();

      logger.info('Бот успешно запущен и работает');

      // Обработка завершения
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());

    } catch (error) {
      logger.error('Критическая ошибка при запуске', error);
      process.exit(1);
    }
  }

  stop() {
    logger.info('Остановка бота...');
    this.commentMonitor.stop();
    this.directMonitor.stop();
    this.webhookService.stop();
    this.adminPanel.stop();
    this.landingAPI.stop();
    process.exit(0);
  }
}

// Запуск бота
const bot = new InstaBot();
bot.start();

