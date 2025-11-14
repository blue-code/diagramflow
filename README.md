# DiagramFlow 🌊

> Modern collaborative ERD tool with real-time editing, version control, and intelligent design analysis.

**DiagramFlow** is a powerful, web-based Entity-Relationship Diagram (ERD) tool inspired by ERMaster, built with Python and modern web technologies. Design database schemas collaboratively in real-time, analyze normalization, and export to multiple formats.

## ✨ Features

### Core Features (MVP + Phase 2 + Phase 3)
- 📊 **Visual ERD editing** with drag-and-drop interface
- 🗄️ **Multi-Database Support**: MySQL, PostgreSQL, Oracle DDL generation
- 💾 **JSON-based model storage** (Git-friendly)
- 🔄 **Reverse Engineering**: Import existing database schemas
- 📑 **Documentation Export**: Excel and HTML reports
- 🌐 **Web-based UI** (no installation required)
- 📝 **Logical and Physical naming** support
- 🔗 **Relationship management** with visual connections
- ✅ **Schema validation** and statistics

### Phase 2 Features ✅
- ✅ PostgreSQL DDL generator
- ✅ Oracle DDL generator
- ✅ Reverse engineering (MySQL, PostgreSQL)
- ✅ Excel export (comprehensive documentation)
- ✅ HTML export (styled documentation)
- ✅ Enhanced relationship visualization

### Phase 3 Features ✅
- ✅ **Real-time Collaboration**: Multi-user editing with WebSocket
  - User presence and cursor tracking
  - Table locking mechanism
  - Live updates and chat messaging
- ✅ **Git Integration**: Version control for diagrams
  - Commit history tracking
  - Branch management
  - Version checkout and comparison
- ✅ **Normalization Analysis**: Automatic database normalization checker
  - 1NF, 2NF, 3NF violation detection
  - Actionable recommendations
  - General design issue detection
- ✅ **MySQL Workbench Compatibility**: Import/export .mwb files
  - Full bidirectional conversion
  - Preserves table structure and relationships
- ✅ **Theme Customization**: 6 beautiful themes
  - Light, Dark, Ocean, Forest, Sunset, Purple
  - Persistent theme selection
  - Keyboard shortcuts (Alt+T)
- ✅ **Enhanced DDL Import**: Improved Oracle DDL parsing
  - Full support for VARCHAR2, NUMBER, DATE types
  - Handles COMMENT ON TABLE/COLUMN statements
  - Processes complex Oracle storage clauses
- ✅ **Diagram View Controls**: Enhanced visualization
  - **Fit to Screen**: Auto-zoom to view all tables (⊡ button)
  - **Auto Layout**: Intelligent grid-based table arrangement (⚡ button)
  - Zoom controls (+, -, ⊙)
  - Pan and zoom with mouse/trackpad

## Architecture

```
diagramflow/
├── backend/                  # Python Flask backend
│   ├── models/               # Data models (Table, Column, Relationship, Diagram)
│   ├── generators/           # DDL generators (MySQL, PostgreSQL, Oracle)
│   ├── api/                  # REST API routes (with Phase 3 endpoints)
│   ├── collaboration/        # WebSocket handlers for real-time collaboration
│   │   └── websocket_handler.py
│   └── utils/                # Utilities
│       ├── serialization.py  # JSON import/export
│       ├── reverse_engineering.py  # DB schema import
│       ├── exporters.py      # Excel/HTML exporters
│       ├── git_integration.py     # Git version control
│       ├── normalization_analyzer.py  # Database normalization checker
│       └── workbench_converter.py     # MySQL Workbench .mwb format
├── frontend/                 # Web UI
│   ├── static/
│   │   ├── css/
│   │   │   ├── style.css
│   │   │   └── themes.css    # Theme customization
│   │   └── js/
│   │       ├── collaboration.js   # WebSocket client
│   │       ├── theme-manager.js   # Theme switching
│   │       └── diagram.js
│   └── templates/
│       └── index.html
├── models_storage/           # Saved diagrams (JSON)
├── config.py                 # Configuration
├── requirements.txt          # Python dependencies
├── run.sh                    # Quick start script
├── LICENSE                   # MIT License
├── CONTRIBUTING.md           # Contribution guidelines
└── CHANGELOG.md              # Version history
```

