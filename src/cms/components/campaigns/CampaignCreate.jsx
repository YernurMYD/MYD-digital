import { useState, useRef, useCallback, useMemo } from 'react';
import { createCampaign, uploadMediaFile } from '../../services/campaign.api.js';
import './CampaignCreate.css';

/* ═══════════════════════════════════════════════════
   Локации и экраны с аппаратными требованиями
   ═══════════════════════════════════════════════════ */

const LOCATIONS = [
  {
    id: 'loc-1',
    name: 'ТРЦ Хан-Шатыр',
    city: 'Астана',
    screens: [
      { id: 'scr-1a', name: 'Медиафасад главный',   width: 1080, height: 1920, orientation: 'portrait',  note: 'Вертикальный фасад, 9:16' },
      { id: 'scr-1b', name: 'LED-панель фуд-корт',  width: 3840, height: 2160, orientation: 'landscape', note: '4K UHD' },
      { id: 'scr-1c', name: 'Колонна входная',       width: 1080, height: 3840, orientation: 'portrait',  note: 'Супервертикаль 9:32' },
    ],
  },
  {
    id: 'loc-2',
    name: 'Сфера Нур Алем',
    city: 'Астана',
    screens: [
      { id: 'scr-2a', name: 'Кольцевой LED-экран',   width: 7680, height: 1080, orientation: 'ultrawide', note: 'UltraWide 64:9, 8K×FHD' },
      { id: 'scr-2b', name: 'Сферический проектор',   width: 4096, height: 4096, orientation: 'square',    note: 'Квадрат 1:1, 4K' },
    ],
  },
  {
    id: 'loc-3',
    name: 'Вокзал Нурлы Жол',
    city: 'Астана',
    screens: [
      { id: 'scr-3a', name: 'Табло зала ожидания',    width: 3840, height: 2160, orientation: 'landscape', note: '4K UHD, ландшафт' },
      { id: 'scr-3b', name: 'Пилон платформы #1',     width: 1080, height: 1920, orientation: 'portrait',  note: 'Вертикальный 9:16' },
      { id: 'scr-3c', name: 'Пилон платформы #2',     width: 1080, height: 1920, orientation: 'portrait',  note: 'Вертикальный 9:16' },
    ],
  },
  {
    id: 'loc-4',
    name: 'пр. Аль-Фараби / Розыбакиева',
    city: 'Алматы',
    screens: [
      { id: 'scr-4a', name: 'Билборд 6×3м',          width: 1920, height: 1080, orientation: 'landscape', note: 'Full HD, стандарт 16:9' },
    ],
  },
  {
    id: 'loc-5',
    name: 'ТРЦ MEGA Silk Way',
    city: 'Астана',
    screens: [
      { id: 'scr-5a', name: 'Атриум — видеостена',    width: 7680, height: 4320, orientation: 'landscape', note: '8K UHD' },
      { id: 'scr-5b', name: 'Лифтовая шахта',         width: 1080, height: 5760, orientation: 'portrait',  note: 'Сверх-вертикаль 3:16' },
    ],
  },
];

const ALL_SCREENS = LOCATIONS.flatMap((loc) =>
  loc.screens.map((scr) => ({ ...scr, locationId: loc.id, locationName: loc.name, city: loc.city })),
);

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function aspectLabel(w, h) {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

/* ═══════════════════════════════════════════════════
   Валидация видео через HTML5 Video API
   ═══════════════════════════════════════════════════ */

function probeVideoFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        aspect: aspectLabel(video.videoWidth, video.videoHeight),
      });
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать метаданные видео'));
    };

    video.src = url;
  });
}

function validateVideo(meta, screen) {
  const errors = [];

  if (meta.width !== screen.width || meta.height !== screen.height) {
    errors.push(
      `Разрешение ролика ${meta.width}×${meta.height} не совпадает ` +
      `с требуемым ${screen.width}×${screen.height} (${screen.note}).`,
    );
  }

  const videoAspect = aspectLabel(meta.width, meta.height);
  const screenAspect = aspectLabel(screen.width, screen.height);
  if (videoAspect !== screenAspect) {
    errors.push(
      `Соотношение сторон ${videoAspect} не соответствует экрану ${screenAspect}. ` +
      `Загрузите ролик в правильной ориентации.`,
    );
  }

  return errors;
}

