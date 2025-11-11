"""
Relationship model representing relationships between tables
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field
from uuid import uuid4


class Relationship(BaseModel):
    """
    Represents a relationship between two tables.

    Attributes:
        id: Unique identifier for the relationship
        name: Optional name for the relationship
        source_table_id: ID of the source (parent) table
        target_table_id: ID of the target (child) table
        source_column_ids: List of column IDs in source table
        target_column_ids: List of column IDs in target table (FK columns)
        cardinality: Type of relationship (1:1, 1:N, N:N)
        on_delete: Action on delete (CASCADE, SET NULL, RESTRICT, NO ACTION)
        on_update: Action on update (CASCADE, SET NULL, RESTRICT, NO ACTION)
        comment: Description of the relationship
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: Optional[str] = None

    # Table references
    source_table_id: str = Field(..., min_length=1)
    target_table_id: str = Field(..., min_length=1)

    # Column references
    source_column_ids: list[str] = Field(default_factory=list)
    target_column_ids: list[str] = Field(default_factory=list)

    # Relationship type
    cardinality: Literal["1:1", "1:N", "N:N"] = "1:N"

    # Referential actions
    on_delete: Literal["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"] = "RESTRICT"
    on_update: Literal["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"] = "NO ACTION"

    # Metadata
    comment: Optional[str] = None

    class Config:
        """Pydantic configuration"""
        json_schema_extra = {
            "example": {
                "id": "rel-001",
                "name": "user_posts",
                "source_table_id": "table-users",
                "target_table_id": "table-posts",
                "source_column_ids": ["col-user-id"],
                "target_column_ids": ["col-post-user-id"],
                "cardinality": "1:N",
                "on_delete": "CASCADE",
            }
        }

    def __str__(self) -> str:
        """String representation of the relationship"""
        return f"{self.source_table_id} -> {self.target_table_id} ({self.cardinality})"

    def __repr__(self) -> str:
        """Detailed representation of the relationship"""
        return (
            f"Relationship(name='{self.name}', "
            f"source={self.source_table_id}, "
            f"target={self.target_table_id}, "
            f"cardinality='{self.cardinality}')"
        )

    def is_one_to_one(self) -> bool:
        """Check if this is a one-to-one relationship"""
        return self.cardinality == "1:1"

    def is_one_to_many(self) -> bool:
        """Check if this is a one-to-many relationship"""
        return self.cardinality == "1:N"

    def is_many_to_many(self) -> bool:
        """Check if this is a many-to-many relationship"""
        return self.cardinality == "N:N"

    def get_fk_name(self, target_table_name: str) -> str:
        """
        Generate foreign key constraint name.

        Args:
            target_table_name: Physical name of the target table

        Returns:
            Foreign key constraint name
        """
        if self.name:
            return f"fk_{self.name}"
        return f"fk_{target_table_name}_{self.id[:8]}"

    def validate_relationship(self) -> list[str]:
        """
        Validate relationship and return list of issues.

        Returns:
            List of validation error messages (empty if valid)
        """
        issues = []

        # Check that source and target are different
        if self.source_table_id == self.target_table_id:
            issues.append(
                f"Relationship '{self.id}' has same source and target table (self-reference not supported in MVP)"
            )

        # Check that column lists match in length
        if len(self.source_column_ids) != len(self.target_column_ids):
            issues.append(
                f"Relationship '{self.id}' has mismatched column count: "
                f"{len(self.source_column_ids)} source vs {len(self.target_column_ids)} target"
            )

        # Check that at least one column is specified
        if not self.source_column_ids or not self.target_column_ids:
            issues.append(f"Relationship '{self.id}' must have at least one column pair")

        return issues
