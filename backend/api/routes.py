"""
REST API routes for Python ERD Tool
"""

from flask import Blueprint, request, jsonify, send_file
from ..models import Diagram, Table, Column, Relationship
from ..utils.serialization import save_diagram, load_diagram, export_to_json, import_from_json, list_diagrams
from ..generators import MySQLDDLGenerator, PostgreSQLDDLGenerator, OracleDDLGenerator
from ..utils.reverse_engineering import create_reverse_engineer
from ..utils.exporters import ExcelExporter, HTMLExporter
from ..utils.git_integration import GitIntegration
from ..utils.normalization_analyzer import NormalizationAnalyzer
from ..utils.workbench_converter import WorkbenchConverter
from config import MODELS_DIR
import os
import tempfile


def create_api_blueprint():
    """Create and configure the API blueprint"""
    api = Blueprint('api', __name__, url_prefix='/api')

    # ==================== Diagram Endpoints ====================

    @api.route('/diagrams', methods=['GET'])
    def get_diagrams():
        """List all saved diagrams"""
        try:
            diagrams = list_diagrams(MODELS_DIR)
            return jsonify({"success": True, "diagrams": diagrams})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams', methods=['POST'])
    def create_diagram():
        """Create a new diagram"""
        try:
            data = request.get_json()
            diagram = Diagram(**data) if data else Diagram()

            # Save to file
            file_path = os.path.join(MODELS_DIR, f"{diagram.id}.json")
            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "diagram": diagram.model_dump(mode='json'),
                "message": "Diagram created successfully"
            }), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    @api.route('/diagrams/<diagram_id>', methods=['GET'])
    def get_diagram(diagram_id):
        """Get a specific diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)
            return jsonify({
                "success": True,
                "diagram": diagram.model_dump(mode='json')
            })
        except FileNotFoundError:
            return jsonify({"success": False, "error": "Diagram not found"}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>', methods=['PUT'])
    def update_diagram(diagram_id):
        """Update a diagram"""
        try:
            data = request.get_json()
            diagram = Diagram(**data)

            # Save to file
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "diagram": diagram.model_dump(mode='json'),
                "message": "Diagram updated successfully"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    @api.route('/diagrams/<diagram_id>', methods=['DELETE'])
    def delete_diagram(diagram_id):
        """Delete a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            if os.path.exists(file_path):
                os.remove(file_path)
                return jsonify({
                    "success": True,
                    "message": "Diagram deleted successfully"
                })
            else:
                return jsonify({"success": False, "error": "Diagram not found"}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Table Endpoints ====================

    @api.route('/diagrams/<diagram_id>/tables', methods=['POST'])
    def add_table(diagram_id):
        """Add a table to a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            data = request.get_json()
            table = Table(**data)
            diagram.add_table(table)

            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "table": table.model_dump(mode='json'),
                "message": "Table added successfully"
            }), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    @api.route('/diagrams/<diagram_id>/tables/<table_id>', methods=['PUT'])
    def update_table(diagram_id, table_id):
        """Update a table in a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            # Find and update table
            table = diagram.get_table(table_id)
            if not table:
                return jsonify({"success": False, "error": "Table not found"}), 404

            data = request.get_json()
            updated_table = Table(**data)

            # Replace table
            diagram.tables = [t if t.id != table_id else updated_table for t in diagram.tables]
            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "table": updated_table.model_dump(mode='json'),
                "message": "Table updated successfully"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    @api.route('/diagrams/<diagram_id>/tables/<table_id>', methods=['DELETE'])
    def delete_table(diagram_id, table_id):
        """Delete a table from a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            if diagram.remove_table(table_id):
                save_diagram(diagram, file_path)
                return jsonify({
                    "success": True,
                    "message": "Table deleted successfully"
                })
            else:
                return jsonify({"success": False, "error": "Table not found"}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Relationship Endpoints ====================

    @api.route('/diagrams/<diagram_id>/relationships', methods=['POST'])
    def add_relationship(diagram_id):
        """Add a relationship to a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            data = request.get_json()
            relationship = Relationship(**data)
            diagram.add_relationship(relationship)

            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "relationship": relationship.model_dump(mode='json'),
                "message": "Relationship added successfully"
            }), 201
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 400

    @api.route('/diagrams/<diagram_id>/relationships/<relationship_id>', methods=['DELETE'])
    def delete_relationship(diagram_id, relationship_id):
        """Delete a relationship from a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            if diagram.remove_relationship(relationship_id):
                save_diagram(diagram, file_path)
                return jsonify({
                    "success": True,
                    "message": "Relationship deleted successfully"
                })
            else:
                return jsonify({"success": False, "error": "Relationship not found"}), 404
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== DDL Generation Endpoints ====================

    @api.route('/diagrams/<diagram_id>/export/ddl', methods=['GET'])
    def export_ddl(diagram_id):
        """Export diagram as DDL"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            # Get database type from query param or use diagram's default
            db_type = request.args.get('db_type', diagram.database_type)

            # Select appropriate generator
            generators = {
                'mysql': MySQLDDLGenerator,
                'postgresql': PostgreSQLDDLGenerator,
                'oracle': OracleDDLGenerator
            }

            generator_class = generators.get(db_type)
            if not generator_class:
                return jsonify({
                    "success": False,
                    "error": f"Database type '{db_type}' not supported. Supported types: {', '.join(generators.keys())}"
                }), 400

            generator = generator_class(diagram)
            ddl = generator.generate()

            return jsonify({
                "success": True,
                "ddl": ddl,
                "database_type": db_type
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Validation Endpoints ====================

    @api.route('/diagrams/<diagram_id>/validate', methods=['GET'])
    def validate_diagram(diagram_id):
        """Validate a diagram"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            issues = diagram.validate()

            return jsonify({
                "success": True,
                "valid": len(issues) == 0,
                "issues": issues,
                "issue_count": len(issues)
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Statistics Endpoints ====================

    @api.route('/diagrams/<diagram_id>/statistics', methods=['GET'])
    def get_statistics(diagram_id):
        """Get diagram statistics"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            stats = diagram.get_statistics()

            return jsonify({
                "success": True,
                "statistics": stats
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Reverse Engineering Endpoints ====================

    @api.route('/import/database', methods=['POST'])
    def import_from_database():
        """Import schema from database (Reverse Engineering)"""
        try:
            data = request.get_json()

            db_type = data.get('db_type', 'mysql')
            connection_params = data.get('connection')
            schema_name = data.get('schema')

            if not connection_params:
                return jsonify({
                    "success": False,
                    "error": "Connection parameters required"
                }), 400

            # Create reverse engineer and import
            engineer = create_reverse_engineer(db_type, connection_params)
            diagram = engineer.import_schema(schema_name)

            # Save diagram
            file_path = os.path.join(MODELS_DIR, f"{diagram.id}.json")
            save_diagram(diagram, file_path)

            return jsonify({
                "success": True,
                "diagram": diagram.model_dump(mode='json'),
                "message": f"Successfully imported {len(diagram.tables)} tables from database"
            })

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Export Endpoints ====================

    @api.route('/diagrams/<diagram_id>/export/excel', methods=['GET'])
    def export_excel(diagram_id):
        """Export diagram to Excel"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                exporter = ExcelExporter(diagram)
                exporter.export(tmp.name)

                return send_file(
                    tmp.name,
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    as_attachment=True,
                    download_name=f"{diagram.name}.xlsx"
                )

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/export/html', methods=['GET'])
    def export_html(diagram_id):
        """Export diagram to HTML"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.html', mode='w', encoding='utf-8') as tmp:
                exporter = HTMLExporter(diagram)
                exporter.export(tmp.name)

                return send_file(
                    tmp.name,
                    mimetype='text/html',
                    as_attachment=True,
                    download_name=f"{diagram.name}.html"
                )

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Normalization Analysis Endpoints ====================

    @api.route('/diagrams/<diagram_id>/analyze/normalization', methods=['GET'])
    def analyze_normalization(diagram_id):
        """Analyze diagram for normalization issues"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            analyzer = NormalizationAnalyzer(diagram)
            issues = analyzer.analyze()
            summary = analyzer.get_summary()
            recommendations = analyzer.get_recommendations()

            return jsonify({
                "success": True,
                "issues": issues,
                "summary": summary,
                "recommendations": recommendations
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Workbench Import/Export Endpoints ====================

    @api.route('/diagrams/<diagram_id>/export/mwb', methods=['GET'])
    def export_workbench(diagram_id):
        """Export diagram to MySQL Workbench .mwb format"""
        try:
            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")
            diagram = load_diagram(file_path)

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mwb') as tmp:
                success = WorkbenchConverter.export_to_mwb(diagram, tmp.name)

                if success:
                    return send_file(
                        tmp.name,
                        mimetype='application/zip',
                        as_attachment=True,
                        download_name=f"{diagram.name}.mwb"
                    )
                else:
                    return jsonify({
                        "success": False,
                        "error": "Failed to export to .mwb format"
                    }), 500

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/import/mwb', methods=['POST'])
    def import_workbench():
        """Import diagram from MySQL Workbench .mwb file"""
        try:
            if 'file' not in request.files:
                return jsonify({
                    "success": False,
                    "error": "No file provided"
                }), 400

            file = request.files['file']
            if file.filename == '':
                return jsonify({
                    "success": False,
                    "error": "No file selected"
                }), 400

            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mwb') as tmp:
                file.save(tmp.name)

                # Import from .mwb
                diagram = WorkbenchConverter.import_from_mwb(tmp.name)

                if diagram:
                    # Save diagram
                    file_path = os.path.join(MODELS_DIR, f"{diagram.id}.json")
                    save_diagram(diagram, file_path)

                    return jsonify({
                        "success": True,
                        "diagram": diagram.model_dump(mode='json'),
                        "message": f"Successfully imported {len(diagram.tables)} tables from .mwb file"
                    })
                else:
                    return jsonify({
                        "success": False,
                        "error": "Failed to import .mwb file"
                    }), 500

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Git Integration Endpoints ====================

    @api.route('/diagrams/<diagram_id>/git/init', methods=['POST'])
    def git_init(diagram_id):
        """Initialize Git repository for diagram"""
        try:
            repo_path = request.get_json().get('repo_path', MODELS_DIR)

            git = GitIntegration(repo_path)
            success = git.init_repository()

            return jsonify({
                "success": success,
                "message": "Git repository initialized" if success else "Failed to initialize repository"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/commit', methods=['POST'])
    def git_commit(diagram_id):
        """Commit diagram changes to Git"""
        try:
            data = request.get_json()
            message = data.get('message', 'Update diagram')
            author_name = data.get('author_name', 'ERD User')
            author_email = data.get('author_email', 'user@example.com')
            repo_path = data.get('repo_path', MODELS_DIR)

            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")

            git = GitIntegration(repo_path)
            commit_hash = git.commit_diagram(file_path, message, author_name, author_email)

            if commit_hash:
                return jsonify({
                    "success": True,
                    "commit_hash": commit_hash,
                    "message": "Changes committed successfully"
                })
            else:
                return jsonify({
                    "success": False,
                    "error": "Failed to commit changes"
                }), 500

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/history', methods=['GET'])
    def git_history(diagram_id):
        """Get commit history for diagram"""
        try:
            repo_path = request.args.get('repo_path', MODELS_DIR)
            max_count = int(request.args.get('max_count', 50))

            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")

            git = GitIntegration(repo_path)
            history = git.get_commit_history(file_path, max_count)

            return jsonify({
                "success": True,
                "history": history,
                "count": len(history)
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/checkout', methods=['POST'])
    def git_checkout(diagram_id):
        """Checkout a specific version of diagram"""
        try:
            data = request.get_json()
            commit_hash = data.get('commit_hash')
            repo_path = data.get('repo_path', MODELS_DIR)

            if not commit_hash:
                return jsonify({
                    "success": False,
                    "error": "commit_hash is required"
                }), 400

            file_path = os.path.join(MODELS_DIR, f"{diagram_id}.json")

            # Create temporary output file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
                git = GitIntegration(repo_path)
                success = git.checkout_version(file_path, commit_hash, tmp.name)

                if success:
                    # Load the checked out diagram
                    diagram = load_diagram(tmp.name)
                    return jsonify({
                        "success": True,
                        "diagram": diagram.model_dump(mode='json'),
                        "message": f"Checked out version {commit_hash[:7]}"
                    })
                else:
                    return jsonify({
                        "success": False,
                        "error": "Failed to checkout version"
                    }), 500

        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/branches', methods=['GET'])
    def git_list_branches(diagram_id):
        """List all Git branches"""
        try:
            repo_path = request.args.get('repo_path', MODELS_DIR)

            git = GitIntegration(repo_path)
            branches = git.list_branches()
            current_branch = git.get_current_branch()

            return jsonify({
                "success": True,
                "branches": branches,
                "current_branch": current_branch
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/branches', methods=['POST'])
    def git_create_branch(diagram_id):
        """Create a new Git branch"""
        try:
            data = request.get_json()
            branch_name = data.get('branch_name')
            repo_path = data.get('repo_path', MODELS_DIR)

            if not branch_name:
                return jsonify({
                    "success": False,
                    "error": "branch_name is required"
                }), 400

            git = GitIntegration(repo_path)
            success = git.create_branch(branch_name)

            return jsonify({
                "success": success,
                "message": f"Branch '{branch_name}' created" if success else "Failed to create branch"
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @api.route('/diagrams/<diagram_id>/git/status', methods=['GET'])
    def git_status(diagram_id):
        """Get Git repository status"""
        try:
            repo_path = request.args.get('repo_path', MODELS_DIR)

            git = GitIntegration(repo_path)
            status = git.get_status()

            return jsonify({
                "success": True,
                "status": status
            })
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    # ==================== Health Check ====================

    @api.route('/health', methods=['GET'])
    def health_check():
        """API health check"""
        return jsonify({
            "success": True,
            "status": "healthy",
            "version": "0.3.0-Phase3"
        })

    return api
