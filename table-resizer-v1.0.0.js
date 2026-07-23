/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.0.0
 */
class TableResizer {
    constructor(options = {}) {
        this.defaultOptions = {
            storageKey: null,
            minWidth: 50,
            autoResizeOnDblClick: true,
            saveDelay: 300
        };

        this.options = { ...this.defaultOptions, ...options };
        this.tables = new Map();
        this.saveTimeout = null;
    }

    /**
     * Инициализирует функционал для таблицы
     * @param {string} tableId - ID таблицы
     * @param {object} customOptions - Пользовательские настройки
     */
    init(tableId, customOptions = {}) {
        const table = document.getElementById(tableId);

        if (!table) {
            console.error(`Таблица с ID "${tableId}" не найдена`);
            return false;
        }

        const options = { ...this.options, ...customOptions };

        // Устанавливаем уникальный ключ для хранения если не указан
        if (!options.storageKey) {
            options.storageKey = `tableColumnsWidths_${tableId}`;
        }

        // Добавляем необходимые классы и стили
        table.classList.add('table-resizable');
        table.style.tableLayout = 'fixed';
        table.style.width = '100%';

        const instance = {
            table,
            options,
            isResizing: false,
            currentHeader: null,
            startX: 0,
            startWidth: 0
        };

        this.tables.set(tableId, instance);
        this.setupTable(instance);
        this.loadColumnWidths(instance);

        return true;
    }

    /**
     * Настраивает таблицу для работы с ресайзом
     */
    setupTable(instance) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');

