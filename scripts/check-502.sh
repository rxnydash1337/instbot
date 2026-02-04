#!/bin/bash
# Узкий чек 502: откуда запрос и куда проксит

echo "=== Curl на бэкенд (должен 200) ==="
curl -v --connect-timeout 3 http://127.0.0.1:3002/ 2>&1 | head -20
echo ""

echo "=== Какой server_name ловит bazkod.ru? ==="
echo "Первый server с bazkod.ru в порядке загрузки:"
grep -r "server_name" /etc/nginx/ 2>/dev/null | grep -i bazkod
echo ""

echo "=== Конфиги с bazkod.ru (полный путь) ==="
grep -rl "bazkod" /etc/nginx/ 2>/dev/null
echo ""

echo "=== В этих файлах есть proxy_pass к 3002? ==="
for f in $(grep -rl "bazkod" /etc/nginx/ 2>/dev/null); do
  echo "--- $f ---"
  grep -A2 "location /" "$f" 2>/dev/null | head -20
  grep "proxy_pass" "$f" 2>/dev/null || echo "(нет proxy_pass)"
done
echo ""

echo "=== Последние 502 в error.log ==="
grep "502\|upstream\|connection refused" /var/log/nginx/error.log 2>/dev/null | tail -10
