/** Сервис для работы с Instagram Graph API через OAuth 2.0 */
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class InstagramGraphAPI {
  constructor() {
    this.accessToken = config.instagram.accessToken;
    this.instagramBusinessAccountId = config.instagram.instagramBusinessAccountId;
    this.baseURL = 'https://graph.instagram.com';
    this.graphURL = 'https://graph.facebook.com';
    this.processedComments = new Set();
    this.processedDirects = new Set();
  }

  async makeRequest(url, method = 'GET', body = null, { silent = false } = {}) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();

      if (data.error) {
        throw new Error(`API Error: ${data.error.message} (${data.error.code})`);
      }

      return data;
    } catch (error) {
      if (!silent) {
        logger.error(`Ошибка запроса к Instagram API: ${url}`, error);
      }
      throw error;
    }
  }

  async validateToken() {
    try {
      const url = `${this.baseURL}/me?fields=id,username&access_token=${this.accessToken}`;
      const data = await this.makeRequest(url, 'GET', null, { silent: true });
      logger.info(`Токен валиден. Аккаунт: ${data.username} (${data.id})`);
      return true;
    } catch {
      return false;
    }
  }

  async getRecentPosts(limit = 10) {
    if (!this.instagramBusinessAccountId || !this.accessToken) {
      return [];
    }
    try {
      const url = `${this.graphURL}/${this.instagramBusinessAccountId}/media?` +
        `fields=id,caption,media_type,permalink,timestamp&` +
        `limit=${limit}&` +
        `access_token=${this.accessToken}`;

      const data = await this.makeRequest(url);
      return data.data || [];
    } catch (error) {
      logger.error('Ошибка получения постов', error);
      return [];
    }
  }

  async getPostComments(mediaId) {
    try {
      const url = `${this.graphURL}/${mediaId}/comments?` +
        `fields=id,text,username,timestamp,replies&` +
        `access_token=${this.accessToken}`;
      
      const data = await this.makeRequest(url);
      return data.data || [];
    } catch (error) {
      logger.error(`Ошибка получения комментариев для поста ${mediaId}`, error);
      return [];
    }
  }

  async replyToComment(commentId, text) {
    try {
      const url = `${this.graphURL}/${commentId}/replies?` +
        `message=${encodeURIComponent(text)}&` +
        `access_token=${this.accessToken}`;
      
      await this.makeRequest(url, 'POST');
      logger.info(`Ответ на комментарий ${commentId}: ${text}`);
      return true;
    } catch (error) {
      logger.error('Ошибка отправки ответа на комментарий', error);
      return false;
    }
  }

  async getDirectThreads() {
    try {
      // Instagram Graph API не поддерживает прямую работу с Direct Messages
      // Используйте Instagram Messaging API через webhooks
      // Этот метод оставлен для обратной совместимости
      return [];
    } catch (error) {
      logger.error('Ошибка получения директов', error);
      return [];
    }
  }

  async getThreadMessages(threadId) {
    try {
      // Instagram Graph API не поддерживает прямую работу с Direct Messages
      // Используйте Instagram Messaging API через webhooks
      return [];
    } catch (error) {
      logger.error(`Ошибка получения сообщений треда ${threadId}`, error);
      return [];
    }
  }

  async sendDirectMessage(threadId, text) {
    try {
      // Instagram Graph API не поддерживает прямую отправку Direct Messages
      // Используйте Instagram Messaging API через webhookService
      return false;
    } catch (error) {
      logger.error('Ошибка отправки сообщения в директ', error);
      return false;
    }
  }

  checkCodeWord(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase().trim();
    
    for (const [word, wordConfig] of Object.entries(config.codeWords)) {
      if (lowerText.includes(word.toLowerCase())) {
        return word;
      }
    }
    return null;
  }

  isProcessed(type, id) {
    const key = `${type}_${id}`;
    if (type === 'comment') {
      return this.processedComments.has(key);
    } else if (type === 'direct') {
      return this.processedDirects.has(key);
    }
    return false;
  }

  markAsProcessed(type, id) {
    const key = `${type}_${id}`;
    if (type === 'comment') {
      this.processedComments.add(key);
    } else if (type === 'direct') {
      this.processedDirects.add(key);
    }
  }
}

export default InstagramGraphAPI;

