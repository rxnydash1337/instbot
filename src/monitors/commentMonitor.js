/** Мониторинг комментариев */
import InstagramService from '../services/instagramService.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class CommentMonitor {
  constructor(instagramService, postSettingsService) {
    this.instagramService = instagramService;
    this.postSettingsService = postSettingsService;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Запущен мониторинг комментариев');
    this.monitor();
  }

  stop() {
    this.isRunning = false;
    logger.info('Остановлен мониторинг комментариев');
  }

  async monitor() {
    while (this.isRunning) {
      try {
        await this.checkComments();
        await this.sleep(config.checkInterval);
      } catch (error) {
        logger.error('Ошибка в мониторинге комментариев', error);
        await this.sleep(config.checkInterval);
      }
    }
  }

  async checkComments() {
    const posts = await this.instagramService.getRecentPosts(50);
    
    for (const post of posts) {
      // Получаем настройки поста
      const postSettings = this.postSettingsService.getPostSettings(post.id);
      
      // Пропускаем посты без настроек или неактивные
      if (!postSettings || !postSettings.enabled) {
        continue;
      }

      const comments = await this.instagramService.getPostComments(post.id);
      
      for (const comment of comments) {
        if (this.instagramService.isProcessed('comment', comment.id)) {
          continue;
        }

        // Проверяем кодовое слово для конкретного поста
        const codeWordMatch = this.postSettingsService.checkCodeWord(comment.text, post.id);
        
        if (codeWordMatch) {
          const replyText = postSettings.commentReply;
          const success = await this.instagramService.replyToComment(
            post.id,
            comment.id,
            replyText
          );
          
          if (success) {
            this.instagramService.markAsProcessed('comment', comment.id);
            logger.info(`Обработан комментарий ${comment.id} к посту ${post.id} с кодовым словом "${postSettings.codeWord}"`);
          }
        }
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CommentMonitor;

