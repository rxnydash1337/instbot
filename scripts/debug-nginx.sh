#!/bin/bash
# Полный дебаг nginx и 502

# Запуск: chmod +x scripts/debug-nginx.sh && ./scripts/debug-nginx.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== NGINX DEBUG (502 / ERR_CONNECTION_REFUSED) ===${NC}\n"

echo -e "${YELLOW}1. Порт 80 и 443 — слушает ли nginx? (для браузера)${NC}"
ss -tlnp | grep -E ':80 |:443 ' || echo "НИЧЕГО НЕ СЛУШАЕТ 80/443"
echo ""

echo -e "${YELLOW}2. Nginx статус${NC}"
systemctl is-active nginx 2>/dev/null || echo "nginx не запущен"
echo ""

echo -e "${YELLOW}3. Синтаксис конфига${NC}"
nginx -t 2>&1 || true
echo ""

echo -e "${YELLOW}4. Firewall (80, 443 открыты?)${NC}"
ufw status 2>/dev/null | head -20 || iptables -L INPUT -n 2>/dev/null | head -15 || echo "Проверь вручную"
echo ""

echo -e "${YELLOW}5. Слушают ли порты 3000-3003 (бэкенд)?${NC}"
for p in 3000 3001 3002 3003; do
  if ss -tlnp 2>/dev/null | grep -q ":$p " || { command -v netstat >/dev/null && netstat -tlnp 2>/dev/null | grep -q ":$p "; }; then
    echo -e "  $p: ${GREEN}LISTEN${NC}"
    ss -tlnp 2>/dev/null | grep ":$p " || netstat -tlnp 2>/dev/null | grep ":$p " || true
  else
    echo -e "  $p: ${RED}НЕ СЛУШАЕТ${NC}"
  fi
done
echo ""

echo -e "${YELLOW}6. Доступность бэкендов (curl localhost)${NC}"
for p in 3000 3001 3002 3003; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:$p/ 2>/dev/null || echo "ERR")
  if [ "$code" = "ERR" ]; then
    echo -e "  :$p ${RED}не отвечает${NC}"
  else
    echo -e "  :$p ${GREEN}HTTP $code${NC}"
  fi
done
echo ""

echo -e "${YELLOW}7. Docker контейнеры instabot${NC}"
docker ps -a --filter "name=instabot" 2>/dev/null || echo "Docker не доступен"
echo ""

echo -e "${YELLOW}8. Последние ошибки nginx (error.log)${NC}"
tail -30 /var/log/nginx/error.log 2>/dev/null || echo "Нет доступа к логам"
echo ""

echo -e "${YELLOW}9. Конфиг nginx (listen)${NC}"
grep -E "listen|server_name" /etc/nginx/nginx.conf 2>/dev/null || true
echo ""

echo -e "${YELLOW}10. Активные конфиги nginx${NC}"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null
echo ""

echo -e "${YELLOW}11. proxy_pass в конфиге${NC}"
grep -r "bazkod\|proxy_pass\|listen" /etc/nginx/ 2>/dev/null | head -60
echo ""

echo -e "${YELLOW}12. Curl на бэкенд с сервера${NC}"
curl -s -o /dev/null -w "127.0.0.1:3002 → %{http_code}\n" --connect-timeout 2 http://127.0.0.1:3002/ || echo "FAIL"
echo ""

echo -e "${YELLOW}13. Процессы node${NC}"
ps aux | grep -E "node|instabot" | grep -v grep || echo "Нет node процессов"
echo ""

echo -e "${YELLOW}14. Тест прокси напрямую${NC}"
curl -s -o /dev/null -w "GET / → %{http_code}\n" -H "Host: bazkod.ru" http://127.0.0.1:3002/ 2>/dev/null || echo "FAIL"
curl -s -o /dev/null -w "GET /webhook → %{http_code}\n" -H "Host: bazkod.ru" http://127.0.0.1:3001/webhook 2>/dev/null || echo "FAIL"
echo ""

echo -e "${YELLOW}15. Порты 3000-3003 vs 0.0.0.0${NC}"
for p in 3000 3001 3002 3003; do
  ss -tlnp 2>/dev/null | grep ":$p " || true
done
echo ""

echo -e "${GREEN}=== Конец ===${NC}"
echo ""
echo "ERR_CONNECTION_REFUSED: nginx не слушает 80/443 или firewall блокирует. Запусти fix-connection.sh"
echo "502: бэкенд не отвечает. Запусти docker compose up -d"
