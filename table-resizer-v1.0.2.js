/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.0.2
 */
class TableResizer {
    constructor(options = {}) {
        this.defaultOptions = {
            storageKey: null,
            minWidth: 50,
            autoResizeOnDblClick: true,
            saveDelay: 300,
            defaultWidth: 300
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
        table.style.width = 'fit-content';

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

        // Добавляем обработчики только для НЕ column-control-header столбцов
        headers.forEach((header, index) => {
            // Получаем индекс столбца с учетом column-control-header
            const allHeaders = table.querySelectorAll('th');
            let actualIndex = Array.from(allHeaders).indexOf(header);

            header.setAttribute('data-column', actualIndex);

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
                    this.autoResizeColumn(instance, header, false);
                    e.preventDefault();
                    e.stopPropagation();
                });
            }
        });

        // Сохраняем оригинальные стили для column-control-header
        this.preserveControlColumnStyles(instance);

        // Настраиваем стили для ячеек
        this.setupTableStyles(table);
    }

    /**
     * Сохраняет оригинальные стили столбца column-control-header
     */
    preserveControlColumnStyles(instance) {
        const { table } = instance;
        const controlHeaders = table.querySelectorAll('th.column-control-header');
        const controlCells = table.querySelectorAll('td.column-control-header');

        // Сохраняем стили заголовков
        controlHeaders.forEach(header => {
            const originalWidth = header.style.width || header.getAttribute('data-original-width');
            if (!header.hasAttribute('data-original-width')) {
                header.setAttribute('data-original-width', originalWidth || header.offsetWidth + 'px');
            }

            // Восстанавливаем оригинальные стили
            header.style.width = header.getAttribute('data-original-width');
            header.style.minWidth = header.getAttribute('data-original-width') || '50px';
        });

        // Сохраняем стили ячеек
        controlCells.forEach(cell => {
            const originalWidth = cell.style.width || cell.getAttribute('data-original-width');
            if (!cell.hasAttribute('data-original-width')) {
                cell.setAttribute('data-original-width', originalWidth || '50px');
            }

            // Восстанавливаем оригинальные стили
            cell.style.width = cell.getAttribute('data-original-width');
            cell.style.minWidth = cell.getAttribute('data-original-width') || '50px';
        });
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

                .table-resizable th:not(.column-control-header) {
                    min-width: 50px !important;
                }

                .table-resizable td:not(.column-control-header) {
                    min-width: 50px !important;
                }

                .table-resizable th.column-control-header,
                .table-resizable td.column-control-header {
                    /* Стили остаются как есть из CSS */
                    overflow: visible !important;
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

                /* НЕ переопределяем стили для column-control-header */
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

        const deltaX = e.pageX - instance.startX;
        const newWidth = instance.startWidth + deltaX;
        const minWidth = instance.options.minWidth;

        if (newWidth >= minWidth) {
            const colIndex = parseInt(instance.currentHeader.getAttribute('data-column'));
            this.setColumnWidth(instance, colIndex, newWidth + 'px');
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
     * Устанавливает ширину для всего столбца (кроме column-control-header)
     */
    setColumnWidth(instance, columnIndex, width) {
        const rows = instance.table.querySelectorAll('tr');
        const minWidth = instance.options.minWidth + 'px';

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[columnIndex] && !cells[columnIndex].classList.contains('column-control-header')) {
                cells[columnIndex].style.width = width;
                cells[columnIndex].style.minWidth = minWidth;
            }
        });
    }

    /**
     * Автоматически подбирает ширину столбца по содержимому
     */
    autoResizeColumn(instance, header, isInitialLoad = false) {
        // Пропускаем column-control-header
        if (header.classList.contains('column-control-header')) {
            return;
        }

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
            font-weight: bold;
            padding: 8px;
        `;
        document.body.appendChild(measureElement);

        // Измеряем ширину заголовка
        measureElement.textContent = header.textContent.trim();
        maxWidth = Math.max(maxWidth, measureElement.offsetWidth);

        // Если это не начальная загрузка, измеряем содержимое ячеек
        if (!isInitialLoad) {
            // Измеряем ширину содержимого ячеек
            rows.forEach((row, index) => {
                if (index === 0) return; // Пропускаем строку заголовков

                const cells = row.querySelectorAll('td');
                if (cells[colIndex] && !cells[colIndex].classList.contains('column-control-header')) {
                    measureElement.style.fontWeight = 'normal';
                    measureElement.textContent = cells[colIndex].textContent.trim();
                    maxWidth = Math.max(maxWidth, measureElement.offsetWidth);
                }
            });
        }

        document.body.removeChild(measureElement);

        // Добавляем отступы и минимальную ширину
        const finalWidth = Math.max(maxWidth + 30, options.minWidth);

        // Устанавливаем новую ширину
        this.setColumnWidth(instance, colIndex, finalWidth + 'px');

        // Сохраняем только если это не начальная загрузка
        if (!isInitialLoad) {
            this.debouncedSave(instance);
        }
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
     * Сохраняет ширины столбцов в localStorage (исключая column-control-header)
     */
    saveColumnWidths(instance) {
        const { table, options } = instance;
        const widths = [];
        const firstRow = table.querySelector('tr');

        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach(cell => {
            // Пропускаем column-control-header
            if (cell.classList.contains('column-control-header')) {
                widths.push(null); // помечаем как специальный столбец
                return;
            }

            const currentWidth = cell.style.width || cell.offsetWidth + 'px';
            const minWidth = options.minWidth + 'px';

            const computedWidth = parseInt(currentWidth) < options.minWidth ? minWidth : currentWidth;
            widths.push(computedWidth);
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
            // Есть сохраненные ширины - восстанавливаем их (кроме column-control-header)
            savedWidths.forEach((width, index) => {
                if (width !== null) { // пропускаем null (column-control-header)
                    const widthValue = parseInt(width);
                    const finalWidth = widthValue >= options.minWidth ? width : (options.minWidth + 'px');
                    this.setColumnWidth(instance, index, finalWidth);
                }
            });
        } else {
            // Нет сохраненных ширин - устанавливаем ширину по умолчанию (кроме column-control-header)
            const headers = table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach((header, index) => {
                const allHeaders = table.querySelectorAll('th');
                let actualIndex = Array.from(allHeaders).indexOf(header);
                this.setColumnWidth(instance, actualIndex, options.defaultWidth + 'px');
            });

            // Сохраняем ширины по умолчанию
            setTimeout(() => {
                this.saveColumnWidths(instance);
            }, 100);
        }

        // Всегда восстанавливаем стили column-control-header
        this.preserveControlColumnStyles(instance);
    }

    /**
     * Равномерно распределяет столбцы (кроме column-control-header)
     */
    distributeColumns(instance) {
        const { table } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        const controlColumn = table.querySelector('th.column-control-header');

        let availableWidth = table.parentElement ? table.parentElement.offsetWidth : table.offsetWidth;
        if (controlColumn) {
            availableWidth -= controlColumn.offsetWidth;
        }

        const minTotalWidth = headers.length * instance.options.minWidth;
        const columnWidth = Math.max(availableWidth / headers.length, instance.options.minWidth) + 'px';

        headers.forEach((header, index) => {
            const allHeaders = table.querySelectorAll('th');
            let actualIndex = Array.from(allHeaders).indexOf(header);
            this.setColumnWidth(instance, actualIndex, columnWidth);
        });
    }

    /**
     * Сбрасывает ширины столбцов для таблицы
     */
    reset(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            localStorage.removeItem(instance.options.storageKey);
            // При сбросе устанавливаем ширину по умолчанию (кроме column-control-header)
            const headers = instance.table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach((header, index) => {
                const allHeaders = table.querySelectorAll('th');
                let actualIndex = Array.from(allHeaders).indexOf(header);
                this.setColumnWidth(instance, actualIndex, instance.options.defaultWidth + 'px');
            });

            // Сохраняем сброшенные ширины
            setTimeout(() => {
                this.saveColumnWidths(instance);
            }, 100);
        }
    }

    /**
     * Уничтожает экземпляр для таблицы
     */
    destroy(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            const headers = instance.table.querySelectorAll('th:not(.column-control-header)');
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
window.tableResizer = new TableResizer({
    defaultWidth: 300
});