"""
Reverse Engineering - Import database schema to ERD
"""

import pymysql
import psycopg2
from typing import Dict, List, Optional
from ..models import Diagram, Table, Column, Relationship


class ReverseEngineer:
    """Base class for reverse engineering database schemas"""

    def __init__(self, connection_params: Dict):
        """
        Initialize reverse engineer.

        Args:
            connection_params: Database connection parameters
        """
        self.connection_params = connection_params
        self.connection = None

    def connect(self):
        """Connect to database - to be implemented by subclasses"""
        raise NotImplementedError

    def disconnect(self):
        """Disconnect from database"""
        if self.connection:
            self.connection.close()
            self.connection = None

    def import_schema(self, schema_name: Optional[str] = None) -> Diagram:
        """Import database schema to diagram"""
        raise NotImplementedError


class MySQLReverseEngineer(ReverseEngineer):
    """Reverse engineer for MySQL databases"""

    def connect(self):
        """Connect to MySQL database"""
        self.connection = pymysql.connect(
            host=self.connection_params.get('host', 'localhost'),
            port=self.connection_params.get('port', 3306),
            user=self.connection_params['user'],
            password=self.connection_params['password'],
            database=self.connection_params.get('database', ''),
            charset='utf8mb4'
        )

    def import_schema(self, schema_name: Optional[str] = None) -> Diagram:
        """
        Import MySQL schema to diagram.

        Args:
            schema_name: Schema/database name to import

        Returns:
            Diagram object with tables and relationships
        """
        self.connect()

        try:
            cursor = self.connection.cursor()

            # Use specified schema or default
            schema = schema_name or self.connection_params.get('database')
            if not schema:
                raise ValueError("Schema name must be provided")

            # Create diagram
            diagram = Diagram(
                name=f"{schema} - MySQL",
                database_type="mysql",
                description=f"Imported from MySQL database: {schema}"
            )

            # Get all tables
            cursor.execute(f"""
                SELECT TABLE_NAME, TABLE_COMMENT
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            """, (schema,))

            tables_info = cursor.fetchall()

            # Import each table
            for idx, (table_name, table_comment) in enumerate(tables_info):
                table = self._import_table(cursor, schema, table_name, table_comment, idx)
                diagram.add_table(table)

            # Import foreign keys
            self._import_foreign_keys(cursor, schema, diagram)

            return diagram

        finally:
            self.disconnect()

    def _import_table(self, cursor, schema: str, table_name: str, table_comment: str, index: int) -> Table:
        """Import a single table"""

        # Get columns
        cursor.execute(f"""
            SELECT
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                COLUMN_KEY,
                COLUMN_DEFAULT,
                EXTRA,
                COLUMN_COMMENT,
                DATA_TYPE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """, (schema, table_name))

        columns_info = cursor.fetchall()

        table = Table(
            physical_name=table_name,
            logical_name="",
            comment=table_comment or "",
            position={"x": 100 + (index % 5) * 300, "y": 100 + (index // 5) * 250}
        )

        for col_info in columns_info:
            column = self._create_column(col_info)
            table.add_column(column)

        return table

    def _create_column(self, col_info) -> Column:
        """Create column from database metadata"""
        (
            col_name, col_type, is_nullable, col_key, col_default,
            extra, comment, data_type, char_length, num_precision, num_scale
        ) = col_info

        # Map MySQL data types to abstract types
        type_mapping = {
            'int': 'integer',
            'bigint': 'bigint',
            'varchar': 'string',
            'char': 'string',
            'text': 'text',
            'datetime': 'datetime',
            'timestamp': 'timestamp',
            'date': 'date',
            'tinyint': 'boolean' if char_length == 1 else 'integer',
            'decimal': 'decimal',
            'numeric': 'decimal',
            'json': 'json',
        }

        abstract_type = type_mapping.get(data_type.lower(), 'string')

        return Column(
            physical_name=col_name,
            logical_name="",
            data_type=abstract_type,
            length=char_length,
            precision=num_precision,
            scale=num_scale,
            nullable=(is_nullable == 'YES'),
            primary_key=(col_key == 'PRI'),
            unique=(col_key == 'UNI'),
            auto_increment=('auto_increment' in extra.lower()),
            default_value=col_default,
            comment=comment or ""
        )

    def _import_foreign_keys(self, cursor, schema: str, diagram: Diagram):
        """Import foreign key relationships"""
        cursor.execute(f"""
            SELECT
                CONSTRAINT_NAME,
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = %s
              AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION
        """, (schema,))

        fks_info = cursor.fetchall()

        # Group by constraint name
        fk_groups = {}
        for fk_info in fks_info:
            constraint_name = fk_info[0]
            if constraint_name not in fk_groups:
                fk_groups[constraint_name] = []
            fk_groups[constraint_name].append(fk_info)

        # Create relationships
        for constraint_name, fk_list in fk_groups.items():
            first_fk = fk_list[0]
            table_name = first_fk[1]
            ref_table_name = first_fk[3]

            # Find tables
            source_table = diagram.get_table_by_name(ref_table_name)
            target_table = diagram.get_table_by_name(table_name)

            if not source_table or not target_table:
                continue

            # Get column IDs
            source_col_ids = []
            target_col_ids = []

            for fk in fk_list:
                col_name = fk[2]
                ref_col_name = fk[4]

                source_col = source_table.get_column_by_name(ref_col_name)
                target_col = target_table.get_column_by_name(col_name)

                if source_col and target_col:
                    source_col_ids.append(source_col.id)
                    target_col_ids.append(target_col.id)

            if source_col_ids and target_col_ids:
                relationship = Relationship(
                    name=constraint_name,
                    source_table_id=source_table.id,
                    target_table_id=target_table.id,
                    source_column_ids=source_col_ids,
                    target_column_ids=target_col_ids,
                    cardinality="1:N"
                )
                diagram.add_relationship(relationship)


class PostgreSQLReverseEngineer(ReverseEngineer):
    """Reverse engineer for PostgreSQL databases"""

    def connect(self):
        """Connect to PostgreSQL database"""
        self.connection = psycopg2.connect(
            host=self.connection_params.get('host', 'localhost'),
            port=self.connection_params.get('port', 5432),
            user=self.connection_params['user'],
            password=self.connection_params['password'],
            database=self.connection_params.get('database', 'postgres')
        )

    def import_schema(self, schema_name: Optional[str] = 'public') -> Diagram:
        """
        Import PostgreSQL schema to diagram.

        Args:
            schema_name: Schema name to import (default: public)

        Returns:
            Diagram object with tables and relationships
        """
        self.connect()

        try:
            cursor = self.connection.cursor()

            # Create diagram
            diagram = Diagram(
                name=f"{schema_name} - PostgreSQL",
                database_type="postgresql",
                description=f"Imported from PostgreSQL schema: {schema_name}"
            )

            # Get all tables
            cursor.execute("""
                SELECT table_name,
                       obj_description((quote_ident(table_schema)||'.'||quote_ident(table_name))::regclass, 'pg_class') as table_comment
                FROM information_schema.tables
                WHERE table_schema = %s AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """, (schema_name,))

            tables_info = cursor.fetchall()

            # Import each table
            for idx, (table_name, table_comment) in enumerate(tables_info):
                table = self._import_table(cursor, schema_name, table_name, table_comment or '', idx)
                diagram.add_table(table)

            # Import foreign keys
            self._import_foreign_keys(cursor, schema_name, diagram)

            return diagram

        finally:
            self.disconnect()

    def _import_table(self, cursor, schema: str, table_name: str, table_comment: str, index: int) -> Table:
        """Import a single table"""

        # Get columns
        cursor.execute("""
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                col_description((quote_ident(%s)||'.'||quote_ident(%s))::regclass, c.ordinal_position) as column_comment,
                (SELECT COUNT(*)
                 FROM information_schema.key_column_usage kcu
                 JOIN information_schema.table_constraints tc
                   ON kcu.constraint_name = tc.constraint_name
                 WHERE tc.table_schema = %s
                   AND tc.table_name = %s
                   AND kcu.column_name = c.column_name
                   AND tc.constraint_type = 'PRIMARY KEY') as is_pk,
                (SELECT COUNT(*)
                 FROM information_schema.key_column_usage kcu
                 JOIN information_schema.table_constraints tc
                   ON kcu.constraint_name = tc.constraint_name
                 WHERE tc.table_schema = %s
                   AND tc.table_name = %s
                   AND kcu.column_name = c.column_name
                   AND tc.constraint_type = 'UNIQUE') as is_unique
            FROM information_schema.columns c
            WHERE c.table_schema = %s AND c.table_name = %s
            ORDER BY c.ordinal_position
        """, (schema, table_name, schema, table_name, schema, table_name, schema, table_name))

        columns_info = cursor.fetchall()

        table = Table(
            physical_name=table_name,
            logical_name="",
            comment=table_comment,
            position={"x": 100 + (index % 5) * 300, "y": 100 + (index // 5) * 250}
        )

        for col_info in columns_info:
            column = self._create_column(col_info)
            table.add_column(column)

        return table

    def _create_column(self, col_info) -> Column:
        """Create column from database metadata"""
        (
            col_name, data_type, is_nullable, col_default,
            char_length, num_precision, num_scale, comment,
            is_pk, is_unique
        ) = col_info

        # Map PostgreSQL data types to abstract types
        type_mapping = {
            'integer': 'integer',
            'bigint': 'bigint',
            'character varying': 'string',
            'varchar': 'string',
            'text': 'text',
            'timestamp without time zone': 'datetime',
            'timestamp with time zone': 'timestamp',
            'date': 'date',
            'boolean': 'boolean',
            'numeric': 'decimal',
            'decimal': 'decimal',
            'jsonb': 'json',
            'json': 'json',
        }

        abstract_type = type_mapping.get(data_type.lower(), 'string')

        # Check for serial types (auto-increment)
        auto_increment = col_default and 'nextval' in col_default

        return Column(
            physical_name=col_name,
            logical_name="",
            data_type=abstract_type,
            length=char_length,
            precision=num_precision,
            scale=num_scale,
            nullable=(is_nullable == 'YES'),
            primary_key=(is_pk > 0),
            unique=(is_unique > 0),
            auto_increment=auto_increment,
            default_value=None,  # Can parse col_default if needed
            comment=comment or ""
        )

    def _import_foreign_keys(self, cursor, schema: str, diagram: Diagram):
        """Import foreign key relationships"""
        cursor.execute("""
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = %s
            ORDER BY tc.constraint_name
        """, (schema,))

        fks_info = cursor.fetchall()

        # Group by constraint name
        fk_groups = {}
        for fk_info in fks_info:
            constraint_name = fk_info[0]
            if constraint_name not in fk_groups:
                fk_groups[constraint_name] = []
            fk_groups[constraint_name].append(fk_info)

        # Create relationships
        for constraint_name, fk_list in fk_groups.items():
            first_fk = fk_list[0]
            table_name = first_fk[1]
            ref_table_name = first_fk[3]

            # Find tables
            source_table = diagram.get_table_by_name(ref_table_name)
            target_table = diagram.get_table_by_name(table_name)

            if not source_table or not target_table:
                continue

            # Get column IDs
            source_col_ids = []
            target_col_ids = []

            for fk in fk_list:
                col_name = fk[2]
                ref_col_name = fk[4]

                source_col = source_table.get_column_by_name(ref_col_name)
                target_col = target_table.get_column_by_name(col_name)

                if source_col and target_col:
                    source_col_ids.append(source_col.id)
                    target_col_ids.append(target_col.id)

            if source_col_ids and target_col_ids:
                relationship = Relationship(
                    name=constraint_name,
                    source_table_id=source_table.id,
                    target_table_id=target_table.id,
                    source_column_ids=source_col_ids,
                    target_column_ids=target_col_ids,
                    cardinality="1:N"
                )
                diagram.add_relationship(relationship)


def create_reverse_engineer(db_type: str, connection_params: Dict) -> ReverseEngineer:
    """
    Factory function to create reverse engineer for specific database type.

    Args:
        db_type: Database type ('mysql', 'postgresql')
        connection_params: Connection parameters

    Returns:
        ReverseEngineer instance

    Raises:
        ValueError: If database type not supported
    """
    engineers = {
        'mysql': MySQLReverseEngineer,
        'postgresql': PostgreSQLReverseEngineer
    }

    engineer_class = engineers.get(db_type.lower())
    if not engineer_class:
        raise ValueError(f"Database type '{db_type}' not supported for reverse engineering")

    return engineer_class(connection_params)
