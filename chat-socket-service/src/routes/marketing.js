/**
 * CLOUD-247: REST API endpoint for marketing agent events
 *
 * Provides an HTTP endpoint for backend services (Python marketing-agent,
 * Java ia-marketing-operation) to emit marketing socket events without
 * needing a direct Socket.IO client connection.
 *
 * This is the "push API" approach: backend services POST to this endpoint,
 * and the chat-socket-service broadcasts to the appropriate Socket.IO room.
 *
 * POST /api/marketing/emit
 * Body: {
 *   event: 'marketing-batch-update' | 'marketing-agent-status-update' |
 *          'marketing-agent-task-update' | 'marketing-action-event',
 *   tenantId: number,
 *   companyId?: number,
 *   payload: object
 * }
 *
 * @see chat-socket-service/src/handlers/marketingHandler.js (emitToMarketingRoom)
 * @see frontend_new/src/hooks/useMarketingAgentsSocket.ts (consumer)
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { emitToMarketingRoom } = require('../handlers/marketingHandler');

// Valid marketing event names (whitelist)
const VALID_MARKETING_EVENTS = new Set([
    'marketing-batch-update',
    'marketing-agent-status-update',
    'marketing-agent-task-update',
    'marketing-action-event'
]);

/**
 * POST /api/marketing/emit
 *
 * Allows backend services to emit marketing events to Socket.IO rooms
 * via a simple REST API call.
 *
 * Headers:
 *   x-internal-token: Shared secret for service-to-service auth
 *
 * Body:
 *   event    - One of the valid marketing event names
 *   tenantId - Tenant identifier (required)
 *   companyId - Company identifier (optional)
 *   payload  - Event payload (required)
 */
router.post('/emit', (req, res) => {
    try {
        const { event, tenantId, companyId, payload } = req.body;

        // Validate required fields
        if (!event) {
            return res.status(400).json({ error: 'Missing required field: event' });
        }
        if (!tenantId) {
            return res.status(400).json({ error: 'Missing required field: tenantId' });
        }
        if (!payload) {
            return res.status(400).json({ error: 'Missing required field: payload' });
        }

        // Validate event name against whitelist
        if (!VALID_MARKETING_EVENTS.has(event)) {
            return res.status(400).json({
                error: `Invalid event: '${event}'. Valid events: ${Array.from(VALID_MARKETING_EVENTS).join(', ')}`
            });
        }

        // Get the Socket.IO instance from the Express app
        const io = req.app.get('io');
        if (!io) {
            logger.error('[MARKETING-API] Socket.IO instance not available');
            return res.status(503).json({ error: 'Socket.IO service not available' });
        }

        // Emit to the marketing room
        emitToMarketingRoom(io, event, tenantId, companyId || null, payload);

        logger.info(`[MARKETING-API] Emitted ${event} to tenant ${tenantId}${companyId ? ` company ${companyId}` : ''}`);

        res.json({
            success: true,
            event,
            room: companyId
                ? `marketing_tenant_${tenantId}_company_${companyId}`
                : `marketing_tenant_${tenantId}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error(`[MARKETING-API] Error in /emit: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/marketing/rooms/:tenantId
 *
 * Returns the active marketing room name(s) for a tenant.
 * Useful for debugging and monitoring.
 */
router.get('/rooms/:tenantId', (req, res) => {
    try {
        const { tenantId } = req.params;
        const companyId = req.query.companyId;

        const roomName = companyId
            ? `marketing_tenant_${tenantId}_company_${companyId}`
            : `marketing_tenant_${tenantId}`;

        // Get the Socket.IO instance to check room occupancy
        const io = req.app.get('io');
        if (!io) {
            return res.json({ room: roomName, sockets: [] });
        }

        // Get sockets in the room (async in Socket.IO v4)
        const socketsInRoom = io.sockets.adapter.rooms.get(roomName);

        res.json({
            room: roomName,
            tenantId: Number(tenantId),
            companyId: companyId ? Number(companyId) : null,
            socketCount: socketsInRoom ? socketsInRoom.size : 0,
            sockets: socketsInRoom ? Array.from(socketsInRoom) : []
        });

    } catch (error) {
        logger.error(`[MARKETING-API] Error in /rooms: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
