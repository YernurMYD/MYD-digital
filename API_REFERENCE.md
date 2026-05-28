# API Reference - MYDigital Functions

Справочник по функциям библиотеки MYDigital для работы с Theatre.js и Phoenix.

## Инициализация проекта

### `initPhoenixProject(host, projectName, projectState, dev)`

Инициализирует проект Theatre.js с интеграцией MYDigital Phoenix.

**Параметры:**
- `host` (string) - IP-адрес Phoenix в локальной сети
- `projectName` (string) - Имя проекта
- `projectState` (Object|null) - Состояние проекта из state.json (для продакшена)
- `dev` (boolean) - Режим разработки (true = с Studio, false = без Studio)

**Возвращает:** Promise<Project> - Theatre.js проект

**Пример:**
```javascript
const project = await initPhoenixProject(
    '192.168.2.77', 
    'MYDigitalDemo', 
    projectState, 
    import.meta.env.DEV
);
```

---

## Управление Sheets

### `createSheetManager(project, sheetDefinitions)`

Создаёт менеджер для управления несколькими sheets.

**Параметры:**
- `project` (Project) - Theatre.js проект
- `sheetDefinitions` (Object) - Определения sheets в формате `{ ключ: 'id' }`

**Возвращает:** Object со следующими свойствами и методами:

#### Свойства:
- `sheets` (Object) - Словарь всех sheets
- `sheet` (Sheet) - Алиас для `sheets.Main` (для совместимости)

#### Методы:
- `getSheet()` - Получить первый активный sheet
- `getActiveSheets()` - Получить массив всех активных sheets
- `getActiveSheetsNames()` - Получить массив имён активных sheets
- `setActiveSheets(...names)` - Установить активные sheets
- `addActiveSheet(name)` - Добавить sheet к активным
- `removeActiveSheet(name)` - Удалить sheet из активных
- `playActive(options)` - Воспроизвести все активные sheets
- `pauseActive()` - Приостановить все активные sheets
- `seekActive(position)` - Перемотать все активные sheets
- `resetActive()` - Сбросить все активные sheets в начало

**Пример:**
```javascript
const sheetManager = createSheetManager(project, {
    Main: 'Main',
    UI: 'UI',
    Effects: 'Effects',
});

const { 
    sheets, 
    setActiveSheets, 
    playActive 
} = sheetManager;

setActiveSheets('Main', 'UI');
playActive({ rate: 1.0 });
```

---

## Инициализация сцен

### `initScenes(scenes, sheets)`

Инициализирует объекты на соответствующих sheets.

**Параметры:**
- `scenes` (Object) - Словарь сцен в формате `{ sheetName: [objects] }`
- `sheets` (Object) - Словарь sheets из sheetManager

**Пример:**
```javascript
const SCENES = {
    Main: [
        { type: 'player', name: 'PLAYER', init: { x: 0, y: 0 }, id: 'player' },
    ],
    UI: [
        { type: 'rect', name: 'TopBar', init: { x: 0, y: 0, w: 1920, h: 80 } },
    ],
};

initScenes(SCENES, sheets);
```

---

## Создание сущностей

### `makeEntity(definition, sheet)`

Создаёт и регистрирует сущность на сцене.

**Параметры:**
- `definition` (Object) - Определение объекта:
  - `type` (string) - Тип объекта (obj, group, rect, image, text, player)
  - `name` (string) - Уникальное имя объекта
  - `init` (Object) - Начальные параметры (x, y, w, h, bg, text, size, color, src, rot и др.)
  - `parent` (string) - Имя родительской сущности (опционально)
  - `id` (string) - ID DOM-элемента (опционально)
  - `el` (HTMLElement) - Существующий DOM-элемент (опционально)
- `sheet` (Sheet) - Theatre.js sheet

**Возвращает:** ISheetObject

**Пример:**
```javascript
makeEntity({
    type: 'text',
    name: 'Title',
    init: { x: 100, y: 200, text: 'Hello', size: 48, color: '#fff' }
}, sheets.Main);
```

---

## Привязка событий к таймлайну

### `bindOneShots(sequence, triggers, options)`

Привязывает вызовы функций к позициям на таймлайне.

