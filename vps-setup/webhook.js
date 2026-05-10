import http from 'http';
import crypto from 'crypto';
import { exec } from 'child_process';

const PORT = 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'vertinova-webhook-secret';

function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    return res.end('Not Found');
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'] || '';

    if (!verifySignature(body, signature)) {
      console.log('[' + new Date().toISOString() + '] Invalid signature');
      res.writeHead(401);
      return res.end('Unauthorized');
    }

    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      res.writeHead(400);
      return res.end('Bad Request');
    }

    const branch = (payload.ref || '').replace('refs/heads/', '');
    console.log('[' + new Date().toISOString() + '] Push to branch: ' + branch);

    if (branch === 'main' || branch === 'master') {
      exec('/var/www/vertinova/deploy.sh', (err, stdout, stderr) => {
        if (err) {
          console.error('[' + new Date().toISOString() + '] Deploy error: ' + err.message);
        } else {
          console.log('[' + new Date().toISOString() + '] Deploy success');
        }
      });
    }

    res.writeHead(200);
    res.end('OK');
  });
});

server.listen(PORT, () => {
  console.log('[' + new Date().toISOString() + '] Webhook server running on port ' + PORT);
});
