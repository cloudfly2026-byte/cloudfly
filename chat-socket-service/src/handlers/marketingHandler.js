/**
 * CLOUD-243 / CLOUD-247: Marketing Agent Socket Handlers
 *
 * Handles marketing-specific Socket.IO events for the real-time
 * Marketing Live Dashboard (CLOUD-213 / CLOUD-200).
 *
 * Events handled:
 *   Client → Server:
 *     • subscribe-marketing   — Join marketing room for tenant/company
 *     • unsubscribe-marketing — Leave marketing room
 *
 *   Server → Client (emitted by backend services, not this handler):
 *     • marketing-batch-update        — Full agent + connections snapshot
 *     • marketing-agent-status-update — Single agent status change
 *     • marketing-agent-task-update   — Single agent task change
 *     • marketing-action-event        — New timeline event
 *
 * Room naming convention:
 *   • With companyId:    marketing_tenant_{tenantId}_company_{companyId}
 *   • Without companyId: marketing_tenant_{tenantId}
 *
 * Security:
 *   • Cross-tenant subscription is rejected (tenantId must match socket.tenantId)
 *
 * @see frontend_new/src/hooks/useMarketingAgentsSocket.ts (consumer)
 * @see frontend_new/src/types/marketing/aiMarketing.ts (type definitions)
 */

const logger = require('../utils/logger');

/**
 * Handles the 'subscribe-marketing' event.
 * Joins the socket to the appropriate marketing room based on tenantId
 * and optional companyId.
 *
 * SECURITY: Validates that the tenantId in the data payload matches the
 * socket.tenantId set during authentication. This prevents cross-tenant
 * data leakage where a malicious client could subscribe to another
 * tenant's marketing data by passing a different tenantId in the payload.
 *
 * @param {object} socket - The Socket.IO socket instance
 * @param {object} io     - The Socket.IO server instance
 * @returns {function} Event handler function
 */
const handleSubscribeMarketing = (socket, io) => (data) => {
    try {
        const { tenantId: dataTenantId, companyId: dataCompanyId } = data || {};

        // SECURITY: Cross-tenant validation
        // The tenantId from the payload MUST match the socket's authenticated tenantId.
        // This prevents a malicious client from subscribing to another tenant's rooms.
        if (dataTenantId !== undefined && dataTenantId !== null) {
            if (Number(dataTenantId) !== Number(socket.tenantId)) {
                logger.warn(
                    `[MARKETING-SOCKET] Socket ${socket.id} attempted cross-tenant marketing subscription ` +
                    `(socket tenant: ${socket.tenantId}, requested: ${dataTenantId})`
                );
                socket.emit('error', { message: 'Cross-tenant subscription not allowed' });
                return;
            }
        }

        // Use the socket's authenticated tenantId (never trust the payload for tenantId)
        const tenantId = socket.tenantId;
        const companyId = dataCompanyId || socket.companyId;

        if (!tenantId) {
            logger.warn(`[MARKETING-SOCKET] Socket ${socket.id} subscribe-marketing without tenantId`);
            socket.emit('error', { message: 'tenantId is required to subscribe to marketing' });
            return;
        }

        const roomName = companyId
            ? `marketing_tenant_${tenantId}_company_${companyId}`
            : `marketing_tenant_${tenantId}`;

        socket.join(roomName);

        logger.info(`[MARKETING-SOCKET] Socket ${socket.id} (user: ${socket.userName}) subscribed to room: ${roomName}`);

        // Confirm subscription to the client
        socket.emit('subscribed-marketing', {
            room: roomName,
            tenantId,
            companyId: companyId || null
        });

    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error in subscribe-marketing: ${error.message}`);
        socket.emit('error', { message: 'Failed to subscribe to marketing room' });
    }
};

/**
 * Handles the 'unsubscribe-marketing' event.
 * Leaves the marketing room for the given tenant/company.
 *
 * SECURITY: Uses socket.tenantId as the source of truth for room name
 * construction, preventing cross-tenant room manipulation.
 *
 * @param {object} socket - The Socket.IO socket instance
 * @param {object} io     - The Socket.IO server instance
 * @returns {function} Event handler function
 */
const handleUnsubscribeMarketing = (socket, io) => (data) => {
    try {
        const { companyId: dataCompanyId } = data || {};

        // Use the socket's authenticated tenantId (never trust the payload for tenantId)
        const tenantId = socket.tenantId;
        const companyId = dataCompanyId || socket.companyId;

        if (!tenantId) {
            logger.warn(`[MARKETING-SOCKET] Socket ${socket.id} unsubscribe-marketing without tenantId`);
            return;
        }

        const roomName = companyId
            ? `marketing_tenant_${tenantId}_company_${companyId}`
            : `marketing_tenant_${tenantId}`;

        socket.leave(roomName);

        logger.info(`[MARKETING-SOCKET] Socket ${socket.id} (user: ${socket.userName}) unsubscribed from room: ${roomName}`);

        // Confirm unsubscription to the client
        socket.emit('unsubscribed-marketing', {
            room: roomName,
            tenantId,
            companyId: companyId || null
        });

    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error in unsubscribe-marketing: ${error.message}`);
    }
};

/**
 * Utility: Get the marketing room name for a given tenant/company.
 * Used by backend services to emit events to the correct room.
 *
 * @param {number} tenantId  - The tenant identifier
 * @param {number} [companyId] - Optional company identifier
 * @returns {string} The room name
 */
const getMarketingRoomName = (tenantId, companyId) => {
    return companyId
        ? `marketing_tenant_${tenantId}_company_${companyId}`
        : `marketing_tenant_${tenantId}`;
};

/**
 * Utility: Emit a marketing event to a specific room.
 * This is the server-side counterpart for the events that the
 * frontend hook (useMarketingAgentsSocket) listens for.
 *
 * @param {object} io        - The Socket.IO server instance
 * @param {string} eventName - The event name (e.g., 'marketing-batch-update')
 * @param {number} tenantId  - The tenant identifier
 * @param {number} [companyId] - Optional company identifier
 * @param {object} payload   - The event payload
 */
const emitToMarketingRoom = (io, eventName, tenantId, companyId, payload) => {
    try {
        const roomName = getMarketingRoomName(tenantId, companyId);
        io.to(roomName).emit(eventName, payload);
        logger.info(`[MARKETING-SOCKET] Emitted ${eventName} to room ${roomName}`);
    } catch (error) {
        logger.error(`[MARKETING-SOCKET] Error emitting ${eventName}: ${error.message}`);
    }
};

module.exports = {
    handleSubscribeMarketing,
    handleUnsubscribeMarketing,
    getMarketingRoomName,
    emitToMarketingRoom
};
