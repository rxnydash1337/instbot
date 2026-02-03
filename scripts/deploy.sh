#!/bin/bash

# Скрипт деплоя на VPS с доменом reg.ru
# Использование: ./deploy.sh your-domain.com

set -e

DOMAIN=$1
EMAIL=${2:-"admin@${DOMAIN}"}

if [ -z "$DOMAIN" ]; then
    echo "Использование: ./deploy.sh your-domain.com [email]"
    exit 1
fi

echo "🚀 Начало деплоя для домена: $DOMAIN"
echo "📧 Email для SSL: $EMAIL"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Запустите скрипт от root или через sudo${NC}"
    exit 1
fi

# Обновление системы
echo -e "${YELLOW}📦 Обновление системы...${NC}"
apt-get update
apt-get upgrade -y

# Установка необходимых пакетов
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
apt-get install -y curl wget git nginx certbot python3-certbot-nginx docker.io docker-compose ufw

# Запуск Docker
echo -e "${YELLOW}🐳 Настройка Docker...${NC}"
systemctl enable docker
systemctl start docker

# Настройка firewall
echo -e "${YELLOW}🔥 Настройка firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Создание директории проекта
PROJECT_DIR="/opt/instabot"
echo -e "${YELLOW}📁 Создание директории проекта...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Копирование файлов проекта (если еще не скопированы)
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}📋 Копирование файлов проекта...${NC}"
    # Предполагаем, что файлы уже есть или будут склонированы
    echo "Убедитесь, что файлы проекта находятся в $PROJECT_DIR"
fi

# Создание .env файла если его нет
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚙️  Создание .env файла...${NC}"
    cat > .env << EOF
# Instagram OAuth настройки
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_PAGE_ACCESS_TOKEN=

# OAuth настройки
PUBLIC_URL=https://${DOMAIN}
OAUTH_REDIRECT_URI=https://${DOMAIN}/oauth/callback
OAUTH_PORT=3000

# Webhook настройки
WEBHOOK_PORT=3001
WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 32)
WEBHOOK_URL=https://${DOMAIN}/webhook

# Telegram настройки
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# URL для редиректа по умолчанию
REDIRECT_URL=https://t.me/your_bot

# Админ панель
ADMIN_PORT=3002
ADMIN_PASSWORD=$(openssl rand -hex 16)

# Интервал проверки
CHECK_INTERVAL=30000
EOF
    echo -e "${GREEN}✅ .env файл создан. Заполните необходимые переменные!${NC}"
fi

# Создание nginx конфигурации
echo -e "${YELLOW}🌐 Настройка Nginx...${NC}"
cat > /etc/nginx/sites-available/instabot << EOF
# Основной домен - админ панель
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # OAuth callback
    location /oauth/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Webhook для Instagram
    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Landing page
    location /landing {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Статические файлы
    location /admin/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /landing/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF

# Активация конфигурации
ln -sf /etc/nginx/sites-available/instabot /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации nginx
nginx -t

# Перезапуск nginx
systemctl restart nginx
systemctl enable nginx

# Получение SSL сертификата
echo -e "${YELLOW}🔒 Получение SSL сертификата...${NC}"
certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${EMAIL} --redirect

# Настройка автообновления SSL
echo "0 0,12 * * * root certbot renew --quiet" | tee -a /etc/cron.d/certbot

# Обновление docker-compose.yml для продакшена
echo -e "${YELLOW}🐳 Настройка Docker Compose...${NC}"
if [ -f "docker-compose.yml" ]; then
    # Обновляем порты если нужно
    sed -i "s/3001:3001/3001:3001/" docker-compose.yml 2>/dev/null || true
    sed -i "s/3002:3002/3002:3002/" docker-compose.yml 2>/dev/null || true
    sed -i "s/3003:3003/3003:3003/" docker-compose.yml 2>/dev/null || true
fi

# Создание systemd service для автозапуска
echo -e "${YELLOW}⚙️  Создание systemd service...${NC}"
cat > /etc/systemd/system/instabot.service << EOF
[Unit]
Description=Instagram Bot Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${PROJECT_DIR}
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable instabot

# Создание скрипта для обновления
cat > ${PROJECT_DIR}/update.sh << 'UPDATE_SCRIPT'
#!/bin/bash
cd /opt/instabot
git pull 2>/dev/null || echo "Git pull пропущен"
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f --tail=50
UPDATE_SCRIPT
chmod +x ${PROJECT_DIR}/update.sh

# Создание скрипта для просмотра логов
cat > ${PROJECT_DIR}/logs.sh << 'LOGS_SCRIPT'
#!/bin/bash
cd /opt/instabot
docker-compose -f docker-compose.prod.yml logs -f
LOGS_SCRIPT
chmod +x ${PROJECT_DIR}/logs.sh

echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo ""
echo -e "${YELLOW}📋 Следующие шаги:${NC}"
echo "1. Заполните .env файл в ${PROJECT_DIR}/.env"
echo "2. Запустите: cd ${PROJECT_DIR} && docker-compose -f docker-compose.prod.yml up -d"
echo "3. Проверьте логи: ${PROJECT_DIR}/logs.sh"
echo ""
echo -e "${GREEN}🌐 Доступные URL:${NC}"
echo "  - Админ панель: https://${DOMAIN}"
echo "  - Лендинг: https://${DOMAIN}/landing"
echo "  - Webhook: https://${DOMAIN}/webhook"
echo "  - OAuth: https://${DOMAIN}/oauth/callback"
echo ""
echo -e "${YELLOW}📝 Полезные команды:${NC}"
echo "  - Обновление: ${PROJECT_DIR}/update.sh"
echo "  - Логи: ${PROJECT_DIR}/logs.sh"
echo "  - Перезапуск: systemctl restart instabot"
echo "  - Статус: systemctl status instabot"

