import { useState, useEffect, useCallback } from 'react';
import { screenApi } from '../../services/screenApi';
import { toast } from '../common/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/auth';
import { AddScreenModal } from './AddScreenModal';
import { EditScreenModal } from './EditScreenModal';
import {
  ScreenStatus,
  SCREEN_STATUS_LABELS,
  type Screen,
  type ScreenQuery,
} from '../../types/screen';
import './ScreenInventory.css';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function slotsFillPercent(occupied: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

export default function ScreenInventory() {
  const { hasRole } = useAuth();
  const canManage = hasRole(UserRole.ADMIN, UserRole.OPERATOR);

  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingScreen, setEditingScreen] = useState<Screen | null>(null);
  const [filterStatus, setFilterStatus] = useState<ScreenStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchScreens = useCallback(async () => {
    try {
      setLoading(true);
      const query: ScreenQuery = {};
      if (filterStatus) query.status = filterStatus;
      const data = await screenApi.getAll(query);
      setScreens(data);
    } catch {
      toast('Не удалось загрузить экраны', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchScreens();
  }, [fetchScreens]);

  const filtered = screens.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: screens.length,
    active: screens.filter((s) => s.status === ScreenStatus.ACTIVE).length,
    maintenance: screens.filter((s) => s.status === ScreenStatus.MAINTENANCE).length,
    offline: screens.filter((s) => s.status === ScreenStatus.OFFLINE).length,
  };

  const handleCreated = () => {
    setShowAddModal(false);
    fetchScreens();
  };

  const handleUpdated = () => {
    setEditingScreen(null);
    fetchScreens();
  };

  return (
    <div className="si">
      <div className="si__header">
        <h1 className="page-title">Управление экранами</h1>
        {canManage && (
          <button className="si__add-btn" onClick={() => setShowAddModal(true)}>
            + Добавить экран
          </button>
        )}
      </div>

      <div className="si__stats">
        <div className="si__stat">
          <span className="si__stat-value">{stats.total}</span>
          <span className="si__stat-label">Всего</span>
        </div>
        <div className="si__stat si__stat--active">
          <span className="si__stat-value">{stats.active}</span>
          <span className="si__stat-label">Активных</span>
        </div>
        <div className="si__stat si__stat--maintenance">
          <span className="si__stat-value">{stats.maintenance}</span>
          <span className="si__stat-label">Обслуживание</span>
        </div>
        <div className="si__stat si__stat--offline">
          <span className="si__stat-value">{stats.offline}</span>
          <span className="si__stat-label">Офлайн</span>
        </div>
      </div>

      <div className="si__toolbar">
        <input
          type="text"
          className="si__search"
          placeholder="Поиск по названию или локации..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="si__filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ScreenStatus | '')}
        >
          <option value="">Все статусы</option>
          {Object.values(ScreenStatus).map((s) => (
            <option key={s} value={s}>
              {SCREEN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="si__count">{filtered.length} экранов</span>
      </div>

      {loading ? (
        <div className="si__loader">
          <div className="route-loader__spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="si__empty">
          <span className="si__empty-icon">▣</span>
          <p>Экраны не найдены</p>
          {canManage && (
            <button
              className="si__add-btn si__add-btn--ghost"
              onClick={() => setShowAddModal(true)}
            >
              + Добавить первый экран
            </button>
          )}
        </div>
      ) : (
        <div className="si__grid">
          {filtered.map((screen) => (
            <ScreenCard
              key={screen.id}
              screen={screen}
              canManage={canManage}
              onEdit={() => setEditingScreen(screen)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddScreenModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}

      {editingScreen && (
        <EditScreenModal
          screen={editingScreen}
          onClose={() => setEditingScreen(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

interface ScreenCardProps {
  screen: Screen;
  canManage: boolean;
  onEdit: () => void;
}

function ScreenCard({ screen, canManage, onEdit }: ScreenCardProps) {
  const fill = slotsFillPercent(screen.occupiedSlots, screen.slotsCount);

  const statusClass =
    screen.status === ScreenStatus.ACTIVE
      ? 'active'
      : screen.status === ScreenStatus.MAINTENANCE
        ? 'warning'
        : 'offline';

  return (
    <div className="sc">
      <div className="sc__top">
        <div className={`badge badge--${statusClass}`}>
          <span className={`dot dot--${statusClass === 'active' ? 'online' : statusClass}`} />
          {SCREEN_STATUS_LABELS[screen.status]}
        </div>
        {canManage && (
          <button className="sc__edit" onClick={onEdit} title="Редактировать">
            ✎
          </button>
        )}
      </div>

      <h3 className="sc__name">{screen.name}</h3>
      <p className="sc__location">{screen.location}</p>

      <div className="sc__slots">
        <div className="sc__slots-header">
          <span>Слоты</span>
          <span className="sc__slots-numbers">
            {screen.occupiedSlots} из {screen.slotsCount}
          </span>
        </div>
        <div className="sc__slots-bar">
          <div
            className={`sc__slots-fill ${fill >= 90 ? 'sc__slots-fill--full' : fill >= 60 ? 'sc__slots-fill--mid' : ''}`}
            style={{ width: `${fill}%` }}
          />
        </div>
        <span className="sc__slots-percent">Занято {fill}%</span>
      </div>

      <div className="sc__price">
        <span className="sc__price-label">Стоимость / мес</span>
        <span className="sc__price-value">{formatCurrency(screen.monthlyCost)}</span>
      </div>
    </div>
  );
}
