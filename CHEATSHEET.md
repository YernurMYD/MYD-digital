# Шпаргалка MYDigital

Быстрый справочник по основным операциям.

## 🚀 Быстрый старт

```javascript
// 1. Настройте проект
const PHOENIX_HOST = '192.168.2.77'
const PROJECT_NAME = 'MyProject'

// 2. Создайте sheets
const sheetManager = createSheetManager(project, {
    Main: 'Main',
    UI: 'UI',
});
const { sheets, sheet, playActive } = sheetManager;

// 3. Определите сцену
const SCENES = {
    Main: [
        { type: 'player', name: 'PLAYER', init: { x: 0, y: 0 }, id: 'player' },
    ],
};
initScenes(SCENES, sheets);

// 4. Запустите
sheet.sequence.play();
```

## 📐 Типы объектов

| Тип | Описание | Пример |
|-----|----------|--------|
| `player` | Видеоплеер | `{ type: 'player', name: 'PLAYER', id: 'player' }` |
| `obj` | Ссылка на элемент | `{ type: 'obj', name: 'weather', id: 'weather' }` |
| `rect` | Прямоугольник | `{ type: 'rect', name: 'Box', init: { x: 10, y: 10, w: 100, h: 100, bg: '#f00' } }` |
| `image` | Изображение | `{ type: 'image', name: 'Logo', init: { x: 50, y: 50, w: 200, h: 100, src: '/logo.png' } }` |
| `text` | Текст | `{ type: 'text', name: 'Title', init: { x: 100, y: 200, text: 'Hello', size: 48 } }` |
| `group` | Группа | `{ type: 'group', name: 'HUD', init: { x: 40, y: 40 } }` |

## 🎬 Управление воспроизведением

```javascript
// Один sheet
sheet.sequence.play()                 // Запуск
sheet.sequence.pause()                // Пауза
sheet.sequence.position = 5.0         // Перемотка

// Активные sheets
playActive()                          // Запуск всех
pauseActive()                         // Пауза всех
seekActive(5.0)                       // Перемотка всех
resetActive()                         // В начало

// Конкретный sheet
sheets.Main.sequence.play()
sheets.UI.sequence.pause()
```

## ⚙️ Параметры воспроизведения

```javascript
sheet.sequence.play({ 
    rate: 2.0                         // Скорость 2x
})

sheet.sequence.play({ 
    range: [1, 4]                     // С 1 по 4 сек
})

sheet.sequence.play({ 
    iterationCount: 3                 // 3 повтора
})

sheet.sequence.play({ 
    direction: 'reverse'              // Назад
})

sheet.sequence.play({ 
    iterationCount: Infinity,
    direction: 'alternateReverse'     // Бесконечно туда-сюда
})
```

## 🎯 Управление sheets

```javascript
// Установить активные
setActiveSheets('Main')               // Один
setActiveSheets('Main', 'UI')         // Несколько

// Добавить/удалить
addActiveSheet('Effects')             // Добавить
removeActiveSheet('UI')               // Удалить

// Получить активные
getActiveSheetsNames()                // ['Main', 'UI']
```

## 🎬 CD-Player (видеоплеер)

### Инициализация

```javascript
const player = document.getElementById('player');
player.init();                        // Подключение к Phoenix
player.USE_CACHE_IN_DEV = true;      // Кэш в dev режиме
```

### Методы

```javascript
player.play()                         // Воспроизведение
player.pause()                        // Пауза
player.swapVideo()                    // Переключить видео
player.screenInfo()                   // Инфо об экране
player.comment()                      // Комментарий видео
```

### События

```javascript
player.addEventListener('ready', () => {
    // Плеер готов
})

player.addEventListener('beginplay', () => {
    // Первое видео началось
    sheet.sequence.play()
})

player.addEventListener('play', () => {
    // Видео воспроизводится
})

player.addEventListener('ended', () => {
    // Видео закончилось
})

player.addEventListener('swapped', (e) => {
    // Видео переключено
    e.preventDefault()  // Остановить на последнем кадре
})
```

### Свойства

```javascript
player.playing                        // true если играет
```

### Чтение цвета из видео

```javascript
// Включить чтение пикселей
player.enableColorSampling();

// Получить RGB цвет
const color = player.rgbAvgAt(0);     // Позиция x=0
// { r: 120, g: 45, b: 200 }

const color = player.rgbAvgAt(0, 50); // Усреднить 50px
```