## Installation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/diagramflow.git
cd diagramflow

# Run the application
./run.sh
```

The script will:
- Create a virtual environment
- Install dependencies
- Start the server at http://localhost:5000

### Manual Installation

1. Create virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python backend/app.py
```

4. Open browser at `http://localhost:5000`

## Usage Guide

### Creating ERD from Scratch

1. **Create Tables**: Click "Add Table" button
2. **Edit Table**: Double-click a table to edit:
   - Physical name (database name)
   - Logical name (human-readable name)
   - Columns with types, constraints
3. **Add Columns**: In table editor, click "Add Column"
   - Set data type, length, nullable, PK, etc.
4. **Create Relationships**: (Visual drag connections in UI)
5. **Save Diagram**: Click "Save" button

### Importing from DDL

1. **Click "DDL Import" button** in the sidebar
2. **Paste your DDL statements**:
   - Supports MySQL, PostgreSQL, and Oracle DDL
   - Can include multiple CREATE TABLE statements
   - COMMENT ON TABLE/COLUMN statements are automatically parsed
3. **Click "Import"** to add tables to diagram
4. **Use View Controls** to organize:
   - Click **⚡ (Auto Layout)** to automatically arrange tables in a grid
   - Click **⊡ (Fit to Screen)** to zoom and pan to view all tables

Example Oracle DDL:
```sql
CREATE TABLE "USERS" 
   ("USER_ID" VARCHAR2(20), 
    "USER_NAME" VARCHAR2(50), 
    "EMAIL" VARCHAR2(100), 
    "REG_DATE" DATE);

COMMENT ON TABLE USERS IS '사용자 정보';
COMMENT ON COLUMN USERS.USER_ID IS '사용자ID';
COMMENT ON COLUMN USERS.USER_NAME IS '사용자명';
```

### Importing from Existing Database

Use the API endpoint:
```bash
POST /api/import/database

{
  "db_type": "mysql",
  "connection": {
    "host": "localhost",
    "port": 3306,
    "user": "username",
    "password": "password",
    "database": "mydb"
  },
  "schema": "mydb"
}
```

Supported databases: MySQL, PostgreSQL

### Exporting

#### Generate DDL
```bash
GET /api/diagrams/{id}/export/ddl?db_type=mysql
```

Supported: `mysql`, `postgresql`, `oracle`

#### Export Documentation
- **Excel**: `GET /api/diagrams/{id}/export/excel`
- **HTML**: `GET /api/diagrams/{id}/export/html`

## API Endpoints

### Diagram Management
- `GET /api/diagrams` - List all diagrams
- `POST /api/diagrams` - Create new diagram
- `GET /api/diagrams/{id}` - Get diagram
- `PUT /api/diagrams/{id}` - Update diagram
- `DELETE /api/diagrams/{id}` - Delete diagram

### Table Management
- `POST /api/diagrams/{id}/tables` - Add table
- `PUT /api/diagrams/{id}/tables/{tid}` - Update table
- `DELETE /api/diagrams/{id}/tables/{tid}` - Delete table

### Relationship Management
- `POST /api/diagrams/{id}/relationships` - Add relationship
- `DELETE /api/diagrams/{id}/relationships/{rid}` - Delete relationship

### Export & Import
- `POST /api/import/database` - Import from database (Reverse Engineering)
- `POST /api/import/mwb` - Import from MySQL Workbench .mwb file
- `GET /api/diagrams/{id}/export/ddl` - Export as DDL
- `GET /api/diagrams/{id}/export/excel` - Export as Excel
- `GET /api/diagrams/{id}/export/html` - Export as HTML
- `GET /api/diagrams/{id}/export/mwb` - Export as MySQL Workbench .mwb file

### Validation & Statistics
- `GET /api/diagrams/{id}/validate` - Validate diagram
- `GET /api/diagrams/{id}/statistics` - Get statistics

