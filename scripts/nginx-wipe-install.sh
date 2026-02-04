#!/bin/bash
# Удалить всё лишнее, поставить один nginx.conf

[ "$EUID" -ne 0 ] && { echo "root"; exit 1; }

echo "=== 1. Удаление лишнего ==="
rm -rf /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* 2>/dev/null
rm -rf /etc/nginx/vhosts /etc/nginx/vhosts-resources 2>/dev/null
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null
find /etc/nginx -name "*.conf" -delete 2>/dev/null

echo "=== 3. Один nginx.conf ==="
cat > /etc/nginx/nginx.conf << 'EOF'
worker_processes auto;
events { worker_connections 1024; }

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

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
}
EOF

echo "=== 4. Проверка ==="
nginx -t && systemctl restart nginx

echo "Готово"
