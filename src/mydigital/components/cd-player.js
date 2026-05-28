/**
 * MYDigital Video Player — Web Component с двойной буферизацией.
 *
 * Поддерживает:
 *  - Бесшовное переключение между двумя <video> (Active / Pending)
 *  - Прогрев аппаратного декодера (play → pause → seek 0)
 *  - Чтение пиксельных данных верхней строки (enableColorSampling / rgbAvgAt)
 *  - Тайлинг-режим (enableTiling) для устранения мерцания на 4K / 8K
 *  - WebM VP8 с прозрачным фоном (alpha-канал)
 */

const TEMPLATE = document.createElement('template');
TEMPLATE.innerHTML = `
<style>
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    width: 100%;
    height: 100%;
    background: transparent;
  }
  .video-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: transparent;
    z-index: 1;
  }
  .video-layer.hidden {
    visibility: hidden;
    pointer-events: none;
    z-index: 0;
  }
  .tile-container {
    display: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 2;
    gap: 0;
  }
  .tile-container.active { display: grid; }
  .tile-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
<video class="video-layer" id="videoA"></video>
<video class="video-layer hidden" id="videoB"></video>
<div class="tile-container" id="tileContainer"></div>
`;

class CdPlayer extends HTMLElement {
  // ─── Состояние буферизации ───────────────────────────────
  /** @type {HTMLVideoElement} */
  _videoA = null;
  /** @type {HTMLVideoElement} */
  _videoB = null;
  /** @type {HTMLVideoElement} Ссылка на текущий активный элемент */
  _videoActive = null;
  /** @type {HTMLVideoElement} Ссылка на ожидающий элемент */
  _videoPending = null;

  // ─── Метаданные подготовленного видео ────────────────────
  _preparedId = null;
  _activeComment = '';
  _pendingComment = '';

  // ─── Color sampling ──────────────────────────────────────
  _colorSamplingEnabled = false;
  /** @type {HTMLCanvasElement|OffscreenCanvas|null} */
  _samplingCanvas = null;
  /** @type {CanvasRenderingContext2D|null} */
  _samplingCtx = null;
  /** @type {Uint8ClampedArray|null} */
  _samplingPixels = null;
  _samplingRafId = 0;
  _samplingWidth = 0;

  // ─── Tiling ──────────────────────────────────────────────
  _tilingEnabled = false;
  _tilesX = 2;
  _tilesY = 2;
  /** @type {HTMLCanvasElement[]} */
  _tileCanvases = [];
  /** @type {CanvasRenderingContext2D[]} */
  _tileCtxs = [];
  _tileRafId = 0;
  /** @type {Int32Array|null} Flat layout: [sx,sy,sw,sh, sx,sy,sw,sh, ...] */
  _tileLayout = null;
  _lastTileVW = 0;
  _lastTileVH = 0;
  /** @type {HTMLDivElement} */
  _tileContainer = null;

  // ─── Кэширование ────────────────────────────────────────
  _useCacheInDev = false;
  _useCache = false;

  // ─── Прочее ──────────────────────────────────────────────
  _playing = false;
  _firstPlayFired = false;
  _borderRadius = 0;
  _ws = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

    this._videoA = this.shadowRoot.getElementById('videoA');
    this._videoB = this.shadowRoot.getElementById('videoB');
    this._tileContainer = this.shadowRoot.getElementById('tileContainer');

    this._configureVideo(this._videoA);
    this._configureVideo(this._videoB);

