-- ============================================================================
-- Migration 003: Телеметрия устройств (система VECTOR)
-- Сбор данных: CPU, температура, SD-карты, сеть, память
-- Оптимизировано для сотен устройств с частотой отправки 10-60 сек
-- ============================================================================

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');

-- ============================================================================
-- Телеметрия (time-series, партиционирование по дням)
-- ============================================================================
CREATE TABLE device_telemetry (
    id BIGSERIAL,
    device_id UUID NOT NULL REFERENCES devices(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- CPU
    cpu_usage_percent DECIMAL(5, 2),
    cpu_temperature_celsius DECIMAL(5, 2),
    cpu_frequency_mhz INT,

    -- Память
    ram_used_mb INT,
    ram_total_mb INT,

    -- Хранилище (SD-карта / eMMC)
    storage_used_mb INT,
    storage_total_mb INT,
    storage_health_percent DECIMAL(5, 2),
    storage_read_errors BIGINT DEFAULT 0,
    storage_write_errors BIGINT DEFAULT 0,

    -- Сеть
    network_type VARCHAR(20),
    network_signal_dbm INT,
    bandwidth_up_kbps INT,
    bandwidth_down_kbps INT,
    packet_loss_percent DECIMAL(5, 2),

    -- Дисплей
    display_connected BOOLEAN DEFAULT true,
    display_brightness INT,

    -- Системные
    uptime_seconds BIGINT,
    process_count INT,
    player_pid INT,
    player_memory_mb INT,

    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Автоматическое создание партиций по дням (пример на неделю)
CREATE TABLE device_telemetry_default PARTITION OF device_telemetry DEFAULT;

-- Индексы для быстрого доступа
CREATE INDEX idx_telemetry_device_time ON device_telemetry(device_id, recorded_at DESC);
CREATE INDEX idx_telemetry_cpu_temp ON device_telemetry(cpu_temperature_celsius)
    WHERE cpu_temperature_celsius > 75;

-- ============================================================================
-- Агрегированная телеметрия (hourly rollups для длительных периодов)
-- ============================================================================
CREATE TABLE device_telemetry_hourly (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id),
    hour_start TIMESTAMPTZ NOT NULL,

    cpu_usage_avg DECIMAL(5, 2),
    cpu_usage_max DECIMAL(5, 2),
    cpu_temp_avg DECIMAL(5, 2),
    cpu_temp_max DECIMAL(5, 2),
    ram_usage_avg_percent DECIMAL(5, 2),
    storage_health_min DECIMAL(5, 2),
    network_packet_loss_avg DECIMAL(5, 2),
    uptime_percent DECIMAL(5, 2),

    sample_count INT NOT NULL DEFAULT 0,

    CONSTRAINT uq_telemetry_hourly UNIQUE (device_id, hour_start)
);

CREATE INDEX idx_telemetry_hourly_device ON device_telemetry_hourly(device_id, hour_start DESC);

-- ============================================================================
-- Алерты и инциденты
-- ============================================================================
CREATE TABLE device_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id),
    severity alert_severity NOT NULL,
    status alert_status NOT NULL DEFAULT 'active',
    alert_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    threshold_value DECIMAL(10, 2),
    actual_value DECIMAL(10, 2),
    metadata JSONB NOT NULL DEFAULT '{}',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_device ON device_alerts(device_id, triggered_at DESC);
CREATE INDEX idx_alerts_active ON device_alerts(status) WHERE status = 'active';
CREATE INDEX idx_alerts_severity ON device_alerts(severity, status);

-- ============================================================================
-- Правила мониторинга (настраиваемые пороги)
-- ============================================================================
CREATE TABLE monitoring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(10) NOT NULL,
    threshold_value DECIMAL(10, 2) NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'warning',
    cooldown_minutes INT NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notify_channels JSONB NOT NULL DEFAULT '["dashboard"]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- История состояний устройства (для прогнозирования отказов)
-- ============================================================================
CREATE TABLE device_state_history (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id),
    state VARCHAR(30) NOT NULL,
    reason TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_state_history_device ON device_state_history(device_id, recorded_at DESC);
