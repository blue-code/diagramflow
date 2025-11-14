# Changelog

All notable changes to DiagramFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-01-14

### Fixed
- **Oracle DDL Import**: Fixed critical parsing bug where only the first column was imported
  - Improved handling of quoted column identifiers (e.g., "COLUMN_NAME")
  - Enhanced support for Oracle-specific data types (VARCHAR2, NUMBER, DATE)
  - Better parsing of complex storage clauses (SEGMENT CREATION, PCTFREE, etc.)
  - Proper whitespace and tab normalization in DDL text

### Added
- **Fit to Screen**: New button (⊡) to automatically zoom and pan to view all tables at once
  - Calculates optimal zoom level to fit all content
  - Centers the view for better navigation
  - Shows success notification
- **Auto Layout**: New button (⚡) to intelligently arrange tables in a grid layout
  - Grid-based algorithm for consistent spacing
  - Sorts tables alphabetically for predictable layout
  - Automatically fits to screen after layout
  - Saves to history for undo/redo support

### Improved
- DDL Import parsing now includes extensive logging for debugging
- Enhanced column definition regex to handle various quote styles
- Better error messages when DDL parsing fails

## [0.3.0] - 2025-01-11

### Added - Phase 3 Release 🚀

#### Real-time Collaboration
- WebSocket-based multi-user editing
- User presence and cursor tracking
- Table locking mechanism to prevent conflicts
- In-app chat messaging
- Live diagram updates across all connected users

#### Git Integration
- Full version control for diagrams
- Commit history tracking with metadata
- Branch management (create, switch, list)
- Version checkout and comparison
- Git status monitoring

#### Normalization Analysis
- Automatic detection of 1NF, 2NF, 3NF violations
- Intelligent pattern-based analysis
- Actionable recommendations for schema improvements
- General design issue detection
- Summary statistics and reporting

#### MySQL Workbench Compatibility
- Import .mwb files with full structure preservation
- Export diagrams to .mwb format
- Bidirectional conversion support
- Compatible with MySQL Workbench 8.0+

#### Theme Customization
- 6 beautiful pre-built themes (Light, Dark, Ocean, Forest, Sunset, Purple)
- Persistent theme selection via localStorage
- Smooth theme transitions
- Keyboard shortcut support (Alt+T)
- Theme preview in selector

### Changed
- Project renamed from "Python ERD Tool" to "DiagramFlow"
- Updated branding and visual identity
- Improved documentation with comprehensive examples
- Enhanced API with Phase 3 endpoints

## [0.2.0] - 2025-01-10

### Added - Phase 2 Release

#### Multi-Database Support
- PostgreSQL DDL generator with SERIAL types
- Oracle DDL generator with sequences and triggers
- Database-specific type mappings

#### Reverse Engineering
- MySQL schema import from existing databases
- PostgreSQL schema import with full metadata
- Automatic foreign key detection
- Column comment preservation

#### Export Features
- Excel export with multiple sheets (Overview, Tables List, Detail sheets)
- HTML export with styled, responsive design
- Comprehensive documentation generation

### Improved
- Enhanced relationship visualization
- Better error handling
- Improved API response formats

## [0.1.0] - 2025-01-09

### Added - MVP Release

#### Core Features
- Visual ERD editor with drag-and-drop
- Table and column management
- Relationship creation and editing
- MySQL DDL generation
- JSON-based storage (Git-friendly)
- RESTful API
- Web-based UI

#### Data Models
- Table model with physical/logical naming
- Column model with full constraint support
- Relationship model with cardinality
- Diagram container model

#### User Interface
- Responsive web interface
- Modal-based editing
- Sidebar with table list
- Statistics dashboard
- Context menus

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

## Future Releases

### [0.4.0] - Planned
- 🤖 AI-powered schema suggestions
- 🎯 Auto-layout algorithms
- 📱 Mobile-responsive interface improvements
- 🔄 Additional database support (SQLite, MongoDB)
- 🌍 Multi-language support (i18n)
- 🔌 Plugin system for extensions

### [1.0.0] - Planned
- Production-ready release
- Performance optimizations
- Complete test coverage
- Comprehensive documentation
- Security audit
- Enterprise features