### Phase 3: Normalization Analysis
- `GET /api/diagrams/{id}/analyze/normalization` - Analyze normalization issues

### Phase 3: Git Integration
- `POST /api/diagrams/{id}/git/init` - Initialize Git repository
- `POST /api/diagrams/{id}/git/commit` - Commit diagram changes
- `GET /api/diagrams/{id}/git/history` - Get commit history
- `POST /api/diagrams/{id}/git/checkout` - Checkout specific version
- `GET /api/diagrams/{id}/git/branches` - List branches
- `POST /api/diagrams/{id}/git/branches` - Create new branch
- `GET /api/diagrams/{id}/git/status` - Get repository status

### Phase 3: WebSocket Events (Real-time Collaboration)
- `connect` / `disconnect` - Connection management
- `join_diagram` / `leave_diagram` - Session management
- `table_update` / `table_move` / `table_add` / `table_delete` - Table operations
- `relationship_add` / `relationship_delete` - Relationship operations
- `cursor_move` - Cursor tracking
- `table_lock` / `table_unlock` - Collaborative editing
- `chat_message` - Team communication

## Development Roadmap

### ✅ Phase 1: MVP (Completed)
- [x] Basic data models (Table, Column, Relationship)
- [x] JSON serialization
- [x] MySQL DDL generation
- [x] Basic web UI
- [x] Simple diagram editing

### ✅ Phase 2 (Completed)
- [x] PostgreSQL DDL generator
- [x] Oracle DDL generator
- [x] Reverse engineering (MySQL, PostgreSQL)
- [x] Excel export with comprehensive documentation
- [x] HTML export with styled templates
- [x] Enhanced relationship visualization
- [x] Category management (backend ready)

### ✅ Phase 3 (Completed)
- [x] Real-time collaboration with WebSocket
- [x] Git integration for version control
- [x] Automatic normalization analysis
- [x] MySQL Workbench .mwb format support
- [x] Theme customization
- [ ] Auto-layout algorithms (Future)
- [ ] Advanced validation rules (Future)

## Technology Stack

- **Backend**: Python 3.11+, Flask, Pydantic
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Real-time**: Flask-SocketIO, Socket.IO Client
- **Storage**: JSON files (Git-friendly)
- **Version Control**: GitPython
- **Database Connectors**:
  - PyMySQL (MySQL)
  - psycopg2 (PostgreSQL)
  - cx_Oracle (Oracle) - optional
- **Export Libraries**:
  - openpyxl (Excel generation)
  - Jinja2 (HTML templating)

## Configuration

Edit `config.py` to customize:

```python
# Application settings
APP_NAME = "DiagramFlow"
VERSION = "0.3.0"
DESCRIPTION = "Modern collaborative ERD tool with real-time editing"

# Server settings
HOST = "0.0.0.0"
PORT = 5000
DEBUG = True

# Database type mappings
SUPPORTED_DATABASES = {
    'mysql': 'MySQL 8.0',
    'postgresql': 'PostgreSQL 15',
    'oracle': 'Oracle 19c',
}
```

## Examples

### Example 1: Create Simple E-commerce ERD

```python
from backend.models import Diagram, Table, Column

# Create a diagram with DiagramFlow
diagram = Diagram(name="E-commerce", database_type="mysql")

users = Table(
    physical_name="users",
    logical_name="사용자",
    columns=[
        Column(physical_name="id", data_type="integer", primary_key=True, auto_increment=True),
        Column(physical_name="email", data_type="string", length=100, nullable=False),
        Column(physical_name="name", data_type="string", length=50),
    ]
)

diagram.add_table(users)
```

### Example 2: Import from MySQL

```bash
curl -X POST http://localhost:5000/api/import/database \
  -H "Content-Type: application/json" \
  -d '{
    "db_type": "mysql",
    "connection": {
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "myapp"
    },
    "schema": "myapp"
  }'
```

### Example 3: Analyze Normalization (Phase 3)

