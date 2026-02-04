#!/bin/bash
# Фикс ERR_CONNECTION_REFUSED

[ "$EUID" -ne 0 ] && { echo "root"; exit 1; }

echo "=== 1. Firewall: открыть 80, 443 ==="
ufw allow 80/tcp 2>/dev/null
ufw allow 443/tcp 2>/dev/null
ufw --force enable 2>/dev/null
echo ""

echo "=== 2. Nginx: запуск ==="
systemctl start nginx 2>/dev/null || nginx
sleep 2
echo ""

echo "=== 3. Docker + instabot ==="
cd /opt/instbot 2>/dev/null || cd "$(dirname "$0")/.."
docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null
sleep 3
echo ""

echo "=== 4. Проверка ==="
ss -tlnp | grep -E ':80 |:443 |:3002 ' || true
echo ""
echo "Проверь: http://bazkod.ru (или https://)"
