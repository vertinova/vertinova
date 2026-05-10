#!/bin/bash
cd /var/www/vertinova
echo "[$(date)] Starting deploy..." >> /var/log/vertinova-deploy.log
git pull origin main 2>&1 >> /var/log/vertinova-deploy.log
npm install 2>&1 >> /var/log/vertinova-deploy.log
npm run build 2>&1 >> /var/log/vertinova-deploy.log
systemctl restart vertinova-finance-api 2>&1 >> /var/log/vertinova-deploy.log
echo "[$(date)] Deploy completed" >> /var/log/vertinova-deploy.log
