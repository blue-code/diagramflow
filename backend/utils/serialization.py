"""
Serialization utilities for saving and loading diagrams
"""

import json
import os
from pathlib import Path
from typing import Optional
from datetime import datetime
from ..models.diagram import Diagram


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for datetime objects"""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def save_diagram(diagram: Diagram, file_path: str) -> None:
    """
    Save a diagram to a JSON file.

    Args:
        diagram: Diagram object to save
        file_path: Path to save the file

    Raises:
        IOError: If file cannot be written
    """
    # Ensure directory exists
    directory = os.path.dirname(file_path)
    if directory:
        os.makedirs(directory, exist_ok=True)

    # Update timestamp
    diagram.updated_at = datetime.now()

    # Convert to JSON using Pydantic's model_dump
    diagram_dict = diagram.model_dump(mode='json')

    # Write to file with pretty formatting
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(diagram_dict, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)


def load_diagram(file_path: str) -> Diagram:
    """
    Load a diagram from a JSON file.

    Args:
        file_path: Path to the JSON file

    Returns:
        Diagram object

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If file is not valid JSON
        ValueError: If JSON doesn't match Diagram schema
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Diagram file not found: {file_path}")

    with open(file_path, 'r', encoding='utf-8') as f:
        diagram_dict = json.load(f)

    # Convert to Diagram using Pydantic validation
    return Diagram(**diagram_dict)


def export_to_json(diagram: Diagram) -> str:
    """
    Export a diagram to JSON string.

    Args:
        diagram: Diagram object to export

    Returns:
        JSON string representation
    """
    diagram_dict = diagram.model_dump(mode='json')
    return json.dumps(diagram_dict, indent=2, ensure_ascii=False, cls=DateTimeEncoder)


def import_from_json(json_string: str) -> Diagram:
    """
    Import a diagram from JSON string.

    Args:
        json_string: JSON string to parse

    Returns:
        Diagram object

    Raises:
        json.JSONDecodeError: If string is not valid JSON
        ValueError: If JSON doesn't match Diagram schema
    """
    diagram_dict = json.loads(json_string)
    return Diagram(**diagram_dict)


def list_diagrams(directory: str) -> list[dict]:
    """
    List all diagram files in a directory.

    Args:
        directory: Directory to search

    Returns:
        List of diagram metadata (name, path, updated_at)
    """
    diagrams = []

    if not os.path.exists(directory):
        return diagrams

    for file_path in Path(directory).glob("*.json"):
        try:
            diagram = load_diagram(str(file_path))
            diagrams.append(
                {
                    "id": diagram.id,
                    "name": diagram.name,
                    "path": str(file_path),
                    "updated_at": diagram.updated_at.isoformat(),
                    "table_count": len(diagram.tables),
                    "relationship_count": len(diagram.relationships),
                }
            )
        except Exception as e:
            # Skip invalid files
            print(f"Warning: Could not load {file_path}: {e}")
            continue

    # Sort by updated_at descending
    diagrams.sort(key=lambda x: x["updated_at"], reverse=True)
    return diagrams


def create_backup(diagram: Diagram, backup_dir: str) -> str:
    """
    Create a backup of a diagram with timestamp.

    Args:
        diagram: Diagram to backup
        backup_dir: Directory to store backups

    Returns:
        Path to the backup file
    """
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"{diagram.name.replace(' ', '_')}_{timestamp}.json"
    backup_path = os.path.join(backup_dir, backup_filename)

    save_diagram(diagram, backup_path)
    return backup_path
