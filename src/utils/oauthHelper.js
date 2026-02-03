/** Утилита для помощи с OAuth авторизацией */
import OAuthService from '../services/oauthService.js';
import { logger } from './logger.js';

export async function setupOAuth() {
  const oauthService = new OAuthService();
  
  logger.info('Запуск OAuth сервера для получения токена...');
  logger.info('Перейдите по ссылке для авторизации:');
  logger.info(oauthService.getAuthorizationUrl());
  
  const tokens = await oauthService.startCallbackServer();
  
  if (tokens) {
    logger.info('Токены получены! Сохраните их в .env файл:');
    logger.info(`INSTAGRAM_ACCESS_TOKEN=${tokens.accessToken}`);
    logger.info(`INSTAGRAM_BUSINESS_ACCOUNT_ID=${tokens.businessAccountId}`);
  }
  
  return tokens;
}

