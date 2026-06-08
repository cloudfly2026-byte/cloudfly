const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const config = {
  host: 'api.cloudfly.com.co',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('C:/Users/Edwin/.ssh/id_rsa_cloudfly'),
};

conn.on('ready', () => {
  console.log('✅ SSH Client Connected');
  
  const sqlContent = `
USE cloud_master;

CREATE TABLE IF NOT EXISTS company_domains (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    domain_name VARCHAR(255) NOT NULL UNIQUE,
    is_subdomain BOOLEAN DEFAULT FALSE,
    estado VARCHAR(50) DEFAULT 'activo',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_caduca TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_domains_tenant_company (tenant_id, company_id),
    INDEX idx_company_domains_name (domain_name)
);

INSERT INTO company_domains (tenant_id, company_id, domain_name, is_subdomain, estado, fecha_caduca)
VALUES (1, 1, 'cloudflyshop.cloudfly.com.co', TRUE, 'activo', '2036-06-08 10:00:00')
ON DUPLICATE KEY UPDATE estado = 'activo', is_subdomain = TRUE;
  `;

  const remotePath = '/tmp/migration_domains.sql';
  conn.exec(`cat > ${remotePath} << 'EOF'\n${sqlContent}\nEOF\n`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      const cmd = `docker exec -i mysql mysql -uroot -pwidowmaker < ${remotePath}`;
      conn.exec(cmd, (err, execStream) => {
        if (err) throw err;
        execStream.on('close', () => {
          console.log('✅ Company Domains Migration finished successfully');
          
          // Verify insertion
          conn.exec(`docker exec -i mysql mysql -uroot -pwidowmaker -e "SELECT * FROM cloud_master.company_domains;"`, (err, verifyStream) => {
            if (err) throw err;
            verifyStream.on('close', () => {
              conn.end();
            }).on('data', d => console.log('VERIFY:\n' + d)).stderr.on('data', e => console.error('VERIFY ERR: ' + e));
          });
        }).on('data', d => console.log('OUT: ' + d)).stderr.on('data', e => console.error('ERR: ' + e));
      });
    }).on('data', d => console.log(d.toString()));
  });
}).connect(config);
