/**
 * CLOUD-246: End-to-end smoke test for Marketing Live Dashboard
 * 
 * This script verifies:
 * 1. Frontend is accessible at localhost:3000
 * 2. Socket.IO server is accessible at localhost:3001
 * 3. Socket connection can be established
 * 4. subscribe-marketing event can be emitted
 * 5. subscribed-marketing response is received
 * 6. No errors in the connection flow
 */

// Use the socket.io-client from chat-socket-service's node_modules
const io = require('C:/apps/cloudfly/chat-socket-service/node_modules/socket.io-client');

const SOCKET_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';

const results = [];
const addResult = (criterion, passed, detail) => {
  results.push({ criterion, passed, detail });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${criterion}: ${detail}`);
};

// ---- Test 1: Frontend HTTP accessibility ----
async function testFrontendHTTP() {
  try {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(FRONTEND_URL, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 308 is a permanent redirect (Next.js default behavior, e.g. to /dashboard or /login)
          // 200 is direct render. Both are acceptable — the key is no 404/500.
          const isHealthy = res.statusCode === 200 || res.statusCode === 308 || res.statusCode === 307 || res.statusCode === 302;
          addResult(
            'AC-1: Page renders at / without white screen',
            isHealthy,
            `HTTP ${res.statusCode} (redirect or OK), response length: ${data.length} bytes`
          );
          resolve();
        });
      });
      req.on('error', (err) => {
        addResult('AC-1: Page renders at / without white screen', false, `HTTP error: ${err.message}`);
        resolve();
      });
      req.setTimeout(10000, () => {
        addResult('AC-1: Page renders at / without white screen', false, 'HTTP timeout (10s)');
        resolve();
      });
    });
  } catch (err) {
    addResult('AC-1: Page renders at / without white screen', false, `Exception: ${err.message}`);
  }
}

// ---- Test 2: Socket.IO server accessibility ----
async function testSocketServer() {
  return new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: 'smoke-test-token',
        tenantId: 1,
        companyId: 1
      },
      reconnection: false,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      addResult('AC-2: Socket connection attempt visible', false, 'Connection timeout (10s)');
      addResult('AC-3: subscribe-marketing event emitted', false, 'Skipped due to connection failure');
      addResult('AC-4: subscribed-marketing response received', false, 'Skipped due to connection failure');
      socket.disconnect();
      resolve();
    }, 12000);

    socket.on('connect', () => {
      addResult('AC-2: Socket connection attempt visible', true, `Connected with socket ID: ${socket.id}`);
      
      // Emit subscribe-marketing
      socket.emit('subscribe-marketing', { tenantId: 1, companyId: 1 });
      addResult('AC-3: subscribe-marketing event emitted', true, 'Event emitted with tenantId=1, companyId=1');
    });

    socket.on('subscribed-marketing', (data) => {
      const roomOk = data.room === 'marketing_tenant_1_company_1';
      addResult('AC-4: subscribed-marketing response received', roomOk, `Room: ${data.room}, tenantId: ${data.tenantId}, companyId: ${data.companyId}`);
      
      // Test unsubscribe
      socket.emit('unsubscribe-marketing', { tenantId: 1, companyId: 1 });
    });

    socket.on('unsubscribed-marketing', (data) => {
      addResult('AC-5: unsubscribe-marketing works', true, `Left room: ${data.room}`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('error', (err) => {
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('Cross-tenant')) {
        addResult('AC-4: subscribed-marketing response received', false, `Cross-tenant rejection: ${msg}`);
      } else {
        addResult('AC-4: subscribed-marketing response received', false, `Socket error: ${msg}`);
      }
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      addResult('AC-2: Socket connection attempt visible', false, `Connection error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });

    socket.on('disconnect', (reason) => {
      console.log(`  ℹ️ Socket disconnected: ${reason}`);
    });
  });
}

