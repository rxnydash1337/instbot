/** Сервис для работы с Instagram через Graph API */
import InstagramGraphAPI from './instagramGraphAPI.js';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class InstagramService {
  constructor() {
    this.api = new InstagramGraphAPI();
    this.processedComments = new Set();
    this.processedDirects = new Set();
  }

  async login() {
    try {
      const isValid = await this.api.validateToken();
      if (!isValid) {
        return false;
      }
      logger.info('Успешная авторизация через Instagram Graph API');
      return true;
    } catch {
      return false;
    }
  }

  async getRecentPosts(limit = 10) {
    return await this.api.getRecentPosts(limit);
  }

  async getPostComments(mediaId) {
    return await this.api.getPostComments(mediaId);
  }

  async replyToComment(mediaId, commentId, text) {
    return await this.api.replyToComment(commentId, text);
  }

  async getDirectThreads() {
    return await this.api.getDirectThreads();
  }

  async getThreadMessages(threadId) {
    return await this.api.getThreadMessages(threadId);
  }

  async sendDirectMessage(threadId, text) {
    return await this.api.sendDirectMessage(threadId, text);
  }

  get client() {
    // Для обратной совместимости с directMonitor
    return {
      account: {
        currentUser: async () => {
          // Возвращаем информацию о текущем аккаунте
          return { pk: this.api.instagramBusinessAccountId };
        },
      },
    };
  }

  checkCodeWord(text) {
    return this.api.checkCodeWord(text);
  }

  isProcessed(type, id) {
    return this.api.isProcessed(type, id);
  }

  markAsProcessed(type, id) {
    return this.api.markAsProcessed(type, id);
  }
}

export default InstagramService;

