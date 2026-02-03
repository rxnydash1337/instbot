#!/bin/bash

# Скрипт настройки DNS для reg.ru
# Использование: ./setup-domain.sh your-domain.com

set -e

DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "Использование: ./setup-domain.sh your-domain.com"
    exit 1
fi

# Получаем IP сервера
SERVER_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip)

echo "🌐 Настройка DNS для домена: $DOMAIN"
echo "📡 IP сервера: $SERVER_IP"
echo ""
echo "📋 Настройте следующие DNS записи в панели reg.ru:"
echo ""
echo "Тип: A"
echo "Имя: @"
echo "Значение: $SERVER_IP"
echo "TTL: 3600"
echo ""
echo "Тип: A"
echo "Имя: www"
echo "Значение: $SERVER_IP"
echo "TTL: 3600"
echo ""
echo "⏳ Ожидание применения DNS записей..."
echo "Проверка DNS..."

# Ожидание применения DNS
for i in {1..30}; do
    DNS_IP=$(dig +short ${DOMAIN} @8.8.8.8 | tail -n1)
    if [ "$DNS_IP" = "$SERVER_IP" ]; then
        echo "✅ DNS записи применены!"
        exit 0
    fi
    echo "Попытка $i/30... (текущий IP: $DNS_IP, ожидается: $SERVER_IP)"
    sleep 10
done

echo "⚠️  DNS записи еще не применены, но можно продолжить"
echo "Проверьте DNS записи вручную: dig ${DOMAIN}"

