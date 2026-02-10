/** Telegram бот для выдачи инструкций по кодовым словам */
import TelegramBot from 'node-telegram-bot-api';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';
import PostSettingsService from './postSettingsService.js';

class TelegramBotService {
  constructor(postSettingsService) {
    if (!config.telegram.botToken) {
      logger.warn('Telegram bot token не настроен, бот не будет запущен');
      this.bot = null;
      return;
    }

    this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
    this.postSettingsService = postSettingsService || new PostSettingsService();
    this.setupHandlers();
    logger.info('Telegram бот запущен');
  }

  setupHandlers() {
    if (!this.bot) return;

    // Обработка команды /start с параметром кодового слова
    this.bot.onText(/\/start(.*)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const codeWord = match[1]?.trim(); // Параметр после /start

      if (codeWord) {
        const settingsMatch = this.postSettingsService.getSettingsByCodeWord(codeWord);
        if (settingsMatch && settingsMatch.settings.enabled) {
          const { settings } = settingsMatch;
          await this.sendReply(chatId, settings);
          logger.info(`Отправлена инструкция для кодового слова "${codeWord}" пользователю ${chatId}`);
        } else {
          await this.bot.sendMessage(
            chatId,
            'К сожалению, инструкция для этого кодового слова не найдена или неактивна.'
          );
        }
      } else {
        // Если /start без параметра
        await this.bot.sendMessage(
          chatId,
          'Привет! Используй ссылку из Instagram для получения инструкции.'
        );
      }
    });

    // Обработка обычных сообщений (если нужно)
    this.bot.on('message', (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        // Можно добавить дополнительную логику
      }
    });
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

