#!/bin/bash

# Быстрый деплой - все в одном скрипте
# Использование: ./quick-deploy.sh your-domain.com your@email.com

set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Использование: ./quick-deploy.sh your-domain.com your@email.com"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="/opt/instabot"

echo "🚀 Быстрый деплой для $DOMAIN"

# 1. Настройка DNS (инструкции)
echo "📋 Шаг 1: Настройка DNS"
bash ${SCRIPT_DIR}/setup-domain.sh ${DOMAIN}

# 2. Основной деплой
echo "📦 Шаг 2: Деплой приложения"
bash ${SCRIPT_DIR}/deploy.sh ${DOMAIN} ${EMAIL}

# 3. Финальные инструкции
echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📝 Не забудьте:"
echo "1. Настроить DNS записи в reg.ru (если еще не сделано)"
echo "2. Заполнить .env файл: ${PROJECT_DIR}/.env"
echo "3. Запустить: cd ${PROJECT_DIR} && docker-compose -f docker-compose.prod.yml up -d"

