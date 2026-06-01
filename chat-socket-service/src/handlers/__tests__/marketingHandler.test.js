/**
 * CLOUD-247: Unit Tests for Marketing Socket Handlers
 *
 * Tests the marketingHandler module that handles:
 *   • subscribe-marketing   — Join marketing room
 *   • unsubscribe-marketing — Leave marketing room
 *   • getMarketingRoomName  — Room name utility
 *   • emitToMarketingRoom   — Server-side emit utility
 */

const {
    handleSubscribeMarketing,
    handleUnsubscribeMarketing,
    getMarketingRoomName,
    emitToMarketingRoom
} = require('../src/handlers/marketingHandler');

// ---------------------------------------------------------------------------
// Mock Logger
// ---------------------------------------------------------------------------

jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

// ---------------------------------------------------------------------------
// Mock Socket Factory
// ---------------------------------------------------------------------------

function createMockSocket(overrides = {}) {
    const joinedRooms = new Set();
    const leftRooms = new Set();
    const emittedEvents = [];

    return {
        id: 'socket-123',
        userId: 1,
        tenantId: 1,
        companyId: null,
        userName: 'TestUser',
        joinedRooms,
        leftRooms,
        emittedEvents,
        join(room) { joinedRooms.add(room); },
        leave(room) { leftRooms.add(room); },
        emit(event, data) { emittedEvents.push({ event, data }); },
        ...overrides
    };
}