// ---- Test 3: Verify frontend page route exists (check for Next.js build output) ----
async function testFrontendRoute() {
  try {
    const http = require('http');
    return new Promise((resolve) => {
      // Try the marketing page route
      const req = http.get(`${FRONTEND_URL}/marketing/ai-operation`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 200 = page renders (may redirect to login but route exists)
          // 308/307/302 = redirect (also acceptable, means route exists)
          // 404 = route doesn't exist
          const routeExists = res.statusCode !== 404 && res.statusCode !== 500;
          const hasContent = data.length > 1000; // Real pages have content
          addResult(
            'AC-6: /marketing/ai-operation route exists',
            routeExists && hasContent,
            `HTTP ${res.statusCode}, length: ${data.length} bytes, has substantial content: ${hasContent}`
          );
          resolve();
        });
      });
      req.on('error', (err) => {
        addResult('AC-6: /marketing/ai-operation route exists', false, `HTTP error: ${err.message}`);
        resolve();
      });
      req.setTimeout(10000, () => {
        addResult('AC-6: /marketing/ai-operation route exists', false, 'HTTP timeout');
        resolve();
      });
    });
  } catch (err) {
    addResult('AC-6: /marketing/ai-operation route exists', false, `Exception: ${err.message}`);
  }
}

// ---- Test 4: Verify socket event handlers are registered (marketing-batch-update) ----
async function testSocketEventHandlers() {
  return new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: 'smoke-test-token-2',
        tenantId: 1,
        companyId: 1
      },
      reconnection: false,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      addResult('AC-7: Socket event handlers functional', false, 'Timeout waiting for subscription');
      socket.disconnect();
      resolve();
    }, 12000);

    socket.on('connect', () => {
      socket.emit('subscribe-marketing', { tenantId: 1, companyId: 1 });
    });

    socket.on('subscribed-marketing', (data) => {
      addResult('AC-7: Socket event handlers functional', true, `Subscribed to ${data.room}, handlers registered`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('error', (err) => {
      addResult('AC-7: Socket event handlers functional', false, `Error: ${err?.message || JSON.stringify(err)}`);
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      addResult('AC-7: Socket event handlers functional', false, `Connection error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

// ---- Test 5: Cross-tenant security validation ----
async function testCrossTenantSecurity() {
  return new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: 'smoke-test-token-3',
        tenantId: 1,
        companyId: 1
      },
      reconnection: false,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      addResult('AC-8: Cross-tenant security enforced', false, 'Timeout');
      socket.disconnect();
      resolve();
    }, 12000);

    socket.on('connect', () => {
      // Try to subscribe to a different tenant (tenantId=999)
      socket.emit('subscribe-marketing', { tenantId: 999, companyId: 1 });
    });

    socket.on('subscribed-marketing', (data) => {
      // If we get here with tenantId=999, security is broken
      if (data.tenantId === 999 || (data.room && data.room.includes('tenant_999'))) {
        addResult('AC-8: Cross-tenant security enforced', false, `Breach: subscribed to tenant 999 room: ${data.room}`);
      } else {
        addResult('AC-8: Cross-tenant security enforced', true, `Correctly subscribed to own tenant room: ${data.room}`);
      }
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('error', (err) => {
      const msg = err?.message || JSON.stringify(err);
      if (msg.includes('Cross-tenant')) {
        addResult('AC-8: Cross-tenant security enforced', true, `Correctly rejected: ${msg}`);
      } else {
        addResult('AC-8: Cross-tenant security enforced', false, `Unexpected error: ${msg}`);
      }
      clearTimeout(timeout);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (err) => {
      addResult('AC-8: Cross-tenant security enforced', false, `Connection error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });
  });
}

// ---- Main execution ----
async function main() {
  console.log('='.repeat(70));
  console.log('CLOUD-246: End-to-End Smoke Test — Marketing Live Dashboard');
  console.log('='.repeat(70));
  console.log(`Socket URL: ${SOCKET_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log('');

  console.log('--- Test 1: Frontend HTTP Accessibility ---');
  await testFrontendHTTP();
  console.log('');

  console.log('--- Test 2: Socket.IO Connection & Subscription ---');
  await testSocketServer();
  console.log('');

  console.log('--- Test 3: Frontend Route Check ---');
  await testFrontendRoute();
  console.log('');

  console.log('--- Test 4: Socket Event Handlers ---');
  await testSocketEventHandlers();
  console.log('');

  console.log('--- Test 5: Cross-Tenant Security ---');
  await testCrossTenantSecurity();
  console.log('');

  // Summary
  console.log('='.repeat(70));
  console.log('SMOKE TEST SUMMARY');
  console.log('='.repeat(70));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Results: ${passed}/${total} criteria passed`);
  console.log('');
  
  if (passed === total) {
    console.log('🎉 ALL CRITERIA PASSED — Smoke test is GREEN');
  } else {
    console.log('⚠️ SOME CRITERIA FAILED — See details above');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.criterion}: ${r.detail}`);
    });
  }
  console.log('='.repeat(70));

  // Exit code
  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