### Режим тайлинга (для больших разрешений)

```javascript
// Включить для 4K
player.enableTiling(true, 2, 2);      // Сетка 2×2

// Для 8K
player.enableTiling(true, 4, 4);      // Сетка 4×4

// Для UltraWide
player.enableTiling(true, 3, 1);      // 3×1

// Выключить
player.enableTiling(false);
```

**Рекомендации:**
- 4K → 2×2 (4 тайла)
- 8K → 4×4 (16 тайлов)
- UltraWide → 3×1 или 4×1

**Когда использовать:**
- ✅ Видео мерцает
- ✅ Разрешение 4K+
- ✅ Проблемы с GPU

### Скругление углов

```javascript
player.setRound(20);                  // 20px скругление

// Работает с тайлингом
player.enableTiling(true, 2, 2);
player.setRound(30);                  // Применится к тайлам
```

## 🎨 Программное управление элементами

> 📖 Подробнее: [PROGRAMMATIC_CONTROL.md](PROGRAMMATIC_CONTROL.md)

### Доступ к элементам

```javascript
// Theatre.js объект (для анимации)
sheets.Main.objects.CIRCLE0.value     // Текущие значения
sheets.Main.objects.CIRCLE0.onValuesChange(callback)

// DOM элемент с render (для программного управления)
sheets.Main.nodes.CIRCLE0.el          // DOM элемент
sheets.Main.nodes.CIRCLE0.render(values) // Обновить
```

### Программное обновление

```javascript
// Изменить один параметр
sheets.Main.nodes.CIRCLE0.render({ color: '#FF0000' });

// Изменить несколько
sheets.Main.nodes.CIRCLE0.render({ 
    color: '#00FF00', 
    radius: 50 
});
```

### Синхронизация с видео

```javascript
// Включить чтение цвета
player.enableColorSampling();

// Обновлять в реальном времени
onChange(sheet.sequence.pointer.position, () => {
    const color = player.rgbAvgAt(0);
    sheets.Main.nodes.CIRCLE0.render({ 
        color: `rgb(${color.r}, ${color.g}, ${color.b})` 
    });
});
```

### Интерактивность

```javascript
const circle = sheets.Main.nodes.CIRCLE0;

circle.el.addEventListener('click', () => {
    circle.render({ color: '#FF0000' });
});
```

## 🔧 Создание кастомных типов

```javascript
player.addEventListener('ready', () => {
    // Плеер готов
})

player.addEventListener('beginplay', () => {
    // Начало воспроизведения
    sheet.sequence.play()
})

player.addEventListener('ended', () => {
    // Видео закончилось
})

player.addEventListener('swapped', () => {
    // Видео переключено
})
```

## ⏱ Привязка к таймлайну

```javascript
bindOneShots(sheet.sequence, [
    { t: 1.0, fn: myFunc, args: ['arg'] },
    { t: 5.0, fn: otherFunc },
])
```

## 🔧 Часто используемые команды

```bash
npm run dev        # Разработка
npm run build      # Сборка
npm run preview    # Предпросмотр
npm run upload     # Отправка на устройство 
```

## 📱 Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Alt + \` / `Opt + \` | Открыть/закрыть Studio |
| `Space` | Play/Pause видео (dev) |

## 💡 Полезные советы

```javascript
// Ожидание завершения
sheet.sequence.play().then(() => {
    console.log('Done!')
})

// Проверка состояния
if (sheet.sequence.playing) { /* ... */ }

// Отслеживание позиции
onChange(sheet.sequence.pointer.position, (pos) => {
    console.log(pos)
})

// Иерархия объектов
{ type: 'group', name: 'HUD / __root', init: { x: 40, y: 40 } }
{ type: 'rect', name: 'HUD / Panel', init: { ... }, parent: 'HUD / __root' }
```

## 📚 Документация

- [readme.md](readme.md) - Основная документация
- [SHEETS_QUICK_GUIDE.md](SHEETS_QUICK_GUIDE.md) - Краткое руководство по sheets
- [API_REFERENCE.md](API_REFERENCE.md) - Справочник API
- [CD_PLAYER_GUIDE.md](CD_PLAYER_GUIDE.md) - Полное руководство по CD-Player

## 🆘 Нужна помощь?

1. Проверьте консоль браузера (F12)
2. Изучите документацию
3. Посмотрите `index.clean.html` для примера
4. Обратитесь к Theatre.js docs: https://www.theatrejs.com/docs/

