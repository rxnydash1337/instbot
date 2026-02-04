#!/bin/bash
# Убить всё и поставить один чистый конфиг для bazkod.ru

set -e
[ "$EUID" -ne 0 ] && { echo "Запусти от root"; exit 1; }

BACKUP_DIR="/root/nginx-backup-$(date +%Y%m%d%H%M)"
mkdir -p "$BACKUP_DIR"

echo "=== 1. Бэкап и удаление всех bazkod конфигов ==="
mv /etc/nginx/vhosts/www-root/bazkod.ru.conf "$BACKUP_DIR/" 2>/dev/null || true
mv /etc/nginx/sites-available/instabot "$BACKUP_DIR/" 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/instabot 2>/dev/null || true
rm -rf /etc/nginx/vhosts-resources/bazkod.ru 2>/dev/null || true
# Удалить из isplimitreq если там bazkod
sed -i '/bazkod/d' /etc/nginx/conf.d/isplimitreq.conf 2>/dev/null || true

echo "=== 2. Создаю один конфиг ==="
mkdir -p /etc/nginx/vhosts/www-root
cat > /etc/nginx/vhosts/www-root/bazkod.ru.conf << 'NGINX'
server {
    listen 80;
    server_name bazkod.ru www.bazkod.ru;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /oauth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /webhook {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /landing {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

echo "=== 3. Проверка и перезапуск ==="
nginx -t
systemctl reload nginx

echo "=== 4. SSL (если нужен) ==="
echo "Запусти: certbot --nginx -d bazkod.ru -d www.bazkod.ru --email твой@email.com"
echo ""
echo "Бэкап: $BACKUP_DIR"