    this._videoActive = this._videoA;
    this._videoPending = this._videoB;
  }

  // ═══════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════

  /** Инициализация плеера и подключение к Phoenix WebSocket */
  init() {
    this._bindVideoEvents();
    this.dispatchEvent(new CustomEvent('ready'));
  }

  get playing() {
    return this._playing;
  }

  get preparedId() {
    return this._preparedId;
  }

  set USE_CACHE_IN_DEV(val) {
    this._useCacheInDev = Boolean(val);
  }

  set USE_CACHE(val) {
    this._useCache = Boolean(val);
  }

  // ─── Воспроизведение ─────────────────────────────────────

  play() {
    this.playActive();
  }

  playActive() {
    const v = this._videoActive;
    if (v.src || v.currentSrc) {
      v.play().catch(() => {});
      this._playing = true;
    }
  }

  pause() {
    this.pauseActive();
  }

  pauseActive() {
    this._videoActive.pause();
    this._playing = false;
  }

  // ─── Подготовка и переключение ───────────────────────────

  /**
   * Загружает видео в ожидающий буфер и выполняет прогрев декодера.
   * @param {string} url — URL или идентификатор видео
   * @param {string} [commentText] — необязательный комментарий
   * @returns {Promise<void>}
   */
  async prepare(url, commentText = '') {
    const pending = this._videoPending;
    this._preparedId = url;
    this._pendingComment = commentText;

    pending.src = this._resolveUrl(url);
    pending.load();

    await this._whenCanPlayThrough(pending);
    await this._warmUpDecoder(pending);
  }

  /**
   * Меняет местами активное и ожидающее видео.
   *
   * Порядок:
   *  1. Dispatch cancelable «swapped» — слушатель может вызвать preventDefault().
   *  2. Если отменено — ничего не трогаем, возвращаем false.
   *  3. Иначе: поднимаем z-index нового, переключаем visibility-классы,
   *     запускаем play() на новом, останавливаем и освобождаем старое.
   *
   * @param {boolean} [autoplay=true] — запустить воспроизведение после swap
   * @returns {Promise<boolean>} — true если swap выполнен, false если отменён
   */
  async swapVideo(autoplay = true) {
    const event = new CustomEvent('swapped', { cancelable: true });
    this.dispatchEvent(event);

    if (event.defaultPrevented) return false;

    const prev = this._videoActive;
    const next = this._videoPending;

    next.style.zIndex = '2';
    next.classList.remove('hidden');
    prev.classList.add('hidden');
    prev.style.zIndex = '';

    this._videoActive = next;
    this._videoPending = prev;

    this._activeComment = this._pendingComment;
    this._pendingComment = '';
    this._preparedId = null;

    if (autoplay) {
      await next.play().catch(() => {});
      this._playing = true;
    }

    this._releaseVideo(prev);

    if (this._tilingEnabled) this._startTileLoop();
    if (this._colorSamplingEnabled) this._restartSamplingLoop();

    return true;
  }

  // ─── Информация ──────────────────────────────────────────

  comment() {
    return this._activeComment;
  }

  inactive_comment() {
    return this._pendingComment;
  }

  /**
   * Возвращает информацию об экране (заглушка — реализуется через WebSocket).
   * @returns {Promise<{x: number, y: number, rot: number}>}
   */
  async screenInfo() {
    return { x: window.screen.width, y: window.screen.height, rot: 0 };
  }

  /** Устанавливает border-radius на хосте и тайл-контейнере */
  setRound(radius) {
    this._borderRadius = radius;
    this.style.borderRadius = radius + 'px';
    if (this._tilingEnabled) {
      this._applyTileRounding();
    }
  }

  // ─── Color Sampling ──────────────────────────────────────

  /**
   * Включает семплирование пикселей верхней строки активного видео.
   * Использует off-screen canvas (1-строка) и rAF с троттлингом.
   */
  enableColorSampling() {
    if (this._colorSamplingEnabled) return;

    this._samplingCanvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(1, 1)
      : document.createElement('canvas');
    this._samplingCanvas.height = 1;
    this._samplingCtx = this._samplingCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    this._colorSamplingEnabled = true;
    this._restartSamplingLoop();
  }

  /**
   * Возвращает средний RGB верхней строки пикселей.
   *
   * Hot path: может вызываться десятки раз за кадр (ambient lighting).
   * Избегаем лишних аллокаций: нет spread-объектов, нет промежуточных
   * обёрток — читаем напрямую из Uint8ClampedArray.
   *
   * @param {number} x — начальная горизонтальная позиция (px)
   * @param {number} [w=1] — ширина области усреднения (px)
   * @returns {{r: number, g: number, b: number}}
   */
  rgbAvgAt(x, w = 1) {
    const px = this._samplingPixels;
    if (!px) return { r: 0, g: 0, b: 0 };

    const totalW = this._samplingWidth;
    if (totalW === 0) return { r: 0, g: 0, b: 0 };

    const startX = Math.max(0, Math.min(x, totalW - 1));
    const endX = Math.min(startX + w, totalW);
    const count = endX - startX;
    if (count <= 0) return { r: 0, g: 0, b: 0 };

    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = startX; i < endX; i++) {
      const off = i << 2;
      rSum += px[off];
      gSum += px[off + 1];
      bSum += px[off + 2];
    }

    return {
      r: (rSum / count) | 0,
      g: (gSum / count) | 0,
      b: (bSum / count) | 0,
    };
  }

  // ─── Tiling ──────────────────────────────────────────────

  /**
   * Включает / выключает режим тайлинга.
   * @param {boolean} enabled
   * @param {number} [tilesX=2]
   * @param {number} [tilesY=2]
   */
  enableTiling(enabled, tilesX = 2, tilesY = 2) {
    if (!enabled) {
      this._destroyTiles();
      return;
    }

    this._tilesX = tilesX;
    this._tilesY = tilesY;
    this._tilingEnabled = true;

    this._videoActive.classList.add('hidden');
    this._buildTileGrid();
    this._startTileLoop();
  }

  // ═══════════════════════════════════════════════════════════
  // Private — видео утилиты
  // ═══════════════════════════════════════════════════════════

  /** Применяет атрибуты к <video> для оптимальной работы с VP8/alpha */
  _configureVideo(v) {
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
  }

  _bindVideoEvents() {
    const onEnded = () => {
      this.dispatchEvent(new CustomEvent('ended'));
    };

    const onPlay = () => {
      this._playing = true;
      this.dispatchEvent(
        new CustomEvent('play', {
          detail: { video: this._videoActive },
        }),
      );

      if (!this._firstPlayFired) {
        this._firstPlayFired = true;
        this.dispatchEvent(new CustomEvent('beginplay'));
      }
    };

    this._videoA.addEventListener('ended', onEnded);
    this._videoB.addEventListener('ended', onEnded);
    this._videoA.addEventListener('play', onPlay);
    this._videoB.addEventListener('play', onPlay);
  }

  /**
   * Прогрев аппаратного декодера: play → pause → seek(0).
   * Гарантирует, что первый кадр декодирован в GPU-текстуру.
   */
  async _warmUpDecoder(video) {
    try {
      await video.play();
    } catch { /* autoplay policy */ }
    video.pause();
    video.currentTime = 0;
    await this._whenSeeked(video);
  }

  _whenCanPlayThrough(video) {
    if (video.readyState >= 4) return Promise.resolve();
    return new Promise((resolve) => {
      video.addEventListener('canplaythrough', resolve, { once: true });
    });
  }

  _whenSeeked(video) {
    return new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
    });
  }

  /** Освобождает ресурсы видео элемента */
  _releaseVideo(video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  _resolveUrl(id) {
    const url = (id.startsWith('http') || id.startsWith('/') || id.startsWith('blob:'))
      ? id
      : `/videos/${id}`;

    if (this._useCache || this._useCacheInDev) return url;

    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_t=${Date.now()}`;
  }

  // ═══════════════════════════════════════════════════════════
  // Private — Color Sampling (оптимизация FPS)
  // ═══════════════════════════════════════════════════════════

  _restartSamplingLoop() {
    if (this._samplingRafId) {
      cancelAnimationFrame(this._samplingRafId);
    }
    this._samplingPixels = null;
    this._sampleLoop();
  }

  /**
   * Петля семплирования: рисуем ТОЛЬКО верхнюю строку (1px) активного видео
   * в OffscreenCanvas, затем читаем getImageData раз за 2 кадра.
   *
   * Оптимизации:
   *  - Троттлинг: каждый 2-й rAF (~30 Гц при 60fps дисплее)
   *  - currentTime-дедупликация: пропуск если видеокадр не сменился
   *  - _samplingPixels хранит Uint8ClampedArray напрямую (без обёртки ImageData)
   */
  _sampleLoop() {
    let frame = 0;
    let lastTime = -1;
    const tick = () => {
      this._samplingRafId = requestAnimationFrame(tick);

      if (++frame & 1) return;

      const v = this._videoActive;
      if (v.paused || v.ended || !v.videoWidth) return;

      const t = v.currentTime;
      if (t === lastTime) return;
      lastTime = t;

      const w = v.videoWidth;
      if (this._samplingCanvas.width !== w) {
        this._samplingCanvas.width = w;
      }
      this._samplingWidth = w;

      this._samplingCtx.drawImage(v, 0, 0, w, 1, 0, 0, w, 1);
      this._samplingPixels = this._samplingCtx.getImageData(0, 0, w, 1).data;
    };
    this._samplingRafId = requestAnimationFrame(tick);
  }

  // ═══════════════════════════════════════════════════════════
  // Private — Tiling
  // ═══════════════════════════════════════════════════════════

  _buildTileGrid() {
    this._destroyTileCanvases();

    const container = this._tileContainer;
    container.style.gridTemplateColumns = `repeat(${this._tilesX}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${this._tilesY}, 1fr)`;
    container.classList.add('active');

    const count = this._tilesX * this._tilesY;
    this._tileCanvases = new Array(count);
    this._tileCtxs = new Array(count);
    this._tileLayout = new Int32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas');
      c.className = 'tile-canvas';
      container.appendChild(c);
      this._tileCanvases[i] = c;
      this._tileCtxs[i] = c.getContext('2d', { alpha: true });
    }

    if (this._borderRadius) {
      this._applyTileRounding();
    }
  }

  /**
   * Предвычисляет геометрию тайлов при изменении размеров видео.
   *
   * Результат сохраняется в _tileLayout (Int32Array):
   *   [sx0, sy0, sw0, sh0, sx1, sy1, sw1, sh1, ...]
   *
   * Нечётные размеры обрабатываются автоматически:
   * последний ряд/столбец получает оставшиеся пиксели.
   * Например 3839×2159 при 2×2:
   *   tile[0] = 1920×1080, tile[1] = 1919×1080
   *   tile[2] = 1920×1079, tile[3] = 1919×1079
   */
  _computeTileLayout(vw, vh) {
    this._lastTileVW = vw;
    this._lastTileVH = vh;

    const tilesX = this._tilesX;
    const tilesY = this._tilesY;
    const baseTileW = Math.ceil(vw / tilesX);
    const baseTileH = Math.ceil(vh / tilesY);
    const layout = this._tileLayout;

    let idx = 0;
    for (let row = 0; row < tilesY; row++) {
      const sy = row * baseTileH;
      const sh = Math.min(baseTileH, vh - sy);

      for (let col = 0; col < tilesX; col++) {
        const sx = col * baseTileW;
        const sw = Math.min(baseTileW, vw - sx);

        const canvas = this._tileCanvases[idx];
        if (canvas.width !== sw || canvas.height !== sh) {
          canvas.width = sw;
          canvas.height = sh;
        }

        const off = idx << 2;
        layout[off] = sx;
        layout[off + 1] = sy;
        layout[off + 2] = sw;
        layout[off + 3] = sh;
        idx++;
      }
    }
  }

  _destroyTileCanvases() {
    if (this._tileRafId) {
      cancelAnimationFrame(this._tileRafId);
      this._tileRafId = 0;
    }
    this._tileContainer.replaceChildren();
    this._tileCanvases = [];
    this._tileCtxs = [];
    this._tileLayout = null;
    this._lastTileVW = 0;
    this._lastTileVH = 0;
  }

  _destroyTiles() {
    this._tilingEnabled = false;
    this._destroyTileCanvases();
    this._tileContainer.classList.remove('active');
    this._videoActive.classList.remove('hidden');
  }

  _startTileLoop() {
    if (this._tileRafId) {
      cancelAnimationFrame(this._tileRafId);
    }
    this._lastTileVW = 0;
    this._lastTileVH = 0;
    this._renderTiles();
  }

  /**
   * Горячий рендер-цикл тайлинга.
   *
   * Геометрия тайлов (sx, sy, sw, sh) читается из предвычисленного
   * Int32Array — никаких Math.ceil / Math.min в горячем пути.
   * Layout пересчитывается только при смене разрешения видео.
   */
  _renderTiles() {
    const tick = () => {
      this._tileRafId = requestAnimationFrame(tick);

      const v = this._videoActive;
      if (!v.videoWidth || (v.paused && v.currentTime === 0)) return;

      const vw = v.videoWidth;
      const vh = v.videoHeight;
      if (vw !== this._lastTileVW || vh !== this._lastTileVH) {
        this._computeTileLayout(vw, vh);
      }

      const layout = this._tileLayout;
      const ctxs = this._tileCtxs;
      const count = ctxs.length;

      for (let i = 0; i < count; i++) {
        const off = i << 2;
        const sx = layout[off];
        const sy = layout[off + 1];
        const sw = layout[off + 2];
        const sh = layout[off + 3];

        ctxs[i].clearRect(0, 0, sw, sh);
        ctxs[i].drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
      }
    };
    this._tileRafId = requestAnimationFrame(tick);
  }

  _applyTileRounding() {
    const r = this._borderRadius;
    const total = this._tileCanvases.length;
    const cols = this._tilesX;
    const rows = this._tilesY;

    for (let i = 0; i < total; i++) {
      const canvas = this._tileCanvases[i];
      const row = (i / cols) | 0;
      const col = i % cols;

      let tl = 0, tr = 0, bl = 0, br = 0;
      if (row === 0 && col === 0) tl = r;
      if (row === 0 && col === cols - 1) tr = r;
      if (row === rows - 1 && col === 0) bl = r;
      if (row === rows - 1 && col === cols - 1) br = r;

      canvas.style.borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Lifecycle callbacks
  // ═══════════════════════════════════════════════════════════

  disconnectedCallback() {
    if (this._samplingRafId) cancelAnimationFrame(this._samplingRafId);
    if (this._tileRafId) cancelAnimationFrame(this._tileRafId);
    this._samplingPixels = null;
    this._samplingCanvas = null;
    this._samplingCtx = null;
    this._tileLayout = null;
    this._releaseVideo(this._videoA);
    this._releaseVideo(this._videoB);
  }
}

if (!customElements.get('cd-player')) {
  customElements.define('cd-player', CdPlayer);
}

export default CdPlayer;