function createMockIo() {
    const roomEmits = [];

    return {
        roomEmits,
        to(room) {
            return {
                emit(event, data) {
                    roomEmits.push({ room, event, data });
                }
            };
        }
    };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('marketingHandler', () => {

    // =========================================================================
    // getMarketingRoomName
    // =========================================================================

    describe('getMarketingRoomName', () => {
        it('should return tenant-only room when companyId is undefined', () => {
            expect(getMarketingRoomName(1)).toBe('marketing_tenant_1');
        });

        it('should return tenant-only room when companyId is null', () => {
            expect(getMarketingRoomName(5, null)).toBe('marketing_tenant_5');
        });

        it('should return tenant+company room when companyId is provided', () => {
            expect(getMarketingRoomName(1, 7)).toBe('marketing_tenant_1_company_7');
        });

        it('should handle large tenant and company IDs', () => {
            expect(getMarketingRoomName(999, 1234)).toBe('marketing_tenant_999_company_1234');
        });
    });

    // =========================================================================
    // handleSubscribeMarketing
    // =========================================================================

    describe('handleSubscribeMarketing', () => {
        it('should join tenant-only room when no companyId in data or socket', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1 });

            expect(socket.joinedRooms.has('marketing_tenant_1')).toBe(true);
        });

        it('should join tenant+company room when companyId is in data', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1, companyId: 7 });

            expect(socket.joinedRooms.has('marketing_tenant_1_company_7')).toBe(true);
        });

        it('should fall back to socket.companyId when data has no companyId', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: 5 });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1 });

            expect(socket.joinedRooms.has('marketing_tenant_1_company_5')).toBe(true);
        });

        it('should prefer data.companyId over socket.companyId', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: 5 });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1, companyId: 9 });

            expect(socket.joinedRooms.has('marketing_tenant_1_company_9')).toBe(true);
            expect(socket.joinedRooms.has('marketing_tenant_1_company_5')).toBe(false);
        });

        it('should fall back to socket.tenantId when data has no tenantId', () => {
            const socket = createMockSocket({ tenantId: 42, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({});

            expect(socket.joinedRooms.has('marketing_tenant_42')).toBe(true);
        });

        it('should emit error when no tenantId is available', () => {
            const socket = createMockSocket({ tenantId: null, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({});

            const errorEvent = socket.emittedEvents.find(e => e.event === 'error');
            expect(errorEvent).toBeDefined();
            expect(errorEvent.data.message).toContain('tenantId is required');
        });

        it('should emit subscribed-marketing confirmation', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1, companyId: 3 });

            const confirmEvent = socket.emittedEvents.find(e => e.event === 'subscribed-marketing');
            expect(confirmEvent).toBeDefined();
            expect(confirmEvent.data.room).toBe('marketing_tenant_1_company_3');
            expect(confirmEvent.data.tenantId).toBe(1);
            expect(confirmEvent.data.companyId).toBe(3);
        });

        it('should emit subscribed-marketing with null companyId when not provided', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleSubscribeMarketing(socket, io);
            handler({ tenantId: 1 });

            const confirmEvent = socket.emittedEvents.find(e => e.event === 'subscribed-marketing');
            expect(confirmEvent).toBeDefined();
            expect(confirmEvent.data.companyId).toBeNull();
        });
    });

    // =========================================================================
    // handleUnsubscribeMarketing
    // =========================================================================

    describe('handleUnsubscribeMarketing', () => {
        it('should leave tenant-only room when no companyId', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleUnsubscribeMarketing(socket, io);
            handler({ tenantId: 1 });

            expect(socket.leftRooms.has('marketing_tenant_1')).toBe(true);
        });

        it('should leave tenant+company room when companyId is provided', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleUnsubscribeMarketing(socket, io);
            handler({ tenantId: 1, companyId: 7 });

            expect(socket.leftRooms.has('marketing_tenant_1_company_7')).toBe(true);
        });

        it('should fall back to socket.companyId when data has no companyId', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: 5 });
            const io = createMockIo();

            const handler = handleUnsubscribeMarketing(socket, io);
            handler({ tenantId: 1 });

            expect(socket.leftRooms.has('marketing_tenant_1_company_5')).toBe(true);
        });

        it('should emit unsubscribed-marketing confirmation', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: null });
            const io = createMockIo();

            const handler = handleUnsubscribeMarketing(socket, io);
            handler({ tenantId: 1, companyId: 3 });

            const confirmEvent = socket.emittedEvents.find(e => e.event === 'unsubscribed-marketing');
            expect(confirmEvent).toBeDefined();
            expect(confirmEvent.data.room).toBe('marketing_tenant_1_company_3');
            expect(confirmEvent.data.tenantId).toBe(1);
            expect(confirmEvent.data.companyId).toBe(3);
        });

        it('should not emit error when tenantId is missing (silent fail for unsubscribe)', () => {
            const socket = createMockSocket({ tenantId: null, companyId: null });
            const io = createMockIo();

            const handler = handleUnsubscribeMarketing(socket, io);
            handler({});

            // Unsubscribe should not emit error events (silent failure is acceptable)
            const errorEvent = socket.emittedEvents.find(e => e.event === 'error');
            expect(errorEvent).toBeUndefined();
        });
    });

    // =========================================================================
    // emitToMarketingRoom
    // =========================================================================

    describe('emitToMarketingRoom', () => {
        it('should emit event to tenant-only room', () => {
            const io = createMockIo();
            const payload = { agents: [], connections: [] };

            emitToMarketingRoom(io, 'marketing-batch-update', 1, null, payload);

            expect(io.roomEmits).toHaveLength(1);
            expect(io.roomEmits[0].room).toBe('marketing_tenant_1');
            expect(io.roomEmits[0].event).toBe('marketing-batch-update');
            expect(io.roomEmits[0].data).toEqual(payload);
        });

        it('should emit event to tenant+company room', () => {
            const io = createMockIo();
            const payload = { agentId: 'agent-1', status: 'working' };

            emitToMarketingRoom(io, 'marketing-agent-status-update', 1, 7, payload);

            expect(io.roomEmits).toHaveLength(1);
            expect(io.roomEmits[0].room).toBe('marketing_tenant_1_company_7');
            expect(io.roomEmits[0].event).toBe('marketing-agent-status-update');
            expect(io.roomEmits[0].data).toEqual(payload);
        });

        it('should handle all marketing event types', () => {
            const io = createMockIo();
            const eventTypes = [
                'marketing-batch-update',
                'marketing-agent-status-update',
                'marketing-agent-task-update',
                'marketing-action-event'
            ];

            eventTypes.forEach(eventType => {
                emitToMarketingRoom(io, eventType, 1, null, {});
            });

            expect(io.roomEmits).toHaveLength(4);
            eventTypes.forEach((eventType, index) => {
                expect(io.roomEmits[index].event).toBe(eventType);
            });
        });
    });

    // =========================================================================
    // Integration: subscribe → unsubscribe round-trip
    // =========================================================================

    describe('subscribe/unsubscribe round-trip', () => {
        it('should join and leave the same room', () => {
            const socket = createMockSocket({ tenantId: 1, companyId: 5 });
            const io = createMockIo();

            // Subscribe
            const subscribeHandler = handleSubscribeMarketing(socket, io);
            subscribeHandler({ tenantId: 1, companyId: 5 });

            expect(socket.joinedRooms.has('marketing_tenant_1_company_5')).toBe(true);

            // Unsubscribe
            const unsubscribeHandler = handleUnsubscribeMarketing(socket, io);
            unsubscribeHandler({ tenantId: 1, companyId: 5 });

            expect(socket.leftRooms.has('marketing_tenant_1_company_5')).toBe(true);
        });

        it('should handle multiple tenants subscribing to different rooms', () => {
            const socket1 = createMockSocket({ tenantId: 1, companyId: null });
            const socket2 = createMockSocket({ tenantId: 2, companyId: null });
            const io = createMockIo();

            const handler1 = handleSubscribeMarketing(socket1, io);
            handler1({ tenantId: 1 });

            const handler2 = handleSubscribeMarketing(socket2, io);
            handler2({ tenantId: 2 });

            expect(socket1.joinedRooms.has('marketing_tenant_1')).toBe(true);
            expect(socket2.joinedRooms.has('marketing_tenant_2')).toBe(true);
            expect(socket1.joinedRooms.has('marketing_tenant_2')).toBe(false);
            expect(socket2.joinedRooms.has('marketing_tenant_1')).toBe(false);
        });
    });
});
