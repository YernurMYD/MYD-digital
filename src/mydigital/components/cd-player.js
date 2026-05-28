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
  }
  .video-layer.hidden { visibility: hidden; pointer-events: none; }
  .tile-container {
    display: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
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

const BLACK = Object.freeze({ r: 0, g: 0, b: 0 });

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
  /** @type {HTMLCanvasElement} */
  _samplingCanvas = null;
  /** @type {CanvasRenderingContext2D} */
  _samplingCtx = null;
  /** @type {ImageData|null} */
  _samplingData = null;
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
   * @param {string} id — идентификатор / URL видео
   * @param {string} [commentText] — необязательный комментарий
   * @returns {Promise<void>}
   */
  async prepare(id, commentText = '') {
    const pending = this._videoPending;
    this._preparedId = id;
    this._pendingComment = commentText;

    const url = this._resolveUrl(id);
    pending.src = url;
    pending.load();

    await this._whenCanPlay(pending);
    await this._warmUpDecoder(pending);
  }

  /**
   * Меняет местами активное и ожидающее видео.
   * @param {boolean} [autoplay=false] — запустить воспроизведение после swap
   * @returns {Promise<void>}
   */
  async swapVideo(autoplay = false) {
    const event = new CustomEvent('swapped', { cancelable: true });
    this.dispatchEvent(event);

    if (event.defaultPrevented) {
      this._videoActive.pause();
      this._playing = false;
      return;
    }

    const prev = this._videoActive;
    const next = this._videoPending;

    prev.classList.add('hidden');
    next.classList.remove('hidden');

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

    if (this._tilingEnabled) {
      this._startTileLoop();
    }
    if (this._colorSamplingEnabled) {
      this._restartSamplingLoop();
    }
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

    this._samplingCanvas = document.createElement('canvas');
    this._samplingCanvas.height = 1;
    this._samplingCtx = this._samplingCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    this._colorSamplingEnabled = true;
    this._restartSamplingLoop();
  }

  /**
   * Возвращает средний RGB верхней строки пикселей.
   * @param {number} x — начальная горизонтальная позиция (px)
   * @param {number} [w=1] — ширина области усреднения (px)
   * @returns {{r: number, g: number, b: number}}
   */
  rgbAvgAt(x, w = 1) {
    if (!this._colorSamplingEnabled || !this._samplingData) return { ...BLACK };

    const data = this._samplingData.data;
    const totalW = this._samplingWidth;
    if (totalW === 0) return { ...BLACK };

    const startX = Math.max(0, Math.min(x, totalW - 1));
    const endX = Math.min(startX + w, totalW);
    const count = endX - startX;
    if (count <= 0) return { ...BLACK };

    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = startX; i < endX; i++) {
      const off = i * 4;
      rSum += data[off];
      gSum += data[off + 1];
      bSum += data[off + 2];
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

  _whenCanPlay(video) {
    if (video.readyState >= 3) return Promise.resolve();
    return new Promise((resolve) => {
      video.addEventListener('canplay', resolve, { once: true });
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
    if (id.startsWith('http') || id.startsWith('/') || id.startsWith('blob:')) {
      return id;
    }
    return `/videos/${id}`;
  }

  // ═══════════════════════════════════════════════════════════
  // Private — Color Sampling (оптимизация FPS)
  // ═══════════════════════════════════════════════════════════

  _restartSamplingLoop() {
    if (this._samplingRafId) {
      cancelAnimationFrame(this._samplingRafId);
    }
    this._sampleLoop();
  }

  /**
   * Петля семплирования: рисуем ТОЛЬКО верхнюю строку активного видео
   * в canvas 1px высотой, затем читаем getImageData один раз за кадр.
   * Троттлинг: каждые 2 кадра (~30 Гц при 60 fps).
   */
  _sampleLoop() {
    let frame = 0;
    const tick = () => {
      this._samplingRafId = requestAnimationFrame(tick);

      if (++frame & 1) return; // каждый 2-й кадр

      const v = this._videoActive;
      if (v.paused || v.ended || !v.videoWidth) return;

      const w = v.videoWidth;
      if (this._samplingCanvas.width !== w) {
        this._samplingCanvas.width = w;
      }
      this._samplingWidth = w;

      this._samplingCtx.drawImage(v, 0, 0, w, 1, 0, 0, w, 1);
      this._samplingData = this._samplingCtx.getImageData(0, 0, w, 1);
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

  _destroyTileCanvases() {
    if (this._tileRafId) {
      cancelAnimationFrame(this._tileRafId);
      this._tileRafId = 0;
    }
    this._tileContainer.innerHTML = '';
    this._tileCanvases = [];
    this._tileCtxs = [];
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
    this._renderTiles();
  }

  /**
   * Основной рендер-цикл тайлинга.
   * Каждый кадр: вычисляем область каждого тайла и рисуем drawImage
   * из активного видео на соответствующий canvas.
   */
  _renderTiles() {
    const tick = () => {
      this._tileRafId = requestAnimationFrame(tick);

      const v = this._videoActive;
      if (!v.videoWidth || (v.paused && v.currentTime === 0)) return;

      const vw = v.videoWidth;
      const vh = v.videoHeight;
      const tileW = Math.ceil(vw / this._tilesX);
      const tileH = Math.ceil(vh / this._tilesY);

      let idx = 0;
      for (let row = 0; row < this._tilesY; row++) {
        const sy = row * tileH;
        const sh = Math.min(tileH, vh - sy);

        for (let col = 0; col < this._tilesX; col++) {
          const sx = col * tileW;
          const sw = Math.min(tileW, vw - sx);

          const canvas = this._tileCanvases[idx];
          const ctx = this._tileCtxs[idx];

          if (canvas.width !== sw || canvas.height !== sh) {
            canvas.width = sw;
            canvas.height = sh;
          }

          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
          idx++;
        }
      }
    };
    this._tileRafId = requestAnimationFrame(tick);
  }

  /** Скругление углов для крайних тайлов в сетке */
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
    this._releaseVideo(this._videoA);
    this._releaseVideo(this._videoB);
  }
}

if (!customElements.get('cd-player')) {
  customElements.define('cd-player', CdPlayer);
}

export default CdPlayer;
