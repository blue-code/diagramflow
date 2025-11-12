/**
 * WebSocket Collaboration Client for Python ERD Tool
 *
 * Handles real-time collaboration features including:
 * - User presence
 * - Cursor tracking
 * - Table updates
 * - Chat messaging
 * - Table locking
 */

class CollaborationClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.diagramId = null;
        this.userId = null;
        this.userName = 'Anonymous';
        this.userColor = this.generateRandomColor();
        this.activeUsers = new Map();
        this.lockedTables = new Map();
        this.cursorUpdateThrottle = 100; // ms
        this.lastCursorUpdate = 0;
    }

    /**
     * Connect to WebSocket server
     */
    connect(serverUrl = null) {
        if (this.connected) {
            console.log('Already connected to collaboration server');
            return;
        }

        // Use socket.io client library
        const url = serverUrl || window.location.origin;
        this.socket = io(url, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        this.registerEventHandlers();
    }

    /**
     * Register socket event handlers
     */
    registerEventHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            this.connected = true;
            this.userId = this.socket.id;
            console.log('Connected to collaboration server:', this.userId);
            this.onConnect();
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Disconnected from collaboration server');
            this.onDisconnect();
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.onConnectionError(error);
        });

        // Diagram session events
        this.socket.on('joined_diagram', (data) => {
            console.log('Joined diagram:', data);
            this.userId = data.your_id;
            this.activeUsers.clear();
            data.current_users.forEach(user => {
                this.activeUsers.set(user.user_id, user);
            });
            this.onJoinedDiagram(data);
        });

        this.socket.on('user_joined', (data) => {
            console.log('User joined:', data);
            this.activeUsers.set(data.user_id, data);
            this.onUserJoined(data);
        });

        this.socket.on('user_left', (data) => {
            console.log('User left:', data);
            this.activeUsers.delete(data.user_id);
            this.onUserLeft(data);
        });

        // Table events
        this.socket.on('table_updated', (data) => {
            this.onTableUpdated(data);
        });

        this.socket.on('table_moved', (data) => {
            this.onTableMoved(data);
        });

        this.socket.on('table_added', (data) => {
            this.onTableAdded(data);
        });

        this.socket.on('table_deleted', (data) => {
            this.onTableDeleted(data);
        });

        // Relationship events
        this.socket.on('relationship_added', (data) => {
            this.onRelationshipAdded(data);
        });

        this.socket.on('relationship_deleted', (data) => {
            this.onRelationshipDeleted(data);
        });

        // Cursor events
        this.socket.on('cursor_moved', (data) => {
            this.onCursorMoved(data);
        });

        // Table locking events
        this.socket.on('table_locked', (data) => {
            this.lockedTables.set(data.table_id, data);
            this.onTableLocked(data);
        });

        this.socket.on('table_unlocked', (data) => {
            this.lockedTables.delete(data.table_id);
            this.onTableUnlocked(data);
        });

        // Chat events
        this.socket.on('chat_message', (data) => {
            this.onChatMessage(data);
        });

        // Diagram save events
        this.socket.on('diagram_saved', (data) => {
            this.onDiagramSaved(data);
        });

        this.socket.on('reload_diagram', (data) => {
            this.onReloadDiagram(data);
        });

        // Error events
        this.socket.on('error', (data) => {
            console.error('Server error:', data);
            this.onError(data);
        });
    }

    /**
     * Join a diagram session
     */
    joinDiagram(diagramId, userName = null) {
        if (!this.connected) {
            console.error('Not connected to collaboration server');
            return;
        }

        this.diagramId = diagramId;
        this.userName = userName || this.userName;

        this.socket.emit('join_diagram', {
            diagram_id: diagramId,
            user_name: this.userName,
            color: this.userColor,
            timestamp: Date.now()
        });
    }

    /**
     * Leave current diagram session
     */
    leaveDiagram() {
        if (!this.connected || !this.diagramId) {
            return;
        }

        this.socket.emit('leave_diagram', {
            diagram_id: this.diagramId
        });

        this.diagramId = null;
        this.activeUsers.clear();
        this.lockedTables.clear();
    }

    /**
     * Broadcast table update
     */
    updateTable(table) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_update', {
            diagram_id: this.diagramId,
            table: table,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast table movement
     */
    moveTable(tableId, position) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_move', {
            diagram_id: this.diagramId,
            table_id: tableId,
            position: position
        });
    }

    /**
     * Broadcast new table
     */
    addTable(table) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_add', {
            diagram_id: this.diagramId,
            table: table,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast table deletion
     */
    deleteTable(tableId) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_delete', {
            diagram_id: this.diagramId,
            table_id: tableId,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast new relationship
     */
    addRelationship(relationship) {
        if (!this.canBroadcast()) return;

        this.socket.emit('relationship_add', {
            diagram_id: this.diagramId,
            relationship: relationship,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast relationship deletion
     */
    deleteRelationship(relationshipId) {
        if (!this.canBroadcast()) return;

        this.socket.emit('relationship_delete', {
            diagram_id: this.diagramId,
            relationship_id: relationshipId,
            timestamp: Date.now()
        });
    }

    /**
     * Update cursor position (throttled)
     */
    updateCursor(x, y) {
        if (!this.canBroadcast()) return;

        const now = Date.now();
        if (now - this.lastCursorUpdate < this.cursorUpdateThrottle) {
            return;
        }

        this.lastCursorUpdate = now;

        this.socket.emit('cursor_move', {
            diagram_id: this.diagramId,
            position: { x, y }
        });
    }

    /**
     * Lock table for editing
     */
    lockTable(tableId) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_lock', {
            diagram_id: this.diagramId,
            table_id: tableId
        });
    }

    /**
     * Unlock table
     */
    unlockTable(tableId) {
        if (!this.canBroadcast()) return;

        this.socket.emit('table_unlock', {
            diagram_id: this.diagramId,
            table_id: tableId
        });
    }

    /**
     * Send chat message
     */
    sendChatMessage(message) {
        if (!this.canBroadcast()) return;

        this.socket.emit('chat_message', {
            diagram_id: this.diagramId,
            message: message,
            timestamp: Date.now()
        });
    }

    /**
     * Check if table is locked by another user
     */
    isTableLocked(tableId) {
        const lock = this.lockedTables.get(tableId);
        return lock && lock.user_id !== this.userId;
    }

    /**
     * Get lock info for table
     */
    getTableLock(tableId) {
        return this.lockedTables.get(tableId);
    }

    /**
     * Check if can broadcast
     */
    canBroadcast() {
        return this.connected && this.diagramId;
    }

    /**
     * Generate random color for user
     */
    generateRandomColor() {
        const colors = [
            '#4A90E2', '#E74C3C', '#27AE60', '#F39C12',
            '#9B59B6', '#1ABC9C', '#E67E22', '#3498DB'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.connected) {
            this.leaveDiagram();
            this.socket.disconnect();
        }
    }

    // ==================== Event Callbacks ====================
    // Override these methods to handle events

    onConnect() {
        console.log('Collaboration enabled');
    }

    onDisconnect() {
        console.log('Collaboration disabled');
    }

    onConnectionError(error) {
        console.error('Connection error:', error);
    }

    onJoinedDiagram(data) {
        console.log('Successfully joined diagram session');
    }

    onUserJoined(data) {
        console.log('User joined:', data.user_name);
    }

    onUserLeft(data) {
        console.log('User left:', data.user_name);
    }

    onTableUpdated(data) {
        console.log('Table updated by user:', data.user_id);
    }

    onTableMoved(data) {
        console.log('Table moved:', data.table_id);
    }

    onTableAdded(data) {
        console.log('Table added by user:', data.user_id);
    }

    onTableDeleted(data) {
        console.log('Table deleted:', data.table_id);
    }

    onRelationshipAdded(data) {
        console.log('Relationship added by user:', data.user_id);
    }

    onRelationshipDeleted(data) {
        console.log('Relationship deleted:', data.relationship_id);
    }

    onCursorMoved(data) {
        // Handle cursor movement visualization
    }

    onTableLocked(data) {
        console.log('Table locked by', data.user_name);
    }

    onTableUnlocked(data) {
        console.log('Table unlocked:', data.table_id);
    }

    onChatMessage(data) {
        console.log(`${data.user_name}: ${data.message}`);
    }

    onDiagramSaved(data) {
        console.log(`Diagram saved by user ${data.user_name} (version: ${data.version})`);
    }

    onReloadDiagram(data) {
        console.log('Reload diagram requested:', data.reason);
    }

    onError(data) {
        console.error('Collaboration error:', data);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollaborationClient;
}
