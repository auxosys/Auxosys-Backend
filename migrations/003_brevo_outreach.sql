-- ============================================================
-- Brevo Outreach Infrastructure - Migration 003
-- Central company sender emails, per-user sender permissions,
-- suppression lists, campaigns, and message-level audit logging.
-- Works on both fresh databases and existing schema.
-- ============================================================

-- 1. Sender Emails (Central Company Registry & Brevo Status)
CREATE TABLE IF NOT EXISTS sender_emails (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,               -- e.g. Auxosys Careers
  email             TEXT NOT NULL UNIQUE,        -- e.g. careers@auxosys.com
  department        TEXT,                        -- e.g. HR / Recruitment
  brevo_sender_id   TEXT,                        -- Brevo API sender ID
  reply_to_email    TEXT,                        -- Default Reply-To
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default company senders if not present
INSERT INTO sender_emails (name, email, department, reply_to_email, is_verified, status)
VALUES
  ('Auxosys Careers', 'careers@auxosys.com', 'HR / Recruitment', 'careers@auxosys.com', true, 'active'),
  ('Auxosys General', 'hello@auxosys.com', 'General Enquiries', 'hello@auxosys.com', true, 'active'),
  ('Auxosys Sales', 'sales@auxosys.com', 'Sales & Business', 'sales@auxosys.com', true, 'active'),
  ('Auxosys Support', 'support@auxosys.com', 'Customer Support', 'support@auxosys.com', true, 'active'),
  ('Auxosys HR', 'hr@auxosys.com', 'Human Resources', 'hr@auxosys.com', true, 'active')
ON CONFLICT (email) DO NOTHING;

-- 2. User Sender Permissions (RBAC Access Mapping)
CREATE TABLE IF NOT EXISTS user_sender_permissions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL,
  sender_email_id   UUID NOT NULL REFERENCES sender_emails(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, sender_email_id)
);

-- 3. Contact Suppression List
CREATE TABLE IF NOT EXISTS contact_suppressions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT NOT NULL UNIQUE,
  reason            TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'hard_bounce', 'spam_complaint', 'manual')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Campaigns Table Definition & Migration Columns
CREATE TABLE IF NOT EXISTS campaigns (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID,                        -- Creator User ID
  sender_email_id   UUID REFERENCES sender_emails(id),
  name              TEXT NOT NULL,
  template_id       UUID REFERENCES templates(id) ON DELETE SET NULL,
  list_id           UUID REFERENCES mail_lists(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  daily_limit       INTEGER NOT NULL DEFAULT 100,
  min_delay_sec     INTEGER NOT NULL DEFAULT 30,
  max_delay_sec     INTEGER NOT NULL DEFAULT 90,
  track_opens       BOOLEAN NOT NULL DEFAULT TRUE,
  track_clicks      BOOLEAN NOT NULL DEFAULT TRUE,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  total_contacts    INTEGER NOT NULL DEFAULT 0,
  last_sent_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_email_id UUID REFERENCES sender_emails(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- 5. Campaign Logs Table Definition & Migration Columns
CREATE TABLE IF NOT EXISTS campaign_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id       UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  sender_email_id   UUID REFERENCES sender_emails(id),
  created_by_user_id UUID,
  contact_id        UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_email   TEXT NOT NULL,
  brevo_message_id  TEXT,                        -- Brevo Transactional Message ID
  status            TEXT NOT NULL DEFAULT 'queued',
  retry_count       INTEGER NOT NULL DEFAULT 0,
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,                   -- Estimated
  clicked_at        TIMESTAMPTZ,
  replied_at        TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS sender_email_id UUID REFERENCES sender_emails(id);
ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS brevo_message_id TEXT;
ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE campaign_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 6. Indexes for Performance & Lookups
CREATE INDEX IF NOT EXISTS idx_campaign_logs_brevo_msg ON campaign_logs(brevo_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_sender ON campaign_logs(sender_email_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user ON campaign_logs(created_by_user_id);
