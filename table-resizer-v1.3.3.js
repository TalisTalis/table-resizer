/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.3.3
 * @description Исправлено мерцание тултипа при наведении на ручку ресайза
 */
class TableResizer {
    constructor(options = {}) {
        this.defaultOptions = {
            storageKey: null,
            minWidth: 50,
            autoResizeOnDblClick: true,
            saveDelay: 300,
            defaultWidth: 300,
            minColumnsForDefaultWidth: 4,
            disabledColumns: [],
            dataColumnAttribute: 'data-column',
            dataTypeAttribute: 'data-type',
            initialColumnWidths: {},
            dataTypeWidths: {
                'date': '12ch', 'short-date': '10ch', 'datetime': '18ch',
                'time': '8ch', 'age': '7ch', 'gender': '7ch', 'policy': '20ch',
                'phone': '15ch', 'email': '25ch', 'inn': '12ch', 'snils': '14ch',
                'boolean': '8ch', 'number': '10ch', 'currency': '12ch',
                'percent': '8ch', 'status': '10ch', 'id': '8ch', 'name': '20ch',
                'surname': '25ch', 'patronymic': '25ch', 'fullname': '40ch',
                'address': '40ch', 'city': '20ch', 'code': '10ch',
                'action': '40px', 'small-icon': '30px', 'icon': '40px',
                'checkbox': '30px', 'hospital_type': '80px'
            }
        };
        this.options = { ...this.defaultOptions, ...options };
        this.tables = new Map();
        this.saveTimeout = null;
    }

    /**
     * Определяет ширину колонки на основе типа данных
     */
    getDataTypeWidth(header) {
        const { dataTypeAttribute, dataTypeWidths } = this.options;
        if (!header.hasAttribute(dataTypeAttribute)) return null;
        const dataType = header.getAttribute(dataTypeAttribute);
        return dataTypeWidths[dataType] || null;
    }

    /**
     * Определяет ширину колонки на основе содержимого заголовка
     */
    guessWidthFromHeader(header) {
        const text = header.textContent.trim().toLowerCase();
        const words = text.split(/\s+/);
        const patterns = {
            'дата': 'date',
            'число': 'date',
            'время': 'time',
            'возраст': 'age',
            'лет': 'age',
            'пол': 'gender',
            'муж': 'gender',
            'жен': 'gender',
            'полис': 'policy',
            'енп': 'policy',
            'телефон': 'phone',
            'тел': 'phone',
            'почта': 'email',
            'email': 'email',
            'инн': 'inn',
            'снилс': 'snils',
            'сумма': 'currency',
            'цена': 'currency',
            'стоимость': 'currency',
            'процент': 'percent',
            '%': 'percent',
            'статус': 'status',
            'id': 'id',
            'код': 'code',
            'артикул': 'code',
            'фио': 'fullname',
            'фамилия, имя, отчество': 'fullname',
            'имя': 'name',
            'фамилия': 'surname',
            'отчество': 'patronymic',
            'адрес': 'address',
            'город': 'city',
            'действия': 'action',
            'управление': 'action',
            'чекбокс': 'checkbox',
            'выбор': 'checkbox'
        };

        for (const word of words) {
            if (patterns[word]) {
                return this.options.dataTypeWidths[patterns[word]] || null;
            }
        }
        return null;
    }

    /**
     * Получает рекомендуемую ширину для колонки
     */
    getRecommendedWidth(header) {
        const dataTypeWidth = this.getDataTypeWidth(header);
        if (dataTypeWidth) return dataTypeWidth;

        const guessedWidth = this.guessWidthFromHeader(header);
        if (guessedWidth) return guessedWidth;

        const classList = header.classList;
        for (const [type, width] of Object.entries(this.options.dataTypeWidths)) {
            if (classList.contains(`type-${type}`) ||
                classList.contains(`data-${type}`) ||
                classList.contains(`${type}-column`)) {
                return width;
            }
        }
        return null;
    }

