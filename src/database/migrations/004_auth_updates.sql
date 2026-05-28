-- ============================================================================
-- Migration 004: Обновления для модуля Auth + роль "бухгалтер"
-- ============================================================================

-- Добавляем роль 'accountant' (бухгалтер) в enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';

-- Колонка для хранения хэша refresh-токена
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255);

-- Разрешения для бухгалтера
INSERT INTO role_permissions (role, permission_id)
SELECT 'accountant', id FROM permissions
WHERE code IN ('analytics.view', 'analytics.export', 'billing.manage');

-- Seed: администратор по умолчанию (пароль: Admin123!)
-- bcrypt hash для 'Admin123!' с salt=12
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'MYDigital Default', 'myd-default')
ON CONFLICT DO NOTHING;

INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status) VALUES
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin@mydigital.kz',
    '$2b$12$LJ3m4ys3Lk0TSwHiP3VDOeJFHPLJYjzSwyBvGxqR6VCK1R4mJKP3i',
    'System',
    'Admin',
    'admin',
    'active'
  )
ON CONFLICT DO NOTHING;
