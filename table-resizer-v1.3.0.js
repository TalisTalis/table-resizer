/**
 * TableResizer - библиотека для изменения ширины столбцов таблиц с сохранением состояний
 * @version 1.3.0
 * @description Поддержка автоматического определения ширины на основе типа данных
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
            dataTypeAttribute: 'data-type', // Новый атрибут для типа данных
            initialColumnWidths: {},
            // Стандартные ширины для типов данных
            dataTypeWidths: {
                'date': '12ch',        // Дата (DD.MM.YYYY)
                'short-date': '10ch',  // Короткая дата (DD.MM.YY)
                'datetime': '18ch',    // Дата и время
                'time': '8ch',         // Время
                'age': '6ch',          // Возраст
                'gender': '6ch',       // Пол
                'policy': '20ch',      // Номер полиса (ЕНП)
                'phone': '15ch',       // Телефон
                'email': '25ch',       // Email
                'inn': '12ch',         // ИНН
                'snils': '14ch',       // СНИЛС
                'boolean': '8ch',      // Да/Нет
                'number': '10ch',      // Число
                'currency': '12ch',    // Деньги
                'percent': '8ch',      // Процент
                'status': '10ch',      // Статус
                'id': '8ch',           // ID
                'name': '20ch',        // Имя
                'surname': '25ch',     // Фамилия
                'patronymic': '25ch',  // Отчество
                'fullname': '40ch',    // ФИО
                'address': '40ch',     // Адрес
                'city': '20ch',        // Город
                'code': '10ch',        // Код
                'action': '40px',      // Действия (иконки/кнопки)
                'small-icon': '30px',  // Маленькая иконка
                'icon': '40px',        // Иконка
                'checkbox': '30px',     // Чекбокс
                'hospital_type': '80px' // Тип стационара
            }
        };

        this.options = { ...this.defaultOptions, ...options };
        this.tables = new Map();
        this.saveTimeout = null;
    }

    /**
     * Определяет ширину колонки на основе типа данных
     * @param {HTMLElement} header - Заголовок колонки
     * @returns {string|null} - Рекомендуемая ширина или null
     */
    getDataTypeWidth(header) {
        const { dataTypeAttribute, dataTypeWidths } = this.options;

        if (!header.hasAttribute(dataTypeAttribute)) {
            return null;
        }

        const dataType = header.getAttribute(dataTypeAttribute);
        return dataTypeWidths[dataType] || null;
    }

    /**
     * Определяет ширину колонки на основе содержимого заголовка
     * @param {HTMLElement} header - Заголовок колонки
     * @returns {string|null} - Рекомендуемая ширина или null
     */
    guessWidthFromHeader(header) {
        const text = header.textContent.trim().toLowerCase();
        // Разбиваем заголовок на слова
        const words = text.split(/\s+/);
        // Паттерны для определения типа данных по тексту заголовка
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
            'выбор': 'checkbox',
            'стационар': 'hospital_type',
            'тип': 'hospital_type'
        };

        // Проверяем полные слова
        for (const word of words) {
            if (patterns[word]) {
                return this.options.dataTypeWidths[patterns[word]] || null;
            }
        }

        return null;
    }

    /**
     * Получает рекомендуемую ширину для колонки
     * @param {HTMLElement} header - Заголовок колонки
     * @returns {string|null} - Рекомендуемая ширина
     */
    getRecommendedWidth(header) {
        // 1. Проверяем явно указанный тип данных
        const dataTypeWidth = this.getDataTypeWidth(header);
        if (dataTypeWidth) {
            return dataTypeWidth;
        }

        // 2. Пробуем угадать по заголовку
        const guessedWidth = this.guessWidthFromHeader(header);
        if (guessedWidth) {
            return guessedWidth;
        }

        // 3. Проверяем классы на наличие паттернов
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

    /**
     * Конвертирует строковое значение ширины в пиксели
     * @param {string} widthStr - Строка с шириной (например "50ch", "100px", "2em")
     * @returns {number} - Ширина в пикселях
     */
    convertToPixels(widthStr) {
        if (!widthStr || typeof widthStr !== 'string') {
            return parseInt(this.options.minWidth);
        }

        const match = widthStr.match(/^([\d.]+)(ch|px|em|rem|vw|vh|vmin|vmax)?$/);
        if (!match) {
            return parseInt(this.options.minWidth);
        }

        const value = parseFloat(match[1]);
        const unit = match[2] || 'px';

        // Если уже пиксели, возвращаем как есть
        if (unit === 'px') {
            return value;
        }

        // Для ch используем приблизительное преобразование (1ch ≈ ширина символа "0")
        if (unit === 'ch') {
            // Создаем временный элемент для измерения
            const tempElement = document.createElement('div');
            tempElement.style.cssText = `
                position: absolute;
                visibility: hidden;
                white-space: nowrap;
                font: inherit;
            `;
            tempElement.textContent = '0'.repeat(Math.ceil(value));
            document.body.appendChild(tempElement);
            const pixelWidth = tempElement.offsetWidth;
            document.body.removeChild(tempElement);
            return pixelWidth;
        }

        // Для em/rem и других относительных единиц используем вычисление
        if (unit === 'em' || unit === 'rem' || unit === 'vw' || unit === 'vh' || unit === 'vmin' || unit === 'vmax') {
            try {
                const tempElement = document.createElement('div');
                tempElement.style.cssText = `
                    position: absolute;
                    visibility: hidden;
                    width: ${value}${unit};
                `;
                document.body.appendChild(tempElement);
                const pixelWidth = tempElement.offsetWidth;
                document.body.removeChild(tempElement);
                return pixelWidth;
            } catch (e) {
                // В случае ошибки возвращаем минимальную ширину
                return parseInt(this.options.minWidth);
            }
        }

        return value;
    }

    /**
     * Проверяет, содержит ли строка единицы измерения
     * @param {string} widthStr - Строка с шириной
     * @returns {boolean} - true если содержит единицы измерения
     */
    hasUnit(widthStr) {
        if (!widthStr || typeof widthStr !== 'string') return false;
        return /[a-z%]$/i.test(widthStr.trim());
    }

    /**
     * Обрабатывает значение ширины - сохраняет единицы измерения если они есть
     * @param {string} widthValue - Значение ширины
     * @returns {string} - Обработанное значение ширины
     */
    processWidthValue(widthValue) {
        if (!widthValue) return this.options.minWidth + 'px';

        if (typeof widthValue === 'number') {
            return Math.max(widthValue, this.options.minWidth) + 'px';
        }

        if (typeof widthValue === 'string') {
            // Если строка содержит только цифры, добавляем px
            if (/^\d+$/.test(widthValue)) {
                return Math.max(parseInt(widthValue), this.options.minWidth) + 'px';
            }

            // Если есть единицы измерения, проверяем минимальную ширину
            const match = widthValue.match(/^([\d.]+)([a-z%]+)$/i);
            if (match) {
                const numValue = parseFloat(match[1]);
                const unit = match[2];

                // Для пикселей проверяем минимальное значение
                if (unit === 'px' && numValue < this.options.minWidth) {
                    return this.options.minWidth + 'px';
                }

                // Для других единиц оставляем как есть
                return widthValue;
            }
        }

        return this.options.minWidth + 'px';
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
            startWidth: 0,
            columnKeys: new Map()
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
     * Получает ключ столбца из заголовка
     */
    getColumnKey(header) {
        const attrName = this.options.dataColumnAttribute;
        return header.hasAttribute(attrName) ? header.getAttribute(attrName) : null;
    }

    /**
     * Проверяет, отключен ли столбец для регулировки
     */
    isColumnDisabled(header, instance) {
        const columnKey = this.getColumnKey(header);
        if (!columnKey) return false;

        const { disabledColumns } = instance.options;
        return disabledColumns.includes(columnKey);
    }

    /**
     * Получает индекс столбца по ключу
     */
    getColumnIndexByKey(instance, columnKey) {
        const firstRow = instance.table.querySelector('tr');
        if (!firstRow) return null;

        const cells = firstRow.querySelectorAll('th, td');
        for (let i = 0; i < cells.length; i++) {
            const cellKey = this.getColumnKey(cells[i]);
            if (cellKey === columnKey) {
                return i;
            }
        }
        return null;
    }

    /**
     * Настраивает таблицу для работы с ресайзом
     */
    setupTable(instance) {
        const { table, options } = instance;
        const headers = table.querySelectorAll('th:not(.column-control-header)');

        headers.forEach((header, index) => {
            const columnKey = this.getColumnKey(header);
            if (columnKey) {
                instance.columnKeys.set(index, columnKey);
            }

            let handle = header.querySelector('.resize-handle');
            if (handle) {
                handle.remove();
            }

            if (!this.isColumnDisabled(header, instance)) {
                handle = document.createElement('div');
                handle.className = 'resize-handle';
                header.appendChild(handle);

                handle.addEventListener('mousedown', (e) => {
                    this.startResize(e, instance, header);
                });

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
    }

    /**
     * Сохраняет оригинальные стили столбца column-control-header
     */
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
        if (this.isColumnDisabled(header, instance)) {
            return;
        }

        const { table } = instance;

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
            const columnKey = this.getColumnKey(instance.currentHeader);
            if (columnKey) {
                const columnIndex = this.getColumnIndexByKey(instance, columnKey);
                if (columnIndex !== null) {
                    this.setColumnWidth(instance, columnKey, columnIndex, newWidth + 'px');
                }
            }
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
    setColumnWidth(instance, columnKey, columnIndex, width) {
        if (instance.options.disabledColumns.includes(columnKey)) {
            return;
        }

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

    /**
     * Автоматически подбирает ширину столбца по содержимому
     */
    autoResizeColumn(instance, header, isInitialLoad = false) {
        if (header.classList.contains('column-control-header') || this.isColumnDisabled(header, instance)) {
            return;
        }

        const { table, options } = instance;
        const columnKey = this.getColumnKey(header);
        const columnIndex = this.getColumnIndexByKey(instance, columnKey);

        if (columnIndex === null) return;

        const rows = table.querySelectorAll('tr');
        let maxWidth = 0;

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
            const minWidth = options.minWidth + 'px';

            // Проверяем минимальную ширину только для пикселей
            if (this.hasUnit(currentWidth) && !currentWidth.endsWith('px')) {
                // Для не-px единиц сохраняем как есть
                widths[columnKey] = currentWidth;
            } else {
                // Для px или чисел проверяем минимальное значение
                const widthValue = parseInt(currentWidth);
                const finalWidth = widthValue < options.minWidth ? minWidth : currentWidth;
                widths[columnKey] = finalWidth;
            }
        });

        localStorage.setItem(options.storageKey, JSON.stringify(widths));
    }

    /**
     * Подсчитывает количество активных столбцов
     */
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

    /**
     * Загружает сохраненные ширины столбцов
     */
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
                    // Используем processWidthValue для обработки единиц измерения
                    const processedWidth = this.processWidthValue(savedWidth);
                    this.setColumnWidth(instance, columnKey, index, processedWidth);
                } else {
                    // Если нет сохраненной ширины, используем рекомендуемую
                    this.applyRecommendedWidth(instance, cell, columnKey, index);
                }
            });
        }

        // Если нет сохраненных ширин или не все столбцы имеют сохраненные ширины
        if (Object.keys(savedWidths).length === 0) {
            const { initialColumnWidths } = instance.options;
            const hasInitialWidths = Object.keys(initialColumnWidths).length > 0;

            if (hasInitialWidths) {
                // Применяем ручные начальные ширины
                const firstRow = table.querySelector('tr');
                if (firstRow) {
                    const cells = firstRow.querySelectorAll('th, td');
                    cells.forEach((cell, index) => {
                        const columnKey = this.getColumnKey(cell);
                        if (!columnKey || cell.classList.contains('column-control-header') ||
                            options.disabledColumns.includes(columnKey)) {
                            return;
                        }

                        const width = initialColumnWidths[columnKey];
                        if (width) {
                            const processedWidth = this.processWidthValue(width);
                            this.setColumnWidth(instance, columnKey, index, processedWidth);
                        } else {
                            // Для остальных — рекомендуемая ширина
                            this.applyRecommendedWidth(instance, cell, columnKey, index);
                        }
                    });
                }
            } else {
                // Нет initialColumnWidths — используем рекомендуемые ширины
                this.applyRecommendedWidths(instance);
            }

            // Сохраняем ширины после применения
            setTimeout(() => {
                this.saveColumnWidths(instance);
            }, 100);
        }

        // Всегда восстанавливаем стили column-control-header
        this.preserveControlColumnStyles(instance);
    }

    /**
     * Применяет рекомендуемую ширину к колонке
     */
    applyRecommendedWidth(instance, header, columnKey, columnIndex) {
        const recommendedWidth = this.getRecommendedWidth(header);

        if (recommendedWidth) {
            // Используем рекомендуемую ширину
            this.setColumnWidth(instance, columnKey, columnIndex, recommendedWidth);
        } else {
            // Используем дефолтную ширину
            this.applyDefaultWidthToColumn(instance, columnKey, columnIndex);
        }
    }

    /**
     * Применяет рекомендуемые ширины ко всем колонкам
     */
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

    /**
     * Применяет ширину по умолчанию к одному столбцу
     */
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

    /**
     * Применяет ширину по умолчанию к активным столбцам
     */
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

    /**
     * Равномерно распределяет столбцы
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

    /**
     * Сбрасывает ширины столбцов для таблицы
     */
    reset(tableId) {
        const instance = this.tables.get(tableId);
        if (instance) {
            localStorage.removeItem(instance.options.storageKey);
            this.applyRecommendedWidths(instance);

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
                    handle.remove();
                }
                header.classList.remove('resize-disabled');
            });

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