"""
MySQL Workbench .mwb file format converter

Converts between Python ERD Tool format and MySQL Workbench .mwb format.
"""

import zipfile
import xml.etree.ElementTree as ET
from xml.dom import minidom
import tempfile
import os
from typing import Optional
from ..models.diagram import Diagram
from ..models.table import Table
from ..models.column import Column
from ..models.relationship import Relationship


class WorkbenchConverter:
    """Converter for MySQL Workbench .mwb format"""

    # Data type mappings
    TYPE_MAPPING_TO_WB = {
        'integer': 'INT',
        'bigint': 'BIGINT',
        'string': 'VARCHAR',
        'text': 'TEXT',
        'datetime': 'DATETIME',
        'timestamp': 'TIMESTAMP',
        'date': 'DATE',
        'boolean': 'TINYINT',
        'decimal': 'DECIMAL',
        'json': 'JSON'
    }

    TYPE_MAPPING_FROM_WB = {
        'INT': 'integer',
        'BIGINT': 'bigint',
        'VARCHAR': 'string',
        'CHAR': 'string',
        'TEXT': 'text',
        'LONGTEXT': 'text',
        'DATETIME': 'datetime',
        'TIMESTAMP': 'timestamp',
        'DATE': 'date',
        'TINYINT': 'boolean',
        'DECIMAL': 'decimal',
        'NUMERIC': 'decimal',
        'JSON': 'json'
    }

    @staticmethod
    def export_to_mwb(diagram: Diagram, output_path: str) -> bool:
        """
        Export diagram to .mwb file.

        Args:
            diagram: Diagram to export
            output_path: Path to save .mwb file

        Returns:
            True if successful
        """
        try:
            # Create temporary directory for XML files
            with tempfile.TemporaryDirectory() as tmpdir:
                # Create main document XML
                doc_xml = WorkbenchConverter._create_document_xml(diagram)

                # Write XML to temp file
                doc_path = os.path.join(tmpdir, 'document.mwb.xml')
                with open(doc_path, 'w', encoding='utf-8') as f:
                    f.write(doc_xml)

                # Create .mwb file (ZIP archive)
                with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as mwb:
                    mwb.write(doc_path, 'document.mwb.xml')

            return True

        except Exception as e:
            print(f"Error exporting to .mwb: {e}")
            return False

    @staticmethod
    def _create_document_xml(diagram: Diagram) -> str:
        """Create MySQL Workbench XML document"""

        # Create root element
        root = ET.Element('data')

        # Create value element (main container)
        value = ET.SubElement(root, 'value', {
            '_ptr_': '0x0',
            'type': 'object',
            'struct-name': 'workbench.Document',
            'id': diagram.id
        })

        # Add basic info
        ET.SubElement(value, 'value', {'type': 'string', 'key': 'name'}).text = diagram.name
        ET.SubElement(value, 'value', {'type': 'string', 'key': 'version'}).text = '1.0'

        # Create physical models container
        models_link = ET.SubElement(value, 'value', {
            'type': 'list',
            'content-type': 'object',
            'content-struct-name': 'workbench.physical.Model',
            'key': 'physicalModels'
        })

        # Create physical model
        model = ET.SubElement(models_link, 'value', {
            'type': 'object',
            'struct-name': 'workbench.physical.Model',
            'id': f'{diagram.id}_model'
        })

        ET.SubElement(model, 'value', {'type': 'string', 'key': 'name'}).text = diagram.name

        # Create catalog
        catalog_link = ET.SubElement(model, 'link', {'type': 'object', 'key': 'catalog'})
        catalog = ET.SubElement(catalog_link, 'value', {
            'type': 'object',
            'struct-name': 'db.mysql.Catalog',
            'id': f'{diagram.id}_catalog'
        })

        ET.SubElement(catalog, 'value', {'type': 'string', 'key': 'name'}).text = 'mydb'

        # Create schemas container
        schemas_link = ET.SubElement(catalog, 'value', {
            'type': 'list',
            'content-type': 'object',
            'content-struct-name': 'db.mysql.Schema',
            'key': 'schemata'
        })

        # Create schema
        schema = ET.SubElement(schemas_link, 'value', {
            'type': 'object',
            'struct-name': 'db.mysql.Schema',
            'id': f'{diagram.id}_schema'
        })

        ET.SubElement(schema, 'value', {'type': 'string', 'key': 'name'}).text = 'mydb'

        # Create tables container
        tables_link = ET.SubElement(schema, 'value', {
            'type': 'list',
            'content-type': 'object',
            'content-struct-name': 'db.mysql.Table',
            'key': 'tables'
        })

        # Add tables
        for table in diagram.tables:
            WorkbenchConverter._add_table_xml(tables_link, table)

        # Pretty print XML
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent='  ')

    @staticmethod
    def _add_table_xml(parent: ET.Element, table: Table):
        """Add table to XML"""

        table_elem = ET.SubElement(parent, 'value', {
            'type': 'object',
            'struct-name': 'db.mysql.Table',
            'id': table.id
        })

        ET.SubElement(table_elem, 'value', {'type': 'string', 'key': 'name'}).text = table.physical_name

        if table.comment:
            ET.SubElement(table_elem, 'value', {'type': 'string', 'key': 'comment'}).text = table.comment

        # Add columns
        columns_link = ET.SubElement(table_elem, 'value', {
            'type': 'list',
            'content-type': 'object',
            'content-struct-name': 'db.mysql.Column',
            'key': 'columns'
        })

        for column in table.columns:
            col_elem = ET.SubElement(columns_link, 'value', {
                'type': 'object',
                'struct-name': 'db.mysql.Column',
                'id': column.id
            })

            ET.SubElement(col_elem, 'value', {'type': 'string', 'key': 'name'}).text = column.physical_name

            # Data type
            wb_type = WorkbenchConverter.TYPE_MAPPING_TO_WB.get(column.data_type, 'VARCHAR')
            ET.SubElement(col_elem, 'value', {'type': 'string', 'key': 'simpleType'}).text = wb_type

            # Length
            if column.length:
                ET.SubElement(col_elem, 'value', {'type': 'int', 'key': 'length'}).text = str(column.length)

            # Precision and scale
            if column.precision:
                ET.SubElement(col_elem, 'value', {'type': 'int', 'key': 'precision'}).text = str(column.precision)
            if column.scale:
                ET.SubElement(col_elem, 'value', {'type': 'int', 'key': 'scale'}).text = str(column.scale)

            # NOT NULL
            ET.SubElement(col_elem, 'value', {'type': 'int', 'key': 'isNotNull'}).text = '0' if column.nullable else '1'

            # Auto increment
            if column.auto_increment:
                ET.SubElement(col_elem, 'value', {'type': 'int', 'key': 'autoIncrement'}).text = '1'

            # Comment
            if column.comment:
                ET.SubElement(col_elem, 'value', {'type': 'string', 'key': 'comment'}).text = column.comment

        # Add indices (for primary keys)
        pk_columns = table.get_primary_keys()
        if pk_columns:
            indices_link = ET.SubElement(table_elem, 'value', {
                'type': 'list',
                'content-type': 'object',
                'content-struct-name': 'db.mysql.Index',
                'key': 'indices'
            })

            pk_index = ET.SubElement(indices_link, 'value', {
                'type': 'object',
                'struct-name': 'db.mysql.Index',
                'id': f'{table.id}_pk'
            })

            ET.SubElement(pk_index, 'value', {'type': 'string', 'key': 'name'}).text = 'PRIMARY'
            ET.SubElement(pk_index, 'value', {'type': 'string', 'key': 'indexType'}).text = 'PRIMARY'

            # Add PK columns
            pk_cols_link = ET.SubElement(pk_index, 'value', {
                'type': 'list',
                'content-type': 'object',
                'content-struct-name': 'db.mysql.IndexColumn',
                'key': 'columns'
            })

            for pk_col in pk_columns:
                idx_col = ET.SubElement(pk_cols_link, 'value', {
                    'type': 'object',
                    'struct-name': 'db.mysql.IndexColumn',
                    'id': f'{pk_col.id}_idx'
                })

                # Reference to column
                col_ref = ET.SubElement(idx_col, 'link', {
                    'type': 'object',
                    'key': 'referencedColumn'
                })
                col_ref.text = pk_col.id

    @staticmethod
    def import_from_mwb(mwb_path: str) -> Optional[Diagram]:
        """
        Import diagram from .mwb file.

        Args:
            mwb_path: Path to .mwb file

        Returns:
            Diagram object or None if failed
        """
        try:
            # Extract .mwb file (ZIP)
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(mwb_path, 'r') as mwb:
                    mwb.extractall(tmpdir)

                # Read document.mwb.xml
                doc_path = os.path.join(tmpdir, 'document.mwb.xml')
                if not os.path.exists(doc_path):
                    print("document.mwb.xml not found in .mwb file")
                    return None

                tree = ET.parse(doc_path)
                root = tree.getroot()

                # Parse XML and create diagram
                diagram = WorkbenchConverter._parse_document_xml(root)
                return diagram

        except Exception as e:
            print(f"Error importing from .mwb: {e}")
            return None

    @staticmethod
    def _parse_document_xml(root: ET.Element) -> Diagram:
        """Parse MySQL Workbench XML and create Diagram"""

        diagram = Diagram(
            name="Imported from Workbench",
            database_type="mysql"
        )

        # Find schema element
        schema = root.find(".//value[@struct-name='db.mysql.Schema']")
        if schema is None:
            return diagram

        # Get schema name
        schema_name_elem = schema.find("value[@key='name']")
        if schema_name_elem is not None and schema_name_elem.text:
            diagram.name = schema_name_elem.text

        # Find tables
        tables_container = schema.find("value[@key='tables']")
        if tables_container is not None:
            for table_elem in tables_container.findall("value[@struct-name='db.mysql.Table']"):
                table = WorkbenchConverter._parse_table_xml(table_elem)
                if table:
                    diagram.add_table(table)

        return diagram

    @staticmethod
    def _parse_table_xml(table_elem: ET.Element) -> Optional[Table]:
        """Parse table from XML"""

        # Get table name
        name_elem = table_elem.find("value[@key='name']")
        if name_elem is None or not name_elem.text:
            return None

        table = Table(
            id=table_elem.get('id', ''),
            physical_name=name_elem.text,
            logical_name=""
        )

        # Get comment
        comment_elem = table_elem.find("value[@key='comment']")
        if comment_elem is not None and comment_elem.text:
            table.comment = comment_elem.text

        # Parse columns
        columns_container = table_elem.find("value[@key='columns']")
        if columns_container is not None:
            for col_elem in columns_container.findall("value[@struct-name='db.mysql.Column']"):
                column = WorkbenchConverter._parse_column_xml(col_elem)
                if column:
                    table.add_column(column)

        # Parse primary keys
        indices_container = table_elem.find("value[@key='indices']")
        if indices_container is not None:
            for idx_elem in indices_container.findall("value[@struct-name='db.mysql.Index']"):
                idx_type_elem = idx_elem.find("value[@key='indexType']")
                if idx_type_elem is not None and idx_type_elem.text == 'PRIMARY':
                    # Mark columns as primary key
                    pk_cols_container = idx_elem.find("value[@key='columns']")
                    if pk_cols_container is not None:
                        for idx_col in pk_cols_container.findall("value[@struct-name='db.mysql.IndexColumn']"):
                            col_ref = idx_col.find("link[@key='referencedColumn']")
                            if col_ref is not None and col_ref.text:
                                col_id = col_ref.text
                                column = table.get_column(col_id)
                                if column:
                                    column.primary_key = True

        return table

    @staticmethod
    def _parse_column_xml(col_elem: ET.Element) -> Optional[Column]:
        """Parse column from XML"""

        name_elem = col_elem.find("value[@key='name']")
        if name_elem is None or not name_elem.text:
            return None

        # Get data type
        type_elem = col_elem.find("value[@key='simpleType']")
        wb_type = type_elem.text if type_elem is not None and type_elem.text else 'VARCHAR'
        data_type = WorkbenchConverter.TYPE_MAPPING_FROM_WB.get(wb_type.upper(), 'string')

        # Get length
        length_elem = col_elem.find("value[@key='length']")
        length = int(length_elem.text) if length_elem is not None and length_elem.text else None

        # Get precision/scale
        precision_elem = col_elem.find("value[@key='precision']")
        precision = int(precision_elem.text) if precision_elem is not None and precision_elem.text else None

        scale_elem = col_elem.find("value[@key='scale']")
        scale = int(scale_elem.text) if scale_elem is not None and scale_elem.text else None

        # Get nullable
        not_null_elem = col_elem.find("value[@key='isNotNull']")
        nullable = not (not_null_elem is not None and not_null_elem.text == '1')

        # Get auto increment
        auto_inc_elem = col_elem.find("value[@key='autoIncrement']")
        auto_increment = auto_inc_elem is not None and auto_inc_elem.text == '1'

        # Get comment
        comment_elem = col_elem.find("value[@key='comment']")
        comment = comment_elem.text if comment_elem is not None and comment_elem.text else ""

        column = Column(
            id=col_elem.get('id', ''),
            physical_name=name_elem.text,
            logical_name="",
            data_type=data_type,
            length=length,
            precision=precision,
            scale=scale,
            nullable=nullable,
            auto_increment=auto_increment,
            comment=comment,
            primary_key=False  # Will be set later when parsing indices
        )

        return column
