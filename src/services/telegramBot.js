/** Telegram бот: кодовые слова из Instagram + полный доступ к курсу после оплаты */
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';
import PostSettingsService from './postSettingsService.js';
import * as paidAccessStore from './paidAccessStore.js';

// Код доступа после оплаты — только если он есть в хранилище (создан при оплате). Иначе это кодовое слово.
class TelegramBotService {
  constructor(postSettingsService, paidAccessStoreRef = null) {
    if (!config.telegram.botToken) {
      logger.warn('Telegram bot token не настроен, бот не будет запущен');
      this.bot = null;
      return;
    }

    this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
    this.postSettingsService = postSettingsService || new PostSettingsService();
    this.paidAccess = paidAccessStoreRef || paidAccessStore;
    this.setupHandlers();
    logger.info('Telegram бот запущен');
  }

  setupHandlers() {
    if (!this.bot) return;

    this.bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const param = (match[1] || '').trim();

      if (param) {
        // Код доступа после оплаты — только если такой код реально есть в хранилище (создан при создании платежа)
        const paymentRecord = this.paidAccess.getPayment(param);
        if (paymentRecord) {
          if (this.paidAccess.isPaid(param)) {
            const activated = this.paidAccess.activateCode(param, chatId);
            if (activated) {
              await this.sendFullAccessWelcome(chatId);
              logger.info(`Выдан полный доступ по коду ${param} пользователю ${chatId}`);
            } else {
              await this.bot.sendMessage(chatId, 'Этот код доступа уже был использован другим аккаунтом.');
            }
          } else {
            await this.bot.sendMessage(
              chatId,
              'Оплата по этому коду ещё не подтверждена. Подождите минуту и нажмите ссылку снова. Если оплатили только что — мы уже обрабатываем платёж.'
            );
          }
          return;
        }

        // Кодовое слово из Instagram (лендинг/реклама)
        const settingsMatch = this.postSettingsService.getSettingsByCodeWord(param);
        if (settingsMatch && settingsMatch.settings.enabled) {
          const { settings } = settingsMatch;
          await this.sendReply(chatId, settings);
          logger.info(`Отправлена инструкция для кодового слова "${param}" пользователю ${chatId}`);
          return;
        }

        await this.bot.sendMessage(
          chatId,
          'К сожалению, инструкция для этого кодового слова не найдена или неактивна.'
        );
        return;
      }

      // /start без параметра
      if (this.paidAccess.hasAccess(chatId)) {
        await this.sendFullAccessWelcome(chatId);
      } else {
        await this.bot.sendMessage(
          chatId,
          'Привет! Используй ссылку из Instagram для получения инструкции или оплати курс на сайте для полного доступа.'
        );
      }
    });

    // Команда для оплативших: материалы курса
    this.bot.onText(/\/materials/, async (msg) => {
      const chatId = msg.chat.id;
      if (!this.paidAccess.hasAccess(chatId)) {
        await this.bot.sendMessage(
          chatId,
          'Полный доступ к материалам открывается после оплаты курса на сайте. Нажмите «Присоединиться к курсу» на лендинге.'
        );
        return;
      }
      const courseLink = process.env.COURSE_ACCESS_LINK || process.env.REDIRECT_URL || 'https://t.me/instbotqqetest123_bot';
      await this.bot.sendMessage(
        chatId,
        '📚 Доступ к курсу «Базовый код спокойствия» у вас открыт.\n\nЗдесь будут ссылки на модули и материалы (настройте COURSE_ACCESS_LINK или выдавайте контент через бота).',
        { disable_web_page_preview: true }
      );
    });

    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        // Доп. логика при необходимости
      }
    });
  }

  /** Приветствие и кнопки для пользователя с полным доступом */
  async sendFullAccessWelcome(chatId) {
    const text = '✅ Доступ к курсу «Базовый код спокойствия» открыт.\n\nИспользуйте /materials для получения материалов. Если нужна помощь — напишите сюда.';
    await this.bot.sendMessage(chatId, text);
  }

  getBotUsername() {
    if (!this.bot) return null;
    return this.bot.options.username;
  }

  getBotUrl() {
    if (!this.bot) return null;
    const username = this.getBotUsername();
    return username ? `https://t.me/${username}` : null;
  }

  getBotStartUrl(codeWord) {
    const botUrl = this.getBotUrl();
    if (!botUrl || !codeWord) return null;
    return `${botUrl}?start=${encodeURIComponent(codeWord)}`;
  }

  /** Отправка ответа с опциональными медиа и инлайн-кнопками */
  async sendReply(chatId, settings) {
    const text = settings.telegramMessage || 'Привет! Вот инструкция для тебя.';
    const buttons = Array.isArray(settings.telegramButtons) ? settings.telegramButtons : [];
    const media = settings.telegramMedia && settings.telegramMedia.url
      ? settings.telegramMedia
      : null;

    const replyMarkup = buttons.length > 0
      ? {
          inline_keyboard: buttons
            .filter(b => b && (b.url || b.callback_data) && b.text)
            .map(b => {
              const btn = b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.callback_data || b.text };
              return [btn];
            }),
        }
      : undefined;

    const opts = replyMarkup ? { reply_markup: replyMarkup } : {};
    if (media) {
      opts.caption = text;
      const url = media.url.trim();
      try {
        if (media.type === 'photo') {
          await this.bot.sendPhoto(chatId, url, opts);
        } else if (media.type === 'video') {
          await this.bot.sendVideo(chatId, url, opts);
        } else if (media.type === 'document') {
          await this.bot.sendDocument(chatId, url, opts);
        } else {
          await this.bot.sendMessage(chatId, text, replyMarkup ? { reply_markup: opts.reply_markup } : {});
        }
      } catch (err) {
        logger.error('Ошибка отправки медиа в Telegram', err);
        await this.bot.sendMessage(chatId, text, replyMarkup ? { reply_markup: opts.reply_markup } : {});
      }
    } else {
      await this.bot.sendMessage(chatId, text, opts);
    }
  }
}

export default TelegramBotService;

