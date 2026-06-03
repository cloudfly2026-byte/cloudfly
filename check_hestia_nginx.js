const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connection established');
  const commands = [
    'cat /usr/local/hestia/nginx/conf/nginx.conf'
  ];

  const runCommand = (cmd) => {
    return new Promise((resolve, reject) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('close', (code, signal) => {
          resolve({ cmd, code, stdout, stderr });
        }).on('data', (data) => {
          stdout += data;
        }).stderr.on('data', (data) => {
          stderr += data;
        });
      });
    });
  };

  (async () => {
    for (const cmd of commands) {
      console.log(`\n--- RUNNING: ${cmd} ---`);
      try {
        const res = await runCommand(cmd);
        console.log(`STDOUT:\n${res.stdout}`);
        if (res.stderr) console.log(`STDERR:\n${res.stderr}`);
        console.log(`EXIT CODE: ${res.code}`);
      } catch (err) {
        console.error(`Error executing command ${cmd}:`, err);
      }
    }
    conn.end();
  })();
}).connect({
  host: 'cloudfly.com.co',
  port: 10622,
  username: 'root',
  password: 'Elian20200916',
  readyTimeout: 20000
});
