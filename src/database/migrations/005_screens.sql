-- 005_screens.sql — LED-экраны (инвентарь сети)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'screen_status') THEN
    CREATE TYPE screen_status AS ENUM ('active', 'maintenance', 'offline');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS screens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  location        VARCHAR(500) NOT NULL,
  slots_count     INTEGER NOT NULL CHECK (slots_count >= 1),
  occupied_slots  INTEGER NOT NULL DEFAULT 0 CHECK (occupied_slots >= 0),
  monthly_cost    NUMERIC(12, 2) NOT NULL CHECK (monthly_cost >= 0),
  status          screen_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT screens_name_org_unique UNIQUE (name, organization_id),
  CONSTRAINT screens_occupied_le_total CHECK (occupied_slots <= slots_count)
);

CREATE INDEX IF NOT EXISTS idx_screens_status ON screens (status);
CREATE INDEX IF NOT EXISTS idx_screens_org    ON screens (organization_id);
