import { useState, useRef, useEffect } from 'react';
import { useCampaigns } from '../../hooks/useCampaigns.js';
import './CampaignDashboard.css';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateRange(startAt, endAt) {
  return `${formatDate(startAt)} — ${formatDate(endAt)}`;
}

function StatusBadge({ status, STATUSES }) {
  const cfg = STATUSES[status];
  if (!cfg) return null;
  return (
    <span className={`badge badge--${cfg.badge}`}>
      <span className={`cd-status-dot cd-status-dot--${cfg.badge}`} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const isNav = type === 'navigation';
  return (
    <span className={`badge ${isNav ? 'badge--system' : 'badge--commercial'}`}>
      {isNav ? 'Навигация' : 'Коммерческая'}
    </span>
  );
}

function TargetTags({ targets }) {
  const MAX_VISIBLE = 2;
  const visible = targets.slice(0, MAX_VISIBLE);
  const extra = targets.length - MAX_VISIBLE;

  return (
    <div className="cd-targets">
      {visible.map((t) => (
        <span key={t.id} className="cd-target-tag">{t.name}</span>
      ))}
      {extra > 0 && <span className="cd-target-tag cd-target-tag--more">+{extra}</span>}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="cd-skeleton-row">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i}>
          <div className="cd-skeleton" style={{ width: [60, 180, 90, 150, 140, 100][i] }} />
        </td>
      ))}
      <td><div className="cd-skeleton" style={{ width: 28 }} /></td>
    </tr>
  );
}