        // Добавляем обработчики для каждого заголовка
        headers.forEach((header, index) => {
            header.setAttribute('data-column', index);

            // Создаем handle для ресайза если его нет
            let handle = header.querySelector('.resize-handle');
            if (!handle) {
                handle = document.createElement('div');
                handle.className = 'resize-handle';
                header.appendChild(handle);
            }

            // Обработчик начала ресайза
            handle.addEventListener('mousedown', (e) => {
                this.startResize(e, instance, header);
            });

            // Автоподбор по двойному клику
            if (options.autoResizeOnDblClick) {
                handle.addEventListener('dblclick', (e) => {
                    this.autoResizeColumn(instance, header);
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        });

        // Настраиваем стили для ячеек
        this.setupTableStyles(table);
    }

    /**
     * Настраивает базовые стили таблицы
     */
    setupTableStyles(table) {
        const style = document.createElement('style');
        style.id = 'table-resizer-styles';

        if (!document.getElementById('table-resizer-styles')) {
            style.textContent = `
                .table-resizable {
                    table-layout: fixed;
                    width: 100%;
                    border-collapse: collapse;
                    white-space: nowrap;
                }

                .table-resizable th,
                .table-resizable td {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    position: relative;
                }

                .resize-handle {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 8px;
                    height: 100%;
                    background-color: transparent;
                    cursor: col-resize;
                    z-index: 10;
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

                .column-control-header {
                    width: 50px !important;
                    min-width: 50px !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Начинает процесс изменения ширины
     */
    startResize(e, instance, header) {
        const { table, options } = instance;

        instance.isResizing = true;
        instance.currentHeader = header;
        instance.startX = e.pageX;
        instance.startWidth = header.offsetWidth;

        table.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const mouseMoveHandler = (e) => this.handleMouseMove(e, instance);
        const mouseUpHandler = () => this.stopResize(instance, mouseMoveHandler, mouseUpHandler);

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Обрабатывает перемещение мыши при ресайзе
     */
    handleMouseMove(e, instance) {
        if (!instance.isResizing || !instance.currentHeader) return;

        const width = instance.startWidth + (e.pageX - instance.startX);
        const minWidth = instance.options.minWidth;

        if (width >= minWidth) {
            const colIndex = parseInt(instance.currentHeader.getAttribute('data-column'));
            this.setColumnWidth(instance, colIndex, width + 'px');
        }
    }

    /**
     * Завершает процесс изменения ширины
     */
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

    /**
     * Устанавливает ширину для всего столбца
     */
    setColumnWidth(instance, columnIndex, width) {
        const rows = instance.table.querySelectorAll('tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[columnIndex]) {
                cells[columnIndex].style.width = width;
                cells[columnIndex].style.minWidth = width;
            }
        });
    }

    /**
     * Автоматически подбирает ширину столбца по содержимому
     */
    autoResizeColumn(instance, header) {
        const { table, options } = instance;
        const colIndex = parseInt(header.getAttribute('data-column'));
        const rows = table.querySelectorAll('tr');
        let maxWidth = 0;

        // Создаем временный элемент для измерения
        const measureElement = document.createElement('span');
        measureElement.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: nowrap;
            font: inherit;
            padding: 0 8px;
        `;
        document.body.appendChild(measureElement);

        // Измеряем ширину заголовка
        measureElement.textContent = header.textContent.trim();
        maxWidth = Math.max(maxWidth, measureElement.offsetWidth);

        // Измеряем ширину содержимого ячеек
        rows.forEach((row, index) => {
            if (index === 0) return; // Пропускаем строку заголовков

            const cells = row.querySelectorAll('td');
            if (cells[colIndex]) {
                measureElement.textContent = cells[colIndex].textContent.trim();
                maxWidth = Math.max(maxWidth, measureElement.offsetWidth);
            }
        });

        document.body.removeChild(measureElement);

        // Добавляем отступы и минимальную ширину
        const finalWidth = Math.max(maxWidth + 16, options.minWidth);

        // Устанавливаем новую ширину
        this.setColumnWidth(instance, colIndex, finalWidth + 'px');
        this.debouncedSave(instance);
    }

    /**
     * Сохраняет ширины столбцов с задержкой
     */
    debouncedSave(instance) {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveColumnWidths(instance);
        }, instance.options.saveDelay);
    }

    /**
     * Сохраняет ширины столбцов в localStorage
     */
    saveColumnWidths(instance) {
        const { table, options } = instance;
        const widths = [];
        const firstRow = table.querySelector('tr');

        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach(cell => {
            widths.push(cell.style.width || cell.offsetWidth + 'px');
        });

        localStorage.setItem(options.storageKey, JSON.stringify(widths));
    }

    /**
     * Загружает сохраненные ширины столбцов
     */
    loadColumnWidths(instance) {
        const { table, options } = instance;
        const savedWidths = JSON.parse(localStorage.getItem(options.storageKey));

        if (savedWidths && savedWidths.length > 0) {
            savedWidths.forEach((width, index) => {
                if (width) {
                    this.setColumnWidth(instance, index, width);
                }
            });
        } else {
            // Равномерное распределение при первом запуске
            this.distributeColumns(instance);
        }
    }

    /**
     * Равномерно распределяет столбцы
     */
    distributeColumns(instance) {
        const { table } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        const controlColumn = table.querySelector('th.column-control-header');

        let availableWidth = table.offsetWidth;
        if (controlColumn) {
            availableWidth -= controlColumn.offsetWidth;
        }

        const columnWidth = (availableWidth / headers.length) + 'px';

        headers.forEach((header, index) => {
            this.setColumnWidth(instance, index, columnWidth);
        });
    }

    /**
     * Сбрасывает ширины столбцов для таблицы
     */
    reset(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            localStorage.removeItem(instance.options.storageKey);
            this.distributeColumns(instance);
        }
    }

    /**
     * Уничтожает экземпляр для таблицы
     */
    destroy(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            // Убираем обработчики
            const headers = instance.table.querySelectorAll('th');
            headers.forEach(header => {
                const handle = header.querySelector('.resize-handle');
                if (handle) {
                    handle.replaceWith(handle.cloneNode(true));
                }
            });

            instance.table.classList.remove('table-resizable', 'resizing');
            this.tables.delete(tableId);
        }
    }
}

// Создаем глобальный экземпляр
window.tableResizer = new TableResizer();