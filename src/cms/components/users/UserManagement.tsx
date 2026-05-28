import { useState, useEffect, useCallback } from 'react';
import { mockAuth } from '../../services/mockAuth';
import {
  UserRole,
  AccountStatus,
  ROLE_LABELS,
  STATUS_LABELS,
  type User,
  type CreateUserPayload,
} from '../../types/auth';
import './UserManagement.css';

const EMPTY_FORM: CreateUserPayload = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: UserRole.OPERATOR,
};

interface FormErrors {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  server?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mockAuth.getUsers();
      setUsers(data);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!form.firstName.trim()) errs.firstName = 'Обязательное поле';
    if (!form.lastName.trim()) errs.lastName = 'Обязательное поле';

    if (!form.email.trim()) {
      errs.email = 'Обязательное поле';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Некорректный email';
    }

    if (!form.password) {
      errs.password = 'Обязательное поле';
    } else if (form.password.length < 6) {
      errs.password = 'Минимум 6 символов';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setFormErrors({});

    try {
      await mockAuth.createUser(form);
      setShowModal(false);
      setForm({ ...EMPTY_FORM });
      await fetchUsers();
    } catch (err: any) {
      const msg = err?.message || 'Ошибка создания пользователя';
      setFormErrors({ server: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    setTogglingId(userId);
    try {
      const updated = await mockAuth.toggleStatus(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: updated.status } : u)),
      );
    } catch {
      /* swallow */
    } finally {
      setTogglingId(null);
    }
  };

  const openModal = () => {
    setForm({ ...EMPTY_FORM });
    setFormErrors({});
    setShowModal(true);
  };

  const filtered = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      ROLE_LABELS[u.role]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="um">
      <div className="um__header">
        <h1 className="page-title">Управление пользователями</h1>
        <button className="um__add-btn" onClick={openModal}>
          + Добавить пользователя
        </button>
      </div>

      <div className="um__toolbar">
        <input
          type="text"
          className="um__search"
          placeholder="Поиск по имени, email или роли..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="um__count">{filtered.length} пользователей</span>
      </div>

      {loading ? (
        <div className="um__loader">
          <div className="route-loader__spinner" />
        </div>
      ) : (
        <div className="um__table-wrap">
          <table className="um__table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Последний вход</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="um__empty">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="um__user-cell">
                        <div className="um__avatar">
                          {(user.firstName?.[0] || '').toUpperCase()}
                          {(user.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <span>
                          {user.firstName} {user.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="um__email">{user.email}</td>
                    <td>
                      <span className={`badge badge--role-${user.role}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.status === AccountStatus.ACTIVE
                            ? 'badge--active'
                            : user.status === AccountStatus.SUSPENDED
                              ? 'badge--error'
                              : 'badge--pending'
                        }`}
                      >
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td className="um__date">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString('ru-RU')
                        : '—'}
                    </td>
                    <td>
                      <button
                        className={`um__toggle-btn ${
                          user.status === AccountStatus.ACTIVE
                            ? 'um__toggle-btn--block'
                            : 'um__toggle-btn--unblock'
                        }`}
                        onClick={() => handleToggleStatus(user.id)}
                        disabled={togglingId === user.id}
                      >
                        {togglingId === user.id
                          ? '...'
                          : user.status === AccountStatus.ACTIVE
                            ? 'Заблокировать'
                            : 'Разблокировать'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="um-modal__overlay" onClick={() => setShowModal(false)}>
          <div className="um-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-modal__header">
              <h2>Добавить нового пользователя</h2>
              <button
                className="um-modal__close"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="um-modal__body">
              {formErrors.server && (
                <div className="login-alert login-alert--error">
                  {formErrors.server}
                </div>
              )}

              <div className="um-modal__row">
                <div
                  className={`login-field ${formErrors.firstName ? 'login-field--error' : ''}`}
                >
                  <label className="login-field__label">Имя</label>
                  <input
                    className="login-field__input"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, firstName: e.target.value }))
                    }
                    placeholder="Имя"
                  />
                  {formErrors.firstName && (
                    <span className="login-field__error">{formErrors.firstName}</span>
                  )}
                </div>
                <div
                  className={`login-field ${formErrors.lastName ? 'login-field--error' : ''}`}
                >
                  <label className="login-field__label">Фамилия</label>
                  <input
                    className="login-field__input"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, lastName: e.target.value }))
                    }
                    placeholder="Фамилия"
                  />
                  {formErrors.lastName && (
                    <span className="login-field__error">{formErrors.lastName}</span>
                  )}
                </div>
              </div>

              <div
                className={`login-field ${formErrors.email ? 'login-field--error' : ''}`}
              >
                <label className="login-field__label">Email</label>
                <input
                  className="login-field__input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="user@mydigital.kz"
                />
                {formErrors.email && (
                  <span className="login-field__error">{formErrors.email}</span>
                )}
              </div>

              <div
                className={`login-field ${formErrors.password ? 'login-field--error' : ''}`}
              >
                <label className="login-field__label">Пароль</label>
                <input
                  className="login-field__input"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="Минимум 6 символов"
                />
                {formErrors.password && (
                  <span className="login-field__error">{formErrors.password}</span>
                )}
              </div>

              <div className="login-field">
                <label className="login-field__label">Роль</label>
                <select
                  className="login-field__input um-modal__select"
                  value={form.role}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, role: e.target.value as UserRole }))
                  }
                >
                  {Object.values(UserRole).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="login-field">
                <label className="login-field__label">Телефон (необязательно)</label>
                <input
                  className="login-field__input"
                  type="tel"
                  value={form.phone || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="+7 (___) ___-__-__"
                />
              </div>
            </div>

            <div className="um-modal__footer">
              <button
                className="um-modal__cancel"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Отмена
              </button>
              <button
                className="login-btn"
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? <span className="login-btn__spinner" /> : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