**Параметры:**
- `sequence` (ISequence) - sheet.sequence из Theatre.js
- `triggers` (Array) - Массив триггеров:
  - `t` (number) - Время в секундах
  - `fn` (Function) - Функция для вызова
  - `args` (Array) - Аргументы функции (опционально)
- `options` (Object) - Опции:
  - `epsilon` (number) - Допуск на сравнение времени (по умолчанию 0.013)

**Возвращает:** Object с методами управления:
- `start()` - Запустить отслеживание
- `stop()` - Остановить отслеживание
- `reset()` - Сбросить состояние триггеров
- `destroy()` - Уничтожить все обработчики

**Пример:**
```javascript
bindOneShots(sheet.sequence, [
    { t: 1.0, fn: showTitle, args: ['Welcome'] },
    { t: 5.0, fn: fadeOut },
    { t: 10.0, fn: nextScene, args: ['Scene2'] },
]);
```

---

## Расширение типов объектов

### `extendTypes(name, definition)`

Создаёт новый тип анимируемого объекта.

**Параметры:**
- `name` (string) - Имя типа
- `definition` (Object) - Определение типа:
  - `schema` (Function) - Функция, возвращающая схему объекта
  - `mount` (Function) - Функция создания DOM-элемента
  - `render` (Function) - Функция обновления DOM-элемента

**Пример:**
```javascript
extendTypes('glass', {
    schema: (init = {}) => ({
        ...baseSchema(init),
        w: types.number(init.w ?? 160),
        h: types.number(init.h ?? 120),
        matte: types.number(init.matte ?? 0, { range: [0, 20] })
    }),
    mount(parent) {
        const el = document.createElement('div');
        el.className = 'node';
        parent.appendChild(el);
        return el;
    },
    render(el, v) {
        el.style.width = v.w + 'px';
        el.style.height = v.h + 'px';
        el.style.backdropFilter = 'blur(' + v.matte + 'px)';
    }
});
```

---

## Программное управление элементами

После инициализации сцен через `initScenes()`, все элементы доступны через два интерфейса:

### `sheets[sheetName].objects[objectName]`
Theatre.js объект для работы с анимацией. Содержит:
- `value` - текущие значения свойств
- `onValuesChange(callback)` - подписка на изменения

**Пример:**
```javascript
// Получить текущие значения
const currentColor = sheets.Main.objects.CIRCLE0.value.color;
console.log(currentColor); // '#00FF00'

// Подписаться на изменения
sheets.Main.objects.CIRCLE0.onValuesChange((values) => {
    console.log('Новые значения:', values);
});
```

### `sheets[sheetName].nodes[objectName]`
Обёртка над DOM-элементом с методом `render()` для программного обновления **в обход Theatre.js**.

**Свойства:**
- `el` (HTMLElement) - DOM-элемент
- `render(values)` (Function) - Функция обновления

**Метод `render(values)`:**
Позволяет обновить визуальное представление элемента, передав только те свойства, которые нужно изменить. 
Остальные свойства берутся из текущего состояния Theatre.js объекта.

**Параметры:**
- `values` (Object) - Объект со свойствами для обновления (частичный)

**Пример:**
```javascript
// Изменить только цвет
sheets.Main.nodes.CIRCLE0.render({ color: '#FF0000' });

// Изменить несколько свойств
sheets.Main.nodes.CIRCLE0.render({ 
    color: '#00FF00', 
    radius: 50,
    blur: 20 
});

// Доступ к DOM элементу
sheets.Main.nodes.CIRCLE0.el.addEventListener('click', () => {
    console.log('Clicked!');
});
```

### Использование с CD-Player

Типичный сценарий - синхронизация цвета элементов с видео:

```javascript
onChange(sheet.sequence.pointer.position, (pos) => {
    // Получить цвет из видео
    const color = player.rgbAvgAt(0, 50);
    
    // Обновить элементы программно
    sheets.Main.nodes.CIRCLE0.render({ 
        color: `rgb(${color.r}, ${color.g}, ${color.b})` 
    });
    
    sheets.Main.nodes.CIRCLE1.render({ 
        color: `rgb(${color.r}, ${color.g}, ${color.b})` 
    });
});
```

### Когда использовать `sheets.nodes[name].render()`?

