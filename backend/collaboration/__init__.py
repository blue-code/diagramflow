"""
Real-time collaboration module using WebSocket
"""

from .websocket_handler import socketio, register_socket_events

__all__ = ['socketio', 'register_socket_events']
