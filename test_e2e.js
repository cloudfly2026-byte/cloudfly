const http = require('http');

// Test 1: Check page renders
http.get('http://127.0.0.1:3000/marketing/ai-operation', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== PAGE RENDER TEST ===');
    console.log('STATUS:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Body length:', data.length);
    console.log('Has <html>:', data.includes('<html'));
    console.log('Has __next:', data.includes('__next'));
    console.log('Has Marketing:', data.includes('Marketing') || data.includes('marketing'));
    console.log('');
  });
}).on('error', (e) => console.error('PAGE ERR:', e.message));

// Test 2: Check socket service health
http.get('http://chat_socket:3001/api/marketing/rooms/1', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== SOCKET SERVICE TEST ===');
    console.log('STATUS:', res.statusCode);
    console.log('Response:', data.substring(0, 300));
    console.log('');
  });
}).on('error', (e) => console.error('SOCKET ERR:', e.message));

// Test 3: Check socket.io endpoint
http.get('http://chat_socket:3001/socket.io/?EIO=4&transport=polling', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== SOCKET.IO POLLING TEST ===');
    console.log('STATUS:', res.statusCode);
    console.log('Response:', data.substring(0, 200));
    console.log('');
  });
}).on('error', (e) => console.error('SOCKET.IO ERR:', e.message));
