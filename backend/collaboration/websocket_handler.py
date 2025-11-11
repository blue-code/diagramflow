"""
WebSocket handler for real-time collaboration
"""

from flask_socketio import SocketIO, emit, join_room, leave_room
from typing import Dict
import json

# Initialize SocketIO
socketio = SocketIO(cors_allowed_origins="*")

# Active sessions: {diagram_id: {user_id: user_info}}
active_sessions: Dict[str, Dict[str, dict]] = {}

# User cursors: {diagram_id: {user_id: {x, y}}}
user_cursors: Dict[str, Dict[str, dict]] = {}


def register_socket_events():
    """Register all socket event handlers"""

    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        print(f'Client connected: {request.sid}')
        emit('connected', {'status': 'success', 'sid': request.sid})

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        print(f'Client disconnected: {request.sid}')

        # Remove user from all sessions
        for diagram_id in list(active_sessions.keys()):
            if request.sid in active_sessions[diagram_id]:
                user_info = active_sessions[diagram_id][request.sid]
                del active_sessions[diagram_id][request.sid]

                # Remove cursor
                if diagram_id in user_cursors and request.sid in user_cursors[diagram_id]:
                    del user_cursors[diagram_id][request.sid]

                # Notify others
                emit('user_left', {
                    'user_id': request.sid,
                    'user_name': user_info.get('name', 'Anonymous')
                }, room=diagram_id)

                # Clean up empty sessions
                if not active_sessions[diagram_id]:
                    del active_sessions[diagram_id]
                    if diagram_id in user_cursors:
                        del user_cursors[diagram_id]

    @socketio.on('join_diagram')
    def handle_join_diagram(data):
        """User joins a diagram session"""
        diagram_id = data.get('diagram_id')
        user_name = data.get('user_name', 'Anonymous')

        if not diagram_id:
            emit('error', {'message': 'diagram_id is required'})
            return

        # Join room
        join_room(diagram_id)

        # Initialize session if needed
        if diagram_id not in active_sessions:
            active_sessions[diagram_id] = {}
            user_cursors[diagram_id] = {}

        # Add user to session
        active_sessions[diagram_id][request.sid] = {
            'name': user_name,
            'color': data.get('color', '#4A90E2'),
            'joined_at': data.get('timestamp')
        }

        # Get list of current users
        current_users = [
            {'user_id': uid, **info}
            for uid, info in active_sessions[diagram_id].items()
        ]

        # Notify user about current state
        emit('joined_diagram', {
            'diagram_id': diagram_id,
            'current_users': current_users,
            'your_id': request.sid
        })

        # Notify others about new user
        emit('user_joined', {
            'user_id': request.sid,
            'user_name': user_name,
            'color': data.get('color', '#4A90E2')
        }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('leave_diagram')
    def handle_leave_diagram(data):
        """User leaves a diagram session"""
        diagram_id = data.get('diagram_id')

        if diagram_id and diagram_id in active_sessions:
            if request.sid in active_sessions[diagram_id]:
                user_info = active_sessions[diagram_id][request.sid]
                del active_sessions[diagram_id][request.sid]

                # Remove cursor
                if diagram_id in user_cursors and request.sid in user_cursors[diagram_id]:
                    del user_cursors[diagram_id][request.sid]

                leave_room(diagram_id)

                # Notify others
                emit('user_left', {
                    'user_id': request.sid,
                    'user_name': user_info.get('name', 'Anonymous')
                }, room=diagram_id)

    @socketio.on('table_update')
    def handle_table_update(data):
        """Broadcast table update to other users"""
        diagram_id = data.get('diagram_id')
        table_data = data.get('table')

        if diagram_id:
            emit('table_updated', {
                'user_id': request.sid,
                'table': table_data,
                'timestamp': data.get('timestamp')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('table_move')
    def handle_table_move(data):
        """Broadcast table movement to other users"""
        diagram_id = data.get('diagram_id')
        table_id = data.get('table_id')
        position = data.get('position')

        if diagram_id:
            emit('table_moved', {
                'user_id': request.sid,
                'table_id': table_id,
                'position': position
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('table_add')
    def handle_table_add(data):
        """Broadcast new table to other users"""
        diagram_id = data.get('diagram_id')
        table_data = data.get('table')

        if diagram_id:
            emit('table_added', {
                'user_id': request.sid,
                'table': table_data,
                'timestamp': data.get('timestamp')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('table_delete')
    def handle_table_delete(data):
        """Broadcast table deletion to other users"""
        diagram_id = data.get('diagram_id')
        table_id = data.get('table_id')

        if diagram_id:
            emit('table_deleted', {
                'user_id': request.sid,
                'table_id': table_id,
                'timestamp': data.get('timestamp')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('relationship_add')
    def handle_relationship_add(data):
        """Broadcast new relationship to other users"""
        diagram_id = data.get('diagram_id')
        relationship_data = data.get('relationship')

        if diagram_id:
            emit('relationship_added', {
                'user_id': request.sid,
                'relationship': relationship_data,
                'timestamp': data.get('timestamp')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('relationship_delete')
    def handle_relationship_delete(data):
        """Broadcast relationship deletion to other users"""
        diagram_id = data.get('diagram_id')
        relationship_id = data.get('relationship_id')

        if diagram_id:
            emit('relationship_deleted', {
                'user_id': request.sid,
                'relationship_id': relationship_id,
                'timestamp': data.get('timestamp')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('cursor_move')
    def handle_cursor_move(data):
        """Broadcast cursor position to other users"""
        diagram_id = data.get('diagram_id')
        position = data.get('position')

        if diagram_id and position:
            # Update cursor position
            if diagram_id not in user_cursors:
                user_cursors[diagram_id] = {}
            user_cursors[diagram_id][request.sid] = position

            # Broadcast to others
            emit('cursor_moved', {
                'user_id': request.sid,
                'position': position
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('table_lock')
    def handle_table_lock(data):
        """Lock table for editing"""
        diagram_id = data.get('diagram_id')
        table_id = data.get('table_id')

        if diagram_id:
            emit('table_locked', {
                'user_id': request.sid,
                'table_id': table_id,
                'user_name': active_sessions.get(diagram_id, {}).get(request.sid, {}).get('name', 'Anonymous')
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('table_unlock')
    def handle_table_unlock(data):
        """Unlock table"""
        diagram_id = data.get('diagram_id')
        table_id = data.get('table_id')

        if diagram_id:
            emit('table_unlocked', {
                'user_id': request.sid,
                'table_id': table_id
            }, room=diagram_id, skip_sid=request.sid)

    @socketio.on('chat_message')
    def handle_chat_message(data):
        """Handle chat messages"""
        diagram_id = data.get('diagram_id')
        message = data.get('message')

        if diagram_id and message:
            user_info = active_sessions.get(diagram_id, {}).get(request.sid, {})
            emit('chat_message', {
                'user_id': request.sid,
                'user_name': user_info.get('name', 'Anonymous'),
                'message': message,
                'timestamp': data.get('timestamp')
            }, room=diagram_id)


# Import request for socket handlers
from flask import request
