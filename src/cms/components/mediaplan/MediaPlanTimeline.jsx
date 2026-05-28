import { useState, useRef, useCallback } from 'react';
import './MediaPlanTimeline.css';

/* ═══════════════════════════════════════════════════
   Mock data
   ═══════════════════════════════════════════════════ */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SCREENS = [
  { id: 's1', name: 'Экран Абая 52',        resolution: '3840×2160' },
  { id: 's2', name: 'Экран Аль-Фараби 77',  resolution: '1920×1080' },
  { id: 's3', name: 'Экран Мангилик Ел 12', resolution: '3840×2160' },
  { id: 's4', name: 'Экран Кенесары 40',    resolution: '7680×4320' },
  { id: 's5', name: 'Экран Тауке хана 8',   resolution: '1920×1080' },
];

const LIBRARY_ITEMS = [
  { id: 'w1',  name: 'Часы + Дата',          category: 'system',     duration: 1, color: '#7c3aed' },
  { id: 'w2',  name: 'Бегущая строка',       category: 'system',     duration: 1, color: '#8b5cf6' },
  { id: 'w3',  name: 'Логотип MYDigital',    category: 'system',     duration: 1, color: '#6d28d9' },
  { id: 'w4',  name: 'Погода (виджет)',       category: 'system',     duration: 2, color: '#9333ea' },
  { id: 'v1',  name: 'Samsung Galaxy S25',    category: 'commercial', duration: 2, color: '#0891b2' },
  { id: 'v2',  name: 'Coca-Cola NY',          category: 'commercial', duration: 3, color: '#0e7490' },
  { id: 'v3',  name: 'Kaspi Bank',            category: 'commercial', duration: 2, color: '#06b6d4' },
  { id: 'v4',  name: 'Halyk Bank',            category: 'commercial', duration: 1, color: '#22d3ee' },
  { id: 'v5',  name: 'Magnum Cash&Carry',     category: 'commercial', duration: 2, color: '#0d9488' },
  { id: 'v6',  name: 'Beeline KZ',            category: 'commercial', duration: 1, color: '#14b8a6' },
];

function generateInitialPlan() {
  const plan = {};
  SCREENS.forEach((screen) => {
    plan[screen.id] = [
      { ...LIBRARY_ITEMS[0], uid: `${screen.id}-init-0`, startHour: 0 },
      { ...LIBRARY_ITEMS[4], uid: `${screen.id}-init-1`, startHour: 8, duration: 4 },
      { ...LIBRARY_ITEMS[5], uid: `${screen.id}-init-2`, startHour: 12, duration: 3 },
      { ...LIBRARY_ITEMS[3], uid: `${screen.id}-init-3`, startHour: 18, duration: 2 },
    ];
  });
  return plan;
}

let uidCounter = 0;
function nextUid() {
  return `item-${++uidCounter}-${Date.now()}`;
}

/* ═══════════════════════════════════════════════════
   Components
   ═══════════════════════════════════════════════════ */

