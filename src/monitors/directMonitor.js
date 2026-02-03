/** Мониторинг директов */
import InstagramService from '../services/instagramService.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class DirectMonitor {
  constructor(instagramService) {
    this.instagramService = instagramService;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Запущен мониторинг директов');
    this.monitor();
  }

  stop() {
    this.isRunning = false;
    logger.info('Остановлен мониторинг директов');
  }

  async monitor() {
    while (this.isRunning) {
      try {
        await this.checkDirects();
        await this.sleep(config.checkInterval);
      } catch (error) {
        logger.error('Ошибка в мониторинге директов', error);
        await this.sleep(config.checkInterval);
      }
    }
  }

  async checkDirects() {
    try {
      // Instagram Graph API не поддерживает прямую работу с Direct Messages
      // Direct Messages обрабатываются через webhook в webhookService
      // Этот метод оставлен для обратной совместимости, но не используется
      const threads = await this.instagramService.getDirectThreads();
      
      if (!threads || threads.length === 0) {
        return; // Direct Messages обрабатываются через webhook
      }

      for (const thread of threads) {
        const messages = await this.instagramService.getThreadMessages(thread.thread_id || thread.id);
        
        if (!messages || messages.length === 0) {
          continue;
        }

        // Берем последнее сообщение
        const lastMessage = messages[messages.length - 1];
        
        const messageId = lastMessage.id || lastMessage.item_id;
        
        if (this.instagramService.isProcessed('direct', messageId)) {
          continue;
        }

        const messageText = lastMessage.text || '';
        const codeWord = this.instagramService.checkCodeWord(messageText);
        
        if (codeWord) {
          const codeWordConfig = config.codeWords[codeWord];
          // Формируем сообщение с кнопкой-ссылкой
          const replyText = `${codeWordConfig.directReply}\n\n🔗 Инструкция: ${codeWordConfig.redirectUrl}`;

          const success = await this.instagramService.sendDirectMessage(
            thread.thread_id || thread.id,
            replyText
          );
          
          if (success) {
            this.instagramService.markAsProcessed('direct', messageId);
            logger.info(`Обработан директ ${messageId} с кодовым словом "${codeWord}"`);
          }
        }
      }
    } catch (error) {
      logger.error('Ошибка при проверке директов', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DirectMonitor;

