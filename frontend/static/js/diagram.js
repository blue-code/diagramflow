// Python ERD Tool - Diagram Editor

class ERDEditor {
    constructor() {
        this.diagram = null;
        this.currentDiagramId = null;
        this.selectedTable = null;
        this.draggedTable = null;
        this.dragOffset = { x: 0, y: 0 };

        this.init();
    }

    init() {
        this.createNewDiagram();
        this.bindEvents();
        this.render();
    }

    // ==================== Diagram Management ====================

    createNewDiagram() {
        this.diagram = {
            id: this.generateId(),
            name: 'Untitled Diagram',
            description: '',
            database_type: 'mysql',
            version: '1.0',
            tables: [],
            relationships: [],
            metadata: {}
        };
        this.currentDiagramId = null;
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;
    }

    async saveDiagram() {
        try {
            this.diagram.name = document.getElementById('diagram-name').value || 'Untitled Diagram';
            this.diagram.database_type = document.getElementById('diagram-db-type').value;

            const url = this.currentDiagramId
                ? `/api/diagrams/${this.currentDiagramId}`
                : '/api/diagrams';

            const method = this.currentDiagramId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.diagram)
            });

            const result = await response.json();

            if (result.success) {
                this.currentDiagramId = result.diagram.id;
                alert('다이어그램이 저장되었습니다.');
            } else {
                alert('저장 실패: ' + result.error);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('저장 중 오류가 발생했습니다.');
        }
    }

    async loadDiagram() {
        try {
            const response = await fetch('/api/diagrams');
            const result = await response.json();

            if (result.success && result.diagrams.length > 0) {
                const diagramList = result.diagrams
                    .map((d, i) => `${i + 1}. ${d.name} (${d.table_count} tables)`)
                    .join('\n');

                const selection = prompt(`불러올 다이어그램 번호를 입력하세요:\n\n${diagramList}`);

                if (selection) {
                    const index = parseInt(selection) - 1;
                    if (index >= 0 && index < result.diagrams.length) {
                        const diagramId = result.diagrams[index].id;
                        await this.loadDiagramById(diagramId);
                    }
                }
            } else {
                alert('저장된 다이어그램이 없습니다.');
            }
        } catch (error) {
            console.error('Load error:', error);
            alert('불러오기 중 오류가 발생했습니다.');
        }
    }

    async loadDiagramById(diagramId) {
        try {
            const response = await fetch(`/api/diagrams/${diagramId}`);
            const result = await response.json();

            if (result.success) {
                this.diagram = result.diagram;
                this.currentDiagramId = diagramId;
                document.getElementById('diagram-name').value = this.diagram.name;
                document.getElementById('diagram-db-type').value = this.diagram.database_type;
                this.render();
            }
        } catch (error) {
            console.error('Load diagram error:', error);
        }
    }

    async exportDDL() {
        try {
            if (!this.currentDiagramId) {
                alert('먼저 다이어그램을 저장해주세요.');
                return;
            }

            const response = await fetch(`/api/diagrams/${this.currentDiagramId}/export/ddl`);
            const result = await response.json();

            if (result.success) {
                document.getElementById('ddl-output').textContent = result.ddl;
                this.showModal('ddl-modal');
            } else {
                alert('DDL 생성 실패: ' + result.error);
            }
        } catch (error) {
            console.error('Export DDL error:', error);
            alert('DDL 내보내기 중 오류가 발생했습니다.');
        }
    }

    // ==================== Table Management ====================

    addTable() {
        const table = {
            id: this.generateId(),
            physical_name: `table_${this.diagram.tables.length + 1}`,
            logical_name: '',
            columns: [],
            comment: '',
            position: { x: 100, y: 100 + (this.diagram.tables.length * 50) },
            categories: []
        };

        this.diagram.tables.push(table);
        this.render();
        this.editTable(table.id);
    }

    editTable(tableId) {
        const table = this.diagram.tables.find(t => t.id === tableId);
        if (!table) return;

        this.selectedTable = table;

        document.getElementById('table-physical-name').value = table.physical_name || '';
        document.getElementById('table-logical-name').value = table.logical_name || '';
        document.getElementById('table-comment').value = table.comment || '';

        this.renderColumnEditor(table);
        this.showModal('table-modal');
    }

    saveTableFromModal() {
        if (!this.selectedTable) return;

        this.selectedTable.physical_name = document.getElementById('table-physical-name').value;
        this.selectedTable.logical_name = document.getElementById('table-logical-name').value;
        this.selectedTable.comment = document.getElementById('table-comment').value;

        // Update columns from editor
        const columnRows = document.querySelectorAll('.column-row');
        this.selectedTable.columns = Array.from(columnRows).map(row => {
            return {
                id: row.dataset.columnId || this.generateId(),
                physical_name: row.querySelector('.col-physical-name').value,
                logical_name: row.querySelector('.col-logical-name').value,
                data_type: row.querySelector('.col-data-type').value,
                length: parseInt(row.querySelector('.col-length').value) || null,
                nullable: !row.querySelector('.col-not-null').checked,
                primary_key: row.querySelector('.col-pk').checked,
                unique: false,
                auto_increment: false,
                default_value: null,
                comment: '',
                foreign_key: null
            };
        });

        this.hideModal('table-modal');
        this.render();
    }

    deleteTable(tableId) {
        if (confirm('이 테이블을 삭제하시겠습니까?')) {
            this.diagram.tables = this.diagram.tables.filter(t => t.id !== tableId);
            this.diagram.relationships = this.diagram.relationships.filter(
                r => r.source_table_id !== tableId && r.target_table_id !== tableId
            );
            this.render();
        }
    }

    renderColumnEditor(table) {
        const container = document.getElementById('columns-container');
        container.innerHTML = '';

        table.columns.forEach(column => {
            container.appendChild(this.createColumnRow(column));
        });
    }

    createColumnRow(column = null) {
        const row = document.createElement('div');
        row.className = 'column-row';
        if (column) row.dataset.columnId = column.id;

        row.innerHTML = `
            <input type="text" class="col-physical-name" placeholder="column_name" value="${column?.physical_name || ''}">
            <input type="text" class="col-logical-name" placeholder="컬럼명" value="${column?.logical_name || ''}">
            <select class="col-data-type">
                <option value="string" ${column?.data_type === 'string' ? 'selected' : ''}>VARCHAR</option>
                <option value="integer" ${column?.data_type === 'integer' ? 'selected' : ''}>INT</option>
                <option value="bigint" ${column?.data_type === 'bigint' ? 'selected' : ''}>BIGINT</option>
                <option value="text" ${column?.data_type === 'text' ? 'selected' : ''}>TEXT</option>
                <option value="datetime" ${column?.data_type === 'datetime' ? 'selected' : ''}>DATETIME</option>
                <option value="boolean" ${column?.data_type === 'boolean' ? 'selected' : ''}>BOOLEAN</option>
            </select>
            <input type="number" class="col-length" placeholder="길이" value="${column?.length || ''}" style="width: 60px;">
            <label><input type="checkbox" class="col-pk" ${column?.primary_key ? 'checked' : ''}> PK</label>
            <label><input type="checkbox" class="col-not-null" ${!column?.nullable ? 'checked' : ''}> NN</label>
            <button class="btn-remove-column" onclick="this.parentElement.remove()">삭제</button>
        `;

        return row;
    }

    // ==================== Rendering ====================

    render() {
        this.renderCanvas();
        this.renderTableList();
        this.renderStatistics();
    }

    renderCanvas() {
        const tablesLayer = document.getElementById('tables-layer');
        const relationshipsLayer = document.getElementById('relationships-layer');

        tablesLayer.innerHTML = '';
        relationshipsLayer.innerHTML = '';

        // Render relationships first (so they appear behind tables)
        this.diagram.relationships.forEach(rel => {
            this.renderRelationship(rel, relationshipsLayer);
        });

        // Render tables
        this.diagram.tables.forEach(table => {
            this.renderTable(table, tablesLayer);
        });
    }

    renderTable(table, container) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('table-box');
        g.dataset.tableId = table.id;

        const width = 250;
        const headerHeight = 30;
        const rowHeight = 20;
        const bodyHeight = Math.max(table.columns.length * rowHeight, 40);

        // Table header
        const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        header.classList.add('table-header');
        header.setAttribute('x', table.position.x);
        header.setAttribute('y', table.position.y);
        header.setAttribute('width', width);
        header.setAttribute('height', headerHeight);
        header.setAttribute('rx', 5);
        g.appendChild(header);

        // Table title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.classList.add('table-title');
        title.setAttribute('x', table.position.x + width / 2);
        title.setAttribute('y', table.position.y + 20);
        title.setAttribute('text-anchor', 'middle');
        title.textContent = table.logical_name || table.physical_name;
        g.appendChild(title);

        // Table body
        const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        body.classList.add('table-body');
        body.setAttribute('x', table.position.x);
        body.setAttribute('y', table.position.y + headerHeight);
        body.setAttribute('width', width);
        body.setAttribute('height', bodyHeight);
        g.appendChild(body);

        // Columns
        table.columns.forEach((column, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.classList.add('column-text');
            text.setAttribute('x', table.position.x + 10);
            text.setAttribute('y', table.position.y + headerHeight + 15 + (index * rowHeight));

            const pkMark = column.primary_key ? '🔑 ' : '   ';
            const colName = column.logical_name || column.physical_name;
            const dataType = column.data_type.toUpperCase();
            text.textContent = `${pkMark}${colName} (${dataType})`;

            g.appendChild(text);
        });

        // Make draggable
        g.addEventListener('mousedown', (e) => this.startDrag(e, table));
        g.addEventListener('contextmenu', (e) => this.showContextMenu(e, table));

        container.appendChild(g);
    }

    renderRelationship(rel, container) {
        const sourceTable = this.diagram.tables.find(t => t.id === rel.source_table_id);
        const targetTable = this.diagram.tables.find(t => t.id === rel.target_table_id);

        if (!sourceTable || !targetTable) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('relationship-line');
        line.setAttribute('x1', sourceTable.position.x + 125);
        line.setAttribute('y1', sourceTable.position.y + 15);
        line.setAttribute('x2', targetTable.position.x + 125);
        line.setAttribute('y2', targetTable.position.y + 15);

        container.appendChild(line);
    }

    renderTableList() {
        const listContainer = document.getElementById('table-list');

        if (this.diagram.tables.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">테이블이 없습니다</div>';
            return;
        }

        listContainer.innerHTML = this.diagram.tables.map(table => `
            <div class="table-list-item" onclick="app.editTable('${table.id}')">
                <strong>${table.logical_name || table.physical_name}</strong>
                <div style="font-size: 0.8rem; color: #666;">
                    ${table.columns.length} columns
                </div>
            </div>
        `).join('');
    }

    renderStatistics() {
        const totalColumns = this.diagram.tables.reduce((sum, t) => sum + t.columns.length, 0);

        document.getElementById('stat-tables').textContent = this.diagram.tables.length;
        document.getElementById('stat-relationships').textContent = this.diagram.relationships.length;
        document.getElementById('stat-columns').textContent = totalColumns;
    }

    // ==================== Event Handling ====================

    bindEvents() {
        document.getElementById('btn-new').addEventListener('click', () => {
            if (confirm('새 다이어그램을 만드시겠습니까? 저장하지 않은 변경사항은 손실됩니다.')) {
                this.createNewDiagram();
                this.render();
            }
        });

        document.getElementById('btn-save').addEventListener('click', () => this.saveDiagram());
        document.getElementById('btn-load').addEventListener('click', () => this.loadDiagram());
        document.getElementById('btn-export-ddl').addEventListener('click', () => this.exportDDL());
        document.getElementById('btn-add-table').addEventListener('click', () => this.addTable());

        document.getElementById('btn-add-column').addEventListener('click', () => {
            const container = document.getElementById('columns-container');
            container.appendChild(this.createColumnRow());
        });

        document.getElementById('btn-save-table').addEventListener('click', () => this.saveTableFromModal());

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.hideModal(modal.id);
            });
        });

        document.getElementById('btn-copy-ddl').addEventListener('click', () => {
            const ddl = document.getElementById('ddl-output').textContent;
            navigator.clipboard.writeText(ddl).then(() => {
                alert('DDL이 클립보드에 복사되었습니다.');
            });
        });

        // Canvas drag
        const canvas = document.getElementById('canvas');
        canvas.addEventListener('mousemove', (e) => this.onDrag(e));
        canvas.addEventListener('mouseup', () => this.stopDrag());
    }

    startDrag(e, table) {
        e.stopPropagation();
        this.draggedTable = table;
        this.dragOffset = {
            x: e.clientX - table.position.x,
            y: e.clientY - table.position.y
        };
    }

    onDrag(e) {
        if (this.draggedTable) {
            this.draggedTable.position.x = e.clientX - this.dragOffset.x;
            this.draggedTable.position.y = e.clientY - this.dragOffset.y;
            this.render();
        }
    }

    stopDrag() {
        this.draggedTable = null;
    }

    showContextMenu(e, table) {
        e.preventDefault();
        const menu = document.getElementById('context-menu');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.style.display = 'block';

        document.getElementById('menu-edit').onclick = () => {
            this.editTable(table.id);
            menu.style.display = 'none';
        };

        document.getElementById('menu-delete').onclick = () => {
            this.deleteTable(table.id);
            menu.style.display = 'none';
        };

        document.addEventListener('click', () => {
            menu.style.display = 'none';
        }, { once: true });
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // ==================== Utilities ====================

    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ERDEditor();
});
