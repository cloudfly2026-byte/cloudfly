const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const config = {
  host: '109.205.182.94',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('C:/Users/Edwin/.ssh/id_rsa_cloudfly'),
  readyTimeout: 60000
};

console.log('🚀 Connecting to VPS to pull and rebuild web-team with Redis invalidation pattern...');

conn.on('ready', () => {
  console.log('✅ SSH Connection established.');
  
  const cmd = 'cd /apps/cloudfly && git stash && git pull origin main && docker compose -f docker-compose-full-vps.yml build web-team && docker compose -f docker-compose-full-vps.yml up -d web-team';
  
  console.log(`🏃 Running remote command: ${cmd}`);
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`\n🏁 Command finished with exit code: ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('❌ Connection error:', err);
}).connect(config);
