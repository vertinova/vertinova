#!/bin/bash
set -e

# Prompt credentials — tidak disimpan di repo
echo "=== Masukkan konfigurasi VPS ==="
read -rp "MySQL password untuk user 'vertinova': " DB_PASSWORD
read -rp "Super Admin password (untuk login dashboard): " ADMIN_PASSWORD
read -rp "Simpaskor API Key: " SIMPASKOR_KEY
read -rp "Forbasi API Key: " FORBASI_KEY
echo ""

echo "=== [1/6] Setup MySQL database & user ==="
MYSQL_OPTS="--defaults-file=/etc/mysql/debian.cnf"
mysql $MYSQL_OPTS <<SQL
CREATE DATABASE IF NOT EXISTS vertinova_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'vertinova'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON vertinova_finance.* TO 'vertinova'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "MySQL OK"

echo "=== [2/6] Buat .env.local ==="
mkdir -p /var/www/vertinova/backend
cat > /var/www/vertinova/backend/.env.local <<ENV
FINANCE_API_PORT=8787
FRONTEND_ORIGIN=https://vertinova.id
API_BASE_URL=https://vertinova.id
DATABASE_URL=mysql://vertinova:${DB_PASSWORD}@127.0.0.1:3306/vertinova_finance
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@vertinova.id
SUPER_ADMIN_PASSWORD=${ADMIN_PASSWORD}
SESSION_TTL_HOURS=12
SIMPASKOR_API_BASE_URL=https://simpaskor.id
SIMPASKOR_BALANCE_URL=/api/external/admin-fees?includeDetails=true
SIMPASKOR_API_KEY=${SIMPASKOR_KEY}
SIMPASKOR_API_KEY_HEADER=X-API-Key
FORBASI_BALANCE_URL=/api/external/kta/payment-config
FORBASI_API_KEY=${FORBASI_KEY}
FORBASI_API_KEY_HEADER=X-API-Key
ENV
echo ".env.local OK"

echo "=== [3/6] npm install + prisma ==="
cd /var/www/vertinova
npm install --prefix frontend
npm install --prefix backend
set -a
. /var/www/vertinova/backend/.env.local
set +a
cd /var/www/vertinova/backend
npx prisma generate
npx prisma db push
cd /var/www/vertinova
echo "Prisma OK"

echo "=== [4/6] Buat systemd service untuk backend API ==="
cat > /etc/systemd/system/vertinova-api.service <<'SERVICE'
[Unit]
Description=Vertinova Finance API
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/vertinova/backend
ExecStart=/usr/bin/node server/proxy.mjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE
systemctl daemon-reload
systemctl enable vertinova-api
systemctl restart vertinova-api
echo "API service OK"

echo "=== [5/6] Update Nginx config ==="
cat > /etc/nginx/sites-available/vertinova.id <<'NGINX'
server {
    server_name vertinova.id www.vertinova.id;

    root /var/www/vertinova/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    access_log /var/log/nginx/vertinova.id.access.log;
    error_log /var/log/nginx/vertinova.id.error.log;

    listen [::]:443 ssl;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/vertinova.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vertinova.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = www.vertinova.id) { return 301 https://$host$request_uri; }
    if ($host = vertinova.id) { return 301 https://$host$request_uri; }
    listen 80;
    listen [::]:80;
    server_name vertinova.id www.vertinova.id;
    return 404;
}
NGINX
nginx -t && systemctl reload nginx
echo "Nginx OK"

echo "=== [6/6] Build frontend ==="
cd /var/www/vertinova
npm run build --prefix frontend
echo "Build OK"

echo ""
echo "=== SETUP SELESAI ==="
echo "Test API: curl https://vertinova.id/api/finance/health"