**✅ Используйте когда:**
- Нужно обновлять значения в реальном времени (например, по данным с видео)
- Значения меняются слишком часто для keyframe-анимации
- Нужна интеграция с внешними данными (API, сенсоры и т.д.)
- Хотите программный контроль поверх анимации

**❌ Не используйте когда:**
- Анимация может быть создана в Theatre.js Studio
- Нужна синхронизация со звуком/видео через Timeline
- Требуется экспорт анимации в state.json

### Совмещение программного и анимационного управления

Можно использовать оба подхода одновременно:

```javascript
// Анимируем позицию через Theatre.js
// (настраивается в Studio)

// Но цвет обновляем программно
onChange(sheet.sequence.pointer.position, () => {
    const color = getColorFromExternalSource();
    sheets.Main.nodes.CIRCLE0.render({ color });
    
    // x, y, radius и другие свойства 
    // продолжают управляться анимацией из Studio
});
```

---

## Утилиты

### `baseSchema(init)`

Возвращает базовую схему для объектов (x, y, rot, sx, sy, opacity, z, blur).

**Параметры:**
- `init` (Object) - Начальные значения (опционально)

**Возвращает:** Object - Схема Theatre.js

**Пример:**
```javascript
const mySchema = {
    ...baseSchema({ x: 100, y: 200 }),
    customProp: types.number(0, { range: [0, 100] })
};
```

---

### `rotateScreen(rotation)`

Поворачивает сцену на заданный угол.

**Параметры:**
- `rotation` (number) - Угол поворота (0, 90, 180, 270)

**Пример:**
```javascript
rotateScreen(90); // Повернуть на 90 градусов
```

---

## Типы объектов

### Встроенные типы:

#### `obj`
Общий объект для ссылок на существующие элементы.
```javascript
{ type: 'obj', name: 'MyElement', init: { x: 0, y: 0, classlist: 'is-hidden accent' }, id: 'my-element' }
```

- `classlist`: строка с CSS-классами через пробел. Классы из этого поля добавляются поверх исходных классов DOM-элемента.

#### `group`
Группа объектов для иерархии.
```javascript
{ type: 'group', name: 'HUD / __root', init: { x: 40, y: 40 } }
```

#### `rect`
Прямоугольник с фоном.
```javascript
{ type: 'rect', name: 'Box', init: { x: 10, y: 10, w: 100, h: 100, bg: '#f00' } }
```

#### `image`
Изображение.
```javascript
{ type: 'image', name: 'Logo', init: { x: 50, y: 50, w: 200, h: 100, src: '/logo.png', fit: 'contain' } }
```
- `fit`: 'contain' | 'cover' | 'fill' | 'scale-down' | 'none'

#### `text`
Текстовый элемент.
```javascript
{ type: 'text', name: 'Title', init: { x: 100, y: 200, text: 'Hello', size: 48, color: '#fff' } }
```

#### `player`
Видеоплеер MYDigital.
```javascript
{ type: 'player', name: 'PLAYER', init: { x: 0, y: 0 }, id: 'player' }
```

---

## CD-Player

Компонент `cd-player` - видеоплеер с двойной буферизацией для плавного переключения между видео.

> 📚 **Полная документация:** [CD_PLAYER_GUIDE.md](CD_PLAYER_GUIDE.md)

### Базовое использование

```javascript
const player = document.getElementById('player');

// Инициализация
player.init();

// Основные методы
player.play();                        // Воспроизведение
player.pause();                       // Пауза
player.swapVideo();                   // Переключение видео
player.screenInfo();                  // Информация об экране
player.comment();                     // Комментарий видео
player.setRound(20);                  // Скругление углов

// Режим тайлинга (для 4K, 8K)
player.enableTiling(true, 2, 2);      // Включить сетку 2×2
player.enableTiling(false);           // Выключить
```

### События

```javascript
player.addEventListener('ready', () => {
    // Плеер готов
});

player.addEventListener('beginplay', () => {
    // Первое видео началось
    sheet.sequence.play();
});

player.addEventListener('play', () => {
    // Видео воспроизводится
});

player.addEventListener('ended', () => {
    // Видео закончилось
});

player.addEventListener('swapped', (e) => {
    // Видео переключено
    // e.preventDefault() для остановки
});
```

### Режим тайлинга

Для устранения мерцания при больших разрешениях:

