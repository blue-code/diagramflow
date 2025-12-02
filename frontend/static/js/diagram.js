// Python ERD Tool - Diagram Editor

class ERDEditor {
    constructor() {
        this.diagram = null;
        this.currentDiagramId = null;
        this.selectedTable = null;
        this.selectedRelationship = null;
        this.draggedTable = null;
        this.dragOffset = { x: 0, y: 0 };

        // i18n helper method
        this.t = (key, params = {}) => {
            return window.i18n ? window.i18n.t(key, params) : key;
        };
        this.autoSaveTimeout = null;
        this.autoSaveDelay = 2000; // 2 seconds debounce

        // Undo/Redo history
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        this.isUndoRedoAction = false;

        // Table search/filter
        this.tableSearchFilter = '';

        // Zoom/Pan state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        // View mode: 'both', 'physical', 'logical'
        this.viewMode = 'both';

        // Column Dictionary
        this.columnDictionary = this.loadDictionary();
        this.selectedDictEntry = null;

        this.init();
    }

    async init() {
        // Check URL for diagram ID BEFORE creating new diagram
        const diagramId = this.getDiagramIdFromURL();

        if (diagramId) {
            // URL has a diagram ID - create blank diagram first (without clearing URL)
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

            this.bindEvents();
            this.updateDictionaryCount();

            // Load the diagram from URL
            await this.loadDiagramById(diagramId);
        } else {
            // No URL parameter - create new diagram normally
            this.createNewDiagram();
            this.bindEvents();
            this.updateDictionaryCount();
            this.render();
        }
    }

    getDiagramIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('diagram') || urlParams.get('id');
    }

    updateURL(diagramId) {
        if (!diagramId) {
            // Remove diagram parameter from URL
            const url = new URL(window.location);
            url.searchParams.delete('diagram');
            url.searchParams.delete('id');
            window.history.pushState({}, '', url);
            return;
        }

        // Add/update diagram parameter in URL
        const url = new URL(window.location);
        url.searchParams.set('diagram', diagramId);
        window.history.pushState({ diagramId }, '', url);
    }

    getShareableURL() {
        if (!this.currentDiagramId) {
            return window.location.origin + window.location.pathname;
        }

        const url = new URL(window.location);
        url.searchParams.set('diagram', this.currentDiagramId);
        return url.toString();
    }

    async copyShareableURL() {
        if (!this.currentDiagramId) {
            alert(this.t('messages.saveBeforeShare'));
            return;
        }

        const url = this.getShareableURL();

        try {
            await navigator.clipboard.writeText(url);
            this.showNotification('URL이 클립보드에 복사되었습니다!', 'success');
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                this.showNotification('URL이 클립보드에 복사되었습니다!', 'success');
            } catch (err) {
                console.error('Failed to copy URL:', err);
                prompt(this.t('messages.copyUrlPrompt'), url);
            }

            document.body.removeChild(textArea);
        }
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
        // Clear URL parameters for new diagram
        this.updateURL(null);
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;
    }

    // Auto-save with debounce
    autoSave() {
        // Auto-save even for new diagrams (will create them automatically)
        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Set saving status
        this.setSaveStatus('saving', '저장 중...');

        // Debounce: wait before actually saving
        this.autoSaveTimeout = setTimeout(() => {
            this._saveDiagram();
        }, this.autoSaveDelay);
    }

    // Update save status indicator
    setSaveStatus(status, text) {
        const statusElement = document.getElementById('save-status');
        const textElement = statusElement.querySelector('.save-status-text');

        // Remove all status classes
        statusElement.classList.remove('saving', 'saved', 'error');

        // Add new status class
        if (status) {
            statusElement.classList.add(status);
        }

        // Update text
        if (text) {
            textElement.textContent = text;
        }
    }

    async _saveDiagram() {
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
                // Update local diagram with new version
                this.diagram = result.diagram;

                // Clear any saved draft since save succeeded
                this.clearDraft();

                // Update URL with diagram ID
                this.updateURL(this.currentDiagramId);

                this.setSaveStatus('saved', '저장됨');
                // Auto-hide success status after 3 seconds
                setTimeout(() => {
                    if (document.getElementById('save-status').classList.contains('saved')) {
                        this.setSaveStatus('', '저장됨');
                    }
                }, 3000);
            } else if (result.error_type === 'version_conflict') {
                // Version conflict - save current state as draft before reloading
                this.saveDraft();
                this.setSaveStatus('error', '충돌 발생');

                if (confirm(this.t('messages.versionConflict', { message: result.message }))) {
                    await this.loadDiagramById(this.currentDiagramId);
                }
            } else {
                this.setSaveStatus('error', '저장 실패');
                this.showNotification('저장 실패: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.setSaveStatus('error', '저장 실패');
            this.showNotification('저장 중 오류가 발생했습니다.', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                font-weight: 500;
                animation: slideIn 0.3s ease-out;
            `;
            document.body.appendChild(notification);
        }

        // Set colors based on type
        const colors = {
            success: { bg: '#48bb78', text: 'white' },
            error: { bg: '#f56565', text: 'white' },
            warning: { bg: '#ed8936', text: 'white' },
            info: { bg: '#4299e1', text: 'white' }
        };

        const color = colors[type] || colors.info;
        notification.style.backgroundColor = color.bg;
        notification.style.color = color.text;
        notification.textContent = message;
        notification.style.display = 'block';

        // Auto hide after 3 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    async loadDiagram() {
        try {
            const response = await fetch('/api/diagrams');
            const result = await response.json();

            if (result.success && result.diagrams.length > 0) {
                this.showDiagramListModal(result.diagrams);
            } else {
                alert(this.t('messages.noDiagramsSaved'));
            }
        } catch (error) {
            console.error('Load error:', error);
            alert(this.t('messages.loadError'));
        }
    }

    showDiagramListModal(diagrams) {
        const container = document.getElementById('diagram-list-container');

        if (!diagrams || diagrams.length === 0) {
            container.innerHTML = '<div class="empty-state">저장된 다이어그램이 없습니다.</div>';
            this.showModal('diagram-list-modal');
            return;
        }

        container.innerHTML = diagrams.map(diagram => `
            <div class="diagram-list-item" data-diagram-id="${diagram.id}">
                <div class="diagram-info">
                    <div class="diagram-name">${diagram.name}</div>
                    <div class="diagram-meta">
                        <span>📊 ${diagram.table_count} 테이블</span>
                        <span>🔗 ${diagram.relationship_count || 0} 관계</span>
                        <span>📅 ${new Date(diagram.updated_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                </div>
                <div class="diagram-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.loadDiagramById('${diagram.id}'); app.hideModal('diagram-list-modal');">불러오기</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteDiagram('${diagram.id}')">삭제</button>
                </div>
            </div>
        `).join('');

        this.showModal('diagram-list-modal');
    }

    async deleteDiagram(diagramId) {
        if (!confirm(this.t('messages.confirmDeleteDiagram'))) {
            return;
        }

        try {
            const response = await fetch(`/api/diagrams/${diagramId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('다이어그램이 삭제되었습니다.', 'success');

                // If deleted diagram is currently open, create new diagram
                if (this.currentDiagramId === diagramId) {
                    this.createNewDiagram();
                    this.render();
                }

                // Refresh the diagram list
                const listResponse = await fetch('/api/diagrams');
                const listResult = await listResponse.json();

                if (listResult.success) {
                    this.showDiagramListModal(listResult.diagrams);
                }
            } else {
                this.showNotification('삭제 실패: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showNotification('삭제 중 오류가 발생했습니다.', 'error');
        }
    }

    async loadDiagramById(diagramId) {
        try {
            const response = await fetch(`/api/diagrams/${diagramId}`);
            const result = await response.json();

            if (result.success) {
                const serverDiagram = result.diagram;

                // Check if there's a saved draft for this diagram
                if (this.hasDraft(diagramId)) {
                    const draft = this.loadDraft(diagramId);

                    // Show merge modal to let user choose
                    this.showMergeModal(draft, serverDiagram);
                } else {
                    // No draft, just load server version
                    this.diagram = serverDiagram;
                    this.currentDiagramId = diagramId;
                    document.getElementById('diagram-name').value = this.diagram.name;
                    document.getElementById('diagram-db-type').value = this.diagram.database_type;
                    this.render();
                }

                // Update URL with diagram ID
                this.updateURL(diagramId);
                this.showNotification(`"${this.diagram.name}" 다이어그램을 불러왔습니다.`, 'success');
            } else {
                this.showNotification('다이어그램을 불러올 수 없습니다.', 'error');
            }
        } catch (error) {
            console.error('Load diagram error:', error);
            this.showNotification('다이어그램 로드 중 오류가 발생했습니다.', 'error');
        }
    }

    async exportDDL() {
        try {
            if (!this.currentDiagramId) {
                alert(this.t('messages.saveBeforeExport'));
                return;
            }

            const response = await fetch(`/api/diagrams/${this.currentDiagramId}/export/ddl`);
            const result = await response.json();

            if (result.success) {
                document.getElementById('ddl-output').textContent = result.ddl;
                this.showModal('ddl-modal');
            } else {
                alert(this.t('messages.ddlGenerateError', { error: result.error }));
            }
        } catch (error) {
            console.error('Export DDL error:', error);
            alert(this.t('messages.ddlExportError'));
        }
    }

    exportToImage() {
        try {
            const svg = document.getElementById('canvas');
            const svgData = new XMLSerializer().serializeToString(svg);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${this.diagram.name || 'diagram'}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                    this.showNotification('이미지 내보내기 완료', 'success');
                });
            };

            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            img.src = url;
        } catch (error) {
            console.error('Export image error:', error);
            this.showNotification('이미지 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    // ==================== Relationship Management ====================

    addRelationship() {
        if (this.diagram.tables.length < 2) {
            alert(this.t('messages.needTwoTables'));
            return;
        }

        this.selectedRelationship = null;
        this.clearRelationshipModal();
        this.populateRelationshipTableSelects();

        document.getElementById('relationship-modal-title').textContent = '관계 추가';
        this.showModal('relationship-modal');
    }

    editRelationship(relId) {
        const rel = this.diagram.relationships.find(r => r.id === relId);
        if (!rel) return;

        this.selectedRelationship = rel;
        this.populateRelationshipTableSelects();

        document.getElementById('rel-name').value = rel.name || '';
        document.getElementById('rel-source-table').value = rel.source_table_id;
        document.getElementById('rel-target-table').value = rel.target_table_id;
        document.getElementById('rel-cardinality').value = rel.cardinality;
        document.getElementById('rel-on-delete').value = rel.on_delete || 'RESTRICT';
        document.getElementById('rel-on-update').value = rel.on_update || 'CASCADE';
        document.getElementById('rel-comment').value = rel.comment || '';

        // Populate columns for selected tables
        this.populateRelationshipColumnSelects('source', rel.source_table_id);
        this.populateRelationshipColumnSelects('target', rel.target_table_id);

        // Select the columns
        setTimeout(() => {
            const sourceSelect = document.getElementById('rel-source-columns');
            const targetSelect = document.getElementById('rel-target-columns');

            Array.from(sourceSelect.options).forEach(opt => {
                opt.selected = rel.source_column_ids.includes(opt.value);
            });

            Array.from(targetSelect.options).forEach(opt => {
                opt.selected = rel.target_column_ids.includes(opt.value);
            });
        }, 50);

        document.getElementById('relationship-modal-title').textContent = '관계 편집';
        this.showModal('relationship-modal');
    }

    saveRelationshipFromModal() {
        const sourceTableId = document.getElementById('rel-source-table').value;
        const targetTableId = document.getElementById('rel-target-table').value;
        const sourceColumnIds = Array.from(document.getElementById('rel-source-columns').selectedOptions).map(opt => opt.value);
        const targetColumnIds = Array.from(document.getElementById('rel-target-columns').selectedOptions).map(opt => opt.value);

        if (!sourceTableId || !targetTableId) {
            alert(this.t('messages.selectBothTables'));
            return;
        }

        if (sourceColumnIds.length === 0 || targetColumnIds.length === 0) {
            alert(this.t('messages.selectBothColumns'));
            return;
        }

        if (sourceColumnIds.length !== targetColumnIds.length) {
            alert(this.t('messages.columnCountMismatch'));
            return;
        }

        this.saveHistory(); // Save history before changes

        const relationship = {
            id: this.selectedRelationship?.id || this.generateId(),
            name: document.getElementById('rel-name').value || null,
            source_table_id: sourceTableId,
            target_table_id: targetTableId,
            source_column_ids: sourceColumnIds,
            target_column_ids: targetColumnIds,
            cardinality: document.getElementById('rel-cardinality').value,
            on_delete: document.getElementById('rel-on-delete').value,
            on_update: document.getElementById('rel-on-update').value,
            comment: document.getElementById('rel-comment').value || ''
        };

        if (this.selectedRelationship) {
            // Update existing relationship
            const index = this.diagram.relationships.findIndex(r => r.id === this.selectedRelationship.id);
            if (index !== -1) {
                this.diagram.relationships[index] = relationship;
            }
        } else {
            // Add new relationship
            this.diagram.relationships.push(relationship);
        }

        // Update foreign_key in target columns
        this.updateForeignKeyReferences(relationship);

        this.hideModal('relationship-modal');
        this.render();
        this.autoSave(); // Trigger auto-save
    }

    deleteRelationship(relId) {
        if (confirm(this.t('messages.confirmDeleteRelationship'))) {
            this.saveHistory(); // Save history before deletion
            const rel = this.diagram.relationships.find(r => r.id === relId);
            if (rel) {
                // Clear foreign_key references in target columns
                const targetTable = this.diagram.tables.find(t => t.id === rel.target_table_id);
                if (targetTable) {
                    rel.target_column_ids.forEach(colId => {
                        const column = targetTable.columns.find(c => c.id === colId);
                        if (column) {
                            column.foreign_key = null;
                        }
                    });
                }
            }

            this.diagram.relationships = this.diagram.relationships.filter(r => r.id !== relId);
            this.render();
            this.autoSave(); // Trigger auto-save
        }
    }

    updateForeignKeyReferences(relationship) {
        const targetTable = this.diagram.tables.find(t => t.id === relationship.target_table_id);
        if (!targetTable) return;

        relationship.target_column_ids.forEach((colId, index) => {
            const column = targetTable.columns.find(c => c.id === colId);
            if (column) {
                column.foreign_key = {
                    table_id: relationship.source_table_id,
                    column_id: relationship.source_column_ids[index]
                };
            }
        });
    }

    clearRelationshipModal() {
        document.getElementById('rel-name').value = '';
        document.getElementById('rel-source-table').value = '';
        document.getElementById('rel-target-table').value = '';
        document.getElementById('rel-source-columns').innerHTML = '';
        document.getElementById('rel-target-columns').innerHTML = '';
        document.getElementById('rel-cardinality').value = '1:N';
        document.getElementById('rel-on-delete').value = 'RESTRICT';
        document.getElementById('rel-on-update').value = 'CASCADE';
        document.getElementById('rel-comment').value = '';
    }

    populateRelationshipTableSelects() {
        const sourceSelect = document.getElementById('rel-source-table');
        const targetSelect = document.getElementById('rel-target-table');

        const currentSourceValue = sourceSelect.value;
        const currentTargetValue = targetSelect.value;

        sourceSelect.innerHTML = '<option value="">-- 테이블 선택 --</option>';
        targetSelect.innerHTML = '<option value="">-- 테이블 선택 --</option>';

        this.diagram.tables.forEach(table => {
            const displayName = table.logical_name || table.physical_name;
            sourceSelect.innerHTML += `<option value="${table.id}">${displayName}</option>`;
            targetSelect.innerHTML += `<option value="${table.id}">${displayName}</option>`;
        });

        if (currentSourceValue) sourceSelect.value = currentSourceValue;
        if (currentTargetValue) targetSelect.value = currentTargetValue;
    }

    populateRelationshipColumnSelects(type, tableId) {
        const selectId = type === 'source' ? 'rel-source-columns' : 'rel-target-columns';
        const select = document.getElementById(selectId);

        select.innerHTML = '';

        if (!tableId) return;

        const table = this.diagram.tables.find(t => t.id === tableId);
        if (!table) return;

        table.columns.forEach(column => {
            const displayName = column.logical_name || column.physical_name;
            const dataType = column.data_type.toUpperCase();
            const pkMark = column.primary_key ? '🔑 ' : '';
            select.innerHTML += `<option value="${column.id}">${pkMark}${displayName} (${dataType})</option>`;
        });
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
        // Note: Auto-save will be triggered when user saves the table modal
    }

    editTable(tableId) {
        const table = this.diagram.tables.find(t => t.id === tableId);
        if (!table) return;

        this.selectedTable = table;

        document.getElementById('table-physical-name').value = table.physical_name || '';
        document.getElementById('table-logical-name').value = table.logical_name || '';
        document.getElementById('table-comment').value = table.comment || '';
        document.getElementById('table-category').value = table.category || '';

        this.renderColumnEditor(table);
        this.showModal('table-modal');
    }

    saveTableFromModal() {
        if (!this.selectedTable) return;

        this.saveHistory(); // Save history before changes

        this.selectedTable.physical_name = document.getElementById('table-physical-name').value;
        this.selectedTable.logical_name = document.getElementById('table-logical-name').value;
        this.selectedTable.comment = document.getElementById('table-comment').value;
        this.selectedTable.category = document.getElementById('table-category').value;

        // Update columns from editor
        const columnRows = document.querySelectorAll('.column-row');
        this.selectedTable.columns = Array.from(columnRows).map(row => {
            const columnId = row.dataset.columnId;

            // Find existing column to preserve foreign_key
            const existingColumn = columnId
                ? this.selectedTable.columns.find(c => c.id === columnId)
                : null;

            return {
                id: columnId || this.generateId(),
                physical_name: row.querySelector('.col-physical-name').value,
                logical_name: row.querySelector('.col-logical-name').value,
                data_type: row.querySelector('.col-data-type').value,
                length: parseInt(row.querySelector('.col-length').value) || null,
                nullable: !row.querySelector('.col-not-null').checked,
                primary_key: row.querySelector('.col-pk').checked,
                indexed: row.querySelector('.col-indexed').checked,
                unique: false,
                auto_increment: false,
                default_value: null,
                comment: '',
                foreign_key: existingColumn?.foreign_key || null  // Preserve FK
            };
        });

        this.hideModal('table-modal');
        this.render();
        this.autoSave(); // Trigger auto-save
    }

    deleteTable(tableId) {
        if (confirm(this.t('messages.confirmDeleteTable'))) {
            this.saveHistory(); // Save history before deletion
            this.diagram.tables = this.diagram.tables.filter(t => t.id !== tableId);
            this.diagram.relationships = this.diagram.relationships.filter(
                r => r.source_table_id !== tableId && r.target_table_id !== tableId
            );
            this.render();
            this.autoSave(); // Trigger auto-save
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

        const isFK = column?.foreign_key && column?.foreign_key.table_id;
        const fkInfo = isFK ? `<span class="fk-badge" title="Foreign Key">FK</span>` : '';

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
            <label class="pk-label" title="Primary Key">
                <input type="checkbox" class="col-pk" ${column?.primary_key ? 'checked' : ''}>
                <span class="pk-text">🔑 PK</span>
            </label>
            <label class="nn-label" title="Not Null">
                <input type="checkbox" class="col-not-null" ${!column?.nullable ? 'checked' : ''}>
                <span>NN</span>
            </label>
            <label class="idx-label" title="Index">
                <input type="checkbox" class="col-indexed" ${column?.indexed ? 'checked' : ''}>
                <span>IDX</span>
            </label>
            ${fkInfo}
            <button class="btn-remove-column" onclick="this.parentElement.remove()">삭제</button>
        `;

        return row;
    }

    // ==================== Rendering ====================

    render() {
        this.renderCanvas();
        this.renderTableList();
        this.renderStatistics();
        this.updateEmptyStateGuide();
    }

    updateEmptyStateGuide() {
        const emptyGuide = document.getElementById('empty-state-guide');

        // Check if user has chosen not to show the guide again
        const dontShowAgain = localStorage.getItem('dontShowGuideAgain') === 'true';

        // Show guide only when there are no tables and user hasn't disabled it
        if (this.diagram.tables.length === 0 && !dontShowAgain) {
            emptyGuide.style.display = 'block';
        } else {
            emptyGuide.style.display = 'none';
        }
    }

    hideGuideAndSavePreference() {
        const checkbox = document.getElementById('dont-show-guide-again');
        const emptyGuide = document.getElementById('empty-state-guide');

        // Hide the guide
        emptyGuide.style.display = 'none';

        // Save preference if checkbox is checked
        if (checkbox && checkbox.checked) {
            localStorage.setItem('dontShowGuideAgain', 'true');
        }
    }

    renderCanvas() {
        const tablesLayer = document.getElementById('tables-layer');
        const relationshipsLayer = document.getElementById('relationships-layer');

        tablesLayer.innerHTML = '';
        relationshipsLayer.innerHTML = '';

        // Apply zoom and pan transform
        const transform = `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`;
        tablesLayer.setAttribute('transform', transform);
        relationshipsLayer.setAttribute('transform', transform);

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

        // Display based on view mode
        let titleText = '';
        if (this.viewMode === 'physical') {
            titleText = table.physical_name;
        } else if (this.viewMode === 'logical') {
            titleText = table.logical_name || table.physical_name;
        } else { // 'both'
            if (table.logical_name) {
                titleText = `${table.logical_name} (${table.physical_name})`;
            } else {
                titleText = table.physical_name;
            }
        }
        title.textContent = titleText;
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

            // Determine if column is PK or FK
            const isPK = column.primary_key;
            const isFK = column.foreign_key && column.foreign_key.table_id;

            // Choose icon based on column type
            let icon = '   ';
            if (isPK && isFK) {
                icon = '🔑🔗 ';  // Both PK and FK
            } else if (isPK) {
                icon = '🔑 ';    // Primary Key
            } else if (isFK) {
                icon = '🔗 ';    // Foreign Key
            }

            // Display column name based on view mode
            let colName = '';
            if (this.viewMode === 'physical') {
                colName = column.physical_name;
            } else if (this.viewMode === 'logical') {
                colName = column.logical_name || column.physical_name;
            } else { // 'both'
                if (column.logical_name) {
                    colName = `${column.logical_name} (${column.physical_name})`;
                } else {
                    colName = column.physical_name;
                }
            }

            // Format data type with length
            let dataType = column.data_type.toUpperCase();
            if (column.length) {
                // Add length for types that support it
                if (['STRING', 'VARCHAR', 'CHAR'].includes(dataType)) {
                    dataType = `VARCHAR(${column.length})`;
                } else if (['INTEGER', 'INT'].includes(dataType)) {
                    dataType = `INT(${column.length})`;
                } else if (['BIGINT'].includes(dataType)) {
                    dataType = `BIGINT(${column.length})`;
                }
            } else {
                // Use default display names
                if (dataType === 'STRING') {
                    dataType = 'VARCHAR';
                } else if (dataType === 'INTEGER') {
                    dataType = 'INT';
                }
            }

            // Add nullable indicator
            const nullableIndicator = column.nullable ? '' : ' NN';

            text.textContent = `${icon}${colName} ${dataType}${nullableIndicator}`;

            // Add different styling for FK columns
            if (isFK && !isPK) {
                text.classList.add('fk-column');
            }
            if (isPK) {
                text.classList.add('pk-column');
            }

            g.appendChild(text);
        });

        // Make draggable
        g.addEventListener('mousedown', (e) => this.startDrag(e, table));
        g.addEventListener('contextmenu', (e) => this.showContextMenu(e, table));

        // Double-click to edit
        g.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editTable(table.id);
        });

        container.appendChild(g);
    }

    renderRelationship(rel, container) {
        const sourceTable = this.diagram.tables.find(t => t.id === rel.source_table_id);
        const targetTable = this.diagram.tables.find(t => t.id === rel.target_table_id);

        if (!sourceTable || !targetTable) return;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('relationship-group');
        g.dataset.relationshipId = rel.id;

        const x1 = sourceTable.position.x + 125;
        const y1 = sourceTable.position.y + 15;
        const x2 = targetTable.position.x + 125;
        const y2 = targetTable.position.y + 15;

        // Main relationship line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('relationship-line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line.style.cursor = 'pointer';

        // Cardinality labels
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Source cardinality (1 for source side)
        const sourceCard = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sourceCard.classList.add('cardinality-text');
        sourceCard.setAttribute('x', x1 + (x2 - x1) * 0.15);
        sourceCard.setAttribute('y', y1 + (y2 - y1) * 0.15 - 5);
        sourceCard.textContent = '1';

        // Target cardinality (depends on relationship type)
        const targetCard = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        targetCard.classList.add('cardinality-text');
        targetCard.setAttribute('x', x1 + (x2 - x1) * 0.85);
        targetCard.setAttribute('y', y1 + (y2 - y1) * 0.85 - 5);

        if (rel.cardinality === '1:1') {
            targetCard.textContent = '1';
        } else if (rel.cardinality === '1:N') {
            targetCard.textContent = 'N';
        } else if (rel.cardinality === 'N:N') {
            targetCard.textContent = 'N';
            sourceCard.textContent = 'N';
        }

        // Add click handler for editing
        g.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showRelationshipContextMenu(e, rel);
        });

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editRelationship(rel.id);
        });

        g.appendChild(line);
        g.appendChild(sourceCard);
        g.appendChild(targetCard);
        container.appendChild(g);
    }

    showRelationshipContextMenu(e, relationship) {
        const menu = document.getElementById('context-menu');
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.style.display = 'block';

        document.getElementById('menu-edit').onclick = () => {
            this.editRelationship(relationship.id);
            menu.style.display = 'none';
        };

        document.getElementById('menu-delete').onclick = () => {
            this.deleteRelationship(relationship.id);
            menu.style.display = 'none';
        };

        document.addEventListener('click', () => {
            menu.style.display = 'none';
        }, { once: true });
    }

    renderTableList() {
        const listContainer = document.getElementById('table-list');

        if (this.diagram.tables.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">테이블이 없습니다</div>';
            return;
        }

        // Filter tables based on search term
        const filteredTables = this.diagram.tables.filter(table => {
            if (!this.tableSearchFilter) return true;

            const searchTerm = this.tableSearchFilter.toLowerCase();
            const physicalName = (table.physical_name || '').toLowerCase();
            const logicalName = (table.logical_name || '').toLowerCase();

            return physicalName.includes(searchTerm) || logicalName.includes(searchTerm);
        });

        if (filteredTables.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">검색 결과가 없습니다</div>';
            return;
        }

        listContainer.innerHTML = filteredTables.map(table => `
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
            if (confirm(this.t('messages.confirmNewDiagram'))) {
                this.createNewDiagram();
                this.render();
            }
        });

        document.getElementById('btn-load').addEventListener('click', () => this.loadDiagram());
        document.getElementById('btn-export-ddl').addEventListener('click', () => this.exportDDL());
        document.getElementById('btn-export-image').addEventListener('click', () => this.exportToImage());
        document.getElementById('btn-copy-url').addEventListener('click', () => this.copyShareableURL());
        document.getElementById('btn-add-table').addEventListener('click', () => this.addTable());
        document.getElementById('btn-import-ddl').addEventListener('click', () => this.showDDLImport());
        document.getElementById('btn-execute-import').addEventListener('click', () => this.executeImport());
        document.getElementById('btn-add-relationship').addEventListener('click', () => this.addRelationship());

        // Undo/Redo buttons
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());

        // Zoom control buttons
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('btn-zoom-reset').addEventListener('click', () => this.resetZoom());
        document.getElementById('btn-fit-to-screen').addEventListener('click', () => this.fitToScreen());
        document.getElementById('btn-auto-layout').addEventListener('click', () => this.autoLayout());

        // Help button
        document.getElementById('btn-help').addEventListener('click', () => {
            this.showModal('help-modal');
        });

        // Start guide button
        document.getElementById('btn-start-guide').addEventListener('click', () => {
            this.hideGuideAndSavePreference();
            this.addTable();
        });

        // Load sample diagram button
        document.getElementById('btn-load-sample').addEventListener('click', () => {
            this.hideGuideAndSavePreference();
            this.loadSampleDiagram();
        });

        // Auto-save on diagram name or database type change
        document.getElementById('diagram-name').addEventListener('input', () => {
            this.autoSave();
        });

        document.getElementById('diagram-db-type').addEventListener('change', () => {
            this.autoSave();
        });

        // View mode change
        document.getElementById('view-mode').addEventListener('change', (e) => {
            this.viewMode = e.target.value;
            this.render();
        });

        // Table search/filter
        document.getElementById('table-search').addEventListener('input', (e) => {
            this.tableSearchFilter = e.target.value;
            this.renderTableList();
        });

        // Keyboard shortcuts for Undo/Redo
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z or Cmd+Z to undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z to redo
            else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
        });

        document.getElementById('btn-add-column').addEventListener('click', () => {
            const container = document.getElementById('columns-container');
            container.appendChild(this.createColumnRow());
        });

        document.getElementById('btn-add-from-dict').addEventListener('click', () => this.showDictSelection());

        document.getElementById('btn-manage-dictionary').addEventListener('click', () => this.showDictionaryManager());
        document.getElementById('btn-add-dict-entry').addEventListener('click', () => this.addDictEntry());
        document.getElementById('btn-save-dict-entry').addEventListener('click', () => this.saveDictEntry());

        // Dictionary search
        document.getElementById('dict-search').addEventListener('input', (e) => {
            this.renderDictSelectionList(e.target.value);
        });

        document.getElementById('btn-save-table').addEventListener('click', () => this.saveTableFromModal());
        document.getElementById('btn-save-relationship').addEventListener('click', () => this.saveRelationshipFromModal());

        // Relationship modal table selection handlers
        document.getElementById('rel-source-table').addEventListener('change', (e) => {
            this.populateRelationshipColumnSelects('source', e.target.value);
        });

        document.getElementById('rel-target-table').addEventListener('change', (e) => {
            this.populateRelationshipColumnSelects('target', e.target.value);
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this.hideModal(modal.id);
            });
        });

        document.getElementById('btn-copy-ddl').addEventListener('click', () => {
            const ddl = document.getElementById('ddl-output').textContent;
            navigator.clipboard.writeText(ddl).then(() => {
                alert(this.t('messages.ddlCopied'));
            });
        });

        // Canvas drag and pan
        const canvas = document.getElementById('canvas');
        canvas.addEventListener('mousedown', (e) => this.startPan(e));
        canvas.addEventListener('mousemove', (e) => {
            this.onDrag(e);
            this.onPan(e);
        });
        canvas.addEventListener('mouseup', (e) => {
            this.stopDrag();
            this.stopPan(e);
        });
        canvas.addEventListener('mouseleave', (e) => {
            this.stopDrag();
            this.stopPan(e);
        });

        // Zoom with mouse wheel
        canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
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
        if (this.draggedTable) {
            this.saveHistory(); // Save history after drag
            this.draggedTable = null;
            this.autoSave(); // Trigger auto-save after dragging
        }
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

    // ==================== Zoom/Pan Management ====================

    zoomIn() {
        this.zoom = Math.min(this.zoom * 1.2, 3.0); // Max zoom: 3x
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(this.zoom / 1.2, 0.1); // Min zoom: 0.1x
        this.render();
    }

    resetZoom() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
    }

    fitToScreen() {
        if (this.diagram.tables.length === 0) {
            this.resetZoom();
            return;
        }

        // Calculate bounding box of all tables
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.diagram.tables.forEach(table => {
            const x = table.position.x;
            const y = table.position.y;
            const width = 250; // Approximate table width
            const height = 80 + table.columns.length * 25; // Approximate table height

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });

        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Get canvas dimensions
        const canvas = document.getElementById('canvas');
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;

        // Calculate required zoom to fit all tables
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const zoomX = canvasWidth / contentWidth;
        const zoomY = canvasHeight / contentHeight;
        this.zoom = Math.min(zoomX, zoomY, 1.0); // Don't zoom in, only zoom out if needed

        // Center the content
        this.panX = (canvasWidth - contentWidth * this.zoom) / 2 - minX * this.zoom;
        this.panY = (canvasHeight - contentHeight * this.zoom) / 2 - minY * this.zoom;

        this.render();
        this.showNotification('전체 테이블이 화면에 맞춰졌습니다', 'success');
    }

    autoLayout() {
        if (this.diagram.tables.length === 0) {
            this.showNotification('재정렬할 테이블이 없습니다', 'warning');
            return;
        }

        this.saveHistory(); // Save before layout change

        // Simple grid layout algorithm
        const gridCols = Math.ceil(Math.sqrt(this.diagram.tables.length));
        const cellWidth = 320;
        const cellHeight = 280;
        const startX = 50;
        const startY = 50;

        // Sort tables by name for consistent layout
        const sortedTables = [...this.diagram.tables].sort((a, b) =>
            (a.physical_name || '').localeCompare(b.physical_name || '')
        );

        sortedTables.forEach((table, index) => {
            const col = index % gridCols;
            const row = Math.floor(index / gridCols);

            table.position = {
                x: startX + col * cellWidth,
                y: startY + row * cellHeight
            };
        });

        this.render();
        this.autoSave();
        this.showNotification(`${this.diagram.tables.length}개 테이블이 자동 정렬되었습니다`, 'success');

        // Fit to screen after layout
        setTimeout(() => this.fitToScreen(), 100);
    }

    handleWheel(e) {
        e.preventDefault();

        // Zoom with mouse wheel
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.1, Math.min(3.0, this.zoom * delta));

        this.render();
    }

    startPan(e) {
        // Only start panning if not clicking on a table
        if (e.target.tagName === 'svg' || e.target.id === 'canvas') {
            this.isPanning = true;
            this.panStart = {
                x: e.clientX - this.panX,
                y: e.clientY - this.panY
            };
            e.target.style.cursor = 'grabbing';
        }
    }

    onPan(e) {
        if (this.isPanning) {
            this.panX = e.clientX - this.panStart.x;
            this.panY = e.clientY - this.panStart.y;
            this.render();
        }
    }

    stopPan(e) {
        if (this.isPanning) {
            this.isPanning = false;
            if (e.target) {
                e.target.style.cursor = 'default';
            }
        }
    }

    // ==================== Undo/Redo Management ====================

    saveHistory() {
        // Don't save history during undo/redo operations
        if (this.isUndoRedoAction) return;

        // Create a deep copy of current diagram state
        const state = JSON.parse(JSON.stringify({
            tables: this.diagram.tables,
            relationships: this.diagram.relationships
        }));

        // Add to undo stack
        this.undoStack.push(state);

        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        // Clear redo stack when new action is performed
        this.redoStack = [];

        // Update undo/redo button states
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;

        // Save current state to redo stack
        const currentState = JSON.parse(JSON.stringify({
            tables: this.diagram.tables,
            relationships: this.diagram.relationships
        }));
        this.redoStack.push(currentState);

        // Get previous state
        const previousState = this.undoStack.pop();

        // Restore previous state
        this.isUndoRedoAction = true;
        this.diagram.tables = previousState.tables;
        this.diagram.relationships = previousState.relationships;
        this.isUndoRedoAction = false;

        // Re-render
        this.render();
        this.autoSave();

        // Update button states
        this.updateUndoRedoButtons();

        this.showNotification('실행 취소', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Save current state to undo stack
        const currentState = JSON.parse(JSON.stringify({
            tables: this.diagram.tables,
            relationships: this.diagram.relationships
        }));
        this.undoStack.push(currentState);

        // Get next state
        const nextState = this.redoStack.pop();

        // Restore next state
        this.isUndoRedoAction = true;
        this.diagram.tables = nextState.tables;
        this.diagram.relationships = nextState.relationships;
        this.isUndoRedoAction = false;

        // Re-render
        this.render();
        this.autoSave();

        // Update button states
        this.updateUndoRedoButtons();

        this.showNotification('다시 실행', 'info');
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
            undoBtn.style.opacity = this.undoStack.length === 0 ? '0.5' : '1';
        }

        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
            redoBtn.style.opacity = this.redoStack.length === 0 ? '0.5' : '1';
        }
    }

    // ==================== Draft Management ====================

    saveDraft() {
        if (!this.currentDiagramId) return;

        const draftKey = `diagram_draft_${this.currentDiagramId}`;
        const draftData = {
            diagram: this.diagram,
            timestamp: Date.now(),
            diagramId: this.currentDiagramId
        };

        try {
            localStorage.setItem(draftKey, JSON.stringify(draftData));
            console.log('Draft saved to localStorage');
        } catch (error) {
            console.error('Failed to save draft:', error);
        }
    }

    loadDraft(diagramId) {
        const draftKey = `diagram_draft_${diagramId}`;

        try {
            const draftJson = localStorage.getItem(draftKey);
            if (draftJson) {
                const draftData = JSON.parse(draftJson);
                return draftData.diagram;
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
        }

        return null;
    }

    hasDraft(diagramId) {
        const draftKey = `diagram_draft_${diagramId}`;
        return localStorage.getItem(draftKey) !== null;
    }

    clearDraft() {
        if (!this.currentDiagramId) return;

        const draftKey = `diagram_draft_${this.currentDiagramId}`;
        localStorage.removeItem(draftKey);
        console.log('Draft cleared from localStorage');
    }

    showMergeModal(draftDiagram, serverDiagram) {
        // Store both versions for comparison
        this.draftDiagram = draftDiagram;
        this.serverDiagram = serverDiagram;

        // Update merge comparison UI
        this.renderMergeComparison(draftDiagram, serverDiagram);

        // Show merge modal
        this.showModal('merge-modal');
    }

    renderMergeComparison(draftDiagram, serverDiagram) {
        const draftPreview = document.getElementById('draft-preview');
        const serverPreview = document.getElementById('server-preview');

        // Render draft version preview
        draftPreview.innerHTML = this.generateDiagramSummary(draftDiagram, '내 작업 내용');

        // Render server version preview
        serverPreview.innerHTML = this.generateDiagramSummary(serverDiagram, '서버 버전');
    }

    generateDiagramSummary(diagram, title) {
        const tableList = diagram.tables.map(table => {
            const columnCount = table.columns.length;
            const pkColumns = table.columns.filter(c => c.primary_key).length;
            return `
                <div class="table-summary-item">
                    <strong>${table.logical_name || table.physical_name}</strong>
                    <div class="table-summary-meta">
                        ${columnCount} 컬럼 | ${pkColumns} PK
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="merge-section">
                <h4>${title}</h4>
                <div class="merge-stats">
                    <div>테이블: ${diagram.tables.length}</div>
                    <div>관계: ${diagram.relationships.length}</div>
                    <div>버전: ${diagram.version}</div>
                </div>
                <div class="table-summary-list">
                    ${tableList || '<div class="empty-state">테이블 없음</div>'}
                </div>
            </div>
        `;
    }

    useDraftVersion() {
        if (!this.draftDiagram) return;

        // Use draft version
        this.diagram = this.draftDiagram;
        this.currentDiagramId = this.draftDiagram.id;
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;

        // Clear the draft since we're using it
        this.clearDraft();

        this.hideModal('merge-modal');
        this.render();

        this.showNotification('임시 저장된 작업 내용을 불러왔습니다.', 'success');
    }

    useServerVersion() {
        if (!this.serverDiagram) return;

        // Use server version
        this.diagram = this.serverDiagram;
        this.currentDiagramId = this.serverDiagram.id;
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;

        // Clear the draft since we're discarding it
        this.clearDraft();

        this.hideModal('merge-modal');
        this.render();

        this.showNotification('서버 버전을 불러왔습니다.', 'info');
    }

    mergeVersions() {
        if (!this.draftDiagram || !this.serverDiagram) return;

        // Smart merge: Keep server relationships but draft tables
        const mergedDiagram = {
            ...this.serverDiagram,
            tables: this.draftDiagram.tables,
            // Keep relationships from both, removing duplicates
            relationships: this.mergRelationships(
                this.draftDiagram.relationships,
                this.serverDiagram.relationships
            )
        };

        this.diagram = mergedDiagram;
        this.currentDiagramId = mergedDiagram.id;
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;

        // Clear the draft
        this.clearDraft();

        this.hideModal('merge-modal');
        this.render();

        this.showNotification('변경 사항을 병합했습니다. 저장하여 적용하세요.', 'warning');
    }

    mergRelationships(draftRels, serverRels) {
        // Combine relationships, preferring draft versions if IDs match
        const relMap = new Map();

        serverRels.forEach(rel => relMap.set(rel.id, rel));
        draftRels.forEach(rel => relMap.set(rel.id, rel)); // Overwrite if exists

        return Array.from(relMap.values());
    }

    // ==================== Sample Diagram ====================

    loadSampleDiagram() {
        if (this.diagram.tables.length > 0) {
            if (!confirm(this.t('messages.confirmReplaceSample'))) {
                return;
            }
        }

        // Hide the empty state guide
        document.getElementById('empty-state-guide').style.display = 'none';

        // Create sample e-commerce ERD
        const usersTableId = this.generateId();
        const ordersTableId = this.generateId();
        const productsTableId = this.generateId();
        const orderItemsTableId = this.generateId();

        // Users table
        const usersTable = {
            id: usersTableId,
            physical_name: 'users',
            logical_name: '사용자',
            comment: '회원 정보 테이블',
            position: { x: 100, y: 100 },
            categories: [],
            columns: [
                {
                    id: this.generateId(),
                    physical_name: 'user_id',
                    logical_name: '사용자ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    auto_increment: true,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'email',
                    logical_name: '이메일',
                    data_type: 'string',
                    length: 100,
                    nullable: false,
                    primary_key: false,
                    unique: true,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'name',
                    logical_name: '이름',
                    data_type: 'string',
                    length: 50,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'created_at',
                    logical_name: '가입일시',
                    data_type: 'datetime',
                    length: null,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                }
            ]
        };

        // Products table
        const productsTable = {
            id: productsTableId,
            physical_name: 'products',
            logical_name: '상품',
            comment: '상품 정보 테이블',
            position: { x: 500, y: 100 },
            categories: [],
            columns: [
                {
                    id: this.generateId(),
                    physical_name: 'product_id',
                    logical_name: '상품ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    auto_increment: true,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'name',
                    logical_name: '상품명',
                    data_type: 'string',
                    length: 100,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'price',
                    logical_name: '가격',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'stock',
                    logical_name: '재고',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: '0',
                    comment: '',
                    foreign_key: null
                }
            ]
        };

        // Orders table
        const ordersTable = {
            id: ordersTableId,
            physical_name: 'orders',
            logical_name: '주문',
            comment: '주문 정보 테이블',
            position: { x: 100, y: 350 },
            categories: [],
            columns: [
                {
                    id: this.generateId(),
                    physical_name: 'order_id',
                    logical_name: '주문ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    auto_increment: true,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'user_id',
                    logical_name: '사용자ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: {
                        table_id: usersTableId,
                        column_id: usersTable.columns[0].id
                    }
                },
                {
                    id: this.generateId(),
                    physical_name: 'total_amount',
                    logical_name: '총금액',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'order_date',
                    logical_name: '주문일시',
                    data_type: 'datetime',
                    length: null,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                }
            ]
        };

        // Order Items table
        const orderItemsTable = {
            id: orderItemsTableId,
            physical_name: 'order_items',
            logical_name: '주문상품',
            comment: '주문 상세 정보 테이블',
            position: { x: 500, y: 350 },
            categories: [],
            columns: [
                {
                    id: this.generateId(),
                    physical_name: 'order_item_id',
                    logical_name: '주문상품ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: true,
                    unique: false,
                    auto_increment: true,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'order_id',
                    logical_name: '주문ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: {
                        table_id: ordersTableId,
                        column_id: ordersTable.columns[0].id
                    }
                },
                {
                    id: this.generateId(),
                    physical_name: 'product_id',
                    logical_name: '상품ID',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: {
                        table_id: productsTableId,
                        column_id: productsTable.columns[0].id
                    }
                },
                {
                    id: this.generateId(),
                    physical_name: 'quantity',
                    logical_name: '수량',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: '1',
                    comment: '',
                    foreign_key: null
                },
                {
                    id: this.generateId(),
                    physical_name: 'price',
                    logical_name: '단가',
                    data_type: 'integer',
                    length: 11,
                    nullable: false,
                    primary_key: false,
                    unique: false,
                    auto_increment: false,
                    default_value: null,
                    comment: '',
                    foreign_key: null
                }
            ]
        };

        // Create relationships
        const relationships = [
            {
                id: this.generateId(),
                name: 'user_orders',
                source_table_id: usersTableId,
                target_table_id: ordersTableId,
                source_column_ids: [usersTable.columns[0].id],
                target_column_ids: [ordersTable.columns[1].id],
                cardinality: '1:N',
                on_delete: 'RESTRICT',
                on_update: 'CASCADE',
                comment: '사용자-주문 관계'
            },
            {
                id: this.generateId(),
                name: 'order_items_rel',
                source_table_id: ordersTableId,
                target_table_id: orderItemsTableId,
                source_column_ids: [ordersTable.columns[0].id],
                target_column_ids: [orderItemsTable.columns[1].id],
                cardinality: '1:N',
                on_delete: 'CASCADE',
                on_update: 'CASCADE',
                comment: '주문-주문상품 관계'
            },
            {
                id: this.generateId(),
                name: 'product_order_items',
                source_table_id: productsTableId,
                target_table_id: orderItemsTableId,
                source_column_ids: [productsTable.columns[0].id],
                target_column_ids: [orderItemsTable.columns[2].id],
                cardinality: '1:N',
                on_delete: 'RESTRICT',
                on_update: 'CASCADE',
                comment: '상품-주문상품 관계'
            }
        ];

        // Update diagram
        this.diagram = {
            id: this.generateId(),
            name: '샘플 쇼핑몰 ERD',
            description: '사용자, 주문, 상품 관계를 보여주는 샘플 다이어그램',
            database_type: 'mysql',
            version: '1.0',
            tables: [usersTable, productsTable, ordersTable, orderItemsTable],
            relationships: relationships,
            metadata: {}
        };

        this.currentDiagramId = null;
        document.getElementById('diagram-name').value = this.diagram.name;
        document.getElementById('diagram-db-type').value = this.diagram.database_type;

        this.render();
        this.showNotification('샘플 다이어그램을 불러왔습니다. 자유롭게 수정해보세요!', 'success');
    }

    // ==================== Column Dictionary Management ====================

    loadDictionary() {
        try {
            const dictJson = localStorage.getItem('column_dictionary');
            if (dictJson) {
                return JSON.parse(dictJson);
            }
        } catch (error) {
            console.error('Failed to load dictionary:', error);
        }

        // Return default dictionary with common columns
        return this.getDefaultDictionary();
    }

    getDefaultDictionary() {
        return [
            {
                id: this.generateId(),
                physical_name: 'id',
                logical_name: 'ID',
                data_type: 'bigint',
                length: 20,
                nullable: false,
                description: '기본키 (자동 증가)'
            },
            {
                id: this.generateId(),
                physical_name: 'created_at',
                logical_name: '생성일시',
                data_type: 'datetime',
                length: null,
                nullable: false,
                description: '레코드 생성 시간'
            },
            {
                id: this.generateId(),
                physical_name: 'updated_at',
                logical_name: '수정일시',
                data_type: 'datetime',
                length: null,
                nullable: true,
                description: '레코드 수정 시간'
            },
            {
                id: this.generateId(),
                physical_name: 'deleted_at',
                logical_name: '삭제일시',
                data_type: 'datetime',
                length: null,
                nullable: true,
                description: 'Soft Delete 용 삭제 시간'
            },
            {
                id: this.generateId(),
                physical_name: 'name',
                logical_name: '이름',
                data_type: 'string',
                length: 100,
                nullable: false,
                description: '일반적인 이름 필드'
            },
            {
                id: this.generateId(),
                physical_name: 'description',
                logical_name: '설명',
                data_type: 'text',
                length: null,
                nullable: true,
                description: '상세 설명'
            }
        ];
    }

    saveDictionary() {
        try {
            localStorage.setItem('column_dictionary', JSON.stringify(this.columnDictionary));
            this.updateDictionaryCount();
        } catch (error) {
            console.error('Failed to save dictionary:', error);
        }
    }

    updateDictionaryCount() {
        const countElement = document.getElementById('dict-count');
        if (countElement) {
            countElement.textContent = this.columnDictionary.length;
        }
    }

    showDictionaryManager() {
        this.renderDictionaryList();
        this.showModal('dictionary-modal');
    }

    renderDictionaryList() {
        const listContainer = document.getElementById('dictionary-list');

        if (this.columnDictionary.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">등록된 표준 컬럼이 없습니다</div>';
            return;
        }

        listContainer.innerHTML = this.columnDictionary.map(entry => `
            <div class="dict-item">
                <div class="dict-item-info">
                    <div class="dict-item-names">
                        <strong>${entry.logical_name || entry.physical_name}</strong>
                        <span class="dict-physical">${entry.physical_name}</span>
                    </div>
                    <div class="dict-item-details">
                        ${entry.data_type.toUpperCase()}${entry.length ? `(${entry.length})` : ''}
                        ${entry.nullable ? '' : '• NOT NULL'}
                    </div>
                    ${entry.description ? `<div class="dict-item-desc">${entry.description}</div>` : ''}
                </div>
                <div class="dict-item-actions">
                    <button class="btn btn-sm btn-secondary" onclick="app.editDictEntry('${entry.id}')">편집</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteDictEntry('${entry.id}')">삭제</button>
                </div>
            </div>
        `).join('');
    }

    addDictEntry() {
        this.selectedDictEntry = null;
        document.getElementById('dict-entry-title').textContent = '표준 컬럼 추가';
        document.getElementById('dict-physical-name').value = '';
        document.getElementById('dict-logical-name').value = '';
        document.getElementById('dict-data-type').value = 'string';
        document.getElementById('dict-length').value = '';
        document.getElementById('dict-not-null').checked = false;
        document.getElementById('dict-description').value = '';
        this.showModal('dict-entry-modal');
    }

    editDictEntry(entryId) {
        const entry = this.columnDictionary.find(e => e.id === entryId);
        if (!entry) return;

        this.selectedDictEntry = entry;
        document.getElementById('dict-entry-title').textContent = '표준 컬럼 편집';
        document.getElementById('dict-physical-name').value = entry.physical_name;
        document.getElementById('dict-logical-name').value = entry.logical_name || '';
        document.getElementById('dict-data-type').value = entry.data_type;
        document.getElementById('dict-length').value = entry.length || '';
        document.getElementById('dict-not-null').checked = !entry.nullable;
        document.getElementById('dict-description').value = entry.description || '';
        this.showModal('dict-entry-modal');
    }

    saveDictEntry() {
        const entry = {
            id: this.selectedDictEntry?.id || this.generateId(),
            physical_name: document.getElementById('dict-physical-name').value,
            logical_name: document.getElementById('dict-logical-name').value,
            data_type: document.getElementById('dict-data-type').value,
            length: parseInt(document.getElementById('dict-length').value) || null,
            nullable: !document.getElementById('dict-not-null').checked,
            description: document.getElementById('dict-description').value
        };

        if (!entry.physical_name) {
            alert(this.t('messages.enterPhysicalName'));
            return;
        }

        if (this.selectedDictEntry) {
            // Update existing entry
            const index = this.columnDictionary.findIndex(e => e.id === this.selectedDictEntry.id);
            if (index !== -1) {
                this.columnDictionary[index] = entry;
            }
        } else {
            // Add new entry
            this.columnDictionary.push(entry);
        }

        this.saveDictionary();
        this.hideModal('dict-entry-modal');
        this.renderDictionaryList();
        this.showNotification('컬럼 사전이 저장되었습니다.', 'success');
    }

    deleteDictEntry(entryId) {
        if (confirm(this.t('messages.confirmDeleteDictEntry'))) {
            this.columnDictionary = this.columnDictionary.filter(e => e.id !== entryId);
            this.saveDictionary();
            this.renderDictionaryList();
            this.showNotification('표준 컬럼이 삭제되었습니다.', 'info');
        }
    }

    showDictSelection() {
        this.renderDictSelectionList();
        this.showModal('dict-select-modal');
    }

    renderDictSelectionList(searchTerm = '') {
        const listContainer = document.getElementById('dict-select-list');

        const filteredDict = this.columnDictionary.filter(entry => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return entry.physical_name.toLowerCase().includes(search) ||
                   (entry.logical_name && entry.logical_name.toLowerCase().includes(search));
        });

        if (filteredDict.length === 0) {
            listContainer.innerHTML = '<div class="empty-state">검색 결과가 없습니다</div>';
            return;
        }

        listContainer.innerHTML = filteredDict.map(entry => `
            <div class="dict-select-item" onclick="app.addColumnFromDict('${entry.id}')">
                <div class="dict-item-names">
                    <strong>${entry.logical_name || entry.physical_name}</strong>
                    <span class="dict-physical">${entry.physical_name}</span>
                </div>
                <div class="dict-item-details">
                    ${entry.data_type.toUpperCase()}${entry.length ? `(${entry.length})` : ''}
                    ${entry.nullable ? '' : '• NOT NULL'}
                </div>
            </div>
        `).join('');
    }

    addColumnFromDict(entryId) {
        const entry = this.columnDictionary.find(e => e.id === entryId);
        if (!entry) return;

        const column = {
            physical_name: entry.physical_name,
            logical_name: entry.logical_name,
            data_type: entry.data_type,
            length: entry.length,
            nullable: entry.nullable,
            primary_key: false,
            indexed: false,
            unique: false,
            auto_increment: false,
            default_value: null,
            comment: entry.description || '',
            foreign_key: null
        };

        const container = document.getElementById('columns-container');
        container.appendChild(this.createColumnRow(column));

        this.hideModal('dict-select-modal');
        this.showNotification(`"${entry.logical_name || entry.physical_name}" 컬럼이 추가되었습니다.`, 'success');
    }

    // ==================== DDL Import ====================

    showDDLImport() {
        document.getElementById('ddl-import-input').value = '';
        this.showModal('ddl-import-modal');
    }

    executeImport() {
        const ddlText = document.getElementById('ddl-import-input').value;

        if (!ddlText.trim()) {
            alert(this.t('messages.enterDdl'));
            return;
        }

        try {
            const parsedTables = this.parseDDL(ddlText);

            if (parsedTables.length === 0) {
                alert(this.t('messages.noValidDdl'));
                return;
            }

            this.saveHistory(); // Save history before import

            // Add tables to diagram
            let importCount = 0;
            const yOffset = this.diagram.tables.length * 50;

            parsedTables.forEach((parsedTable, index) => {
                const table = {
                    id: this.generateId(),
                    physical_name: parsedTable.tableName,
                    logical_name: parsedTable.logicalName || '',
                    columns: parsedTable.columns.map(col => ({
                        id: this.generateId(),
                        physical_name: col.name,
                        logical_name: col.logicalName || '',
                        data_type: col.dataType,
                        length: col.length,
                        nullable: col.nullable,
                        primary_key: col.isPrimaryKey,
                        indexed: col.isIndexed,
                        unique: col.isUnique,
                        auto_increment: col.autoIncrement,
                        default_value: col.defaultValue,
                        comment: col.comment || '',
                        foreign_key: null  // FKs will be processed separately
                    })),
                    comment: parsedTable.comment || '',
                    position: {
                        x: 100 + (index % 3) * 300,
                        y: 100 + yOffset + Math.floor(index / 3) * 250
                    },
                    category: parsedTable.category || ''
                };

                this.diagram.tables.push(table);
                importCount++;
            });

            this.hideModal('ddl-import-modal');
            this.render();
            this.autoSave();

            this.showNotification(`${importCount}개의 테이블을 성공적으로 import했습니다.`, 'success');
        } catch (error) {
            console.error('DDL Import error:', error);
            alert(this.t('messages.ddlParseError', { error: error.message }));
        }
    }

    parseDDL(ddlText) {
        const tables = [];

        // Remove single-line comments (-- style)
        ddlText = ddlText.replace(/--[^\n]*/g, '');

        // Remove multi-line comments (/* */ style)
        ddlText = ddlText.replace(/\/\*[\s\S]*?\*\//g, '');

        // Extract COMMENT statements before removing them
        const tableComments = new Map();
        const columnComments = new Map();

        // Parse COMMENT ON TABLE statements
        const tableCommentRegex = /COMMENT\s+ON\s+TABLE\s+(?:\w+\.)?["`]?(\w+)["`]?\s+IS\s+['"]([^'"]+)['"]/gi;
        let commentMatch;
        while ((commentMatch = tableCommentRegex.exec(ddlText)) !== null) {
            const tableName = commentMatch[1];
            const comment = commentMatch[2];
            tableComments.set(tableName, comment);
        }

        // Parse COMMENT ON COLUMN statements
        const columnCommentRegex = /COMMENT\s+ON\s+COLUMN\s+(?:\w+\.)?["`]?(\w+)["`]?\.["`]?(\w+)["`]?\s+IS\s+['"]([^'"]+)['"]/gi;
        while ((commentMatch = columnCommentRegex.exec(ddlText)) !== null) {
            const tableName = commentMatch[1];
            const columnName = commentMatch[2];
            const comment = commentMatch[3];

            if (!columnComments.has(tableName)) {
                columnComments.set(tableName, new Map());
            }
            columnComments.get(tableName).set(columnName, comment);
        }

        // Remove COMMENT statements from DDL text
        ddlText = ddlText.replace(/COMMENT\s+ON\s+(TABLE|COLUMN)\s+[^;]+;/gi, '');

        // Split by CREATE TABLE statements using a more robust approach
        // that handles nested parentheses in column definitions
        const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?["`]?(\w+)["`]?\s*\(/gi;

        let match;
        while ((match = createTablePattern.exec(ddlText)) !== null) {
            const tableName = match[1].replace(/[`"]/g, '');
            const startPos = match.index + match[0].length;

            // Find matching closing parenthesis by tracking depth
            let depth = 1;
            let endPos = startPos;
            while (depth > 0 && endPos < ddlText.length) {
                if (ddlText[endPos] === '(') depth++;
                else if (ddlText[endPos] === ')') depth--;
                endPos++;
            }

            if (depth !== 0) {
                console.error(`Unmatched parentheses for table ${tableName}`);
                continue;
            }

            const tableBody = ddlText.substring(startPos, endPos - 1);

            try {
                const parsedTable = this.parseCreateTable(tableName, tableBody);

                // Apply table comment if exists
                if (tableComments.has(tableName)) {
                    const tableComment = tableComments.get(tableName);
                    parsedTable.comment = tableComment;
                    // Use comment as logical name if not already set
                    if (!parsedTable.logicalName) {
                        parsedTable.logicalName = tableComment;
                    }
                }

                // Apply column comments if exist
                if (columnComments.has(tableName)) {
                    const tableColumnComments = columnComments.get(tableName);
                    parsedTable.columns.forEach(col => {
                        if (tableColumnComments.has(col.name)) {
                            const commentText = tableColumnComments.get(col.name);
                            col.comment = commentText;
                            // Use comment as logical name if not already set
                            if (!col.logicalName) {
                                col.logicalName = commentText;
                            }
                        }
                    });
                }

                tables.push(parsedTable);
            } catch (error) {
                console.error(`Error parsing table ${tableName}:`, error);
                // Continue parsing other tables
            }
        }

        return tables;
    }

    parseCreateTable(tableName, tableBody) {
        const columns = [];
        const primaryKeys = [];

        // Split by comma, but not within parentheses
        const lines = this.splitTableDefinition(tableBody);

        console.log(`Parsing table ${tableName}, found ${lines.length} lines`);

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed) continue;

            // Check if it's a PRIMARY KEY constraint (with or without CONSTRAINT name)
            if (/^PRIMARY\s+KEY/i.test(trimmed) || /^CONSTRAINT\s+\w+\s+PRIMARY\s+KEY/i.test(trimmed)) {
                const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
                if (pkMatch) {
                    const pkCols = pkMatch[1].split(',').map(c => c.trim().replace(/[`"]/g, ''));
                    primaryKeys.push(...pkCols);
                }
                continue;
            }

            // Check if it's a UNIQUE constraint (with or without CONSTRAINT name)
            if (/^CONSTRAINT\s+\w+\s+UNIQUE/i.test(trimmed)) {
                // Handle UNIQUE constraints - can be enhanced later
                continue;
            }

            // Check if it's a FOREIGN KEY constraint
            if (/^FOREIGN\s+KEY/i.test(trimmed) || /^CONSTRAINT\s+\w+\s+FOREIGN\s+KEY/i.test(trimmed)) {
                // Skip FK constraints for now - can be added later
                continue;
            }

            // Check if it's other CONSTRAINT types
            if (/^CONSTRAINT/i.test(trimmed)) {
                // Skip other constraints (CHECK, etc.)
                continue;
            }

            // Check if it's a KEY/INDEX constraint
            if (/^(KEY|INDEX|UNIQUE)/i.test(trimmed)) {
                continue;
            }

            // Parse as column definition
            try {
                const column = this.parseColumnDefinition(trimmed);
                if (column) {
                    columns.push(column);
                } else {
                    console.warn('⚠️ parseColumnDefinition returned null for:', trimmed);
                }
            } catch (error) {
                console.error('❌ Failed to parse column:', trimmed, error);
            }
        }

        console.log(`✓ Table ${tableName}: successfully parsed ${columns.length} columns`);


        // Apply PRIMARY KEY constraints
        primaryKeys.forEach(pkCol => {
            const column = columns.find(c => c.name === pkCol);
            if (column) {
                column.isPrimaryKey = true;
            }
        });

        return {
            tableName,
            logicalName: '',
            columns,
            comment: ''
        };
    }

    splitTableDefinition(tableBody) {
        const lines = [];
        let current = '';
        let parenDepth = 0;

        for (let i = 0; i < tableBody.length; i++) {
            const char = tableBody[i];

            if (char === '(') {
                parenDepth++;
                current += char;
            } else if (char === ')') {
                parenDepth--;
                current += char;
            } else if (char === ',' && parenDepth === 0) {
                // Found a column separator at top level
                const trimmed = current.trim();
                if (trimmed) {
                    console.log(`  Found column part: "${trimmed.substring(0, 50)}..."`);
                    lines.push(trimmed);
                }
                current = '';
                continue; // Skip the comma itself
            } else if (char === '\n' || char === '\r' || char === '\t') {
                // Skip whitespace characters - they're just formatting
                // But add a space if current has content to preserve word boundaries
                if (current.length > 0 && current[current.length - 1] !== ' ') {
                    current += ' ';
                }
                continue;
            } else {
                current += char;
            }
        }

        // Don't forget the last column (may not have trailing comma)
        const trimmed = current.trim();
        if (trimmed) {
            console.log(`  Found last column part: "${trimmed.substring(0, 50)}..."`);
            lines.push(trimmed);
        }

        console.log(`Split table definition into ${lines.length} parts`);
        return lines;
    }

    parseColumnDefinition(columnDef) {
        // Remove trailing comma and normalize whitespace
        columnDef = columnDef.replace(/,\s*$/, '').trim();
        // Normalize tabs and multiple spaces to single space
        columnDef = columnDef.replace(/[\t]+/g, ' ').replace(/\s+/g, ' ');

        if (!columnDef) {
            console.warn('⚠️ Empty column definition');
            return null;
        }

        console.log(`📝 Parsing: "${columnDef}"`);

        // Extract column name (handle quoted identifiers properly)
        let columnName;
        let afterName;

        // Try to match quoted identifier first (more specific)
        // Match: "NAME" TYPE or 'NAME' TYPE
        const quotedMatch = columnDef.match(/^["']([^"']+)["']\s+(.+)$/);
        if (quotedMatch) {
            columnName = quotedMatch[1];
            afterName = quotedMatch[2].trim();
            console.log(`  ✓ Matched quoted identifier: "${columnName}"`);
            console.log(`  ✓ Rest: "${afterName}"`);
        } else {
            // Try unquoted identifier
            const unquotedMatch = columnDef.match(/^(\w+)\s+(.+)$/);
            if (unquotedMatch) {
                columnName = unquotedMatch[1];
                afterName = unquotedMatch[2].trim();
                console.log(`  ✓ Matched unquoted identifier: "${columnName}"`);
                console.log(`  ✓ Rest: "${afterName}"`);
            } else {
                console.error(`  ❌ Could not parse column name from: "${columnDef}"`);
                return null;
            }
        }

        if (!afterName) {
            console.error(`  ❌ No data type found after column name: "${columnName}"`);
            return null;
        }

        // Extract data type - enhanced to support Oracle, MySQL, and PostgreSQL types
        // Support CHARACTER VARYING and TIMESTAMP WITH TIME ZONE
        const typeMatch = afterName.match(/^(CHARACTER\s+VARYING|VARCHAR2?|NVARCHAR2?|CHAR|NCHAR|(?:TINY|SMALL|MEDIUM|BIG)?INT(?:EGER)?|(?:BIG)?SERIAL|NUMBER|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|TEXT|CLOB|BLOB|DATE(?:TIME)?|TIMESTAMP(?:\s+WITH(?:OUT)?\s+TIME\s+ZONE)?|TIME|BOOLEAN|BOOL|JSONB?|UUID|BYTEA|ENUM|SET)(?:\s*\(([^)]+)\))?/i);

        if (!typeMatch) {
            console.error(`  ❌ Could not parse data type from: "${afterName}"`);
            console.error(`  ❌ Full column def was: "${columnDef}"`);
            return null;
        }

        console.log(`  ✓ Data type match: ${typeMatch[1]}${typeMatch[2] ? '(' + typeMatch[2] + ')' : ''}`);

        let dataType = typeMatch[1].toUpperCase();
        const lengthMatch = typeMatch[2];

        // Normalize data types
        let normalizedType = 'string';
        let length = null;

        if (lengthMatch) {
            // For ENUM/SET, extract first value as length
            if (dataType === 'ENUM' || dataType === 'SET') {
                length = null;
            } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC' || dataType === 'NUMBER') {
                // For DECIMAL(10,2) or NUMBER(10,2), just take the first number
                const parts = lengthMatch.split(',');
                length = parseInt(parts[0]);
            } else {
                length = parseInt(lengthMatch);
            }
        }

        // Type normalization with Oracle, MySQL, and PostgreSQL support
        if (/^(TINY|SMALL|MEDIUM)?INT/i.test(dataType)) {
            normalizedType = 'integer';
        } else if (/^BIGINT/i.test(dataType)) {
            normalizedType = 'bigint';
        } else if (/^SERIAL$/i.test(dataType)) {
            // PostgreSQL SERIAL = auto-increment integer
            normalizedType = 'integer';
        } else if (/^BIGSERIAL$/i.test(dataType)) {
            // PostgreSQL BIGSERIAL = auto-increment bigint
            normalizedType = 'bigint';
        } else if (/^(CHARACTER\s+VARYING|VARCHAR2?|NVARCHAR2?|CHAR|NCHAR)/i.test(dataType)) {
            normalizedType = 'string';
        } else if (/^UUID$/i.test(dataType)) {
            // PostgreSQL UUID type
            normalizedType = 'string';
            length = 36; // UUID standard length
        } else if (/^(TEXT|CLOB|BLOB|BYTEA)/i.test(dataType)) {
            normalizedType = 'text';
        } else if (/^DATE$/i.test(dataType)) {
            // Oracle/PostgreSQL DATE type
            normalizedType = 'datetime';
        } else if (/^(DATETIME|TIMESTAMP(?:\s+WITH(?:OUT)?\s+TIME\s+ZONE)?|TIME)/i.test(dataType)) {
            normalizedType = 'datetime';
        } else if (/^(BOOL|BOOLEAN)/i.test(dataType)) {
            normalizedType = 'boolean';
        } else if (/^JSONB?$/i.test(dataType)) {
            // PostgreSQL JSON/JSONB types
            normalizedType = 'json';
        } else if (/^(NUMBER|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL)/i.test(dataType)) {
            // Oracle NUMBER and other numeric types
            if (lengthMatch && lengthMatch.includes(',')) {
                // Has decimal places, use integer for now
                normalizedType = 'integer';
            } else {
                normalizedType = 'integer';
            }
        }

        // Check constraints (look in the full column definition)
        const isPrimaryKey = /PRIMARY\s+KEY/i.test(columnDef);
        const isNotNull = /NOT\s+NULL/i.test(columnDef);
        const isUnique = /UNIQUE/i.test(columnDef);
        // PostgreSQL SERIAL/BIGSERIAL or MySQL AUTO_INCREMENT
        const isAutoIncrement = /AUTO_INCREMENT/i.test(columnDef) || /^(BIG)?SERIAL$/i.test(dataType);

        // Extract default value (support PostgreSQL functions like CURRENT_TIMESTAMP, NOW(), etc.)
        let defaultValue = null;
        const defaultMatch = columnDef.match(/DEFAULT\s+(?:'([^']*)'|"([^"]*)"|([^,\s]+(?:\(\))?))/i);
        if (defaultMatch) {
            defaultValue = defaultMatch[1] || defaultMatch[2] || defaultMatch[3];
            if (defaultValue === 'NULL') defaultValue = null;
            // Normalize PostgreSQL timestamp functions
            if (/^(CURRENT_TIMESTAMP|NOW\(\)|CURRENT_DATE|CURRENT_TIME)/i.test(defaultValue)) {
                defaultValue = 'CURRENT_TIMESTAMP';
            }
        }

        // Extract comment (inline COMMENT in DDL)
        let comment = '';
        const commentMatch = columnDef.match(/COMMENT\s+['"]([^'"]+)['"]/i);
        if (commentMatch) {
            comment = commentMatch[1];
        }

        const result = {
            name: columnName,
            logicalName: '',
            dataType: normalizedType,
            length: length,
            nullable: !isNotNull && !isPrimaryKey,
            isPrimaryKey: isPrimaryKey,
            isIndexed: false,
            isUnique: isUnique,
            autoIncrement: isAutoIncrement,
            defaultValue: defaultValue,
            comment: comment
        };

        console.log(`  ✅ SUCCESS: ${columnName} → ${normalizedType}${length ? '(' + length + ')' : ''}`);
        return result;
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ERDEditor();
});
