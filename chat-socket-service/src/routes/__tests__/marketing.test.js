/**
 * CLOUD-247: Integration test for marketing REST API endpoint
 *
 * Tests the /api/marketing/emit and /api/marketing/rooms endpoints
 * that allow backend services to emit marketing socket events via REST.
 *
 * Uses a manual HTTP request approach instead of supertest to avoid
 * dependency issues in the test environment.
 */

const http = require('http');
const { emitToMarketingRoom, getMarketingRoomName } = require('../../handlers/marketingHandler');

// Mock logger
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

// Create a minimal Express app with the marketing router
function createTestApp() {
    const express = require('express');
    const app = express();
    app.use(express.json());

    // Mock Socket.IO instance
    const mockIo = {
        roomEmits: [],
        to(room) {
            return {
                emit(event, data) {
                    mockIo.roomEmits.push({ room, event, data });
                }
            };
        },
        sockets: {
            adapter: {
                rooms: new Map()
            }
        }
    };

    app.set('io', mockIo);

    const marketingRouter = require('../marketing');
    app.use('/api/marketing', marketingRouter);

    return { app, mockIo };
}

// Helper: make HTTP request to Express app without supertest
function makeRequest(app, method, path, body) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            const options = {
                hostname: 'localhost',
                port: port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    server.close();
                    try {
                        resolve({
                            status: res.statusCode,
                            body: JSON.parse(data)
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            body: data
                        });
                    }
                });
            });

            req.on('error', (err) => {
                server.close();
                reject(err);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    });
}

describe('Marketing REST API', () => {

    describe('POST /api/marketing/emit', () => {
        it('should emit marketing-batch-update event', async () => {
            const { app, mockIo } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                event: 'marketing-batch-update',
                tenantId: 1,
                payload: {
                    agents: [{ id: 'agent-1', status: 'idle' }],
                    connections: []
                }
            });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.event).toBe('marketing-batch-update');
            expect(response.body.room).toBe('marketing_tenant_1');
        });

        it('should emit event with companyId', async () => {
            const { app, mockIo } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                event: 'marketing-agent-status-update',
                tenantId: 1,
                companyId: 7,
                payload: { agentId: 'agent-1', status: 'working' }
            });

            expect(response.status).toBe(200);
            expect(response.body.room).toBe('marketing_tenant_1_company_7');
        });

        it('should return 400 when event is missing', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                tenantId: 1,
                payload: {}
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('event');
        });

        it('should return 400 when tenantId is missing', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                event: 'marketing-batch-update',
                payload: {}
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('tenantId');
        });

        it('should return 400 when payload is missing', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                event: 'marketing-batch-update',
                tenantId: 1
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('payload');
        });

        it('should return 400 for invalid event name', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                event: 'invalid-event',
                tenantId: 1,
                payload: {}
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('Invalid event');
        });

        it('should accept all valid marketing event types', async () => {
            const { app } = createTestApp();

            const validEvents = [
                'marketing-batch-update',
                'marketing-agent-status-update',
                'marketing-agent-task-update',
                'marketing-action-event'
            ];

            for (const event of validEvents) {
                const response = await makeRequest(app, 'POST', '/api/marketing/emit', {
                    event,
                    tenantId: 1,
                    payload: {}
                });

                expect(response.status).toBe(200);
                expect(response.body.event).toBe(event);
            }
        });
    });

    describe('GET /api/marketing/rooms/:tenantId', () => {
        it('should return room info without companyId', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'GET', '/api/marketing/rooms/1');

            expect(response.status).toBe(200);
            expect(response.body.room).toBe('marketing_tenant_1');
            expect(response.body.tenantId).toBe(1);
            expect(response.body.companyId).toBeNull();
        });

        it('should return room info with companyId', async () => {
            const { app } = createTestApp();

            const response = await makeRequest(app, 'GET', '/api/marketing/rooms/1?companyId=7');

            expect(response.status).toBe(200);
            expect(response.body.room).toBe('marketing_tenant_1_company_7');
            expect(response.body.tenantId).toBe(1);
            expect(response.body.companyId).toBe(7);
        });
    });
});