function ActionsMenu({ campaign, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const actions = [
    { id: 'edit', label: 'Редактировать', icon: '✎' },
    campaign.status === 'draft'
      ? { id: 'submit', label: 'Отправить на модерацию', icon: '↗' }
      : campaign.status === 'pending_approval'
        ? { id: 'approve', label: 'Утвердить', icon: '✓' }
        : null,
    campaign.status === 'active'
      ? { id: 'pause', label: 'Приостановить показ', icon: '⏸' }
      : null,
    campaign.status === 'paused'
      ? { id: 'resume', label: 'Возобновить показ', icon: '▶' }
      : null,
    { id: 'report', label: 'Скачать отчёт', icon: '↓' },
    { id: 'duplicate', label: 'Дублировать', icon: '⧉' },
  ].filter(Boolean);

  return (
    <div className="cd-actions" ref={ref}>
      <button className="cd-actions__trigger" onClick={() => setOpen(!open)} aria-label="Действия">
        ⋮
      </button>
      {open && (
        <div className="cd-actions__menu">
          {actions.map((a) => (
            <button
              key={a.id}
              className="cd-actions__item"
              onClick={() => { onAction(a.id, campaign); setOpen(false); }}
            >
              <span className="cd-actions__icon">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationMultiSelect({ locations, selectedIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const label = selectedIds.length
    ? `${selectedIds.length} экран${selectedIds.length > 1 ? (selectedIds.length < 5 ? 'а' : 'ов') : ''}`
    : 'Все экраны';

  return (
    <div className="cd-multiselect" ref={ref}>
      <button className="cd-multiselect__trigger" onClick={() => setOpen(!open)}>
        <span>{label}</span>
        <span className="cd-multiselect__arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="cd-multiselect__dropdown">
          {locations.map((loc) => (
            <label key={loc.id} className="cd-multiselect__option">
              <input
                type="checkbox"
                checked={selectedIds.includes(loc.id)}
                onChange={() => onToggle(loc.id)}
              />
              <span>{loc.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Pagination({ meta, onPageChange }) {
  const { page, totalPages, total } = meta;
  if (totalPages <= 1) return null;

  const pages = [];
  const range = 2;

  if (page > 1 + range) pages.push(1);
  if (page > 2 + range) pages.push('...');

  for (let i = Math.max(1, page - range); i <= Math.min(totalPages, page + range); i++) {
    pages.push(i);
  }

  if (page < totalPages - range - 1) pages.push('...');
  if (page < totalPages - range) pages.push(totalPages);

  return (
    <div className="cd-pagination">
      <span className="cd-pagination__info">
        Показано {(page - 1) * meta.limit + 1}–{Math.min(page * meta.limit, total)} из {total}
      </span>
      <div className="cd-pagination__controls">
        <button
          className="cd-pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="cd-pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`cd-pagination__btn ${p === page ? 'cd-pagination__btn--active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="cd-pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function CampaignDashboard() {
  const {
    campaigns,
    loading,
    meta,
    statusCounts,
    page,
    setPage,
    search,
    setSearch,
    statuses,
    toggleStatus,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    locationIds,
    toggleLocation,
    resetFilters,
    hasActiveFilters,
    refetch,
    STATUSES,
    LOCATIONS,
  } = useCampaigns();

  const handleAction = (actionId, campaign) => {
    switch (actionId) {
      case 'edit':
        console.log('Edit campaign:', campaign.id);
        break;
      case 'submit':
        console.log('Submit for moderation:', campaign.id);
        break;
      case 'approve':
        console.log('Approve campaign:', campaign.id);
        break;
      case 'pause':
        console.log('Pause campaign:', campaign.id);
        break;
      case 'resume':
        console.log('Resume campaign:', campaign.id);
        break;
      case 'report':
        console.log('Download report:', campaign.id);
        break;
      case 'duplicate':
        console.log('Duplicate campaign:', campaign.id);
        refetch();
        break;
    }
  };

  const STATUS_FILTERS = [
    { key: 'draft', label: 'Черновик' },
    { key: 'pending_approval', label: 'Согласование' },
    { key: 'active', label: 'Активна' },
    { key: 'completed', label: 'Завершена' },
    { key: 'error', label: 'Ошибка' },
    { key: 'paused', label: 'Приостановлена' },
  ];

  return (
    <div className="cd">
      <div className="cd-header">
        <h1 className="page-title">Рекламные кампании</h1>
        <div className="cd-header__stats">
          {STATUS_FILTERS.map((sf) => (
            <div key={sf.key} className="cd-header__stat">
              <span className={`cd-stat-dot cd-stat-dot--${STATUSES[sf.key].badge}`} />
              <span className="cd-header__stat-count">{statusCounts[sf.key] || 0}</span>
              <span className="cd-header__stat-label">{sf.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="cd-filters">
        <div className="cd-filters__row">
          <div className="cd-search-wrap">
            <span className="cd-search-icon">⌕</span>
            <input
              type="text"
              className="cd-search"
              placeholder="Поиск по названию или ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="cd-status-filters">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.key}
                className={`cd-status-chip ${statuses.includes(sf.key) ? `cd-status-chip--${STATUSES[sf.key].badge}` : ''}`}
                onClick={() => toggleStatus(sf.key)}
              >
                {sf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cd-filters__row">
          <div className="cd-date-range">
            <label className="cd-date-label">Период:</label>
            <input
              type="date"
              className="cd-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="cd-date-sep">—</span>
            <input
              type="date"
              className="cd-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <LocationMultiSelect
            locations={LOCATIONS}
            selectedIds={locationIds}
            onToggle={toggleLocation}
          />

          {hasActiveFilters && (
            <button className="cd-reset-btn" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="cd-table-wrap">
        <table className="cd-table">
          <thead>
            <tr>
              <th className="cd-th--id">ID</th>
              <th className="cd-th--name">Название</th>
              <th className="cd-th--type">Тип</th>
              <th className="cd-th--targets">Привязанные объекты</th>
              <th className="cd-th--period">Период размещения</th>
              <th className="cd-th--status">Статус</th>
              <th className="cd-th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: meta.limit || 15 }).map((_, i) => <SkeletonRow key={i} />)
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="cd-empty">
                  <div className="cd-empty__content">
                    <span className="cd-empty__icon">◇</span>
                    <p>Кампании не найдены</p>
                    {hasActiveFilters && (
                      <button className="cd-reset-btn" onClick={resetFilters}>
                        Сбросить фильтры
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="cd-row">
                  <td className="cd-cell--id">
                    <span className="cd-id">{c.id}</span>
                  </td>
                  <td className="cd-cell--name">
                    <div className="cd-name-wrap">
                      <span className="cd-name">{c.name}</span>
                    </div>
                  </td>
                  <td className="cd-cell--type">
                    <TypeBadge type={c.type} />
                  </td>
                  <td className="cd-cell--targets">
                    <TargetTags targets={c.targets} />
                  </td>
                  <td className="cd-cell--period">
                    <span className="cd-period">{formatDateRange(c.startAt, c.endAt)}</span>
                  </td>
                  <td className="cd-cell--status">
                    <StatusBadge status={c.status} STATUSES={STATUSES} />
                  </td>
                  <td className="cd-cell--actions">
                    <ActionsMenu campaign={c} onAction={handleAction} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} onPageChange={setPage} />
    </div>
  );
}
