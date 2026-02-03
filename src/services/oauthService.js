/** Сервис для OAuth 2.0 авторизации Instagram */
import express from 'express';
import { config } from '../../config/config.js';
import { logger } from '../utils/logger.js';

class OAuthService {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.server = null;
    this.port = config.oauth.port || 3000;
  }

  getAuthorizationUrl() {
    const params = new URLSearchParams({
      client_id: config.instagram.appId,
      redirect_uri: config.oauth.redirectUri,
      scope: config.oauth.scope,
      response_type: 'code',
    });

    return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      const tokenUrl = 'https://api.instagram.com/oauth/access_token';
      const params = new URLSearchParams({
        client_id: config.instagram.appId,
        client_secret: config.instagram.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: config.oauth.redirectUri,
        code: code,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`OAuth Error: ${data.error_message || data.error}`);
      }

      return data.access_token;
    } catch (error) {
      logger.error('Ошибка обмена кода на токен', error);
      throw error;
    }
  }

  async exchangeShortLivedTokenForLongLived(shortLivedToken) {
    try {
      const url = `${config.oauth.graphURL}/oauth/access_token?` +
        `grant_type=ig_exchange_token&` +
        `client_secret=${config.instagram.appSecret}&` +
        `access_token=${shortLivedToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(`Token Exchange Error: ${data.error.message}`);
      }

      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      logger.error('Ошибка обмена short-lived токена на long-lived', error);
      throw error;
    }
  }

  async getPageAccessToken(userAccessToken) {
    try {
      const url = `${config.oauth.graphURL}/me/accounts?` +
        `fields=access_token,name&` +
        `access_token=${userAccessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error || !data.data || data.data.length === 0) {
        throw new Error('Не найдено связанных страниц Facebook');
      }

      return data.data[0].access_token;
    } catch (error) {
      logger.error('Ошибка получения Page Access Token', error);
      throw error;
    }
  }

  async getInstagramBusinessAccountId(pageAccessToken) {
    try {
      const url = `${config.oauth.graphURL}/me?` +
        `fields=instagram_business_account&` +
        `access_token=${pageAccessToken}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }

      if (!data.instagram_business_account) {
        throw new Error('Страница не связана с Instagram Business Account');
      }

      return data.instagram_business_account.id;
    } catch (error) {
      logger.error('Ошибка получения Instagram Business Account ID', error);
      throw error;
    }
  }

  startCallbackServer() {
    return new Promise((resolve) => {
      this.app.get('/oauth/callback', async (req, res) => {
        try {
          const { code, error } = req.query;

          if (error) {
            res.send(`
              <html>
                <body>
                  <h1>Ошибка авторизации</h1>
                  <p>${error}</p>
                </body>
              </html>
            `);
            return;
          }

          if (!code) {
            res.send(`
              <html>
                <body>
                  <h1>Ошибка</h1>
                  <p>Код авторизации не получен</p>
                </body>
              </html>
            `);
            return;
          }

          // Обмен кода на токен
          const shortLivedToken = await this.exchangeCodeForToken(code);
          
          // Получение Instagram Business Account ID (используем short-lived токен для получения Page access token)
          const pageAccessToken = await this.getPageAccessToken(shortLivedToken);
          const businessAccountId = await this.getInstagramBusinessAccountId(pageAccessToken);
          
          // Обмен short-lived токена на long-lived (используем Page access token)
          const longLivedToken = await this.exchangeShortLivedTokenForLongLived(pageAccessToken);

          res.send(`
            <html>
              <body>
                <h1>Авторизация успешна!</h1>
                <h2>Сохраните эти данные в .env файл:</h2>
                <pre>
INSTAGRAM_ACCESS_TOKEN=${longLivedToken.accessToken}
INSTAGRAM_BUSINESS_ACCOUNT_ID=${businessAccountId}
                </pre>
                <p>Токен действителен: ${longLivedToken.expiresIn} секунд</p>
              </body>
            </html>
          `);

          logger.info('Авторизация успешна. Токены получены.');
          resolve({
            accessToken: longLivedToken.accessToken,
            businessAccountId,
            expiresIn: longLivedToken.expiresIn,
          });
        } catch (error) {
          logger.error('Ошибка обработки callback', error);
          res.send(`
            <html>
              <body>
                <h1>Ошибка</h1>
                <p>${error.message}</p>
              </body>
            </html>
          `);
        }
      });

      this.server = this.app.listen(this.port, () => {
        logger.info(`OAuth callback сервер запущен на порту ${this.port}`);
        logger.info(`Перейдите по ссылке для авторизации: ${this.getAuthorizationUrl()}`);
      });
    });
  }

  stopCallbackServer() {
    if (this.server) {
      this.server.close();
      logger.info('OAuth callback сервер остановлен');
    }
  }
}

export default OAuthService;

