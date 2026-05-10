#!/bin/bash
set -e
cd /var/www/vertinova
echo "[$(date)] Starting deploy..." >> /var/log/vertinova-deploy.log
git fetch origin 2>&1 >> /var/log/vertinova-deploy.log
git reset --hard origin/main 2>&1 >> /var/log/vertinova-deploy.log
npm install 2>&1 >> /var/log/vertinova-deploy.log
npx prisma generate 2>&1 >> /var/log/vertinova-deploy.log
npx prisma db push --accept-data-loss 2>&1 >> /var/log/vertinova-deploy.log
npm run build 2>&1 >> /var/log/vertinova-deploy.log
systemctl restart vertinova-api 2>/dev/null >> /var/log/vertinova-deploy.log || true
echo "[$(date)] Deploy completed" >> /var/log/vertinova-deploy.log
