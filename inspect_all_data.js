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
    SELECT '=== COMPANIES ===' as '';
    SELECT id, name, tenant_id FROM companies;
    SELECT '=== COMPANY DOMAINS ===' as '';
    SELECT id, tenant_id, company_id, domain_name, estado FROM company_domains;
    SELECT '=== COMPANY WEBSITES ===' as '';
    SELECT id, company_id, site_name, theme FROM company_website;
    SELECT '=== ALL THEMES ===' as '';
    SELECT id, company_id, name FROM company_themes;
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
