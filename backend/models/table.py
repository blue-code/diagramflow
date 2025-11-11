"""
Table model representing a database table
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import uuid4
from .column import Column


class Table(BaseModel):
    """
    Represents a database table.

    Attributes:
        id: Unique identifier for the table
        physical_name: Physical table name in database (e.g., "tb_users")
        logical_name: Logical/descriptive name (e.g., "사용자 테이블")
        columns: List of columns in this table
        comment: Description/comment for the table
        position: Position on diagram canvas (x, y)
        categories: List of category IDs this table belongs to
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    physical_name: str = Field(..., min_length=1, max_length=64)
    logical_name: Optional[str] = None
    columns: List[Column] = Field(default_factory=list)
    comment: Optional[str] = None

    # UI positioning
    position: dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})

    # Categorization
    categories: List[str] = Field(default_factory=list)

    class Config:
        """Pydantic configuration"""
        json_schema_extra = {
            "example": {
                "id": "table-001",
                "physical_name": "tb_users",
                "logical_name": "사용자",
                "columns": [
                    {
                        "physical_name": "id",
                        "data_type": "integer",
                        "primary_key": True,
                        "auto_increment": True,
                    },
                    {
                        "physical_name": "username",
                        "data_type": "string",
                        "length": 50,
                        "nullable": False,
                    },
                ],
                "position": {"x": 100, "y": 100},
            }
        }

    def __str__(self) -> str:
        """String representation of the table"""
        return f"{self.physical_name} ({len(self.columns)} columns)"

    def __repr__(self) -> str:
        """Detailed representation of the table"""
        return f"Table(physical_name='{self.physical_name}', columns={len(self.columns)})"

    def get_display_name(self, use_logical: bool = True) -> str:
        """
        Get display name based on preference.

        Args:
            use_logical: If True and logical_name exists, return logical name

        Returns:
            Display name string
        """
        if use_logical and self.logical_name:
            return f"{self.logical_name} ({self.physical_name})"
        return self.physical_name

    def add_column(self, column: Column) -> None:
        """
        Add a column to the table.

        Args:
            column: Column object to add
        """
        self.columns.append(column)

    def remove_column(self, column_id: str) -> bool:
        """
        Remove a column from the table.

        Args:
            column_id: ID of the column to remove

        Returns:
            True if column was removed, False if not found
        """
        original_length = len(self.columns)
        self.columns = [col for col in self.columns if col.id != column_id]
        return len(self.columns) < original_length

    def get_column(self, column_id: str) -> Optional[Column]:
        """
        Get a column by ID.

        Args:
            column_id: ID of the column to retrieve

        Returns:
            Column object or None if not found
        """
        for column in self.columns:
            if column.id == column_id:
                return column
        return None

    def get_column_by_name(self, physical_name: str) -> Optional[Column]:
        """
        Get a column by physical name.

        Args:
            physical_name: Physical name of the column

        Returns:
            Column object or None if not found
        """
        for column in self.columns:
            if column.physical_name == physical_name:
                return column
        return None

    def get_primary_keys(self) -> List[Column]:
        """
        Get all primary key columns.

        Returns:
            List of primary key columns
        """
        return [col for col in self.columns if col.primary_key]

    def get_foreign_keys(self) -> List[Column]:
        """
        Get all foreign key columns.

        Returns:
            List of foreign key columns
        """
        return [col for col in self.columns if col.is_foreign_key()]

    def has_primary_key(self) -> bool:
        """Check if table has at least one primary key"""
        return any(col.primary_key for col in self.columns)

    def validate_structure(self) -> List[str]:
        """
        Validate table structure and return list of issues.

        Returns:
            List of validation error messages (empty if valid)
        """
        issues = []

        # Check if table has columns
        if not self.columns:
            issues.append(f"Table '{self.physical_name}' has no columns")

        # Check if table has primary key
        if not self.has_primary_key():
            issues.append(f"Table '{self.physical_name}' has no primary key")

        # Check for duplicate column names
        column_names = [col.physical_name for col in self.columns]
        duplicates = [name for name in column_names if column_names.count(name) > 1]
        if duplicates:
            issues.append(
                f"Table '{self.physical_name}' has duplicate column names: {set(duplicates)}"
            )

        return issues
