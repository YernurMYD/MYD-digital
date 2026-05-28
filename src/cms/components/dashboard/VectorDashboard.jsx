import { useMockDevices } from '../../hooks/useMockDevices.js';
import './VectorDashboard.css';

const STATUS_LABEL = {
  all: 'Все',
  online: 'Онлайн',
  warning: 'Предупреждение',
  error: 'Ошибка',
  offline: 'Оффлайн',
};

function formatUptime(hours) {
  if (hours < 24) return `${hours}ч`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return `${d}д ${h}ч`;
}

function timeAgo(date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  return `${Math.floor(min / 60)}ч ${min % 60}м назад`;
}

function MetricBar({ label, value, max, unit, warn, crit }) {
  const pct = Math.min((value / max) * 100, 100);
  let level = 'ok';
  if (crit !== undefined && value >= crit) level = 'crit';
  else if (warn !== undefined && value >= warn) level = 'warn';

  return (
    <div className="vd-metric">
      <div className="vd-metric__header">
        <span className="vd-metric__label">{label}</span>
        <span className={`metric-value vd-metric__value--${level}`}>
          {value}{unit}
        </span>
      </div>
      <div className="vd-metric__track">
        <div
          className={`vd-metric__fill vd-metric__fill--${level}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DeviceCard({ device }) {
  const { status, metrics } = device;
  const ramPct = Math.round((metrics.ramUsed / metrics.ramTotal) * 100);

  return (
    <div className={`vd-card vd-card--${status}`}>
      <div className="vd-card__header">
        <div className="vd-card__status">
          <span className={`dot dot--${status}`} />
          <span className={`badge badge--${status}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        {device.alerts > 0 && (
          <span className="vd-card__alerts">{device.alerts}</span>
        )}
      </div>

      <h3 className="vd-card__title">{device.name}</h3>

      <div className="vd-card__meta">
        <span className="vd-card__serial">{device.serial}</span>
        <span className="vd-card__resolution">{device.resolution}</span>
      </div>

      {status !== 'offline' ? (
        <div className="vd-card__metrics">
          <MetricBar
            label="CPU" value={metrics.cpuUsage} max={100} unit="%"
            warn={70} crit={90}
          />
          <MetricBar
            label="Температура" value={metrics.cpuTemp} max={100} unit="°C"
            warn={70} crit={85}
          />
          <MetricBar
            label="RAM" value={ramPct} max={100} unit="%"
            warn={80} crit={95}
          />
          <MetricBar
            label="SD Health" value={metrics.storageHealth} max={100} unit="%"
          />
        </div>
      ) : (
        <div className="vd-card__offline-msg">
          Нет связи с устройством
        </div>
      )}

      <div className="vd-card__footer">
        <span className="vd-card__uptime">
          {status !== 'offline' ? `Uptime: ${formatUptime(metrics.uptimeHours)}` : '—'}
        </span>
        <span className="vd-card__seen">{timeAgo(device.lastSeen)}</span>
      </div>
    </div>
  );
}

export default function VectorDashboard() {
  const { devices, counts, filter, setFilter, search, setSearch } = useMockDevices();

  const FILTERS = ['all', 'online', 'warning', 'error', 'offline'];

  return (
    <div className="vd">
      <h1 className="page-title">VECTOR — Мониторинг устройств</h1>

      {/* ─── Summary cards ─────────────────── */}
      <div className="vd-summary">
        <div className="vd-summary__card">
          <span className="vd-summary__value">{counts.all}</span>
          <span className="vd-summary__label">Всего</span>
        </div>
        <div className="vd-summary__card vd-summary__card--online">
          <span className="vd-summary__value">{counts.online}</span>
          <span className="vd-summary__label">Онлайн</span>
        </div>
        <div className="vd-summary__card vd-summary__card--warning">
          <span className="vd-summary__value">{counts.warning}</span>
          <span className="vd-summary__label">Предупреждения</span>
        </div>
        <div className="vd-summary__card vd-summary__card--error">
          <span className="vd-summary__value">{counts.error}</span>
          <span className="vd-summary__label">Ошибки</span>
        </div>
        <div className="vd-summary__card vd-summary__card--offline">
          <span className="vd-summary__value">{counts.offline}</span>
          <span className="vd-summary__label">Оффлайн</span>
        </div>
      </div>

      {/* ─── Toolbar ───────────────────────── */}
      <div className="vd-toolbar">
        <div className="vd-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`vd-filter ${filter === f ? 'vd-filter--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f !== 'all' && <span className={`dot dot--${f}`} />}
              {STATUS_LABEL[f]}
              <span className="vd-filter__count">{counts[f]}</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          className="vd-search"
          placeholder="Поиск по имени, серийному номеру..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ─── Device grid ───────────────────── */}
      <div className="vd-grid">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
        {devices.length === 0 && (
          <div className="vd-empty">Устройства не найдены</div>
        )}
      </div>
    </div>
  );
}
