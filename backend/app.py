"""
Main Flask application for Python ERD Tool
"""

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.api.routes import create_api_blueprint
from backend.collaboration.websocket_handler import socketio, register_socket_events
import config


def create_app():
    """
    Create and configure the Flask application.

    Returns:
        Configured Flask app instance
    """
    app = Flask(
        __name__,
        template_folder='../frontend/templates',
        static_folder='../frontend/static'
    )

    # Configuration
    app.config['SECRET_KEY'] = config.SECRET_KEY
    app.config['DEBUG'] = config.DEBUG
    app.config['JSON_AS_ASCII'] = False  # Support non-ASCII characters (Korean, etc.)
    app.config['JSON_SORT_KEYS'] = False  # Preserve JSON key order

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})

    # Initialize SocketIO
    socketio.init_app(app, cors_allowed_origins=config.CORS_ORIGINS)

    # Register socket event handlers
    register_socket_events()

    # Register API blueprint
    api_blueprint = create_api_blueprint()
    app.register_blueprint(api_blueprint)

    # ==================== Frontend Routes ====================

    @app.route('/')
    def index():
        """Serve the main application page"""
        return render_template('index.html')

    @app.route('/static/<path:path>')
    def send_static(path):
        """Serve static files"""
        return send_from_directory(app.static_folder, path)

    # ==================== Error Handlers ====================

    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors"""
        return {"success": False, "error": "Resource not found"}, 404

    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors"""
        return {"success": False, "error": "Internal server error"}, 500

    return app


def main():
    """Main entry point"""
    app = create_app()

    print("=" * 60)
    print(f"  {config.APP_NAME} v{config.VERSION}")
    print("=" * 60)
    print(f"  Starting server at http://{config.HOST}:{config.PORT}")
    print(f"  Debug mode: {config.DEBUG}")
    print(f"  Models directory: {config.MODELS_DIR}")
    print(f"  WebSocket support: Enabled")
    print("=" * 60)

    # Use socketio.run() instead of app.run() for WebSocket support
    socketio.run(
        app,
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG,
        allow_unsafe_werkzeug=True  # Allow in development mode
    )


if __name__ == '__main__':
    main()
