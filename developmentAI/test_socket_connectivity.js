// Test script to verify frontend-react can reach chat_socket:3001
const net = require('net');
const http = require('http');

console.log('=== Socket Connectivity Test from frontend-react ===\n');

// Test 1: TCP connection to chat_socket:3001
console.log('Test 1: TCP connection to chat_socket:3001');
const tcpSocket = net.createConnection(3001, 'chat_socket', () => {
    console.log('  PASS: TCP connection to chat_socket:3001 SUCCESS');
    tcpSocket.end();
    
    // Test 2: HTTP request to Socket.IO endpoint
    console.log('\nTest 2: HTTP request to chat_socket:3001/socket.io/');
    const options = {
        hostname: 'chat_socket',
        port: 3001,
        path: '/socket.io/',
        method: 'GET',
        timeout: 5000
    };
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('  Status:', res.statusCode);
            console.log('  Body (first 500 chars):', data.substring(0, 500));
            
            // Test 3: Health endpoint
            console.log('\nTest 3: Health endpoint chat_socket:3001/health');
            const healthReq = http.request({
                hostname: 'chat_socket',
                port: 3001,
                path: '/health',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                let healthData = '';
                res.on('data', (chunk) => healthData += chunk);
                res.on('end', () => {
                    console.log('  Status:', res.statusCode);
                    console.log('  Body:', healthData);
                    console.log('\n=== All tests complete ===');
                });
            });
            healthReq.on('error', (e) => console.error('  FAIL:', e.message));
            healthReq.on('timeout', () => { console.error('  FAIL: Timeout'); healthReq.destroy(); });
            healthReq.end();
        });
    });
    req.on('error', (e) => console.error('  FAIL:', e.message));
    req.on('timeout', () => { console.error('  FAIL: Timeout'); req.destroy(); });
    req.end();
    
}).on('error', (e) => {
    console.error('  FAIL: TCP connection to chat_socket:3001 FAILED:', e.message);
});
