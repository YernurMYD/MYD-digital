-- ============================================================================
-- Migration 002: Рекламные кампании, плейлисты, очередность и приоритеты
-- ============================================================================

CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE campaign_priority AS ENUM ('low', 'normal', 'high', 'emergency');
CREATE TYPE media_type AS ENUM ('video', 'image', 'widget', 'stream');

-- ============================================================================
-- Медиафайлы
-- ============================================================================
CREATE TABLE media_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    original_name VARCHAR(500) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    media_type media_type NOT NULL DEFAULT 'video',
    duration_ms INT,
    width INT,
    height INT,
    thumbnail_path VARCHAR(1000),
    transcode_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_org ON media_files(organization_id);
CREATE INDEX idx_media_type ON media_files(media_type);

-- ============================================================================
-- Кампании
-- ============================================================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status campaign_status NOT NULL DEFAULT 'draft',
    priority campaign_priority NOT NULL DEFAULT 'normal',

    -- Расписание
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    daily_start_time TIME,
    daily_end_time TIME,
    days_of_week INT[] DEFAULT '{1,2,3,4,5,6,7}',

    -- Экстренный перехват: если true — прерывает текущее воспроизведение
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    emergency_expires_at TIMESTAMPTZ,

    -- Частота показа (раз в N минут в рамках плейлиста)
    repeat_interval_minutes INT DEFAULT 0,
    max_impressions_per_day INT,

    budget_total DECIMAL(12, 2),
    budget_spent DECIMAL(12, 2) DEFAULT 0,

    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_priority ON campaigns(priority);
CREATE INDEX idx_campaigns_schedule ON campaigns(start_at, end_at);
CREATE INDEX idx_campaigns_emergency ON campaigns(is_emergency) WHERE is_emergency = true;

-- ============================================================================
-- Элементы кампании (медиа внутри кампании)
-- ============================================================================
CREATE TABLE campaign_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    media_file_id UUID NOT NULL REFERENCES media_files(id),
    sort_order INT NOT NULL DEFAULT 0,
    duration_override_ms INT,
    transition_type VARCHAR(50) DEFAULT 'crossfade',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_items_campaign ON campaign_items(campaign_id);
CREATE INDEX idx_campaign_items_order ON campaign_items(campaign_id, sort_order);

-- ============================================================================
-- Привязка кампаний к устройствам/группам
-- ============================================================================
CREATE TABLE campaign_device_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    device_group_id UUID REFERENCES device_groups(id) ON DELETE CASCADE,
    CONSTRAINT chk_target CHECK (
        (device_id IS NOT NULL AND device_group_id IS NULL) OR
        (device_id IS NULL AND device_group_id IS NOT NULL)
    )
);

CREATE INDEX idx_campaign_targets_campaign ON campaign_device_targets(campaign_id);
CREATE INDEX idx_campaign_targets_device ON campaign_device_targets(device_id);

-- ============================================================================
-- Плейлист устройства (вычисленная очередь на конкретную дату)
-- ============================================================================
CREATE TABLE device_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    generated_for_date DATE NOT NULL,
    playlist_data JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_device_playlist_date UNIQUE (device_id, generated_for_date)
);

CREATE INDEX idx_playlists_device_date ON device_playlists(device_id, generated_for_date);

-- ============================================================================
-- Лог показов (для аналитики и биллинга)
-- ============================================================================
CREATE TABLE impression_logs (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    media_file_id UUID NOT NULL REFERENCES media_files(id),
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_played_ms INT,
    was_emergency BOOLEAN NOT NULL DEFAULT false
) PARTITION BY RANGE (played_at);

-- Партиционирование по месяцам для масштабирования
CREATE TABLE impression_logs_2026_01 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE impression_logs_2026_02 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE impression_logs_2026_03 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE impression_logs_2026_04 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE impression_logs_2026_05 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE impression_logs_2026_06 PARTITION OF impression_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_impressions_device ON impression_logs(device_id, played_at);
CREATE INDEX idx_impressions_campaign ON impression_logs(campaign_id, played_at);

CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
