const http = require('http');
http.get('http://127.0.0.1:3000/marketing/ai-operation', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers));
    console.log('BODY (first 500):', data.substring(0, 500));
  });
}).on('error', (e) => console.error('ERR:', e.message));
