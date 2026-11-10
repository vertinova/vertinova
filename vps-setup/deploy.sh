#!/bin/bash
# Deploy for vertinova.id, run by the GitHub webhook (webhook.js) on every push to main.
# Copy of /var/www/vertinova/deploy.sh on the server: keep both in sync.
#
# Wrapped in main() so bash parses the whole file before anything (e.g. git reset) can rewrite it mid-run.
main() {
  set -uo pipefail
  exec >>/var/log/vertinova-deploy.log 2>&1 # stdout AND stderr go to the log

  cd /var/www/vertinova || exit 1
  echo "[$(date)] Starting deploy..."

  git fetch origin && git reset --hard origin/main || { echo "[$(date)] FAILED: git update"; exit 1; }

  # Public site first: it must not depend on the database being reachable.
  npm install --prefix frontend || { echo "[$(date)] FAILED: frontend npm install"; exit 1; }
  npm run build || { echo "[$(date)] FAILED: frontend build (previous dist may be partially replaced)"; exit 1; }
  echo "[$(date)] Frontend built"

  npm install --prefix backend || { echo "[$(date)] FAILED: backend npm install"; exit 1; }
  set -a
  . /var/www/vertinova/backend/.env.local
  set +a
  if (cd backend && npx prisma generate && npx prisma db push --accept-data-loss); then
    systemctl restart vertinova-api || echo "[$(date)] WARN: restart vertinova-api failed"
  else
    echo "[$(date)] FAILED: prisma generate/db push - backend NOT restarted"
    exit 1
  fi

  echo "[$(date)] Deploy completed"
}

main "$@"
