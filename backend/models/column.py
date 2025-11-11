"""
Column model representing a database table column
"""

from typing import Optional, Any
from pydantic import BaseModel, Field
from uuid import uuid4


class Column(BaseModel):
    """
    Represents a column in a database table.

    Attributes:
        id: Unique identifier for the column
        physical_name: Physical name used in database (e.g., "user_id")
        logical_name: Logical/descriptive name (e.g., "사용자 ID")
        data_type: Abstract data type (e.g., "string", "integer")
        length: Length for string types
        precision: Precision for decimal types
        scale: Scale for decimal types
        nullable: Whether NULL values are allowed
        primary_key: Whether this is a primary key column
        unique: Whether values must be unique
        auto_increment: Whether auto-increment is enabled
        default_value: Default value for the column
        comment: Description/comment for the column
        foreign_key: Reference to foreign key if applicable
    """

    id: str = Field(default_factory=lambda: str(uuid4()))
    physical_name: str = Field(..., min_length=1, max_length=64)
    logical_name: Optional[str] = None
    data_type: str = Field(default="string")

    # Type modifiers
    length: Optional[int] = Field(default=None, ge=1)
    precision: Optional[int] = Field(default=None, ge=1)
    scale: Optional[int] = Field(default=None, ge=0)

    # Constraints
    nullable: bool = True
    primary_key: bool = False
    unique: bool = False
    auto_increment: bool = False

    # Default and comments
    default_value: Optional[Any] = None
    comment: Optional[str] = None

    # Foreign key reference (table_id, column_id)
    foreign_key: Optional[dict[str, str]] = None

    class Config:
        """Pydantic configuration"""
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "physical_name": "user_id",
                "logical_name": "사용자 ID",
                "data_type": "integer",
                "nullable": False,
                "primary_key": True,
                "auto_increment": True,
            }
        }

    def __str__(self) -> str:
        """String representation of the column"""
        return f"{self.physical_name} ({self.data_type})"

    def __repr__(self) -> str:
        """Detailed representation of the column"""
        return f"Column(physical_name='{self.physical_name}', data_type='{self.data_type}', pk={self.primary_key})"

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

    def is_foreign_key(self) -> bool:
        """Check if this column is a foreign key"""
        return self.foreign_key is not None

    def get_full_type(self) -> str:
        """
        Get full type specification including length/precision.

        Returns:
            Type string like "VARCHAR(255)" or "DECIMAL(10,2)"
        """
        type_str = self.data_type.upper()

        if self.length is not None:
            type_str += f"({self.length})"
        elif self.precision is not None:
            if self.scale is not None:
                type_str += f"({self.precision},{self.scale})"
            else:
                type_str += f"({self.precision})"

        return type_str
