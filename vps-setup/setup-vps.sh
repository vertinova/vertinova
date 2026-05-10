#!/bin/bash
set -e
echo "=== [1/6] Setup MySQL database & user ==="
MYSQL_OPTS="--defaults-file=/etc/mysql/debian.cnf"
mysql $MYSQL_OPTS <<'SQL'
CREATE DATABASE IF NOT EXISTS vertinova_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'vertinova'@'localhost' IDENTIFIED BY 'VertinovaDB2026!';
GRANT ALL PRIVILEGES ON vertinova_finance.* TO 'vertinova'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "MySQL OK"

echo "=== [2/6] Buat .env.local ==="
cat > /var/www/vertinova/.env.local <<'ENV'
FINANCE_API_PORT=8787
FRONTEND_ORIGIN=https://vertinova.id
API_BASE_URL=https://vertinova.id
DATABASE_URL=mysql://vertinova:VertinovaDB2026!@127.0.0.1:3306/vertinova_finance
SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_EMAIL=admin@vertinova.id
SUPER_ADMIN_PASSWORD=firewall22
SESSION_TTL_HOURS=12
SIMPASKOR_BALANCE_URL=
SIMPASKOR_API_KEY=simpaskor-admin-fee-2026-7d4f6c9b2a8e41f0b5c3d9e7a1f8b6c4
FORBASI_BALANCE_URL=
FORBASI_API_KEY=
FORBASI_API_KEY_HEADER=X-API-Key
ENV
echo ".env.local OK"

echo "=== [3/6] npm install + prisma ==="
cd /var/www/vertinova
npm install
npx prisma generate
npx prisma db push --accept-data-loss
echo "Prisma OK"

echo "=== [4/6] Buat systemd service untuk backend API ==="
cat > /etc/systemd/system/vertinova-api.service <<'SERVICE'
[Unit]
Description=Vertinova Finance API
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/vertinova
ExecStart=/usr/bin/node /var/www/vertinova/server/proxy.mjs
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

echo "=== [5/6] Update Nginx config - tambah proxy /api ==="
cat > /etc/nginx/sites-available/vertinova.id <<'NGINX'
server {
    server_name vertinova.id www.vertinova.id;

    root /var/www/vertinova/dist;
    index index.html;

    # Proxy API ke backend Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
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
npm run build
echo "Build OK"

echo ""
echo "=== SETUP SELESAI ==="
echo "Test API: curl https://vertinova.id/api/finance/health"
