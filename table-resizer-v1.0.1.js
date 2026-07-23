/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.0.1
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
        table.style.width = 'fit-content';
        table.style.minWidth = '100%'; // ДОБАВЛЕНО: чтобы таблица не скукоживалась

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

            // УБРАТЬ: автоматический подбор ширины при загрузке
            // Это будет делаться в loadColumnWidths только если нет сохраненных данных

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
                    width: fit-content;
                    min-width: fit-content !important;
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

                .table-resizable th {
                    min-width: 50px !important;
                }

                .table-resizable td {
                    min-width: 50px !important;
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

                .table-responsive .table-resizable {
                    min-width: fit-content;
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
        const minWidth = instance.options.minWidth + 'px';

        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            if (cells[columnIndex]) {
                cells[columnIndex].style.width = width;
                cells[columnIndex].style.minWidth = minWidth;
            }
        });
    }

    /**
 * Автоматически подбирает ширину столбца по содержимому
 */
    autoResizeColumn(instance, header, isInitialLoad = false) {
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
        font-weight: bold; // Учитываем жирный шрифт заголовков
        padding: 8px; // Учитываем padding ячеек
    `;
        document.body.appendChild(measureElement);

        // Измеряем ширину заголовка (всегда учитываем)
        measureElement.textContent = header.textContent.trim();
        maxWidth = Math.max(maxWidth, measureElement.offsetWidth);

        // Если это не начальная загрузка, измеряем содержимое ячеек
        if (!isInitialLoad) {
            // Измеряем ширину содержимого ячеек
            rows.forEach((row, index) => {
                if (index === 0) return; // Пропускаем строку заголовков

                const cells = row.querySelectorAll('td');
                if (cells[colIndex]) {
                    measureElement.style.fontWeight = 'normal'; // Обычный шрифт для ячеек
                    measureElement.textContent = cells[colIndex].textContent.trim();
                    maxWidth = Math.max(maxWidth, measureElement.offsetWidth);
                }
            });
        }

        document.body.removeChild(measureElement);

        // Добавляем отступы и минимальную ширину
        const finalWidth = Math.max(maxWidth + 30, options.minWidth); // Увеличил отступ до 20px

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
     * Сохраняет ширины столбцов в localStorage
     */
    saveColumnWidths(instance) {
        const { table, options } = instance;
        const widths = [];
        const firstRow = table.querySelector('tr');

        if (!firstRow) return;

        const cells = firstRow.querySelectorAll('th, td');
        cells.forEach(cell => {
            // Сохраняем вычисленную ширину, но не меньше минимальной
            const currentWidth = cell.style.width || cell.offsetWidth + 'px';
            const minWidth = options.minWidth + 'px';

            // Если сохраненная ширина меньше минимальной - сохраняем минимальную
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
            // Есть сохраненные ширины - восстанавливаем их
            savedWidths.forEach((width, index) => {
                if (width) {
                    // Проверяем, что загруженная ширина не меньше минимальной
                    const widthValue = parseInt(width);
                    const finalWidth = widthValue >= options.minWidth ? width : (options.minWidth + 'px');
                    this.setColumnWidth(instance, index, finalWidth);
                }
            });
        } else {
            // Нет сохраненных ширин - устанавливаем по ширине заголовков
            const headers = table.querySelectorAll('th:not(.column-control-header)');
            headers.forEach((header, index) => {
                setTimeout(() => {
                    this.autoResizeColumn(instance, header, true);
                }, index * 50);
            });
        }
    }

    /**
     * Равномерно распределяет столбцы
     */
    distributeColumns(instance) {
        const { table } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');
        const controlColumn = table.querySelector('th.column-control-header');

        let availableWidth = table.parentElement ? table.parentElement.offsetWidth : table.offsetWidth;
        if (controlColumn) {
            availableWidth -= controlColumn.offsetWidth;
        }

        // Убедимся, что минимальная ширина достаточна
        const minTotalWidth = headers.length * instance.options.minWidth;
        const columnWidth = Math.max(availableWidth / headers.length, instance.options.minWidth) + 'px';

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