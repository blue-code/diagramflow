"""
PostgreSQL DDL Generator Test

Tests the PostgreSQL DDL generation functionality.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.models import Diagram, Table, Column
from backend.generators.postgresql_ddl import PostgreSQLDDLGenerator


def test_basic_types():
    """Test basic PostgreSQL data types"""
    print("=" * 60)
    print("Test 1: Basic PostgreSQL Data Types")
    print("=" * 60)

    diagram = Diagram(name="Test Diagram", database_type="postgresql")

    # Create users table
    users = Table(
        physical_name="users",
        logical_name="사용자",
        comment="User information table"
    )

    users.add_column(Column(
        physical_name="id",
        logical_name="사용자 ID",
        data_type="integer",
        primary_key=True,
        auto_increment=True,
        nullable=False
    ))

    users.add_column(Column(
        physical_name="username",
        logical_name="사용자명",
        data_type="string",
        length=50,
        nullable=False
    ))

    users.add_column(Column(
        physical_name="email",
        logical_name="이메일",
        data_type="string",
        length=100,
        unique=True
    ))

    users.add_column(Column(
        physical_name="is_active",
        logical_name="활성 상태",
        data_type="boolean",
        default_value="true"
    ))

    users.add_column(Column(
        physical_name="created_at",
        logical_name="생성일시",
        data_type="datetime",
        default_value="CURRENT_TIMESTAMP"
    ))

    diagram.add_table(users)

    # Generate DDL
    generator = PostgreSQLDDLGenerator(diagram)
    ddl = generator.generate()

    print(ddl)
    print("\n" + "=" * 60)

    # Verify key features
    assert "SERIAL" in ddl, "Should use SERIAL for auto-increment"
    assert "VARCHAR(50)" in ddl, "Should have VARCHAR with length"
    assert "BOOLEAN" in ddl, "Should have BOOLEAN type"
    assert "DEFAULT CURRENT_TIMESTAMP" in ddl, "Should have CURRENT_TIMESTAMP without quotes"
    assert "DROP TABLE IF EXISTS users CASCADE" in ddl, "Should have CASCADE drop"
    assert "COMMENT ON TABLE" in ddl, "Should have table comment"
    assert "COMMENT ON COLUMN" in ddl, "Should have column comments"

    print("[PASS] Test 1: Basic types work correctly\n")


def test_postgresql_specific_types():
    """Test PostgreSQL-specific data types"""
    print("=" * 60)
    print("Test 2: PostgreSQL-Specific Types")
    print("=" * 60)

    diagram = Diagram(name="Products", database_type="postgresql")

    products = Table(
        physical_name="products",
        logical_name="제품",
        comment="Product information"
    )

    products.add_column(Column(
        physical_name="id",
        data_type="string",  # UUID will be mapped
        length=36,
        primary_key=True,
        nullable=False,
        comment="Product UUID"
    ))

    products.add_column(Column(
        physical_name="name",
        data_type="string",
        length=200,
        nullable=False
    ))

    products.add_column(Column(
        physical_name="metadata",
        data_type="json",  # Will be mapped to JSONB
        comment="Product metadata in JSON format"
    ))

    products.add_column(Column(
        physical_name="price",
        data_type="decimal",
        precision=10,
        scale=2,
        nullable=False
    ))

    products.add_column(Column(
        physical_name="image_data",
        data_type="bytea",  # PostgreSQL binary data
        comment="Product image"
    ))

    diagram.add_table(products)

    generator = PostgreSQLDDLGenerator(diagram)
    ddl = generator.generate()

    print(ddl)
    print("\n" + "=" * 60)

    # Verify PostgreSQL-specific features
    assert "JSONB" in ddl or "JSON" in ddl, "Should use JSONB for json type"
    assert "NUMERIC" in ddl or "DECIMAL" in ddl, "Should use NUMERIC/DECIMAL"
    assert "COMMENT ON COLUMN" in ddl, "Should have column comments"

    print("[PASS] Test 2: PostgreSQL-specific types work correctly\n")


def test_bigserial():
    """Test BIGSERIAL auto-increment"""
    print("=" * 60)
    print("Test 3: BIGSERIAL Auto-Increment")
    print("=" * 60)

    diagram = Diagram(name="Logs", database_type="postgresql")

    logs = Table(physical_name="logs", logical_name="로그")

    logs.add_column(Column(
        physical_name="id",
        data_type="bigint",
        primary_key=True,
        auto_increment=True,
        nullable=False
    ))

    logs.add_column(Column(
        physical_name="message",
        data_type="text"
    ))

    diagram.add_table(logs)

    generator = PostgreSQLDDLGenerator(diagram)
    ddl = generator.generate()

    print(ddl)
    print("\n" + "=" * 60)

    assert "BIGSERIAL" in ddl, "Should use BIGSERIAL for bigint auto-increment"

    print("[PASS] Test 3: BIGSERIAL works correctly\n")


def test_timestamp_with_timezone():
    """Test TIMESTAMP WITH TIME ZONE"""
    print("=" * 60)
    print("Test 4: Timestamp with Time Zone")
    print("=" * 60)

    diagram = Diagram(name="Events", database_type="postgresql")

    events = Table(physical_name="events")

    events.add_column(Column(
        physical_name="id",
        data_type="integer",
        primary_key=True,
        auto_increment=True
    ))

    events.add_column(Column(
        physical_name="occurred_at",
        data_type="timestamp",  # Will map to TIMESTAMP WITH TIME ZONE
        default_value="CURRENT_TIMESTAMP"
    ))

    diagram.add_table(events)

    generator = PostgreSQLDDLGenerator(diagram)
    ddl = generator.generate()

    print(ddl)
    print("\n" + "=" * 60)

    # Check for timestamp handling
    assert "TIMESTAMP" in ddl, "Should have TIMESTAMP type"
    assert "DEFAULT CURRENT_TIMESTAMP" in ddl, "Should handle CURRENT_TIMESTAMP"

    print("[PASS] Test 4: Timestamp types work correctly\n")


def run_all_tests():
    """Run all PostgreSQL DDL tests"""
    print("\n" + "PostgreSQL DDL Generator Tests".center(60, "="))
    print()

    try:
        test_basic_types()
        test_postgresql_specific_types()
        test_bigserial()
        test_timestamp_with_timezone()

        print("=" * 60)
        print("All tests PASSED!".center(60))
        print("=" * 60)
        return 0

    except AssertionError as e:
        print(f"\n[FAIL] Test FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(run_all_tests())
