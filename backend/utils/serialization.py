"""
Serialization utilities for saving and loading diagrams
"""

import json
import os
import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime
from ..models.diagram import Diagram
from .file_lock import file_lock


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder for datetime objects"""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def save_diagram(diagram: Diagram, file_path: str, check_version: bool = True) -> None:
    """
    Save a diagram to a JSON file with file locking and version control.

    Args:
        diagram: Diagram object to save
        file_path: Path to save the file
        check_version: If True, check version before saving (optimistic locking)

    Raises:
        IOError: If file cannot be written
        ValueError: If version conflict detected
    """
    # Ensure directory exists
    directory = os.path.dirname(file_path)
    if directory:
        os.makedirs(directory, exist_ok=True)

    # Acquire file lock to prevent concurrent writes
    try:
        with file_lock(file_path, timeout=15.0):
            # Check for version conflicts (optimistic concurrency control)
            if check_version and os.path.exists(file_path):
                try:
                    existing_diagram = load_diagram(file_path, use_lock=False)

                    # Compare versions
                    if existing_diagram.version != diagram.version:
                        raise ValueError(
                            f"Version conflict: file has version {existing_diagram.version}, "
                            f"but trying to save version {diagram.version}. "
                            f"The file was modified by another user."
                        )

                    # Increment version for next save
                    diagram.version = existing_diagram.version + ".0.1"  # Micro version bump

                except FileNotFoundError:
                    pass  # File doesn't exist yet, proceed

            # Create backup before saving
            if os.path.exists(file_path):
                backup_path = file_path + '.backup'
                shutil.copy2(file_path, backup_path)

            # Update timestamp
            diagram.updated_at = datetime.now()

            # Convert to JSON using Pydantic's model_dump
            diagram_dict = diagram.model_dump(mode='json')

            # Write to temporary file first (atomic write)
            temp_path = file_path + '.tmp'
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(diagram_dict, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)

            # Atomic rename
            os.replace(temp_path, file_path)

    except TimeoutError:
        raise IOError(f"Could not acquire lock for {file_path}. File may be locked by another process.")


def load_diagram(file_path: str, use_lock: bool = True) -> Diagram:
    """
    Load a diagram from a JSON file.

    Args:
        file_path: Path to the JSON file
        use_lock: If True, use file locking (default: True)

    Returns:
        Diagram object

    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If file is not valid JSON
        ValueError: If JSON doesn't match Diagram schema
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Diagram file not found: {file_path}")

    if use_lock:
        # Use file lock for reading to ensure consistency
        try:
            with file_lock(file_path, timeout=10.0):
                with open(file_path, 'r', encoding='utf-8') as f:
                    diagram_dict = json.load(f)
        except TimeoutError:
            raise IOError(f"Could not acquire lock for reading {file_path}")
    else:
        # Direct read without locking (used internally during save)
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
