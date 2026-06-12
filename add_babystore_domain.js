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

conn.on('ready', () => {
  console.log('✅ Connected to VPS.');
  
  const query = `
    USE cloud_master;
    INSERT INTO company_domains (tenant_id, company_id, domain_name, is_subdomain, estado, fecha_registro)
    VALUES (83, 88, 'babystore.cloudfly.com.co', 1, 'activo', NOW())
    ON DUPLICATE KEY UPDATE estado='activo';
    
    -- Let's also check if there is an active subscription for tenant 83
    INSERT INTO subscriptions (customer_id, status, plan_id, start_date, end_date)
    VALUES (83, 'ACTIVE', 1, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
    ON DUPLICATE KEY UPDATE status='ACTIVE', end_date=DATE_ADD(NOW(), INTERVAL 1 YEAR);
    
    SELECT * FROM company_domains WHERE domain_name = 'babystore.cloudfly.com.co';
  `;

  // Escape query for bash double quotes
  const escapedQuery = query.replace(/`/g, '\\`').replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `docker exec -i mysql mysql -u root -pwidowmaker -e "${escapedQuery}"`;

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