function LibraryPanel({ categoryFilter, setCategoryFilter }) {
  const filtered = categoryFilter === 'all'
    ? LIBRARY_ITEMS
    : LIBRARY_ITEMS.filter((it) => it.category === categoryFilter);

  function onDragStart(e, item) {
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: 'library',
      item,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="mp-library">
      <h3 className="mp-library__title">Библиотека контента</h3>

      <div className="mp-library__filters">
        {['all', 'system', 'commercial'].map((cat) => (
          <button
            key={cat}
            className={`mp-lib-filter ${categoryFilter === cat ? 'mp-lib-filter--active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat === 'all' ? 'Все' : cat === 'system' ? 'Системные' : 'Рекламные'}
          </button>
        ))}
      </div>

      <div className="mp-library__list">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="mp-lib-item"
            draggable
            onDragStart={(e) => onDragStart(e, item)}
          >
            <div
              className="mp-lib-item__color"
              style={{ background: item.color }}
            />
            <div className="mp-lib-item__info">
              <span className="mp-lib-item__name">{item.name}</span>
              <span className={`badge badge--${item.category}`}>
                {item.category === 'system' ? 'Системный' : 'Реклама'}
              </span>
            </div>
            <span className="mp-lib-item__dur">{item.duration}ч</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineBlock({ block, onRemove, onDragStartBlock }) {
  const widthPct = (block.duration / 24) * 100;
  const leftPct = (block.startHour / 24) * 100;

  return (
    <div
      className={`mp-block mp-block--${block.category}`}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        background: block.color,
      }}
      draggable
      onDragStart={(e) => onDragStartBlock(e, block)}
      title={`${block.name} (${block.startHour}:00 — ${block.startHour + block.duration}:00)`}
    >
      <span className="mp-block__label">{block.name}</span>
      <button
        className="mp-block__remove"
        onClick={(e) => { e.stopPropagation(); onRemove(block.uid); }}
        title="Удалить"
      >
        ×
      </button>
    </div>
  );
}

function TimelineRow({ screen, blocks, onDrop, onRemove, onDragStartBlock }) {
  const rowRef = useRef(null);

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    const rect = rowRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const hour = Math.max(0, Math.min(23, Math.floor((relX / rect.width) * 24)));

    const payload = JSON.parse(raw);
    onDrop(screen.id, payload, hour);
  }

  return (
    <div className="mp-row">
      <div className="mp-row__label">
        <span className="mp-row__name">{screen.name}</span>
        <span className="mp-row__res">{screen.resolution}</span>
      </div>
      <div
        className="mp-row__track"
        ref={rowRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* hour grid lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="mp-row__gridline"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}

        {blocks.map((block) => (
          <TimelineBlock
            key={block.uid}
            block={block}
            onRemove={onRemove}
            onDragStartBlock={onDragStartBlock}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════ */

export default function MediaPlanTimeline() {
  const [plan, setPlan] = useState(generateInitialPlan);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const handleDrop = useCallback((screenId, payload, hour) => {
    setPlan((prev) => {
      const screenBlocks = [...(prev[screenId] || [])];

      if (payload.source === 'library') {
        const item = payload.item;
        const endHour = hour + item.duration;
        if (endHour > 24) return prev;

        const overlaps = screenBlocks.some(
          (b) => hour < b.startHour + b.duration && b.startHour < endHour,
        );
        if (overlaps) return prev;

        screenBlocks.push({
          ...item,
          uid: nextUid(),
          startHour: hour,
        });
      } else if (payload.source === 'timeline') {
        const block = payload.block;
        const endHour = hour + block.duration;
        if (endHour > 24) return prev;

        const idx = screenBlocks.findIndex((b) => b.uid === block.uid);

        const otherBlocks = screenBlocks.filter((b) => b.uid !== block.uid);
        const overlaps = otherBlocks.some(
          (b) => hour < b.startHour + b.duration && b.startHour < endHour,
        );
        if (overlaps) return prev;

        if (idx !== -1) {
          screenBlocks[idx] = { ...screenBlocks[idx], startHour: hour };
        } else {
          // Перемещение между экранами
          const newPlan = { ...prev };
          for (const sid of Object.keys(newPlan)) {
            newPlan[sid] = newPlan[sid].filter((b) => b.uid !== block.uid);
          }
          screenBlocks.push({ ...block, startHour: hour });
          return { ...newPlan, [screenId]: screenBlocks };
        }
      }

      return { ...prev, [screenId]: screenBlocks };
    });
  }, []);

  const handleRemove = useCallback((uid) => {
    setPlan((prev) => {
      const next = {};
      for (const [sid, blocks] of Object.entries(prev)) {
        next[sid] = blocks.filter((b) => b.uid !== uid);
      }
      return next;
    });
  }, []);

  const handleDragStartBlock = useCallback((e, block) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: 'timeline',
      block,
    }));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const totalBlocks = Object.values(plan).reduce((s, b) => s + b.length, 0);
  const systemBlocks = Object.values(plan)
    .flat()
    .filter((b) => b.category === 'system').length;

  return (
    <div className="mp">
      <h1 className="page-title">Медиаплан — Расписание показов</h1>

      <div className="mp-stats">
        <div className="mp-stat">
          <span className="mp-stat__value">{SCREENS.length}</span>
          <span className="mp-stat__label">Экранов</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat__value">{totalBlocks}</span>
          <span className="mp-stat__label">Элементов</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat__value mp-stat__value--system">{systemBlocks}</span>
          <span className="mp-stat__label">Системных</span>
        </div>
        <div className="mp-stat">
          <span className="mp-stat__value mp-stat__value--commercial">{totalBlocks - systemBlocks}</span>
          <span className="mp-stat__label">Рекламных</span>
        </div>
      </div>

      <div className="mp-layout">
        <LibraryPanel
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
        />

        <div className="mp-timeline">
          {/* Hour ruler */}
          <div className="mp-ruler">
            <div className="mp-ruler__label-space" />
            <div className="mp-ruler__hours">
              {HOURS.map((h) => (
                <div key={h} className="mp-ruler__hour">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="mp-rows">
            {SCREENS.map((screen) => (
              <TimelineRow
                key={screen.id}
                screen={screen}
                blocks={plan[screen.id] || []}
                onDrop={handleDrop}
                onRemove={handleRemove}
                onDragStartBlock={handleDragStartBlock}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