/* ═══════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════ */

function StepIndicator({ step, total }) {
  return (
    <div className="cc-steps">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`cc-step ${i + 1 <= step ? 'cc-step--done' : ''} ${i + 1 === step ? 'cc-step--active' : ''}`}>
          <span className="cc-step__num">{i + 1}</span>
          <span className="cc-step__label">
            {['Параметры', 'Экраны', 'Контент', 'Отправка'][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function FieldGroup({ label, children, hint }) {
  return (
    <div className="cc-field">
      <label className="cc-field__label">{label}</label>
      {children}
      {hint && <span className="cc-field__hint">{hint}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════ */

export default function CampaignCreate() {
  const [step, setStep] = useState(1);

  // Step 1: params
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [contentCategory, setContentCategory] = useState('commercial');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dailyStart, setDailyStart] = useState('06:00');
  const [dailyEnd, setDailyEnd] = useState('23:00');
  const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5, 6, 7]);

  // Step 2: screens
  const [selectedScreenIds, setSelectedScreenIds] = useState([]);
  const [expandedLocation, setExpandedLocation] = useState(null);

  // Step 3: upload
  const [videoFile, setVideoFile] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [videoErrors, setVideoErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Step 4: submit
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const selectedScreens = useMemo(
    () => ALL_SCREENS.filter((s) => selectedScreenIds.includes(s.id)),
    [selectedScreenIds],
  );

  // ─── Step 1 helpers ──────────────────────────

  function toggleDay(d) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const step1Valid = name.trim() && startDate && endDate && startDate <= endDate;

  // ─── Step 2 helpers ──────────────────────────

  function toggleScreen(id) {
    setSelectedScreenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllInLocation(loc) {
    const locScreenIds = loc.screens.map((s) => s.id);
    const allSelected = locScreenIds.every((id) => selectedScreenIds.includes(id));
    if (allSelected) {
      setSelectedScreenIds((prev) => prev.filter((id) => !locScreenIds.includes(id)));
    } else {
      setSelectedScreenIds((prev) => [...new Set([...prev, ...locScreenIds])]);
    }
  }

  const step2Valid = selectedScreenIds.length > 0;

  // ─── Step 3 helpers ──────────────────────────

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
      setVideoErrors(['Неподдерживаемый формат. Допустимые: MP4, WebM, MOV, MKV.']);
      return;
    }

    setVideoFile(file);
    setVideoErrors([]);
    setVideoMeta(null);

    try {
      const meta = await probeVideoFile(file);
      setVideoMeta(meta);

      const allErrors = [];
      for (const scr of selectedScreens) {
        const errs = validateVideo(meta, scr);
        if (errs.length) {
          allErrors.push({ screen: `${scr.locationName} → ${scr.name}`, errors: errs });
        }
      }
      setVideoErrors(allErrors);
    } catch (err) {
      setVideoErrors([{ screen: 'Общее', errors: [err.message] }]);
    }
  }, [selectedScreens]);

  function onDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  const step3Valid = videoFile && videoMeta && videoErrors.length === 0;

  // ─── Step 4: submit ─────────────────────────

  async function handleSubmit() {
    if (!step3Valid) return;
    setSubmitting(true);
    setSubmitResult(null);

    try {
      setUploadProgress(0);
      const mediaFile = await uploadMediaFile(videoFile, setUploadProgress);
      setUploadProgress(100);

      const payload = {
        name,
        description,
        priority,
        contentCategory,
        startAt: new Date(`${startDate}T${dailyStart}`).toISOString(),
        endAt: new Date(`${endDate}T${dailyEnd}`).toISOString(),
        dailyStartTime: dailyStart,
        dailyEndTime: dailyEnd,
        daysOfWeek,
        targetDeviceIds: selectedScreenIds,
        items: [{ mediaFileId: mediaFile.id, sortOrder: 0 }],
        videoMeta: {
          width: videoMeta.width,
          height: videoMeta.height,
          duration: videoMeta.duration,
          codec: videoFile.type,
        },
      };

      const result = await createCampaign(payload);
      setSubmitResult({ ok: true, campaign: result });
    } catch (err) {
      setSubmitResult({ ok: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────

  return (
    <div className="cc">
      <h1 className="page-title">Создание кампании</h1>
      <StepIndicator step={step} total={4} />

      <div className="cc-body">
        {/* ─── STEP 1: Параметры ───────────────── */}
        {step === 1 && (
          <div className="cc-panel">
            <h2 className="cc-panel__title">Параметры кампании</h2>

            <div className="cc-form-grid">
              <FieldGroup label="Название кампании">
                <input
                  className="cc-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Samsung Galaxy S25 — июнь"
                />
              </FieldGroup>

              <FieldGroup label="Описание" hint="Необязательно">
                <textarea
                  className="cc-input cc-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Краткое описание кампании..."
                />
              </FieldGroup>

              <div className="cc-row">
                <FieldGroup label="Дата начала">
                  <input type="date" className="cc-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Дата окончания">
                  <input type="date" className="cc-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </FieldGroup>
              </div>

              <div className="cc-row">
                <FieldGroup label="Показ с" hint="Ежедневно">
                  <input type="time" className="cc-input" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} />
                </FieldGroup>
                <FieldGroup label="Показ до">
                  <input type="time" className="cc-input" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} />
                </FieldGroup>
              </div>

              <FieldGroup label="Дни недели">
                <div className="cc-days">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      className={`cc-day ${daysOfWeek.includes(i + 1) ? 'cc-day--active' : ''}`}
                      onClick={() => toggleDay(i + 1)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <div className="cc-row">
                <FieldGroup label="Приоритет">
                  <select className="cc-input cc-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Низкий</option>
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                    <option value="emergency">Экстренный</option>
                  </select>
                </FieldGroup>

                <FieldGroup label="Категория контента">
                  <div className="cc-cat-selector">
                    <button
                      className={`cc-cat-btn ${contentCategory === 'commercial' ? 'cc-cat-btn--active cc-cat-btn--commercial' : ''}`}
                      onClick={() => setContentCategory('commercial')}
                    >
                      <span className="cc-cat-btn__dot" style={{ background: 'var(--cat-commercial)' }} />
                      Рекламный
                    </button>
                    <button
                      className={`cc-cat-btn ${contentCategory === 'system' ? 'cc-cat-btn--active cc-cat-btn--system' : ''}`}
                      onClick={() => setContentCategory('system')}
                    >
                      <span className="cc-cat-btn__dot" style={{ background: 'var(--cat-system)' }} />
                      Системный
                    </button>
                  </div>
                </FieldGroup>
              </div>
            </div>

            <div className="cc-actions">
              <button className="cc-btn cc-btn--primary" disabled={!step1Valid} onClick={() => setStep(2)}>
                Далее — Выбор экранов
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Экраны ──────────────────── */}
        {step === 2 && (
          <div className="cc-panel">
            <h2 className="cc-panel__title">Целевые экраны и локации</h2>
            <p className="cc-panel__desc">
              Выберите экраны для размещения. Аппаратные требования подтянутся автоматически.
            </p>

            <div className="cc-locations">
              {LOCATIONS.map((loc) => {
                const expanded = expandedLocation === loc.id;
                const locScreenIds = loc.screens.map((s) => s.id);
                const selectedCount = locScreenIds.filter((id) => selectedScreenIds.includes(id)).length;

                return (
                  <div key={loc.id} className="cc-loc">
                    <div
                      className="cc-loc__header"
                      onClick={() => setExpandedLocation(expanded ? null : loc.id)}
                    >
                      <div className="cc-loc__info">
                        <span className="cc-loc__toggle">{expanded ? '▾' : '▸'}</span>
                        <div>
                          <span className="cc-loc__name">{loc.name}</span>
                          <span className="cc-loc__city">{loc.city}</span>
                        </div>
                      </div>
                      <div className="cc-loc__right">
                        {selectedCount > 0 && (
                          <span className="cc-loc__badge">{selectedCount}/{loc.screens.length}</span>
                        )}
                        <button
                          className="cc-loc__select-all"
                          onClick={(e) => { e.stopPropagation(); toggleAllInLocation(loc); }}
                        >
                          {selectedCount === loc.screens.length ? 'Снять все' : 'Выбрать все'}
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="cc-loc__screens">
                        {loc.screens.map((scr) => {
                          const selected = selectedScreenIds.includes(scr.id);
                          return (
                            <div
                              key={scr.id}
                              className={`cc-screen ${selected ? 'cc-screen--selected' : ''}`}
                              onClick={() => toggleScreen(scr.id)}
                            >
                              <div className="cc-screen__check">{selected ? '✓' : ''}</div>
                              <div className="cc-screen__info">
                                <span className="cc-screen__name">{scr.name}</span>
                                <span className="cc-screen__specs">
                                  {scr.width}×{scr.height} · {aspectLabel(scr.width, scr.height)} · {scr.orientation}
                                </span>
                              </div>
                              <span className="cc-screen__note">{scr.note}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedScreens.length > 0 && (
              <div className="cc-selected-summary">
                <span className="cc-selected-summary__label">Выбрано {selectedScreens.length} экр.:</span>
                <div className="cc-selected-summary__chips">
                  {selectedScreens.map((s) => (
                    <span key={s.id} className="cc-chip">
                      {s.locationName} → {s.name}
                      <span className="cc-chip__res">{s.width}×{s.height}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="cc-actions">
              <button className="cc-btn" onClick={() => setStep(1)}>Назад</button>
              <button className="cc-btn cc-btn--primary" disabled={!step2Valid} onClick={() => setStep(3)}>
                Далее — Загрузка контента
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Загрузка видео ──────────── */}
        {step === 3 && (
          <div className="cc-panel">
            <h2 className="cc-panel__title">Загрузка и валидация контента</h2>

            <div className="cc-target-reqs">
              <span className="cc-target-reqs__label">Требования выбранных экранов:</span>
              {selectedScreens.map((s) => (
                <div key={s.id} className="cc-target-req">
                  <span className="cc-target-req__name">{s.locationName} → {s.name}</span>
                  <span className="cc-target-req__spec">
                    {s.width}×{s.height} ({aspectLabel(s.width, s.height)}, {s.orientation})
                  </span>
                </div>
              ))}
            </div>

            <div
              className={`cc-dropzone ${isDragging ? 'cc-dropzone--active' : ''} ${videoFile ? 'cc-dropzone--has-file' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                hidden
                onChange={(e) => handleFile(e.target.files[0])}
              />

              {!videoFile ? (
                <div className="cc-dropzone__prompt">
                  <span className="cc-dropzone__icon">⬆</span>
                  <span className="cc-dropzone__text">Перетащите видеофайл сюда</span>
                  <span className="cc-dropzone__sub">или нажмите для выбора · MP4, WebM, MOV, MKV</span>
                </div>
              ) : (
                <div className="cc-dropzone__file">
                  <span className="cc-dropzone__filename">{videoFile.name}</span>
                  <span className="cc-dropzone__size">{(videoFile.size / 1048576).toFixed(1)} MB</span>
                </div>
              )}
            </div>

            {/* Метаданные видео */}
            {videoMeta && (
              <div className="cc-video-meta">
                <div className="cc-vmeta-item">
                  <span className="cc-vmeta-label">Разрешение</span>
                  <span className="cc-vmeta-value">{videoMeta.width}×{videoMeta.height}</span>
                </div>
                <div className="cc-vmeta-item">
                  <span className="cc-vmeta-label">Соотношение</span>
                  <span className="cc-vmeta-value">{videoMeta.aspect}</span>
                </div>
                <div className="cc-vmeta-item">
                  <span className="cc-vmeta-label">Длительность</span>
                  <span className="cc-vmeta-value">{videoMeta.duration.toFixed(1)} сек</span>
                </div>
                <div className="cc-vmeta-item">
                  <span className="cc-vmeta-label">Формат</span>
                  <span className="cc-vmeta-value">{videoFile.type || '—'}</span>
                </div>
              </div>
            )}

            {/* Ошибки валидации */}
            {videoErrors.length > 0 && (
              <div className="cc-verrors">
                <div className="cc-verrors__header">Контент не соответствует требованиям экранов</div>
                {videoErrors.map((group, i) => (
                  <div key={i} className="cc-verror-group">
                    <span className="cc-verror-screen">{group.screen}</span>
                    {group.errors.map((err, j) => (
                      <div key={j} className="cc-verror-msg">{err}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Валидация пройдена */}
            {videoMeta && videoErrors.length === 0 && (
              <div className="cc-vsuccess">
                Видео соответствует требованиям всех выбранных экранов
              </div>
            )}

            <div className="cc-actions">
              <button className="cc-btn" onClick={() => setStep(2)}>Назад</button>
              <button className="cc-btn cc-btn--primary" disabled={!step3Valid} onClick={() => setStep(4)}>
                Далее — Проверка и отправка
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Обзор и отправка ────────── */}
        {step === 4 && (
          <div className="cc-panel">
            <h2 className="cc-panel__title">Проверка и отправка</h2>

            <div className="cc-review">
              <div className="cc-review__section">
                <h3 className="cc-review__heading">Параметры</h3>
                <div className="cc-review__grid">
                  <span className="cc-review__label">Название</span>
                  <span className="cc-review__value">{name}</span>
                  <span className="cc-review__label">Категория</span>
                  <span className="cc-review__value">
                    <span className={`badge badge--${contentCategory}`}>
                      {contentCategory === 'system' ? 'Системный' : 'Рекламный'}
                    </span>
                  </span>
                  <span className="cc-review__label">Период</span>
                  <span className="cc-review__value">{startDate} — {endDate}</span>
                  <span className="cc-review__label">Время показа</span>
                  <span className="cc-review__value">{dailyStart} — {dailyEnd}</span>
                  <span className="cc-review__label">Приоритет</span>
                  <span className="cc-review__value">{priority}</span>
                </div>
              </div>

              <div className="cc-review__section">
                <h3 className="cc-review__heading">Экраны ({selectedScreens.length})</h3>
                {selectedScreens.map((s) => (
                  <div key={s.id} className="cc-review__screen">
                    {s.locationName} → {s.name}
                    <span className="cc-review__screen-spec">{s.width}×{s.height}</span>
                  </div>
                ))}
              </div>

              <div className="cc-review__section">
                <h3 className="cc-review__heading">Контент</h3>
                <div className="cc-review__grid">
                  <span className="cc-review__label">Файл</span>
                  <span className="cc-review__value">{videoFile?.name}</span>
                  <span className="cc-review__label">Разрешение</span>
                  <span className="cc-review__value">{videoMeta?.width}×{videoMeta?.height}</span>
                  <span className="cc-review__label">Длительность</span>
                  <span className="cc-review__value">{videoMeta?.duration.toFixed(1)} сек</span>
                </div>
              </div>
            </div>

            {uploadProgress >= 0 && uploadProgress < 100 && (
              <div className="cc-upload-bar">
                <div className="cc-upload-bar__fill" style={{ width: `${uploadProgress}%` }} />
                <span className="cc-upload-bar__text">Загрузка: {uploadProgress}%</span>
              </div>
            )}

            {submitResult?.ok && (
              <div className="cc-vsuccess">Кампания успешно создана (ID: {submitResult.campaign?.id ?? '—'})</div>
            )}
            {submitResult && !submitResult.ok && (
              <div className="cc-verrors">
                <div className="cc-verror-msg">Ошибка: {submitResult.error}</div>
              </div>
            )}

            <div className="cc-actions">
              <button className="cc-btn" onClick={() => setStep(3)} disabled={submitting}>Назад</button>
              <button
                className="cc-btn cc-btn--primary"
                disabled={submitting || submitResult?.ok}
                onClick={handleSubmit}
              >
                {submitting ? 'Отправка...' : 'Создать кампанию'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