    convertToPixels(widthStr) {
        if (!widthStr || typeof widthStr !== 'string') return parseInt(this.options.minWidth);
        const match = widthStr.match(/^([\d.]+)(ch|px|em|rem|vw|vh|vmin|vmax)?$/);
        if (!match) return parseInt(this.options.minWidth);

        const value = parseFloat(match[1]);
        const unit = match[2] || 'px';

        if (unit === 'px') return value;

        if (unit === 'ch') {
            const tempElement = document.createElement('div');
            tempElement.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap; font: inherit;';
            tempElement.textContent = '0'.repeat(Math.ceil(value));
            document.body.appendChild(tempElement);
            const pixelWidth = tempElement.offsetWidth;
            document.body.removeChild(tempElement);
            return pixelWidth;
        }

        try {
            const tempElement = document.createElement('div');
            tempElement.style.cssText = `position: absolute; visibility: hidden; width: ${value}${unit};`;
            document.body.appendChild(tempElement);
            const pixelWidth = tempElement.offsetWidth;
            document.body.removeChild(tempElement);
            return pixelWidth;
        } catch (e) {
            return parseInt(this.options.minWidth);
        }
    }

    hasUnit(widthStr) {
        if (!widthStr || typeof widthStr !== 'string') return false;
        return /[a-z%]$/i.test(widthStr.trim());
    }

    processWidthValue(widthValue) {
        if (!widthValue) return this.options.minWidth + 'px';
        if (typeof widthValue === 'number') return Math.max(widthValue, this.options.minWidth) + 'px';
        if (typeof widthValue === 'string') {
            if (/^\d+$/.test(widthValue)) return Math.max(parseInt(widthValue), this.options.minWidth) + 'px';
            const match = widthValue.match(/^([\d.]+)([a-z%]+)$/i);
            if (match) {
                const numValue = parseFloat(match[1]);
                const unit = match[2];
                if (unit === 'px' && numValue < this.options.minWidth) return this.options.minWidth + 'px';
                return widthValue;
            }
        }
        return this.options.minWidth + 'px';
    }

