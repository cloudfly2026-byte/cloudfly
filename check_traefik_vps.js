const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const config = {
  host: '109.205.182.94',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('C:/Users/Edwin/.ssh/id_rsa_cloudfly'),
  readyTimeout: 30000
};

conn.on('ready', () => {
  console.log('✅ Connected to VPS via SSH key.\n');
  
  const cmd = `
    echo "=== TRAEFIK CONTAINER STATUS ===" && \
    docker ps -a --filter name=traefik && \
    echo "" && \
    echo "=== TRAEFIK RECENT LOGS (LAST 30 LINES) ===" && \
    docker logs --tail 30 traefik && \
    echo "" && \
    echo "=== TRAEFIK CONFIG IN docker-compose-full-vps.yml ===" && \
    grep -A 25 "traefik:" /apps/cloudfly/docker-compose-full-vps.yml
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
