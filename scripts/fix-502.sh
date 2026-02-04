#!/bin/bash
# Фикс 502: запуск контейнера + проверка порта 443

echo "=== 1. Кто занял порт 443? ==="
ss -tlnp | grep :443 || netstat -tlnp | grep :443
echo ""
echo "Процессы на 443:"
fuser 443/tcp 2>/dev/null || lsof -i :443 2>/dev/null || echo "Проверь вручную: ss -tlnp | grep 443"
echo ""

echo "=== 2. Запуск контейнера ==="
cd /opt/instbot
docker compose up -d 2>/dev/null || docker-compose up -d
echo ""

echo "=== 3. Ждём 5 сек ==="
sleep 5
echo ""

echo "=== 4. Статус портов ==="
for p in 3000 3001 3002 3003; do
  ss -tlnp | grep -q ":$p " && echo "  $p: OK" || echo "  $p: нет"
done
echo ""

echo "Если 443 занят — останови конкурента:"
echo "  systemctl stop apache2   # если apache"
echo "  pkill -f 'nginx'         # если висит старый nginx"
echo "  certbot certificates     # проверить certbot"
echo ""
echo "Потом: ./scripts/debug-nginx.sh"