```javascript
// 4K → 2×2, 8K → 4×4, UltraWide → 3×1
player.enableTiling(true, 2, 2);
```

См. [CD_PLAYER_GUIDE.md](CD_PLAYER_GUIDE.md) для подробной информации о методах, событиях, тайлинге и примерах использования.

---

## Управление Sheet Sequence

### Основные методы:

```javascript
// Воспроизведение
sheet.sequence.play();
sheet.sequence.play({ rate: 1.5 }); // С параметрами
sheet.sequence.play({ range: [1, 4] }); // Диапазон
sheet.sequence.play({ iterationCount: 3 }); // Повторений
sheet.sequence.play({ direction: 'reverse' }); // Обратное
sheet.sequence.play({ 
    iterationCount: Infinity, 
    direction: 'alternateReverse' 
}); // Бесконечный цикл туда-обратно

// Пауза
sheet.sequence.pause();

// Позиция
sheet.sequence.position = 5.0; // Установить позицию в секундах
const pos = sheet.sequence.position; // Получить позицию

// Проверка состояния
const isPlaying = sheet.sequence.playing;

// Ожидание завершения
sheet.sequence.play().then(() => {
    console.log('Завершено');
});
```

---

## Примеры использования

### Простой проект с одним sheet:

```javascript
const project = await initPhoenixProject('192.168.2.77', 'MyProject', projectState, true);

const sheetManager = createSheetManager(project, { Main: 'Main' });
const { sheets, sheet } = sheetManager;

const SCENES = {
    Main: [
        { type: 'text', name: 'Title', init: { x: 100, y: 100, text: 'Hello World', size: 64 } }
    ]
};

initScenes(SCENES, sheets);

sheet.sequence.play();
```

### Многослойный проект:

```javascript
const project = await initPhoenixProject('192.168.2.77', 'MultiLayer', projectState, false);

const sheetManager = createSheetManager(project, {
    Background: 'Background',
    Main: 'Main',
    UI: 'UI',
    Effects: 'Effects'
});

const { sheets, setActiveSheets, playActive } = sheetManager;

const SCENES = {
    Background: [
        { type: 'image', name: 'BG', init: { x: 0, y: 0, w: 1920, h: 1080, src: '/bg.jpg' } }
    ],
    Main: [
        { type: 'player', name: 'PLAYER', init: { x: 0, y: 0 }, id: 'player' }
    ],
    UI: [
        { type: 'rect', name: 'TopBar', init: { x: 0, y: 0, w: 1920, h: 80, bg: '#000' } }
    ],
    Effects: [
        { type: 'rect', name: 'Fade', init: { x: 0, y: 0, w: 1920, h: 1080, bg: '#000', opacity: 0 } }
    ]
};

initScenes(SCENES, sheets);

// Воспроизведение разных слоёв с разными параметрами
sheets.Background.sequence.play({ rate: 0.5 });
sheets.Main.sequence.play();
sheets.UI.sequence.play({ iterationCount: Infinity });

// Или через активные sheets
setActiveSheets('Main', 'UI', 'Effects');
playActive();
```

---

## Глобальные объекты

После инициализации доступны:

- `window.PHOENIX_HOST` - IP-адрес Phoenix
- `registry` - Глобальный реестр сущностей (Map)

---

## TypeScript типы

Для TypeScript-проектов доступны следующие типы:

```typescript
interface EntityDefinition {
    type: 'obj' | 'group' | 'rect' | 'image' | 'text' | 'player';
    name: string;
    init?: Record<string, any>;
    parent?: string;
    id?: string;
    el?: HTMLElement;
}

interface SheetManager {
    sheets: Record<string, ISheet>;
    sheet: ISheet;
    getSheet: () => ISheet;
    getActiveSheets: () => ISheet[];
    getActiveSheetsNames: () => string[];
    setActiveSheets: (...names: string[]) => string[];
    addActiveSheet: (name: string) => string[];
    removeActiveSheet: (name: string) => string[];
    playActive: (options?: PlaybackOptions) => Promise<void>[];
    pauseActive: () => void;
    seekActive: (position: number) => void;
    resetActive: () => void;
}

interface Trigger {
    t: number;
    fn: Function;
    args?: any[];
}
```

---

Этот API обеспечивает полный контроль над анимацией и композицией в MYDigital проектах.
