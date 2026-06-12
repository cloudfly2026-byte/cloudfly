const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const config = {
  host: 'api.cloudfly.com.co',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('C:/Users/Edwin/.ssh/id_rsa_cloudfly'),
  readyTimeout: 30000
};

conn.on('ready', () => {
  console.log('✅ Connected to VPS via SSH key.\n');
  
  const cmd = `
    echo "=== PS AUX ===" && \
    ps aux | grep storefront | grep -v grep && \
    echo "" && \
    echo "=== SYSTEMD SERVICES ===" && \
    systemctl list-units --type=service | grep -E "storefront|cloudfly" || true && \
    echo "" && \
    echo "=== PM2 STATUS ===" && \
    pm2 status || true && \
    echo "" && \
    echo "=== NGINX CONFIG FOR babystore ===" && \
    grep -rn "babystore" /etc/nginx/ || true
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err);
  process.exit(1);
}).connect(config);
