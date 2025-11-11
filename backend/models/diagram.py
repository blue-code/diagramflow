"""
Diagram model representing the entire ERD
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import uuid4
from .table import Table
from .relationship import Relationship


class Diagram(BaseModel):
    """
    Represents an entire ERD diagram.

    Attributes:
        id: Unique identifier for the diagram
        name: Name of the diagram
        description: Description of the diagram
        database_type: Target database type (mysql, postgresql, etc.)
        version: Diagram version
        tables: List of tables in the diagram
        relationships: List of relationships between tables
        created_at: Creation timestamp
        updated_at: Last update timestamp
        metadata: Additional metadata
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str = Field(default="Untitled Diagram")
    description: Optional[str] = None
    database_type: str = Field(default="mysql")
    version: str = Field(default="1.0")

    # Core components
    tables: List[Table] = Field(default_factory=list)
    relationships: List[Relationship] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    # Additional metadata
    metadata: dict = Field(default_factory=dict)

    class Config:
        """Pydantic configuration"""
        json_schema_extra = {
            "example": {
                "id": "diagram-001",
                "name": "E-commerce Database",
                "description": "Main database schema for e-commerce platform",
                "database_type": "mysql",
                "version": "1.0",
                "tables": [],
                "relationships": [],
            }
        }

    def __str__(self) -> str:
        """String representation of the diagram"""
        return f"{self.name} ({len(self.tables)} tables, {len(self.relationships)} relationships)"

    def __repr__(self) -> str:
        """Detailed representation of the diagram"""
        return f"Diagram(name='{self.name}', tables={len(self.tables)}, relationships={len(self.relationships)})"

    # Table management methods
    def add_table(self, table: Table) -> None:
        """Add a table to the diagram"""
        self.tables.append(table)
        self.updated_at = datetime.now()

    def remove_table(self, table_id: str) -> bool:
        """
        Remove a table from the diagram.
        Also removes all relationships involving this table.

        Args:
            table_id: ID of the table to remove

        Returns:
            True if table was removed, False if not found
        """
        original_length = len(self.tables)
        self.tables = [t for t in self.tables if t.id != table_id]

        if len(self.tables) < original_length:
            # Remove related relationships
            self.relationships = [
                r
                for r in self.relationships
                if r.source_table_id != table_id and r.target_table_id != table_id
            ]
            self.updated_at = datetime.now()
            return True
        return False

    def get_table(self, table_id: str) -> Optional[Table]:
        """Get a table by ID"""
        for table in self.tables:
            if table.id == table_id:
                return table
        return None

    def get_table_by_name(self, physical_name: str) -> Optional[Table]:
        """Get a table by physical name"""
        for table in self.tables:
            if table.physical_name == physical_name:
                return table
        return None

    # Relationship management methods
    def add_relationship(self, relationship: Relationship) -> None:
        """Add a relationship to the diagram"""
        self.relationships.append(relationship)
        self.updated_at = datetime.now()

    def remove_relationship(self, relationship_id: str) -> bool:
        """
        Remove a relationship from the diagram.

        Args:
            relationship_id: ID of the relationship to remove

        Returns:
            True if relationship was removed, False if not found
        """
        original_length = len(self.relationships)
        self.relationships = [r for r in self.relationships if r.id != relationship_id]

        if len(self.relationships) < original_length:
            self.updated_at = datetime.now()
            return True
        return False

    def get_relationship(self, relationship_id: str) -> Optional[Relationship]:
        """Get a relationship by ID"""
        for relationship in self.relationships:
            if relationship.id == relationship_id:
                return relationship
        return None

    def get_table_relationships(self, table_id: str) -> List[Relationship]:
        """
        Get all relationships involving a specific table.

        Args:
            table_id: ID of the table

        Returns:
            List of relationships where table is source or target
        """
        return [
            r
            for r in self.relationships
            if r.source_table_id == table_id or r.target_table_id == table_id
        ]

    # Validation methods
    def validate(self) -> List[str]:
        """
        Validate the entire diagram and return list of issues.

        Returns:
            List of validation error messages (empty if valid)
        """
        issues = []

        # Validate each table
        for table in self.tables:
            issues.extend(table.validate_structure())

        # Check for duplicate table names
        table_names = [t.physical_name for t in self.tables]
        duplicates = [name for name in table_names if table_names.count(name) > 1]
        if duplicates:
            issues.append(f"Duplicate table names found: {set(duplicates)}")

        # Validate each relationship
        for relationship in self.relationships:
            issues.extend(relationship.validate_relationship())

            # Check that referenced tables exist
            if not self.get_table(relationship.source_table_id):
                issues.append(
                    f"Relationship '{relationship.id}' references non-existent source table '{relationship.source_table_id}'"
                )
            if not self.get_table(relationship.target_table_id):
                issues.append(
                    f"Relationship '{relationship.id}' references non-existent target table '{relationship.target_table_id}'"
                )

        return issues

    # Statistics methods
    def get_statistics(self) -> dict:
        """
        Get statistics about the diagram.

        Returns:
            Dictionary with diagram statistics
        """
        total_columns = sum(len(table.columns) for table in self.tables)
        total_pks = sum(len(table.get_primary_keys()) for table in self.tables)
        total_fks = sum(len(table.get_foreign_keys()) for table in self.tables)

        return {
            "total_tables": len(self.tables),
            "total_relationships": len(self.relationships),
            "total_columns": total_columns,
            "total_primary_keys": total_pks,
            "total_foreign_keys": total_fks,
            "database_type": self.database_type,
            "version": self.version,
        }
