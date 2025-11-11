"""
Database normalization analyzer

Analyzes database schemas for normalization issues and provides suggestions.
"""

from typing import List, Dict, Tuple
from ..models.diagram import Diagram
from ..models.table import Table
from ..models.column import Column


class NormalizationIssue:
    """Represents a normalization issue"""

    def __init__(self, level: str, table_id: str, table_name: str, issue_type: str, description: str, suggestion: str):
        self.level = level  # '1NF', '2NF', '3NF', 'BCNF'
        self.table_id = table_id
        self.table_name = table_name
        self.issue_type = issue_type
        self.description = description
        self.suggestion = suggestion

    def to_dict(self) -> Dict:
        return {
            'level': self.level,
            'table_id': self.table_id,
            'table_name': self.table_name,
            'issue_type': self.issue_type,
            'description': self.description,
            'suggestion': self.suggestion
        }


class NormalizationAnalyzer:
    """Analyzes diagrams for normalization issues"""

    def __init__(self, diagram: Diagram):
        self.diagram = diagram
        self.issues: List[NormalizationIssue] = []

    def analyze(self) -> List[Dict]:
        """
        Perform complete normalization analysis.

        Returns:
            List of issues found
        """
        self.issues = []

        # Check each table
        for table in self.diagram.tables:
            self._check_first_normal_form(table)
            self._check_second_normal_form(table)
            self._check_third_normal_form(table)
            self._check_general_issues(table)

        return [issue.to_dict() for issue in self.issues]

    def _check_first_normal_form(self, table: Table):
        """
        Check First Normal Form (1NF) violations.

        1NF Requirements:
        - Each column contains atomic values
        - No repeating groups
        """

        # Check for array-like column names (indicating repeating groups)
        repeating_patterns = {}
        for column in table.columns:
            # Check for patterns like "phone1", "phone2", "email1", "email2"
            name = column.physical_name.lower()

            # Extract base name and number
            import re
            match = re.match(r'(.+?)(\d+)$', name)
            if match:
                base_name, num = match.groups()
                if base_name not in repeating_patterns:
                    repeating_patterns[base_name] = []
                repeating_patterns[base_name].append(column.physical_name)

        # Report repeating groups
        for base_name, columns in repeating_patterns.items():
            if len(columns) > 1:
                self.issues.append(NormalizationIssue(
                    level='1NF',
                    table_id=table.id,
                    table_name=table.physical_name,
                    issue_type='repeating_groups',
                    description=f"Repeating group detected: {', '.join(columns)}",
                    suggestion=f"Consider creating a separate table for {base_name} with a foreign key back to {table.physical_name}"
                ))

        # Check for array/list type indicators in column names
        array_keywords = ['list', 'array', 'set', 'collection', 'multiple']
        for column in table.columns:
            name_lower = column.physical_name.lower()
            if any(keyword in name_lower for keyword in array_keywords):
                self.issues.append(NormalizationIssue(
                    level='1NF',
                    table_id=table.id,
                    table_name=table.physical_name,
                    issue_type='non_atomic',
                    description=f"Column '{column.physical_name}' may contain non-atomic values",
                    suggestion=f"If '{column.physical_name}' stores multiple values, create a separate table"
                ))

    def _check_second_normal_form(self, table: Table):
        """
        Check Second Normal Form (2NF) violations.

        2NF Requirements:
        - Must be in 1NF
        - No partial dependencies (all non-key attributes must depend on entire primary key)
        """

        pk_columns = table.get_primary_keys()

        # Only applicable if composite primary key
        if len(pk_columns) < 2:
            return

        # Look for columns that might only depend on part of the key
        # This is a heuristic check based on naming patterns
        pk_names = [pk.physical_name.lower() for pk in pk_columns]

        for column in table.columns:
            if column.primary_key:
                continue

            col_name = column.physical_name.lower()

            # Check if column name suggests it only relates to one part of composite key
            for pk_name in pk_names:
                # Remove common suffixes
                pk_base = pk_name.replace('_id', '').replace('id', '')

                if pk_base and pk_base in col_name and len(pk_base) > 2:
                    # This column might only depend on this part of the key
                    self.issues.append(NormalizationIssue(
                        level='2NF',
                        table_id=table.id,
                        table_name=table.physical_name,
                        issue_type='partial_dependency',
                        description=f"Column '{column.physical_name}' may only depend on '{pk_name}' (part of composite key)",
                        suggestion=f"Consider moving '{column.physical_name}' to a table related to '{pk_name}'"
                    ))
                    break

    def _check_third_normal_form(self, table: Table):
        """
        Check Third Normal Form (3NF) violations.

        3NF Requirements:
        - Must be in 2NF
        - No transitive dependencies (non-key attributes must not depend on other non-key attributes)
        """

        # Look for columns that suggest transitive dependencies
        # Common pattern: having both an ID and related attributes in the same table

        fk_columns = table.get_foreign_keys()
        non_key_columns = [col for col in table.columns if not col.primary_key and col not in fk_columns]

        # Group columns by potential entity they describe
        entity_groups = {}

        for column in non_key_columns:
            col_name = column.physical_name.lower()

            # Check if column name suggests it belongs to a referenced entity
            for fk in fk_columns:
                fk_name = fk.physical_name.lower().replace('_id', '').replace('id', '')

                if fk_name and fk_name in col_name and len(fk_name) > 2:
                    if fk.id not in entity_groups:
                        entity_groups[fk.id] = []
                    entity_groups[fk.id].append(column)

        # Report potential transitive dependencies
        for fk_id, dependent_columns in entity_groups.items():
            if dependent_columns:
                fk_column = table.get_column(fk_id)
                if fk_column:
                    col_names = ', '.join([col.physical_name for col in dependent_columns])
                    self.issues.append(NormalizationIssue(
                        level='3NF',
                        table_id=table.id,
                        table_name=table.physical_name,
                        issue_type='transitive_dependency',
                        description=f"Columns ({col_names}) may transitively depend on '{fk_column.physical_name}'",
                        suggestion=f"Consider moving these columns to the referenced table"
                    ))

    def _check_general_issues(self, table: Table):
        """Check general database design issues"""

        # Check for missing primary key
        if not table.has_primary_key():
            self.issues.append(NormalizationIssue(
                level='General',
                table_id=table.id,
                table_name=table.physical_name,
                issue_type='no_primary_key',
                description=f"Table '{table.physical_name}' has no primary key",
                suggestion="Add a primary key column (e.g., 'id') to uniquely identify rows"
            ))

        # Check for too many columns (potential normalization issue)
        if len(table.columns) > 15:
            self.issues.append(NormalizationIssue(
                level='General',
                table_id=table.id,
                table_name=table.physical_name,
                issue_type='too_many_columns',
                description=f"Table '{table.physical_name}' has {len(table.columns)} columns",
                suggestion="Consider splitting into multiple related tables if columns represent different entities"
            ))

        # Check for columns with NULL values allowed for important data
        important_keywords = ['name', 'title', 'code', 'type', 'status']
        for column in table.columns:
            if not column.primary_key and column.nullable:
                col_lower = column.physical_name.lower()
                if any(keyword in col_lower for keyword in important_keywords):
                    self.issues.append(NormalizationIssue(
                        level='General',
                        table_id=table.id,
                        table_name=table.physical_name,
                        issue_type='nullable_important_field',
                        description=f"Important column '{column.physical_name}' allows NULL values",
                        suggestion="Consider making this column NOT NULL if it should always have a value"
                    ))

        # Check for potential duplication indicators
        duplicate_keywords = ['copy', 'backup', 'temp', 'old', 'new']
        for column in table.columns:
            col_lower = column.physical_name.lower()
            if any(keyword in col_lower for keyword in duplicate_keywords):
                self.issues.append(NormalizationIssue(
                    level='General',
                    table_id=table.id,
                    table_name=table.physical_name,
                    issue_type='potential_duplication',
                    description=f"Column '{column.physical_name}' name suggests data duplication",
                    suggestion="Review if this represents duplicated data that could be normalized"
                ))

    def get_summary(self) -> Dict:
        """
        Get summary of normalization analysis.

        Returns:
            Summary statistics
        """
        summary = {
            'total_issues': len(self.issues),
            'by_level': {},
            'by_type': {},
            'tables_with_issues': len(set(issue.table_id for issue in self.issues)),
            'total_tables': len(self.diagram.tables)
        }

        for issue in self.issues:
            # Count by level
            if issue.level not in summary['by_level']:
                summary['by_level'][issue.level] = 0
            summary['by_level'][issue.level] += 1

            # Count by type
            if issue.issue_type not in summary['by_type']:
                summary['by_type'][issue.issue_type] = 0
            summary['by_type'][issue.issue_type] += 1

        return summary

    def get_recommendations(self) -> List[str]:
        """
        Get general recommendations for improving normalization.

        Returns:
            List of recommendation strings
        """
        recommendations = []

        summary = self.get_summary()

        if summary['total_issues'] == 0:
            recommendations.append("✓ No normalization issues detected")
        else:
            if '1NF' in summary['by_level']:
                recommendations.append("• Review repeating groups and non-atomic values")

            if '2NF' in summary['by_level']:
                recommendations.append("• Check partial dependencies in tables with composite keys")

            if '3NF' in summary['by_level']:
                recommendations.append("• Look for transitive dependencies between columns")

            if summary.get('by_type', {}).get('no_primary_key', 0) > 0:
                recommendations.append("• Add primary keys to all tables")

            if summary.get('by_type', {}).get('too_many_columns', 0) > 0:
                recommendations.append("• Consider decomposing large tables")

        return recommendations
