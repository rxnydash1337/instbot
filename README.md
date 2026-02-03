# Instagram Bot

Автоматизация ответов в Instagram: мониторинг комментариев и директов с автоответами и сбором лидов.

## Структура проекта

```
instabot/
├── src/
│   ├── services/          # Сервисы (Instagram, Telegram)
│   ├── monitors/          # Мониторы (комментарии, директы)
│   ├── utils/             # Утилиты (логирование)
│   └── index.js           # Точка входа
├── config/                # Конфигурация
├── docker/                # Docker файлы
├── logs/                  # Логи (создается автоматически)
├── docker-compose.yml     # Docker Compose конфигурация
└── package.json
```

## Функционал

1. **Мониторинг комментариев** - отслеживает комментарии с кодовыми словами
2. **Автоответ на комментарии** - отвечает "напиши в директ!"
3. **Мониторинг директов** - отслеживает входящие сообщения через webhook
4. **Автоответ в директ** - отправляет ответ с кнопкой "Инструкция"
5. **Админ панель** - веб-интерфейс для управления кодовыми словами для каждого поста
6. **Telegram бот** - сбор лидов через Telegram

## Установка

### Локальная установка

```bash
npm install
```

### Docker установка

```bash
# Сборка образа
npm run docker:build

# Запуск
npm run docker:up

# Просмотр логов
npm run docker:logs

# Остановка
npm run docker:down
```

## Настройка

### 1. Регистрация приложения в Meta for Developers

1. Перейдите на [Meta for Developers](https://developers.facebook.com/)
2. Создайте новое приложение типа "Business"
3. Добавьте продукт "Instagram Graph API"
4. Получите `App ID` и `App Secret`
5. Настройте OAuth Redirect URI (например: `http://localhost:3000/oauth/callback`)

### 2. Настройка Instagram Business Account

1. Убедитесь, что у вас есть Instagram Business Account
2. Свяжите его с Facebook Page
3. В настройках приложения добавьте необходимые разрешения:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_messaging` (для Messaging API)

### 2.1. Настройка Webhook для Messaging API

1. В Meta for Developers перейдите в настройки вашего приложения
2. Добавьте продукт "Messenger"
3. В разделе "Webhooks" нажмите "Add Callback URL"
4. Укажите URL вашего webhook (например: `https://your-domain.com/webhook`)
5. Укажите Verify Token (должен совпадать с `WEBHOOK_VERIFY_TOKEN` в `.env`)
6. Подпишитесь на события:
   - `messages` - для получения входящих сообщений
   - `messaging_postbacks` - для обработки нажатий на кнопки
7. Получите Page Access Token из настроек Messenger

### 3. Получение токена доступа

**Вариант 1: Автоматическая настройка (рекомендуется)**

```bash
npm run setup-oauth
```

Скрипт запустит локальный сервер и откроет браузер для авторизации. После авторизации вы получите токен и ID бизнес-аккаунта.

**Вариант 2: Ручная настройка**

1. Откройте в браузере URL авторизации (сформируйте его с вашими данными)
2. Авторизуйтесь и получите `auth_code`
3. Обменяйте код на токен через API

### 4. Настройка переменных окружения

Создайте файл `.env` на основе примера:

```bash
# Instagram OAuth настройки
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_ACCESS_TOKEN=your_access_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_business_account_id
INSTAGRAM_PAGE_ACCESS_TOKEN=your_page_access_token  # Для Messaging API

# OAuth настройки
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback
OAUTH_PORT=3000

# Webhook настройки (для Messaging API)
WEBHOOK_PORT=3001
WEBHOOK_VERIFY_TOKEN=your_secure_verify_token_change_this
WEBHOOK_URL=https://your-domain.com/webhook

# Telegram настройки
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id_for_notifications

# URL для редиректа
REDIRECT_URL=https://t.me/your_bot

# Интервал проверки в миллисекундах
CHECK_INTERVAL=30000
```

## Запуск

### Локальный запуск

```bash
npm start
```

### Docker запуск

```bash
docker-compose up -d
```

## Админ панель

После запуска бота админ панель доступна по адресу: `http://localhost:3002`

В админ панели вы можете:
- Просматривать все ваши посты
- Назначать кодовое слово для каждого поста индивидуально
- Настраивать ответы на комментарии и в директ
- Указывать URL для редиректа для каждого поста
- Включать/отключать мониторинг для конкретных постов

**Важно**: Кодовые слова теперь настраиваются через админ панель, а не через `.env` файл.

## Развертывание на VPS

1. Склонируйте репозиторий на сервер:
```bash
git clone <repository-url>
cd instabot
```

2. Создайте файл `.env` на основе `env.example.txt`:
```bash
cp env.example.txt .env
nano .env  # или используйте любой редактор
```

3. Заполните все необходимые переменные окружения

4. Запустите через Docker:
```bash
# Сборка образа
docker-compose build

# Запуск в фоновом режиме
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

Бот будет автоматически перезапускаться при сбоях благодаря `restart: unless-stopped`.

### Полезные команды Docker

```bash
# Перезапуск контейнера
docker-compose restart

# Просмотр статуса
docker-compose ps

# Просмотр логов за последние 100 строк
docker-compose logs --tail=100

# Остановка и удаление контейнера
docker-compose down
```

## Примечания

- **Авторизация**: Используется официальный Instagram Graph API через OAuth 2.0
- **Требования**: Instagram Business Account, связанный с Facebook Page
- **Direct Messages**: Работают через Instagram Messaging API с webhooks
- **Webhook**: Должен быть доступен из интернета (используйте ngrok для локальной разработки)
- **Токены**: Long-lived токены действительны 60 дней, после чего требуется обновление
- **Админ панель**: Доступна на порту 3002 (настраивается через `ADMIN_PORT`)
- **Кодовые слова**: Настраиваются индивидуально для каждого поста через админ панель
- Бот мониторит последние 50 постов
- Интервал проверки: 30 секунд (настраивается через `CHECK_INTERVAL`)
- Логи сохраняются в папке `logs/`
- Настройки постов сохраняются в `data/post-settings.json`
- Для работы на VPS рекомендуется использовать Docker

## Локальная разработка с Webhook

Для тестирования webhook локально используйте ngrok:

```bash
# Установите ngrok
# Запустите бота
npm start

# В другом терминале запустите ngrok
ngrok http 3001

# Используйте полученный URL в настройках webhook Meta for Developers
# Например: https://abc123.ngrok.io/webhook
```

## Обновление токена

Токены Instagram Graph API имеют ограниченный срок действия. Для обновления:

1. Запустите `npm run setup-oauth`
2. Повторите процесс авторизации
3. Обновите `INSTAGRAM_ACCESS_TOKEN` в `.env` файле
