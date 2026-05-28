import { useState } from 'react';
import { screenApi } from '../../services/screenApi';
import { toast } from '../common/Toast';
import {
  ScreenStatus,
  SCREEN_STATUS_LABELS,
  type CreateScreenPayload,
} from '../../types/screen';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface FormErrors {
  name?: string;
  location?: string;
  slotsCount?: string;
  monthlyCost?: string;
  server?: string;
}

const INITIAL_FORM: CreateScreenPayload = {
  name: '',
  location: '',
  slotsCount: 1,
  monthlyCost: 0,
  status: ScreenStatus.ACTIVE,
};

export function AddScreenModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<CreateScreenPayload>({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!form.name.trim()) {
      errs.name = 'Название обязательно';
    }

    if (!form.location.trim()) {
      errs.location = 'Местоположение обязательно';
    }

    if (!Number.isInteger(form.slotsCount) || form.slotsCount < 1) {
      errs.slotsCount = 'Минимум 1 слот (целое число)';
    }

    if (form.monthlyCost < 0) {
      errs.monthlyCost = 'Стоимость не может быть отрицательной';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      await screenApi.create({
        ...form,
        slotsCount: Math.floor(form.slotsCount),
        monthlyCost: Math.round(form.monthlyCost * 100) / 100,
      });
      toast('Экран успешно добавлен', 'success');
      onCreated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Ошибка при создании экрана';
      setErrors({ server: Array.isArray(msg) ? msg[0] : msg });
    } finally {
      setSubmitting(false);
    }
  };

  const setSlotsCount = (raw: string) => {
    const n = parseInt(raw, 10);
    setForm((p) => ({ ...p, slotsCount: isNaN(n) ? 0 : n }));
  };

  const setMonthlyCost = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    setForm((p) => ({ ...p, monthlyCost: isNaN(n) ? 0 : n }));
  };

  return (
    <div className="um-modal__overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal__header">
          <h2>Добавить новый экран</h2>
          <button className="um-modal__close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="um-modal__body">
          {errors.server && (
            <div className="login-alert login-alert--error">
              {errors.server}
            </div>
          )}

          <div className={`login-field ${errors.name ? 'login-field--error' : ''}`}>
            <label className="login-field__label">Название экрана</label>
            <input
              className="login-field__input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder='Например: "Медиафасад Хан-Шатыр"'
            />
            {errors.name && (
              <span className="login-field__error">{errors.name}</span>
            )}
          </div>

          <div className={`login-field ${errors.location ? 'login-field--error' : ''}`}>
            <label className="login-field__label">Местоположение</label>
            <input
              className="login-field__input"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="Адрес или координаты размещения"
            />
            {errors.location && (
              <span className="login-field__error">{errors.location}</span>
            )}
          </div>

          <div className="um-modal__row">
            <div className={`login-field ${errors.slotsCount ? 'login-field--error' : ''}`}>
              <label className="login-field__label">Количество слотов</label>
              <input
                className="login-field__input"
                type="number"
                min={1}
                step={1}
                value={form.slotsCount || ''}
                onChange={(e) => setSlotsCount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === '.' || e.key === ',' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                placeholder="10"
              />
              {errors.slotsCount && (
                <span className="login-field__error">{errors.slotsCount}</span>
              )}
            </div>

            <div className={`login-field ${errors.monthlyCost ? 'login-field--error' : ''}`}>
              <label className="login-field__label">Стоимость / мес (KZT)</label>
              <input
                className="login-field__input"
                type="text"
                inputMode="decimal"
                value={form.monthlyCost || ''}
                onChange={(e) => setMonthlyCost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === '-') e.preventDefault();
                }}
                placeholder="500 000"
              />
              {errors.monthlyCost && (
                <span className="login-field__error">{errors.monthlyCost}</span>
              )}
            </div>
          </div>

          <div className="login-field">
            <label className="login-field__label">Начальный статус</label>
            <select
              className="login-field__input um-modal__select"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as ScreenStatus }))
              }
            >
              {Object.values(ScreenStatus).map((s) => (
                <option key={s} value={s}>
                  {SCREEN_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="um-modal__footer">
          <button
            className="um-modal__cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <span className="login-btn__spinner" /> : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
}
