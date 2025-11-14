"""
Configuration file for Python ERD Tool
"""

import os

# Application settings
APP_NAME = "DiagramFlow"
VERSION = "0.3.1"
DESCRIPTION = "Modern collaborative ERD tool with real-time editing"

# Flask settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
HOST = os.environ.get('HOST', '0.0.0.0')
PORT = int(os.environ.get('PORT', 5000))

# CORS settings
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

# File storage
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models_storage')
os.makedirs(MODELS_DIR, exist_ok=True)

# Supported database types
SUPPORTED_DATABASES = {
    'mysql': 'MySQL 8.0',
    'postgresql': 'PostgreSQL 15',
    'oracle': 'Oracle 19c',
    'sqlite': 'SQLite 3',
}

# Default database type
DEFAULT_DATABASE = 'mysql'

# Data type mappings (abstract to DB-specific)
DATA_TYPE_MAPPINGS = {
    'mysql': {
        'string': 'VARCHAR',
        'text': 'TEXT',
        'integer': 'INT',
        'bigint': 'BIGINT',
        'decimal': 'DECIMAL',
        'boolean': 'TINYINT(1)',
        'date': 'DATE',
        'datetime': 'DATETIME',
        'timestamp': 'TIMESTAMP',
        'json': 'JSON',
    },
    'postgresql': {
        'string': 'VARCHAR',
        'text': 'TEXT',
        'integer': 'INTEGER',
        'bigint': 'BIGINT',
        'decimal': 'NUMERIC',
        'boolean': 'BOOLEAN',
        'date': 'DATE',
        'datetime': 'TIMESTAMP',
        'timestamp': 'TIMESTAMP',
        'json': 'JSONB',
    },
}
