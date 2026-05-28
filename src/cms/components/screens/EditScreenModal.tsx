import { useState } from 'react';
import { screenApi } from '../../services/screenApi';
import { toast } from '../common/Toast';
import {
  ScreenStatus,
  SCREEN_STATUS_LABELS,
  type Screen,
  type UpdateScreenPayload,
} from '../../types/screen';

interface Props {
  screen: Screen;
  onClose: () => void;
  onUpdated: () => void;
}

interface FormErrors {
  name?: string;
  location?: string;
  slotsCount?: string;
  occupiedSlots?: string;
  monthlyCost?: string;
  server?: string;
}

export function EditScreenModal({ screen, onClose, onUpdated }: Props) {
  const [form, setForm] = useState<UpdateScreenPayload>({
    name: screen.name,
    location: screen.location,
    slotsCount: screen.slotsCount,
    occupiedSlots: screen.occupiedSlots,
    monthlyCost: screen.monthlyCost,
    status: screen.status,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (form.name !== undefined && !form.name.trim()) {
      errs.name = 'Название обязательно';
    }

    if (form.location !== undefined && !form.location.trim()) {
      errs.location = 'Местоположение обязательно';
    }

    if (form.slotsCount !== undefined) {
      if (!Number.isInteger(form.slotsCount) || form.slotsCount < 1) {
        errs.slotsCount = 'Минимум 1 слот';
      }
    }

    if (form.occupiedSlots !== undefined && form.slotsCount !== undefined) {
      if (form.occupiedSlots > form.slotsCount) {
        errs.occupiedSlots = 'Не может превышать общее кол-во слотов';
      }
    }

    if (form.monthlyCost !== undefined && form.monthlyCost < 0) {
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
      await screenApi.update(screen.id, form);
      toast('Экран обновлён', 'success');
      onUpdated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Ошибка при обновлении экрана';
      setErrors({ server: Array.isArray(msg) ? msg[0] : msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="um-modal__overlay" onClick={onClose}>
      <div className="um-modal" onClick={(e) => e.stopPropagation()}>
        <div className="um-modal__header">
          <h2>Редактировать экран</h2>
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
              value={form.name ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            {errors.name && (
              <span className="login-field__error">{errors.name}</span>
            )}
          </div>

          <div className={`login-field ${errors.location ? 'login-field--error' : ''}`}>
            <label className="login-field__label">Местоположение</label>
            <input
              className="login-field__input"
              value={form.location ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
            />
            {errors.location && (
              <span className="login-field__error">{errors.location}</span>
            )}
          </div>

          <div className="um-modal__row">
            <div className={`login-field ${errors.slotsCount ? 'login-field--error' : ''}`}>
              <label className="login-field__label">Всего слотов</label>
              <input
                className="login-field__input"
                type="number"
                min={1}
                step={1}
                value={form.slotsCount ?? ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setForm((p) => ({ ...p, slotsCount: isNaN(n) ? 0 : n }));
                }}
                onKeyDown={(e) => {
                  if (e.key === '.' || e.key === ',' || e.key === '-') e.preventDefault();
                }}
              />
              {errors.slotsCount && (
                <span className="login-field__error">{errors.slotsCount}</span>
              )}
            </div>

            <div className={`login-field ${errors.occupiedSlots ? 'login-field--error' : ''}`}>
              <label className="login-field__label">Занято слотов</label>
              <input
                className="login-field__input"
                type="number"
                min={0}
                step={1}
                value={form.occupiedSlots ?? ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setForm((p) => ({ ...p, occupiedSlots: isNaN(n) ? 0 : n }));
                }}
                onKeyDown={(e) => {
                  if (e.key === '.' || e.key === ',' || e.key === '-') e.preventDefault();
                }}
              />
              {errors.occupiedSlots && (
                <span className="login-field__error">{errors.occupiedSlots}</span>
              )}
            </div>
          </div>

          <div className="um-modal__row">
            <div className={`login-field ${errors.monthlyCost ? 'login-field--error' : ''}`}>
              <label className="login-field__label">Стоимость / мес (KZT)</label>
              <input
                className="login-field__input"
                type="text"
                inputMode="decimal"
                value={form.monthlyCost ?? ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                  const n = parseFloat(cleaned);
                  setForm((p) => ({ ...p, monthlyCost: isNaN(n) ? 0 : n }));
                }}
                onKeyDown={(e) => {
                  if (e.key === '-') e.preventDefault();
                }}
              />
              {errors.monthlyCost && (
                <span className="login-field__error">{errors.monthlyCost}</span>
              )}
            </div>

            <div className="login-field">
              <label className="login-field__label">Статус</label>
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
            {submitting ? <span className="login-btn__spinner" /> : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
