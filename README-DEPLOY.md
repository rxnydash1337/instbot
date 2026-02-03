# Деплой на VPS с доменом reg.ru

Инструкция по деплою Instagram бота на VPS сервер с доменом от reg.ru.

## Быстрый старт

```bash
# 1. Скопируйте проект на сервер
scp -r . root@your-server-ip:/opt/instabot

# 2. Подключитесь к серверу
ssh root@your-server-ip

# 3. Запустите скрипт деплоя
cd /opt/instabot
chmod +x scripts/*.sh
./scripts/quick-deploy.sh your-domain.com your@email.com
```

## Пошаговая инструкция

### 1. Подготовка сервера

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка необходимых пакетов
apt-get install -y curl wget git nginx certbot python3-certbot-nginx docker.io docker-compose ufw
```

### 2. Настройка DNS в reg.ru

1. Войдите в панель управления reg.ru
2. Перейдите в раздел DNS
3. Добавьте A-записи:
   - `@` → IP вашего сервера
   - `www` → IP вашего сервера
4. Дождитесь применения (обычно 5-15 минут)

Проверить можно командой:
```bash
dig your-domain.com
```

### 3. Запуск скрипта деплоя

```bash
cd /opt/instabot
chmod +x scripts/deploy.sh
./scripts/deploy.sh your-domain.com your@email.com
```

Скрипт автоматически:
- ✅ Установит все зависимости
- ✅ Настроит Nginx с проксированием
- ✅ Получит SSL сертификат (Let's Encrypt)
- ✅ Настроит автозапуск через systemd
- ✅ Создаст .env файл с базовыми настройками

### 4. Настройка .env файла

Отредактируйте `/opt/instabot/.env` и заполните все необходимые переменные:

```bash
nano /opt/instabot/.env
```

Обязательные переменные:
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- `TELEGRAM_BOT_TOKEN`

### 5. Запуск приложения

```bash
cd /opt/instabot
docker-compose -f docker-compose.prod.yml up -d
```

### 6. Проверка работы

```bash
# Проверка статуса
systemctl status instabot

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Или используйте скрипт
./logs.sh
```

## Доступные URL

После деплоя будут доступны:

- **Админ панель**: `https://your-domain.com`
- **Лендинг**: `https://your-domain.com/landing`
- **Webhook**: `https://your-domain.com/webhook`
- **OAuth callback**: `https://your-domain.com/oauth/callback`

## Полезные команды

### Обновление приложения

```bash
cd /opt/instabot
./update.sh
```

### Просмотр логов

```bash
cd /opt/instabot
./logs.sh
```

### Перезапуск сервиса

```bash
systemctl restart instabot
```

### Проверка статуса

```bash
systemctl status instabot
docker-compose -f docker-compose.prod.yml ps
```

### Обновление SSL сертификата

```bash
certbot renew
```

## Настройка Nginx

Конфигурация Nginx создается автоматически в `/etc/nginx/sites-available/instabot`.

Если нужно изменить настройки:

```bash
nano /etc/nginx/sites-available/instabot
nginx -t  # Проверка конфигурации
systemctl reload nginx
```

## Структура портов

- `3000` - OAuth сервер (только localhost)
- `3001` - Webhook для Instagram (через nginx)
- `3002` - Админ панель (через nginx)
- `3003` - Лендинг (через nginx)

Все порты доступны только через Nginx с SSL.

## Troubleshooting

### Проблема: DNS не применяется

```bash
# Проверьте DNS записи
dig your-domain.com

# Если IP не совпадает, подождите еще 15-30 минут
```

### Проблема: SSL сертификат не получен

```bash
# Проверьте доступность домена
curl -I http://your-domain.com

# Получите сертификат вручную
certbot --nginx -d your-domain.com
```

### Проблема: Приложение не запускается

```bash
# Проверьте логи
docker-compose -f docker-compose.prod.yml logs

# Проверьте .env файл
cat .env

# Проверьте статус контейнера
docker-compose -f docker-compose.prod.yml ps
```

### Проблема: Nginx не проксирует запросы

```bash
# Проверьте конфигурацию
nginx -t

# Проверьте логи Nginx
tail -f /var/log/nginx/error.log

# Перезапустите Nginx
systemctl restart nginx
```

## Безопасность

1. **Firewall**: Настроен автоматически (открыты только 22, 80, 443)
2. **SSL**: Автоматически обновляется через certbot
3. **Порты**: Все сервисы доступны только через Nginx
4. **Пароли**: Генерируются автоматически в .env

## Резервное копирование

Рекомендуется настроить резервное копирование:

```bash
# Создание бэкапа
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/instabot/data /opt/instabot/.env

# Восстановление
tar -xzf backup-YYYYMMDD.tar.gz -C /
```

## Обновление

Для обновления приложения:

```bash
cd /opt/instabot
git pull  # или скопируйте новые файлы
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

Или используйте скрипт:

```bash
./update.sh
```

