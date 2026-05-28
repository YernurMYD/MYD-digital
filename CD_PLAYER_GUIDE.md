# Руководство по работе с CD-Player

Полное руководство по использованию видеоплеера MYDigital с двойной буферизацией.

## 📖 Содержание

1. [Введение](#введение)
2. [Архитектура](#архитектура)
3. [Быстрый старт](#быстрый-старт)
4. [API Reference](#api-reference)
5. [Примеры использования](#примеры-использования)
6. [Лучшие практики](#лучшие-практики)
7. [Решение проблем](#решение-проблем)

---

## Введение

`cd-player` - это веб-компонент (Custom Element) для воспроизведения видео с двойной буферизацией. Основные преимущества:

✅ **Бесшовное переключение** - нет чёрного экрана между видео  
✅ **Предзагрузка** - следующее видео готовится заранее  
✅ **WebSocket интеграция** - автоматическое управление от Phoenix  
✅ **Прогрев декодера** - плавный старт без заиканий  
✅ **Управление кэшированием** - оптимизация для разработки и продакшена  

---

## Архитектура

### Двойная буферизация

Плеер содержит два `<video>` элемента:

```
┌────────────────────────────────────┐
│  CD-Player (Shadow DOM)            │
│                                    │
│  ┌──────────────┐  ┌────────────┐  │
│  │ Video A      │  │ Video B    │  │
│  │ (активный)   │  │ (ожидает)  │  │
│  │ visible      │  │ hidden     │  │
│  │ playing      │  │ prepared   │  │
│  └──────────────┘  └────────────┘  │
└────────────────────────────────────┘
```

**Переключение:**
1. Ожидающее видео становится видимым
2. Элементы меняются ролями
3. Старое видео останавливается и очищается

**Результат:** Мгновенный переход без чёрного экрана!

### Жизненный цикл видео

```
1. prepare(id) → загрузка в ожидающий буфер
2. прогрев декодера (play → pause → seek(0))
3. готово к переключению
4. swapVideo() → переключение
5. старое видео освобождается
```

---

## Быстрый старт

### 1. HTML разметка

```html
<div id="stage">
    <cd-player id="player" class="node"></cd-player>
</div>
```

### 2. Импорт компонента

```javascript
import "./mydigital/components/cd-player.min";
```

### 3. Инициализация

```javascript
const player = document.getElementById('player');

onload = () => {
    player.init(); // Подключение к Phoenix
    
    player.screenInfo().then(info => {
        console.log('Screen resolution:', info.x, 'x', info.y);
        console.log('Rotation:', info.rot);
    });
    
    // Опционально: включить кэширование в dev
    player.USE_CACHE_IN_DEV = true;
};
```

### 4. Обработка событий

```javascript
player.addEventListener('ready', () => {
    console.log('✓ Player ready');
});

player.addEventListener('beginplay', () => {
    console.log('▶ First video started');
    // Запустить анимацию
    sheet.sequence.play();
});

player.addEventListener('swapped', () => {
    console.log('⇄ Video swapped');
});
```

---

## API Reference

### Методы

#### init()
Инициализирует плеер и устанавливает соединение с Phoenix.

```javascript
player.init();
```

**Важно:** Вызывайте только после загрузки страницы!

---

#### enableColorSampling()
Включает чтение пиксельных данных верхней строки видео для использования `rgbAvgAt()`.

```javascript
await player.enableColorSampling();
```

**Когда использовать:**
- Нужно использовать `rgbAvgAt()` для анализа цвета
- Нужен ambient lighting или цветовая синхронизация UI

**Когда НЕ использовать:**
- Не используется `rgbAvgAt()` в проекте
- Важна максимальная производительность

**Оптимизация:**
Чтение пиксельных данных требует ресурсов (canvas.getImageData() дорога операция). 
Поэтому этот метод должен быть вызван **только если необходимо**:

```javascript
onload = () => {
    player.init();
    
    // Вызвать только если используется rgbAvgAt()
    if (needsColorAnalysis) {
        player.enableColorSampling();
    }
};
```

---

#### play() / playActive()
Запускает воспроизведение активного видео. Автоматически переключает 
видео, если было поставлено на паузу без переключения.

```javascript
player.play();
```

---

#### pause() / pauseActive()
Приостанавливает воспроизведение.

```javascript
player.pause();
```

---

#### swapVideo(play)
Переключает активное и ожидающее видео.

```javascript
// Просто переключить
await player.swapVideo();

// Переключить и запустить
await player.swapVideo(true);
```

**Параметры:**
- `play` (boolean) - запустить после переключения

---

#### screenInfo()
Получает информацию об экране от Phoenix.

```javascript
const info = await player.screenInfo();
// { x: 1920, y: 1080, rot: 0 }
```

**Использование:**
```javascript
player.screenInfo().then(info => {
    if (!project.mydigital.dev) {
        rotateScreen(info.rot);
    }
});
```

---

#### setRound(radius)
Устанавливает скругление углов видео.

```javascript
player.setRound(16); // border-radius: 16px
```

**Анимация через Theatre.js:**
```javascript
{ type: 'player', name: 'PLAYER', init: { x: 0, y: 0, round: 0 } }
```

---

#### comment()
Возвращает комментарий текущего видео.

```javascript
const text = player.comment();
console.log(text); // "Welcome video"
```

---

#### inactive_comment()
Возвращает комментарий ожидающего видео.

```javascript
const next = player.inactive_comment();
```

---

#### rgbAvgAt(x, w)
Возвращает средний цвет RGB верхней строки пикселей активного видео.

```javascript
const color = player.rgbAvgAt(x, w);
// { r: 120, g: 45, b: 200 }
```

**⚠️ Важно:** Сначала нужно вызвать `enableColorSampling()`!

```javascript
onload = () => {
    player.init();
    player.enableColorSampling(); // Активировать чтение цвета
    
    // Теперь rgbAvgAt() будет работать
    onChange(sheet.sequence.pointer.position, () => {
        const color = player.rgbAvgAt(0);
        console.log(color);
    });
};
```

**Параметры:**
- `x` (number) - горизонтальная позиция пикселя (0 - левый край)
- `w` (number, optional) - ширина области для усреднения в пикселях (по умолчанию 1)

**Возвращает:**
- `{ r, g, b }` - объект с компонентами цвета (0-255)
- `{ r: 0, g: 0, b: 0 }` - если `enableColorSampling()` не был вызван

**Использование:**
```javascript
// Получить цвет одного пикселя слева
const leftColor = player.rgbAvgAt(0);

// Усреднить цвет области шириной 100px
const avgColor = player.rgbAvgAt(0, 100);

// Отслеживать изменение цвета во время анимации
onChange(sheet.sequence.pointer.position, (pos) => {
    const color = player.rgbAvgAt(0);
    console.log(`RGB: ${color.r}, ${color.g}, ${color.b}`);
});
```

**Применение:**
- Динамическое изменение цвета элементов UI возле видео
- Создание ambient lighting эффектов
- Синхронизация цветовой схемы с контентом
- Анализ визуального содержимого для триггеров

**Производительность:**
- Методу нужны данные пикселей от `enableColorSampling()`
- Без вызова `enableColorSampling()` метод вернёт чёрный цвет
- Не забывайте про `enableColorSampling()` если планируете использовать `rgbAvgAt()`

---

### Свойства

#### playing (read-only)
Возвращает состояние воспроизведения.

```javascript
if (player.playing) {
    console.log('▶ Playing');
} else {
    console.log('⏸ Paused');
}
```

---

#### USE_CACHE_IN_DEV (write-only)
Кэширование в режиме разработки.

```javascript
player.USE_CACHE_IN_DEV = true;
```

**Когда использовать:** Если видео загружаются медленно через локальную сеть.

---

#### USE_CACHE (write-only)
Кэширование в продакшене.

```javascript
player.USE_CACHE = true; // ⚠️ Не рекомендуется!
```

**Предупреждение:** Сокращает срок службы SD карты.

---

### События

#### ready
Плеер готов к работе.

```javascript
player.addEventListener('ready', () => {
    console.log('Player initialized');
});
```

---

#### beginplay
Первое видео начало воспроизводиться.

```javascript
player.addEventListener('beginplay', () => {
    // Запустить анимацию
    sheet.sequence.play();
});
```

**Важно:** Событие вызывается только один раз!

---

#### play
Видео начало воспроизведение.

```javascript
player.addEventListener('play', (e) => {
    console.log('Playing:', e.detail.video);
    console.log('Comment:', player.comment());
});
```

**Detail:**
- `video` (HTMLVideoElement) - элемент видео

---

#### ended
Видео закончилось.

```javascript
player.addEventListener('ended', (e) => {
    console.log('Video ended');
    // Автоматически переключится на следующее
});
```

---

#### swapped (cancelable)
Видео переключено. **Можно отменить!**

```javascript
player.addEventListener('swapped', (e) => {
    // Остановиться на последнем кадре
    if (shouldPause) {
        e.preventDefault();
    }
});
```

**Важно:** `preventDefault()` остановит переключение и поставит на паузу.

---

## Примеры использования

### Базовая настройка

```javascript
const player = document.getElementById('player');

player.addEventListener('ready', () => {
    console.log('✓ Ready');
});

player.addEventListener('beginplay', () => {
    console.log('▶ Started');
    sheet.sequence.play();
});

onload = () => {
    player.init();
    
    // ⚠️ Включить только если используется rgbAvgAt()!
    // Это требует ресурсов, поэтому вызывайте только если нужно
    if (project.useColorAnalysis) {
        player.enableColorSampling();
    }
    
    player.USE_CACHE_IN_DEV = true;
    
    player.screenInfo().then(info => {
        if (!project.mydigital.dev) {
            rotateScreen(info.rot);
        } else {
            stage.style.width = info.x + 'px';
            stage.style.height = info.y + 'px';
        }
    });
};
```

---

### Использование rgbAvgAt с enableColorSampling

```javascript
onload = () => {
    player.init();
    
    // Активировать чтение пиксельных данных
    player.enableColorSampling();
    
    // Теперь можно использовать rgbAvgAt()
    onChange(sheet.sequence.pointer.position, () => {
        const leftColor = player.rgbAvgAt(0, 20);
        const centerColor = player.rgbAvgAt(960, 50);
        const rightColor = player.rgbAvgAt(1900, 20);
        
        console.log('Left:', leftColor);
        console.log('Center:', centerColor);
        console.log('Right:', rightColor);
    });
};
```

---

### Условное включение color sampling

```javascript
// Если цветовой анализ опциональный
const useColorEffects = project.config?.useAmbientLighting ?? false;

onload = () => {
    player.init();
    
    // Включить только если нужно
    if (useColorEffects) {
        console.log('🎨 Color analysis enabled');
        player.enableColorSampling();
    } else {
        console.log('⚡ Color analysis disabled (better performance)');
    }
};
```

---

### Управление с клавиатуры

```javascript
window.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'Space':
            player.playing ? player.pause() : player.play();
            break;
    }
});
```

---

### Синхронизация анимации с видео

```javascript
player.addEventListener('beginplay', () => {
    // Запуск всех слоёв анимации
    setActiveSheets('Main', 'UI', 'Effects');
    playActive();
});

player.addEventListener('swapped', () => {
    // Эффект перехода
    sheets.Effects.sequence.play({ range: [0, 1] });
});

player.addEventListener('ended', () => {
    // Остановка анимации по окончании
    pauseActive();
});
```

---

### Отображение информации о видео

```javascript
// Создать элемент для отображения
const videoInfo = document.createElement('div');
videoInfo.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px;
    background: rgba(0,0,0,0.7);
    color: white;
    font-size: 16px;
`;
document.body.appendChild(videoInfo);

// Обновлять при каждом видео
player.addEventListener('play', () => {
    videoInfo.textContent = player.comment() || 'Untitled';
});

player.addEventListener('swapped', () => {
    const next = player.inactive_comment();
    console.log('Next video:', next);
});
```

---

### Автоматическое управление от Phoenix

**Важно:** Плеер управляется автоматически через WebSocket от Phoenix. Вам не нужно вручную вызывать методы для воспроизведения или переключения видео, если воспроизведение не было прервано вручную.

```javascript
// ✅ Правильно - просто реагируем на события
player.addEventListener('beginplay', () => {
    console.log('Первое видео началось');
    sheet.sequence.play();
});

player.addEventListener('swapped', () => {
    console.log('Видео переключено на:', player.comment());
});
```

---

### Остановка на определённом видео

```javascript
let stopAfterThisVideo = 'outro_video';

player.addEventListener('play', () => {
    const currentComment = player.comment();
    
    if (currentComment === stopAfterThisVideo) {
        // Остановиться после этого видео
        player.addEventListener('ended', (e) => {
            e.preventDefault();
            player.pause();
        }, { once: true });
    }
});
```

---

### Динамическое изменение цвета UI по видео

```javascript
// Создать элемент с ambient lighting
const ambientBorder = document.createElement('div');
ambientBorder.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 100px 50px rgba(0,0,0,0);
    transition: box-shadow 0.3s;
`;
document.body.appendChild(ambientBorder);

// Обновлять цвет рамки в реальном времени
onChange(sheet.sequence.pointer.position, (pos) => {
    const color = player.rgbAvgAt(0, 50); // Усреднить первые 50px
    ambientBorder.style.boxShadow = 
        `inset 0 0 100px 50px rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;
});
```

**Другие применения:**

```javascript
// Изменить цвет фона под видео
onChange(sheet.sequence.pointer.position, () => {
    const color = player.rgbAvgAt(960, 100); // Центр экрана 1920px
    document.body.style.backgroundColor = 
        `rgb(${color.r}, ${color.g}, ${color.b})`;
});

// Триггер по яркости
onChange(sheet.sequence.pointer.position, () => {
    const color = player.rgbAvgAt(0);
    const brightness = (color.r + color.g + color.b) / 3;
    
    if (brightness > 200) {
        // Светлая сцена - тёмный текст
        textElement.style.color = '#000';
    } else {
        // Тёмная сцена - светлый текст
        textElement.style.color = '#fff';
    }
});

// Создание градиента по краям видео
function updateGradient() {
    const left = player.rgbAvgAt(0, 20);
    const right = player.rgbAvgAt(1900, 20); // Для 1920px ширины
    
    overlay.style.background = `linear-gradient(
        to right,
        rgba(${left.r}, ${left.g}, ${left.b}, 0.3),
        transparent,
        rgba(${right.r}, ${right.g}, ${right.b}, 0.3)
    )`;
}

onChange(sheet.sequence.pointer.position, updateGradient);
```

---

## Лучшие практики

### ✅ DO

1. **Инициализируйте в onload**
   ```javascript
   onload = () => player.init();
   ```

2. **Включайте enableColorSampling только если нужно rgbAvgAt()**
   ```javascript
   // Хорошо - экономим ресурсы
   if (needsColorAnalysis) {
       player.enableColorSampling();
   }
   ```

3. **Используйте кэш в dev режиме (необязательно, если с выключенным кэшем все работает)**
   ```javascript
   player.USE_CACHE_IN_DEV = true;
   ```

4. **Обрабатывайте beginplay для запуска анимации**
   ```javascript
   player.addEventListener('beginplay', () => {
       sheet.sequence.play();
   });
   ```

5. **Проверяйте screenInfo для поворота**
   ```javascript
   player.screenInfo().then(info => {
       rotateScreen(info.rot);
   });
   ```

6. **Используйте комментарии для отладки**
   ```javascript
   console.log('Current:', player.comment());
   ```

---

### ❌ DON'T

1. **Не вызывайте init() до загрузки страницы**
   ```javascript
   // ❌ Плохо
   player.init();
   
   // ✅ Хорошо
   onload = () => player.init();
   ```

2. **Не включайте enableColorSampling() если не используете rgbAvgAt()**
   ```javascript
   // ❌ Плохо - бесполезно нагружает систему
   onload = () => {
       player.init();
       player.enableColorSampling(); // Зачем если не нужна?
   };
   
   // ✅ Хорошо - включайте только если нужно
   onload = () => {
       player.init();
       if (project.useColorAnalysis) {
           player.enableColorSampling();
       }
   };
   ```

3. **Не используйте rgbAvgAt() без enableColorSampling()**
   ```javascript
   // ❌ Плохо - вернёт чёрный цвет
   onload = () => {
       player.init();
       // enableColorSampling не вызван!
       onChange(..., () => {
           const color = player.rgbAvgAt(0); // { r: 0, g: 0, b: 0 }
       });
   };
   
   // ✅ Хорошо
   onload = () => {
       player.init();
       player.enableColorSampling();
       onChange(..., () => {
           const color = player.rgbAvgAt(0); // Нормальные значения
       });
   };
   ```

4. **Не включайте кэш в продакшене**
   ```javascript
   // ❌ Плохо - изнашивает SD карту
   player.USE_CACHE = true;
   ```

5. **Не управляйте src напрямую**
   ```javascript
   // ❌ Плохо
   player._videoA.src = 'video.mp4';
   
   // ✅ Хорошо - Phoenix сделает это автоматически
   // Просто дождитесь событий ready/beginplay
   ```

6. **Не вызывайте внутренние методы напрямую**
   ```javascript
   // ❌ Плохо - эти методы вызывает Phoenix автоматически
   player._prepare('video_id');
   player._startPlay('video_id');
   
   // ✅ Хорошо - Phoenix управляет воспроизведением
   player.addEventListener('beginplay', () => {
       // Просто реагируйте на события
   });
   ```

7. **Не забывайте про автоматическое переключение**
   ```javascript
   // ❌ Плохо - не обрабатывайте ended без необходимости
   player.addEventListener('ended', () => {
       player.swapVideo();
   });
   
   // ✅ Хорошо - Phoenix сделает это за вас
   ```

---

## Решение проблем

### Проблема: Autoplay failed

**Симптом:** Ошибка в консоли при первом запуске

**Причина:** Браузеры блокируют автозапуск видео

**Решение:** Это нормально! Плеер автоматически обработает ситуацию.

```javascript
player.addEventListener('beginplay', () => {
    if (project.mydigital.dev) {
        player.pause(); // В dev режиме можно поставить на паузу
    }
});
```

---

## Режим тайлинга

### Введение

Режим тайлинга решает проблему **мерцания при больших разрешениях** (4K, 8K). Вместо рендеринга единого большого холста, видео разделяется на сетку из нескольких маленьких canvas-элементов (тайлов).

### Когда использовать

✅ **Используйте тайлинг если:**
- Видео мерцает при воспроизведении
- Разрешение 4K или выше
- Проблемы с GPU памятью
- Нужна стабильность рендеринга

❌ **НЕ используйте если:**
- Видео работает стабильно
- Разрешение Full HD или ниже
- Критична максимальная производительность

### Как это работает

```
Обычный режим:           Режим тайлинга (2×2):
┌─────────────────┐      ┌────────┬────────┐
│                 │      │ Тайл 1 │ Тайл 2 │
│   Одно видео    │  →   ├────────┼────────┤
│                 │      │ Тайл 3 │ Тайл 4 │
└─────────────────┘      └────────┴────────┘
```

1. Видео разбивается на сетку (например, 2×2, 3×3, 4×4)
2. Размер каждого тайла вычисляется автоматически
3. Каждый canvas рендерит свою часть через `drawImage()`
4. Система автоматически обрабатывает нечетные размеры

### API

#### enableTiling(enabled, tilesX, tilesY)

Включает или выключает режим тайлинга.

**Параметры:**
- `enabled` (boolean) - включить/выключить
- `tilesX` (number, опционально) - количество тайлов по горизонтали (по умолчанию 2)
- `tilesY` (number, опционально) - количество тайлов по вертикали (по умолчанию 2)

**Примеры:**

```javascript
const player = document.querySelector('cd-player');

// Включить с сеткой 2×2 (по умолчанию)
player.enableTiling(true);

// Включить с кастомной сеткой
player.enableTiling(true, 3, 3); // 3×3 = 9 тайлов
player.enableTiling(true, 4, 4); // 4×4 = 16 тайлов
player.enableTiling(true, 3, 1); // 3×1 = 3 тайла (для UltraWide)

// Выключить
player.enableTiling(false);
```

### Рекомендации по сеткам

| Разрешение видео | Рекомендуемая сетка | Количество тайлов | Размер тайла (~) |
|------------------|---------------------|-------------------|------------------|
| 4K (3840×2160)   | 2×2                | 4                | 1920×1080       |
| 5K (5120×2880)   | 3×3                | 9                | 1707×960        |
| 6K (6144×3456)   | 3×3 или 4×4        | 9-16             | 2048×1152       |
| 8K (7680×4320)   | 4×4                | 16               | 1920×1080       |
| UltraWide (5760×1080) | 3×1 или 4×1   | 3-4              | 1920×1080       |

### Примеры использования

#### Базовый пример

```javascript
const player = document.querySelector('cd-player');

// Включить тайлинг для 4K
player.enableTiling(true, 2, 2);
```

#### Динамическая настройка

```javascript
player.addEventListener('play', () => {
    const video = player._videoActive;
    const resolution = video.videoWidth * video.videoHeight;
    
    if (resolution > 8000000) { // > 8MP (8K)
        player.enableTiling(true, 4, 4);
    } else if (resolution > 4000000) { // > 4MP (4K-6K)
        player.enableTiling(true, 3, 3);
    } else if (resolution > 2000000) { // > 2MP
        player.enableTiling(true, 2, 2);
    }
});
```

#### С Theatre.js

```javascript
import { types } from '@theatre/core';

const config = {
    // ...другие настройки
    tilingEnabled: types.boolean(false),
    tilesX: types.number(2, { range: [1, 8] }),
    tilesY: types.number(2, { range: [1, 8] })
};

const playerObj = sheet.object('Player', config);

playerObj.onValuesChange((values) => {
    player.enableTiling(
        values.tilingEnabled,
        values.tilesX,
        values.tilesY
    );
});
```

### Скругление углов с тайлингом

Метод `setRound()` полностью совместим с тайлингом:

```javascript
// Включаем тайлинг
player.enableTiling(true, 2, 2);

// Скругляем углы
player.setRound(20); // 20px скругление
```

**Как это работает:**
- Скругление применяется к контейнеру с `overflow: hidden`
- Угловые canvas получают скругление соответствующих углов

```javascript
// Можно менять в любой момент
player.setRound(50);

// Убрать скругление
player.setRound(0);

// Работает в любом порядке
player.setRound(30);
player.enableTiling(true, 3, 3); // Скругление применится автоматически
```

### Обработка нечетных размеров

Система автоматически обрабатывает нечетные разрешения:

```javascript
// Видео 1920×1081 с сеткой 2×2
// Тайлы: 960×541, 960×541, 960×540, 960×540
player.enableTiling(true, 2, 2);

// Видео 3839×2159 с сеткой 2×2  
// Тайлы: 1920×1080, 1919×1080, 1920×1079, 1919×1079
player.enableTiling(true, 2, 2);
```

Последний ряд/столбец тайлов автоматически подгоняется под оставшееся пространство.

### Производительность

**Преимущества:**
- ✅ Устраняет мерцание на больших разрешениях
- ✅ Более стабильный рендеринг
- ✅ Лучше для GPU с ограниченной памятью

**Недостатки:**
- ⚠️ Увеличенная нагрузка на CPU
- ⚠️ Больше памяти для canvas-элементов

**Рекомендации:**
- Начните с 2×2 для 4K
- Если мерцание сохраняется, увеличьте до 3×3 или 4×4
- Если производительность низкая, уменьшите количество тайлов

### Формула расчета

Размер каждого тайла вычисляется автоматически:

```javascript
tileWidth = Math.ceil(videoWidth / tilesX)
tileHeight = Math.ceil(videoHeight / tilesY)
```

Для последних тайлов (при нечетных размерах):

```javascript
actualWidth = Math.min(tileWidth, videoWidth - x)
actualHeight = Math.min(tileHeight, videoHeight - y)
```

### Troubleshooting тайлинга

#### Видео не отображается после включения

**Решение:** Включайте тайлинг после загрузки видео:

```javascript
player.addEventListener('play', () => {
    setTimeout(() => {
        player.enableTiling(true, 2, 2);
    }, 100);
});
```

#### Мерцание все еще присутствует

**Решение:** Увеличьте количество тайлов:

```javascript
// Вместо 2×2 попробуйте
player.enableTiling(true, 3, 3); // 9 тайлов
player.enableTiling(true, 4, 4); // 16 тайлов
```

#### Низкая производительность

**Решение:** Уменьшите количество тайлов:

```javascript
player.enableTiling(true, 2, 2); // Меньше тайлов = лучше производительность
```

#### Артефакты на границах

**Это нормально** для нечетных размеров. Система автоматически подгоняет последние тайлы.

---

### Проблема: Видео не переключаются

**Проверьте:**
1. WebSocket соединение установлено?
2. Phoenix отправляет команды prepare/play?
3. События swapped обрабатываются?

**Отладка:**
```javascript
player.addEventListener('swapped', (e) => {
    console.log('✓ Swapped');
    if (e.defaultPrevented) {
        console.warn('⚠️ Swapping prevented!');
    }
});
```

---

### Проблема: Чёрный экран между видео

**Причина:** Видео не было предзагружено

**Решение:** Phoenix должен отправлять prepare перед play

**Проверка:**
```javascript
player.addEventListener('play', () => {
    if (!player.preparedId) {
        console.warn('⚠️ Video not prepared!');
    }
});
```

---

### Проблема: Медленная загрузка в dev режиме

**Решение:** Включите кэширование

```javascript
player.USE_CACHE_IN_DEV = true;
```

---

### Проблема: Видео не отображается

**Проверьте:**
1. Элемент создан? `<cd-player id="player"></cd-player>`
2. Компонент импортирован? `import "./mydigital/components/cd-player.min"`
3. CSS класс node добавлен? `class="node"`
