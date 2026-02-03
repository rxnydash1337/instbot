/** Сервис для работы с Instagram Messaging API */
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class MessagingAPI {
  constructor() {
    this.pageAccessToken = config.instagram.pageAccessToken;
    this.graphURL = 'https://graph.facebook.com/v18.0';
    this.processedMessages = new Set();
  }

  async sendMessage(recipientId, messageText) {
    try {
      const url = `${this.graphURL}/me/messages?access_token=${this.pageAccessToken}`;
      
      const payload = {
        recipient: {
          id: recipientId,
        },
        message: {
          text: messageText,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Messaging API Error: ${data.error.message} (${data.error.code})`);
      }

      logger.info(`Отправлено сообщение пользователю ${recipientId}: ${messageText}`);
      return true;
    } catch (error) {
      logger.error('Ошибка отправки сообщения через Messaging API', error);
      return false;
    }
  }

  async sendMessageWithButton(recipientId, messageText, buttonText, buttonUrl) {
    try {
      const url = `${this.graphURL}/me/messages?access_token=${this.pageAccessToken}`;
      
      const payload = {
        recipient: {
          id: recipientId,
        },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: messageText,
              buttons: [
                {
                  type: 'web_url',
                  url: buttonUrl,
                  title: buttonText,
                },
              ],
            },
          },
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Messaging API Error: ${data.error.message} (${data.error.code})`);
      }

      logger.info(`Отправлено сообщение с кнопкой пользователю ${recipientId}`);
      return true;
    } catch (error) {
      logger.error('Ошибка отправки сообщения с кнопкой', error);
      return false;
    }
  }

  // Метод checkCodeWord удален - теперь используется PostSettingsService

  isProcessed(messageId) {
    return this.processedMessages.has(messageId);
  }

  markAsProcessed(messageId) {
    this.processedMessages.add(messageId);
  }
}

export default MessagingAPI;

