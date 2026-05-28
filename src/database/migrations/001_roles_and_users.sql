-- ============================================================================
-- Migration 001: Многоуровневая ролевая модель (RBAC)
-- Поддержка ролей: operator, agent, admin, client
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Перечисление системных ролей
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'agent', 'client');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'pending', 'archived');

-- ============================================================================
-- Организации (тенанты) — мультитенантность для масштабирования
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================================
-- Пользователи
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'client',
    status account_status NOT NULL DEFAULT 'pending',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_email_org UNIQUE (email, organization_id)
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- Гранулярные разрешения (permissions)
-- ============================================================================
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    module VARCHAR(50) NOT NULL
);

-- Связь роль → разрешения
CREATE TABLE role_permissions (
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

-- Индивидуальные разрешения пользователя (переопределение роли)
CREATE TABLE user_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, permission_id)
);

-- ============================================================================
-- Устройства (LED-экраны с Mini PC)
-- ============================================================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    location_lat DECIMAL(10, 7),
    location_lng DECIMAL(10, 7),
    address TEXT,
    resolution_width INT NOT NULL DEFAULT 1920,
    resolution_height INT NOT NULL DEFAULT 1080,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Almaty',
    is_online BOOLEAN NOT NULL DEFAULT false,
    last_heartbeat_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_org ON devices(organization_id);
CREATE INDEX idx_devices_online ON devices(is_online);
CREATE INDEX idx_devices_serial ON devices(serial_number);

-- Привязка оператора/агента к устройствам
CREATE TABLE user_device_access (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    access_level VARCHAR(20) NOT NULL DEFAULT 'view',
    PRIMARY KEY (user_id, device_id)
);

-- ============================================================================
-- Группы устройств (для массового управления)
-- ============================================================================
CREATE TABLE device_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_group_members (
    group_id UUID NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, device_id)
);

-- ============================================================================
-- Начальные данные: системные разрешения
-- ============================================================================
INSERT INTO permissions (id, code, description, module) VALUES
    (uuid_generate_v4(), 'campaigns.create', 'Создание рекламных кампаний', 'campaigns'),
    (uuid_generate_v4(), 'campaigns.edit', 'Редактирование кампаний', 'campaigns'),
    (uuid_generate_v4(), 'campaigns.delete', 'Удаление кампаний', 'campaigns'),
    (uuid_generate_v4(), 'campaigns.emergency', 'Экстренный перехват эфира', 'campaigns'),
    (uuid_generate_v4(), 'devices.manage', 'Управление устройствами', 'devices'),
    (uuid_generate_v4(), 'devices.view', 'Просмотр устройств', 'devices'),
    (uuid_generate_v4(), 'users.manage', 'Управление пользователями', 'users'),
    (uuid_generate_v4(), 'analytics.view', 'Просмотр аналитики', 'analytics'),
    (uuid_generate_v4(), 'analytics.export', 'Экспорт аналитики', 'analytics'),
    (uuid_generate_v4(), 'telemetry.view', 'Просмотр телеметрии', 'telemetry'),
    (uuid_generate_v4(), 'billing.manage', 'Управление биллингом', 'billing');

-- Назначение разрешений ролям
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

INSERT INTO role_permissions (role, permission_id)
SELECT 'operator', id FROM permissions
WHERE code IN ('campaigns.create', 'campaigns.edit', 'campaigns.emergency', 'devices.manage', 'devices.view', 'analytics.view', 'telemetry.view');

INSERT INTO role_permissions (role, permission_id)
SELECT 'agent', id FROM permissions
WHERE code IN ('campaigns.create', 'campaigns.edit', 'devices.view', 'analytics.view');

INSERT INTO role_permissions (role, permission_id)
SELECT 'client', id FROM permissions
WHERE code IN ('campaigns.create', 'devices.view', 'analytics.view');

-- ============================================================================
-- Триггер обновления updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