    init(tableId, customOptions = {}) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error(`Таблица с ID "${tableId}" не найдена`);
            return false;
        }

        const options = { ...this.defaultOptions, ...customOptions };
        if (!options.storageKey) options.storageKey = `tableColumnsWidths_${tableId}`;

        const instance = {
            table, options,
            isResizing: false,
            currentHeader: null,
            startX: 0,
            startWidth: 0,
            columnKeys: new Map(),
            _tooltipBound: false,
            _tooltipTimeout: null,
            _tooltipCell: null
        };
        this.tables.set(tableId, instance);

        table.classList.add('table-resizable');
        table.style.tableLayout = 'fixed';
        table.style.width = 'fit-content';

        this.setupTable(instance);
        this.loadColumnWidths(instance);
        return true;
    }

    getColumnKey(header) {
        const attrName = this.options.dataColumnAttribute;
        return header.hasAttribute(attrName) ? header.getAttribute(attrName) : null;
    }

    isColumnDisabled(header, instance) {
        const columnKey = this.getColumnKey(header);
        if (!columnKey) return false;
        return instance.options.disabledColumns.includes(columnKey);
    }

    getColumnIndexByKey(instance, columnKey) {
        const firstRow = instance.table.querySelector('tr');
        if (!firstRow) return null;

        const cells = firstRow.querySelectorAll('th, td');
        for (let i = 0; i < cells.length; i++) {
            const cellKey = this.getColumnKey(cells[i]);
            if (cellKey === columnKey) return i;
        }
        return null;
    }

    setupTable(instance) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');

        headers.forEach((header, index) => {
            const columnKey = this.getColumnKey(header);
            if (columnKey) instance.columnKeys.set(index, columnKey);

            let handle = header.querySelector('.resize-handle');
            if (handle) handle.remove();

            if (!this.isColumnDisabled(header, instance)) {
                handle = document.createElement('div');
                handle.className = 'resize-handle';
                header.appendChild(handle);

                handle.addEventListener('mousedown', (e) => this.startResize(e, instance, header));
                if (options.autoResizeOnDblClick) {
                    handle.addEventListener('dblclick', (e) => {
                        this.autoResizeColumn(instance, header, false);
                        e.preventDefault();
                        e.stopPropagation();
                    });
                }
            } else {
                header.classList.add('resize-disabled');
            }
        });

        this.preserveControlColumnStyles(instance);
        this.setupTableStyles(table);

        // Привязка событий для тултипа (один раз)
        if (!instance._tooltipBound) {
            instance.table.addEventListener('mouseenter', (e) => this._handleHeaderMouseEnter(e, instance), true);
            instance.table.addEventListener('mouseleave', (e) => this._handleHeaderMouseLeave(e, instance), true);
            instance._tooltipBound = true;
        }
    }

    preserveControlColumnStyles(instance) {
        const { table } = instance;
        const controlHeaders = table.querySelectorAll('th.column-control-header');
        const controlCells = table.querySelectorAll('td.column-control-header');

        controlHeaders.forEach(header => {
            const originalWidth = header.style.width || header.getAttribute('data-original-width');
            if (!header.hasAttribute('data-original-width')) {
                header.setAttribute('data-original-width', originalWidth || header.offsetWidth + 'px');
            }
            header.style.width = header.getAttribute('data-original-width');
            header.style.minWidth = header.getAttribute('data-original-width') || '50px';
        });

        controlCells.forEach(cell => {
            const originalWidth = cell.style.width || cell.getAttribute('data-original-width');
            if (!cell.hasAttribute('data-original-width')) {
                cell.setAttribute('data-original-width', originalWidth || '50px');
            }
            cell.style.width = cell.getAttribute('data-original-width');
            cell.style.minWidth = cell.getAttribute('data-original-width') || '50px';
        });
    }

    setupTableStyles(table) {
        if (document.getElementById('table-resizer-styles')) return;
        const style = document.createElement('style');
        style.id = 'table-resizer-styles';
        style.textContent = `
            .table-resizable {
                table-layout: fixed;
                width: fit-content;
                border-collapse: collapse;
                white-space: nowrap;
            }
            .table-resizable th:not(.column-control-header),
            .table-resizable td:not(.column-control-header) {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                position: relative;
            }
            /* КУРСОР: обычная стрелка на заголовках */
            .table-resizable th:not(.column-control-header) {
                min-width: 50px !important;
                cursor: default;
            }
            .table-resizable td:not(.column-control-header) {
                min-width: 50px !important;
            }
            .table-resizable th.column-control-header,
            .table-resizable td.column-control-header {
                overflow: visible !important;
            }
            .table-resizable th.resize-disabled {
                cursor: default !important;
            }
            .resize-handle {
                position: absolute;
                top: 0; right: 0;
                width: 8px; height: 100%;
                background-color: transparent;
                cursor: col-resize;
                z-index: 10;
            }
            .resize-handle:hover {
                background-color: rgba(93, 141, 168, 0.3);
            }
            .resize-handle:active,
            .resize-handle:focus,
            .resize-handle.active {
                background-color: #5d8da8;
                opacity: 0.7;
            }
            .table-resizable.resizing {
                cursor: col-resize;
                user-select: none;
            }
            .table-resizable.resizing * {
                user-select: none;
            }

            /* Плавное появление тултипа */
            .table-resizable th[title]:hover::after,
            .table-resizable th[data-bs-title]::after {
                transition: opacity 0.15s ease-in-out;
            }

            /* Предотвращаем выделение текста при быстрых движениях */
            .table-resizable th {
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
    }

    startResize(e, instance, header) {
        if (this.isColumnDisabled(header, instance)) return;
        instance.isResizing = true;
        instance.currentHeader = header;
        instance.startX = e.pageX;
        instance.startWidth = header.offsetWidth;

        instance.table.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const mouseMoveHandler = (e) => this.handleMouseMove(e, instance);
        const mouseUpHandler = () => this.stopResize(instance, mouseMoveHandler, mouseUpHandler);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e, instance) {
        if (!instance.isResizing || !instance.currentHeader) return;
        const deltaX = e.pageX - instance.startX;
        const newWidth = instance.startWidth + deltaX;
        const minWidth = instance.options.minWidth;

        if (newWidth >= minWidth) {
            const columnKey = this.getColumnKey(instance.currentHeader);
            if (columnKey) {
                const columnIndex = this.getColumnIndexByKey(instance, columnKey);
                if (columnIndex !== null) {
                    this.setColumnWidth(instance, columnKey, columnIndex, newWidth + 'px');
                }
            }
        }
    }

    stopResize(instance, mouseMoveHandler, mouseUpHandler) {
        instance.isResizing = false;
        instance.currentHeader = null;

        instance.table.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        this.debouncedSave(instance);
    }

    setColumnWidth(instance, columnKey, columnIndex, width) {
        if (instance.options.disabledColumns.includes(columnKey)) return;

        const rows = instance.table.querySelectorAll('tr');
        const minWidth = instance.options.minWidth + 'px';

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[columnIndex]) {
                const cellKey = this.getColumnKey(cells[columnIndex]);
                if (cellKey === columnKey && !cells[columnIndex].classList.contains('column-control-header')) {
                    cells[columnIndex].style.width = this.processWidthValue(width);
                    cells[columnIndex].style.minWidth = minWidth;
                }
            }
        });
    }

    autoResizeColumn(instance, header, isInitialLoad = false) {
        if (header.classList.contains('column-control-header') || this.isColumnDisabled(header, instance)) return;

        const { table, options } = instance;
        const columnKey = this.getColumnKey(header);
        const columnIndex = this.getColumnIndexByKey(instance, columnKey);
        if (columnIndex === null) return;

        const rows = table.querySelectorAll('tr');
        let maxWidth = 0;

        const measureElement = document.createElement('span');
        measureElement.style.cssText = 'position: absolute; visibility: hidden; white-space: nowrap; font: inherit; font-weight: bold; padding: 8px;';
        document.body.appendChild(measureElement);

        measureElement.textContent = header.textContent.trim();
        maxWidth = Math.max(maxWidth, measureElement.offsetWidth);

        if (!isInitialLoad) {
            rows.forEach((row, index) => {
                if (index === 0) return;
                const cells = row.querySelectorAll('td');
                if (cells[columnIndex]) {
                    measureElement.style.fontWeight = 'normal';
                    measureElement.textContent = cells[columnIndex].textContent.trim();
                    maxWidth = Math.max(maxWidth, measureElement.offsetWidth);
                }
            });
        }

        document.body.removeChild(measureElement);

        const finalWidth = Math.max(maxWidth + 30, options.minWidth);
        this.setColumnWidth(instance, columnKey, columnIndex, finalWidth + 'px');

        if (!isInitialLoad) {
            this.debouncedSave(instance);
        }
    }

    debouncedSave(instance) {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveColumnWidths(instance);
        }, instance.options.saveDelay);
    }

    saveColumnWidths(instance) {
        const { table, options } = instance;
        const widths = {};
        const firstRow = table.querySelector('tr');
        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach((cell, index) => {
            const columnKey = this.getColumnKey(cell);
            if (!columnKey) return;
            if (cell.classList.contains('column-control-header')) return;
            if (options.disabledColumns.includes(columnKey)) return;

            const currentWidth = cell.style.width || cell.offsetWidth + 'px';
            if (this.hasUnit(currentWidth) && !currentWidth.endsWith('px')) {
                widths[columnKey] = currentWidth;
            } else {
                const widthValue = parseInt(currentWidth);
                const finalWidth = widthValue < options.minWidth ? options.minWidth + 'px' : currentWidth;
                widths[columnKey] = finalWidth;
            }
        });

        localStorage.setItem(options.storageKey, JSON.stringify(widths));
    }

    countActiveColumns(instance) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        let activeCount = 0;
        headers.forEach(header => {
            const columnKey = this.getColumnKey(header);
            if (columnKey && !options.disabledColumns.includes(columnKey)) {
                activeCount++;
            }
        });
        return activeCount;
    }

    loadColumnWidths(instance) {
        const { table, options } = instance;
        const savedWidthsJson = localStorage.getItem(options.storageKey);
        let savedWidths = {};
        if (savedWidthsJson) {
            try {
                savedWidths = JSON.parse(savedWidthsJson);
            } catch (e) {
                console.warn('Ошибка при загрузке сохраненных ширин столбцов:', e);
            }
        }

        const firstRow = table.querySelector('tr');
        if (firstRow) {
            const cells = firstRow.querySelectorAll('th, td');
            cells.forEach((cell, index) => {
                const columnKey = this.getColumnKey(cell);
                if (!columnKey) return;
                if (cell.classList.contains('column-control-header')) return;
                if (options.disabledColumns.includes(columnKey)) return;

                const savedWidth = savedWidths[columnKey];
                if (savedWidth) {
                    this.setColumnWidth(instance, columnKey, index, this.processWidthValue(savedWidth));
                } else {
                    this.applyRecommendedWidth(instance, cell, columnKey, index);
                }
            });
        }

        if (Object.keys(savedWidths).length === 0) {
            const { initialColumnWidths } = instance.options;
            const hasInitialWidths = Object.keys(initialColumnWidths).length > 0;

            if (hasInitialWidths) {
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    const cells = firstRow.querySelectorAll('th, td');
                    cells.forEach((cell, index) => {
                        const columnKey = this.getColumnKey(cell);
                        if (!columnKey || cell.classList.contains('column-control-header') ||
                            options.disabledColumns.includes(columnKey)) return;
                        const width = initialColumnWidths[columnKey];
                        if (width) {
                            this.setColumnWidth(instance, columnKey, index, this.processWidthValue(width));
                        } else {
                            this.applyRecommendedWidth(instance, cell, columnKey, index);
                        }
                    });
                }
            } else {
                this.applyRecommendedWidths(instance);
            }
            setTimeout(() => this.saveColumnWidths(instance), 100);
        }
        this.preserveControlColumnStyles(instance);

        // После применения всех ширин — принудительно пересчитываем состояние тултипов
        setTimeout(() => {
            const headers = instance.table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach(header => {
                if (this._isTextTruncated(header)) {
                    // Помечаем, что тултип возможен (но не показываем сразу)
                    header.dataset.truncated = 'true';
                } else {
                    delete header.dataset.truncated;
                }
            });
        }, 150); // Даём браузеру время на reflow
    }

    applyRecommendedWidth(instance, header, columnKey, columnIndex) {
        const recommendedWidth = this.getRecommendedWidth(header);
        if (recommendedWidth) {
            this.setColumnWidth(instance, columnKey, columnIndex, recommendedWidth);
        } else {
            this.applyDefaultWidthToColumn(instance, columnKey, columnIndex);
        }
    }

    applyRecommendedWidths(instance) {
        const { table } = instance;
        const firstRow = table.querySelector('tr');
        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach((cell, index) => {
            const columnKey = this.getColumnKey(cell);
            if (columnKey && !cell.classList.contains('column-control-header') &&
                !instance.options.disabledColumns.includes(columnKey)) {
                this.applyRecommendedWidth(instance, cell, columnKey, index);
            }
        });
    }

    applyDefaultWidthToColumn(instance, columnKey, columnIndex) {
        const { options } = instance;
        const activeColumnsCount = this.countActiveColumns(instance);
        let finalWidth;

        if (activeColumnsCount > options.minColumnsForDefaultWidth) {
            finalWidth = options.defaultWidth + 'px';
        } else {
            const widthScreen = window.innerWidth - 80;
            const widthColumn = Math.floor(widthScreen / activeColumnsCount);
            finalWidth = Math.max(widthColumn, options.minWidth) + 'px';
        }

        this.setColumnWidth(instance, columnKey, columnIndex, finalWidth);
    }

    applyDefaultWidths(instance) {
        const { table, options } = instance;
        const firstRow = table.querySelector('tr');
        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach((cell, index) => {
            const columnKey = this.getColumnKey(cell);
            if (columnKey && !cell.classList.contains('column-control-header') &&
                !options.disabledColumns.includes(columnKey)) {
                this.applyDefaultWidthToColumn(instance, columnKey, index);
            }
        });
    }

    distributeColumns(tableId) {
        const instance = this.tables.get(tableId);
        if (!instance) return;

        const { table, options } = instance;
        const activeColumnsCount = this.countActiveColumns(instance);
        if (activeColumnsCount > 0) {
            const widthScreen = window.innerWidth;
            const widthColumn = Math.floor(widthScreen / activeColumnsCount);
            const finalWidth = Math.max(widthColumn, options.minWidth);

            const firstRow = table.querySelector('tr');
            if (!firstRow) return;

            const cells = firstRow.querySelectorAll('th, td');
            cells.forEach((cell, index) => {
                const columnKey = this.getColumnKey(cell);
                if (columnKey && !cell.classList.contains('column-control-header') &&
                    !options.disabledColumns.includes(columnKey)) {
                    this.setColumnWidth(instance, columnKey, index, finalWidth + 'px');
                }
            });

            this.debouncedSave(instance);
        }
    }

    reset(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            localStorage.removeItem(instance.options.storageKey);
            this.applyRecommendedWidths(instance);
            setTimeout(() => this.saveColumnWidths(instance), 100);
        }
    }

    destroy(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            // Удаляем все Bootstrap-тултипы, созданные для заголовков
            instance.table.querySelectorAll('th').forEach(th => {
                if (th._bootstrapTooltip) {
                    th._bootstrapTooltip.dispose();
                    delete th._bootstrapTooltip;
                }
            });

            const headers = instance.table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach(header => {
                const handle = header.querySelector('.resize-handle');
                if (handle) handle.remove();
                header.classList.remove('resize-disabled');
            });

            instance.table.classList.remove('table-resizable', 'resizing');
            instance.table.style.tableLayout = '';
            instance.table.style.width = '';
            this.tables.delete(tableId);
        }
    }

    // ========== НОВЫЕ МЕТОДЫ ДЛЯ ВСПЛЫВАЮЩЕЙ ПОДСКАЗКИ ==========

    /**
     * При наведении на заголовок: если текст обрезан — показывает стилизованный тултип
     */
    _handleHeaderMouseOver(e, instance) {
        const cell = e.target.closest('th');

        // Если мышь ушла с предыдущего th (например, на td или за пределы таблицы) – скрываем старый тултип
        if (!cell || cell.classList.contains('column-control-header')) {
            if (instance._tooltipCell) {
                this._restoreHeaderTitle(instance._tooltipCell);
                instance._tooltipCell = null;
            }
            return;
        }

        // Перешли на другой th — скрываем тултип предыдущего
        if (instance._tooltipCell && instance._tooltipCell !== cell) {
            this._restoreHeaderTitle(instance._tooltipCell);
            instance._tooltipCell = null;
        }

        // Проверяем, надо ли показывать тултип для текущего th
        if (cell.scrollWidth > cell.clientWidth) {
            instance._tooltipCell = cell;
            const fullText = cell.textContent.trim();
            if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                this._showBootstrapTooltip(cell, fullText);
            } else {
                if (!cell.hasAttribute('data-original-title')) {
                    cell.setAttribute('data-original-title', cell.getAttribute('title') || '');
                }
                cell.setAttribute('title', fullText);
            }
        } else {
            // Текст помещается полностью — скрываем тултип, если он был именно на этой ячейке
            if (instance._tooltipCell === cell) {
                this._restoreHeaderTitle(cell);
                instance._tooltipCell = null;
            }
        }
    }

    _handleHeaderMouseOut(e, instance) {
        const toElement = e.relatedTarget;
        // Скрываем тултип только если курсор действительно покинул пределы th (включая дочерние элементы)
        if (instance._tooltipCell) {
            if (!toElement || !instance._tooltipCell.contains(toElement)) {
                this._restoreHeaderTitle(instance._tooltipCell);
                instance._tooltipCell = null;
            }
        }
    }

    _showBootstrapTooltip(cell, fullText) {
        if (!cell._bootstrapTooltip) {
            cell._bootstrapTooltip = new bootstrap.Tooltip(cell, {
                title: fullText,
                placement: 'top',
                trigger: 'manual',
                container: 'body'
            });
        } else {
            cell._bootstrapTooltip._config.title = fullText;
        }
        cell._bootstrapTooltip.show();
    }

    /**
 * Обработчик mouseenter — показывает тултип с задержкой
 */
    _handleHeaderMouseEnter(e, instance) {
        const cell = e.target.closest('th');

        if (!cell || cell.classList.contains('column-control-header')) {
            this._hideTooltipDelayed(instance, 0);
            return;
        }

        if (instance._tooltipCell && instance._tooltipCell !== cell) {
            this._hideTooltipDelayed(instance, 0);
        }

        // Используем надёжную проверку вместо scrollWidth > clientWidth
        if (this._isTextTruncated(cell)) {
            if (instance._tooltipTimeout) {
                clearTimeout(instance._tooltipTimeout);
                instance._tooltipTimeout = null;
            }

            instance._tooltipCell = cell;
            const fullText = cell.textContent.trim();

            instance._tooltipTimeout = setTimeout(() => {
                if (instance._tooltipCell === cell) {
                    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
                        this._showBootstrapTooltip(cell, fullText);
                    } else {
                        if (!cell.hasAttribute('data-original-title')) {
                            cell.setAttribute('data-original-title', cell.getAttribute('title') || '');
                        }
                        cell.setAttribute('title', fullText);
                    }
                }
            }, 250);
        }
    }

    /**
     * Обработчик mouseleave — скрывает тултип с небольшой задержкой
     */
    _handleHeaderMouseLeave(e, instance) {
        const toElement = e.relatedTarget;

        // Скрываем только если курсор действительно покинул пределы ячейки
        if (instance._tooltipCell && (!toElement || !instance._tooltipCell.contains(toElement))) {
            this._hideTooltipDelayed(instance, 100); // Небольшая задержка для плавности
        }
    }

    /**
     * Универсальный метод скрытия с задержкой
     */
    _hideTooltipDelayed(instance, delay = 0) {
        if (instance._tooltipTimeout) {
            clearTimeout(instance._tooltipTimeout);
            instance._tooltipTimeout = null;
        }

        if (delay > 0) {
            instance._tooltipTimeout = setTimeout(() => {
                if (instance._tooltipCell) {
                    this._restoreHeaderTitle(instance._tooltipCell);
                    instance._tooltipCell = null;
                }
            }, delay);
        } else {
            if (instance._tooltipCell) {
                this._restoreHeaderTitle(instance._tooltipCell);
                instance._tooltipCell = null;
            }
        }
    }

    /**
     * Обновлённый _restoreHeaderTitle для надёжной очистки
     */
    _restoreHeaderTitle(cell) {
        // Скрываем Bootstrap-тултип
        if (cell._bootstrapTooltip) {
            cell._bootstrapTooltip.hide();
            // Не уничтожаем экземпляр, чтобы переиспользовать при следующем показе
        }

        // Восстанавливаем оригинальный title
        if (cell.hasAttribute('data-original-title')) {
            const original = cell.getAttribute('data-original-title');
            if (original) {
                cell.setAttribute('title', original);
            } else {
                cell.removeAttribute('title');
            }
            cell.removeAttribute('data-original-title');
        } else {
            // Если data-original-title не было, просто очищаем title
            cell.removeAttribute('title');
        }
    }

    /**
 * Надёжная проверка: действительно ли текст обрезан?
 * Учитывает resize-handle, padding и sub-pixel погрешности
 */
    _isTextTruncated(cell) {
        // Игнорируем ячейки без текста
        const text = cell.textContent.trim();
        if (!text) return false;

        // Получаем доступную ширину для текста (без resize-handle и паддингов)
        const style = window.getComputedStyle(cell);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;

        // Вычитаем ширину resize-handle, если он есть внутри ячейки
        const handle = cell.querySelector('.resize-handle');
        const handleWidth = handle ? handle.offsetWidth : 0;

        const availableWidth = cell.clientWidth - paddingLeft - paddingRight - handleWidth;

        // Измеряем реальную ширину текста
        const measureSpan = document.createElement('span');
        measureSpan.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        font: ${style.font};
        padding: 0;
        margin: 0;
        border: none;
    `;
        measureSpan.textContent = text;
        document.body.appendChild(measureSpan);
        const textWidth = measureSpan.offsetWidth;
        document.body.removeChild(measureSpan);

        // Добавляем небольшой допуск (5px) для sub-pixel rendering
        return textWidth > availableWidth + 5;
    }
}

// Глобальный экземпляр
window.tableResizer = new TableResizer({
    defaultWidth: 300,
    minColumnsForDefaultWidth: 4
});