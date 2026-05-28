import { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './LoginPage.css';

interface FormErrors {
  email?: string;
  password?: string;
  server?: string;
}

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!email.trim()) {
      next.email = 'Введите email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Некорректный формат email';
    }

    if (!password) {
      next.password = 'Введите пароль';
    } else if (password.length < 6) {
      next.password = 'Минимум 6 символов';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const message = err?.message ?? err?.response?.data?.message;

      if (status === 401) {
        setErrors({ server: message || 'Неверный email или пароль' });
      } else if (status === 403) {
        setErrors({ server: message || 'Аккаунт заблокирован' });
      } else {
        setErrors({ server: message || 'Ошибка сервера. Попробуйте позже' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__logo">
            MYD<span>igital</span>
          </h1>
          <p className="login-card__subtitle">LED MEDIA BORD — Панель управления</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {errors.server && (
            <div className="login-alert login-alert--error">{errors.server}</div>
          )}

          <div className={`login-field ${errors.email ? 'login-field--error' : ''}`}>
            <label className="login-field__label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="login-field__input"
              placeholder="user@mydigital.kz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={loading}
            />
            {errors.email && <span className="login-field__error">{errors.email}</span>}
          </div>

          <div className={`login-field ${errors.password ? 'login-field--error' : ''}`}>
            <label className="login-field__label" htmlFor="password">
              Пароль
            </label>
            <div className="login-field__password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="login-field__input"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="login-field__toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? '◉' : '◎'}
              </button>
            </div>
            {errors.password && (
              <span className="login-field__error">{errors.password}</span>
            )}
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="login-btn__spinner" /> : 'Войти в систему'}
          </button>
        </form>

        <div className="login-card__hint">
          <p className="login-hint__title">Тестовые аккаунты:</p>
          <div className="login-hint__accounts">
            <span><b>admin@mydigital.kz</b> / Admin123!</span>
            <span><b>operator@mydigital.kz</b> / Oper123!</span>
            <span><b>agent@mydigital.kz</b> / Agent123!</span>
            <span><b>client@mydigital.kz</b> / Client123!</span>
            <span><b>accountant@mydigital.kz</b> / Account123!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
