/** Конфигурация бота */
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Instagram настройки (OAuth 2.0)
  instagram: {
    appId: process.env.INSTAGRAM_APP_ID || '',
    appSecret: process.env.INSTAGRAM_APP_SECRET || '',
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    pageAccessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '', // Для Messaging API
  },

  // Публичный URL (для логов и редиректов)
  publicUrl: process.env.PUBLIC_URL || process.env.WEBHOOK_URL?.replace(/\/webhook\/?$/, '') || 'https://bazkod.ru',

  // Webhook настройки
  webhook: {
    port: parseInt(process.env.WEBHOOK_PORT) || 3001,
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_change_this',
    webhookUrl: process.env.WEBHOOK_URL || 'https://bazkod.ru/webhook',
  },

  // OAuth настройки
  oauth: {
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'https://bazkod.ru/oauth/callback',
    scope: process.env.OAUTH_SCOPE || 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement',
    port: parseInt(process.env.OAUTH_PORT) || 3000,
    graphURL: 'https://graph.facebook.com/v18.0',
  },

  // Telegram настройки
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Админ панель
  admin: {
    port: parseInt(process.env.ADMIN_PORT) || 3002,
    password: process.env.ADMIN_PASSWORD || 'admin',
  },

  // Настройки мониторинга
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000, // миллисекунды между проверками
};