```bash
curl http://localhost:5000/api/diagrams/{diagram_id}/analyze/normalization
```

Response:
```json
{
  "success": true,
  "issues": [
    {
      "level": "1NF",
      "table_name": "users",
      "issue_type": "repeating_groups",
      "description": "Repeating group detected: phone1, phone2, phone3",
      "suggestion": "Consider creating a separate table for phone with a foreign key back to users"
    }
  ],
  "summary": {
    "total_issues": 5,
    "by_level": {"1NF": 2, "3NF": 3},
    "tables_with_issues": 3
  },
  "recommendations": [
    "• Review repeating groups and non-atomic values",
    "• Look for transitive dependencies between columns"
  ]
}
```

### Example 4: Git Integration (Phase 3)

```bash
# Initialize Git repository
curl -X POST http://localhost:5000/api/diagrams/{id}/git/init \
  -H "Content-Type: application/json" \
  -d '{"repo_path": "/path/to/models"}'

# Commit changes
curl -X POST http://localhost:5000/api/diagrams/{id}/git/commit \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Add customer table",
    "author_name": "John Doe",
    "author_email": "john@example.com"
  }'

# View commit history
curl http://localhost:5000/api/diagrams/{id}/git/history?max_count=10
```

### Example 5: Real-time Collaboration (Phase 3)

```javascript
// In frontend JavaScript
const collaboration = new CollaborationClient();

// Connect to server
collaboration.connect();

// Join diagram session
collaboration.joinDiagram('diagram-123', 'John Doe');

// Listen for events
collaboration.onUserJoined = (data) => {
  console.log(`${data.user_name} joined the session`);
};

collaboration.onTableUpdated = (data) => {
  // Update UI with remote changes
  updateTableInUI(data.table);
};

// Broadcast changes
collaboration.addTable(newTable);
collaboration.updateTable(updatedTable);
```

### Example 6: Theme Switching (Phase 3)

```javascript
// In frontend JavaScript
// Theme manager is automatically initialized

// Switch theme programmatically
themeManager.switchTheme('dark');

// Get current theme
const currentTheme = themeManager.getCurrentTheme();

// Listen for theme changes
themeManager.onThemeChange((data) => {
  console.log('Theme changed to:', data.theme);
});

// Or use keyboard shortcut: Alt+T
```

### Example 7: MySQL Workbench Import/Export (Phase 3)

```bash
# Export to .mwb format
curl http://localhost:5000/api/diagrams/{id}/export/mwb \
  --output my-diagram.mwb

# Import from .mwb file
curl -X POST http://localhost:5000/api/import/mwb \
  -F "file=@my-diagram.mwb"
```

## Troubleshooting

### Database Connection Issues

**MySQL**:
```bash
pip install pymysql
```

**PostgreSQL**:
```bash
pip install psycopg2-binary
```

### Port Already in Use

Change port in `config.py`:
```python
PORT = 5001  # or any available port
```

## License

MIT License

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Credits

Inspired by ERMaster Eclipse plugin. Built with modern Python stack for enhanced functionality and ease of use.

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/diagramflow/issues)
- Documentation: See `/docs` folder (coming soon)
- Website: diagramflow.dev (coming soon)

## Roadmap

### Future Enhancements
- 🤖 AI-powered schema suggestions
- 📊 Advanced analytics and reporting
- 🔌 Plugin system for extensions
- 🌍 Multi-language support
- 📱 Mobile-friendly interface
- 🎯 Auto-layout algorithms
- 🔄 More database platform support (SQLite, MongoDB, etc.)

---

<div align="center">

**DiagramFlow** v0.3.0

*Design. Collaborate. Deploy.*

[![Made with Python](https://img.shields.io/badge/Made%20with-Python-blue?style=flat-square&logo=python)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green?style=flat-square&logo=flask)](https://flask.palletsprojects.com/)
[![WebSocket](https://img.shields.io/badge/Real--time-WebSocket-orange?style=flat-square)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Status**: Production Ready ✅ | **Features**: Collaboration • Version Control • Smart Analysis

</div>
