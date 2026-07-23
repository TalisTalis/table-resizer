/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.0.4
 */
class TableResizer {
    constructor(options = {}) {
        this.defaultOptions = {
            storageKey: null,
            minWidth: 50,
            autoResizeOnDblClick: true,
            saveDelay: 300,
            defaultWidth: 300,
            minColumnsForDefaultWidth: 4, // минимальное количество столбцов для применения defaultWidth
            disabledColumns: [] // массив индексов столбцов, для которых отключена регулировка
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

        const options = { ...this.defaultOptions, ...customOptions };

        // Устанавливаем уникальный ключ для хранения если не указан
        if (!options.storageKey) {
            options.storageKey = `tableColumnsWidths_${tableId}`;
        }

        const instance = {
            table,
            options,
            isResizing: false,
            currentHeader: null,
            startX: 0,
            startWidth: 0
        };

        this.tables.set(tableId, instance);

        // Добавляем необходимые классы и стили
        table.classList.add('table-resizable');
        table.style.tableLayout = 'fixed';
        table.style.width = 'fit-content';

        this.setupTable(instance);
        this.loadColumnWidths(instance);

        return true;
    }

    /**
     * Проверяет, отключен ли столбец для регулировки
     * @param {HTMLElement} header - Заголовок столбца
     * @param {object} instance - Экземпляр таблицы
     * @returns {boolean} - true если регулировка отключена
     */
    isColumnDisabled(header, instance) {
        if (!header.hasAttribute('data-column')) return false;

        const colIndex = parseInt(header.getAttribute('data-column'));
        const { disabledColumns } = instance.options;

        // Проверяем, есть ли индекс в массиве отключенных столбцов
        return disabledColumns.includes(colIndex);
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

            // Создаем handle для ресайза только если столбец не отключен
            let handle = header.querySelector('.resize-handle');

            // Удаляем существующий handle если он уже есть
            if (handle) {
                handle.remove();
            }

            // Добавляем новый handle только если столбец не отключен
            if (!this.isColumnDisabled(header, instance)) {
                handle = document.createElement('div');
                handle.className = 'resize-handle';
                header.appendChild(handle);

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
            } else {
                // Добавляем класс для отключенного столбца
                header.classList.add('resize-disabled');
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

                .table-resizable th.resize-disabled {
                    cursor: default !important;
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
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Начинает процесс изменения ширины
     */
    startResize(e, instance, header) {
        // Проверяем, не отключен ли столбец
        if (this.isColumnDisabled(header, instance)) {
            return;
        }

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
     * Устанавливает ширину для всего столбца (кроме column-control-header и отключенных столбцов)
     */
    setColumnWidth(instance, columnIndex, width) {
        // Пропускаем отключенные столбцы
        if (instance.options.disabledColumns.includes(columnIndex)) {
            return;
        }

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
        // Пропускаем column-control-header и отключенные столбцы
        if (header.classList.contains('column-control-header') || this.isColumnDisabled(header, instance)) {
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
     * Сохраняет ширины столбцов в localStorage (исключая column-control-header и отключенные столбцы)
     */
    saveColumnWidths(instance) {
        const { table, options } = instance;
        const widths = [];
        const firstRow = table.querySelector('tr');

        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach((cell, index) => {
            // Пропускаем column-control-header
            if (cell.classList.contains('column-control-header')) {
                widths.push(null); // помечаем как специальный столбец
                return;
            }

            // Для отключенных столбцов сохраняем null
            if (options.disabledColumns.includes(index)) {
                widths.push(null);
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
     * Подсчитывает количество обычных столбцов (без учета column-control-header)
     */
    countRegularColumns(instance) {
        const { table } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        return headers.length;
    }

    /**
     * Подсчитывает количество активных столбцов (без учета column-control-header и отключенных)
     */
    countActiveColumns(instance) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        let activeCount = 0;

        headers.forEach(header => {
            const colIndex = parseInt(header.getAttribute('data-column'));
            if (!options.disabledColumns.includes(colIndex)) {
                activeCount++;
            }
        });

        return activeCount;
    }

    /**
     * Загружает сохраненные ширины столбцов
     */
    loadColumnWidths(instance) {
        const { table, options } = instance;
        const savedWidths = JSON.parse(localStorage.getItem(options.storageKey));

        if (savedWidths && savedWidths.length > 0) {
            // Есть сохраненные ширины - восстанавливаем их (кроме column-control-header и отключенных)
            savedWidths.forEach((width, index) => {
                if (width !== null && !options.disabledColumns.includes(index)) { // пропускаем null (column-control-header) и отключенные столбцы
                    const widthValue = parseInt(width);
                    const finalWidth = widthValue >= options.minWidth ? width : (options.minWidth + 'px');
                    this.setColumnWidth(instance, index, finalWidth);
                }
            });
        } else {
            // Нет сохраненных ширин - устанавливаем ширину по умолчанию (кроме column-control-header и отключенных)
            const activeColumnsCount = this.countActiveColumns(instance);

            if (activeColumnsCount > 0) {
                if (activeColumnsCount > options.minColumnsForDefaultWidth) {
                    // Если активных столбцов больше 4 - устанавливаем дефолтную ширину
                    this.applyDefaultWidthToActiveColumns(instance, options.defaultWidth);
                } else {
                    // Если активных столбцов 4 или меньше - используем ширину экрана / количество активных столбцов
                    const widthScreen = window.innerWidth - 80;
                    const widthColumn = Math.floor(widthScreen / activeColumnsCount);
                    const finalWidth = Math.max(widthColumn, options.minWidth);

                    this.applyDefaultWidthToActiveColumns(instance, finalWidth);
                }

                // Сохраняем ширины
                setTimeout(() => {
                    this.saveColumnWidths(instance);
                }, 100);
            }
        }

        // Всегда восстанавливаем стили column-control-header
        this.preserveControlColumnStyles(instance);
    }

    /**
     * Применяет ширину по умолчанию к активным столбцам
     */
    applyDefaultWidthToActiveColumns(instance, width) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');

        headers.forEach((header) => {
            const colIndex = parseInt(header.getAttribute('data-column'));
            if (!options.disabledColumns.includes(colIndex)) {
                this.setColumnWidth(instance, colIndex, width + 'px');
            }
        });
    }

    /**
     * Равномерно распределяет столбцы (кроме column-control-header и отключенных)
     */
    distributeColumns(tableId) {
        const instance = this.tables.get(tableId);
        if (!instance) return;

        const { table, options } = instance;
        const activeColumnsCount = this.countActiveColumns(instance);

        if (activeColumnsCount > 0) {
            const widthScreen = window.innerWidth;
            const widthColumn = Math.floor(widthScreen / activeColumnsCount);
            const finalWidth = Math.max(widthColumn, options.minWidth);

            const headers = table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach((header) => {
                const colIndex = parseInt(header.getAttribute('data-column'));
                if (!options.disabledColumns.includes(colIndex)) {
                    this.setColumnWidth(instance, colIndex, finalWidth + 'px');
                }
            });

            // Сохраняем ширины
            this.debouncedSave(instance);
        }
    }

    /**
     * Сбрасывает ширины столбцов для таблицы
     */
    reset(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            localStorage.removeItem(instance.options.storageKey);

            // При сбросе устанавливаем ширину по умолчанию или по ширине экрана
            const activeColumnsCount = this.countActiveColumns(instance);

            if (activeColumnsCount > 0) {
                if (activeColumnsCount > instance.options.minColumnsForDefaultWidth) {
                    // Если активных столбцов больше 4 - устанавливаем дефолтную ширину
                    this.applyDefaultWidthToActiveColumns(instance, instance.options.defaultWidth);
                } else {
                    // Если активных столбцов 4 или меньше - используем ширину экрана / количество активных столбцов
                    const widthScreen = window.innerWidth;
                    const widthColumn = Math.floor(widthScreen / activeColumnsCount);
                    const finalWidth = Math.max(widthColumn, instance.options.minWidth);

                    this.applyDefaultWidthToActiveColumns(instance, finalWidth);
                }

                // Сохраняем сброшенные ширины
                setTimeout(() => {
                    this.saveColumnWidths(instance);
                }, 100);
            }
        }
    }

    /**
     * Уничтожает экземпляр для таблицы
     */
    destroy(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            // Удаляем resize-handle
            const headers = instance.table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach(header => {
                const handle = header.querySelector('.resize-handle');
                if (handle) {
                    handle.remove();
                }

                // Снимаем атрибуты и классы
                header.removeAttribute('data-column');
                header.classList.remove('resize-disabled');
            });

            // Восстанавливаем стили таблицы
            instance.table.classList.remove('table-resizable', 'resizing');
            instance.table.style.tableLayout = '';
            instance.table.style.width = '';

            this.tables.delete(tableId);
        }
    }
}

// Создаем глобальный экземпляр
window.tableResizer = new TableResizer({
    defaultWidth: 300,
    minColumnsForDefaultWidth: 4
});