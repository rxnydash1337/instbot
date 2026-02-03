/** Скрипт для настройки OAuth авторизации */
import { setupOAuth } from '../src/utils/oauthHelper.js';

setupOAuth().then(() => {
  console.log('OAuth настройка завершена');
  process.exit(0);
}).catch((error) => {
  console.error('Ошибка настройки OAuth:', error);
  process.exit(1);
});

