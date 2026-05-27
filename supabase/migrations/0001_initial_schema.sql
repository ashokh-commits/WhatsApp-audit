-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                   TEXT NOT NULL,
  instance_name          TEXT NOT NULL UNIQUE,
  instance_key_encrypted TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ============================================================
-- CONSENT RECORDS
-- ============================================================
CREATE TABLE consent_records (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  authorized_by TEXT NOT NULL,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  document_url  TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_consent_client ON consent_records(client_id);

-- ============================================================
-- AUDITS
-- ============================================================
CREATE TABLE audits (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  window_days      SMALLINT NOT NULL DEFAULT 30,
  overall_score    SMALLINT,
  dimension_scores JSONB,
  metrics          JSONB,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','running','complete','failed')),
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audits_client     ON audits(client_id);
CREATE INDEX idx_audits_created_at ON audits(created_at DESC);

-- ============================================================
-- META AD ROWS  (uploaded CSV/XLSX)
-- ============================================================
CREATE TABLE meta_ad_rows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id      UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  campaign_name TEXT,
  adset_name    TEXT,
  ad_name       TEXT,
  spend         NUMERIC(10,2),
  impressions   INTEGER,
  clicks        INTEGER,
  results       INTEGER,
  source        TEXT NOT NULL CHECK (source IN ('csv','api')),
  raw_row       JSONB
);

CREATE INDEX idx_meta_ad_rows_audit ON meta_ad_rows(audit_id);

-- ============================================================
-- CTWA CONVERSATIONS
-- ============================================================
CREATE TABLE ctwa_conversations (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_id               UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  chat_ref               TEXT NOT NULL,
  referral               JSONB NOT NULL,
  ad_headline            TEXT,
  source_url             TEXT,
  answered               BOOLEAN NOT NULL DEFAULT FALSE,
  first_response_seconds INTEGER,
  matched_meta_row_id    UUID REFERENCES meta_ad_rows(id) ON DELETE SET NULL,
  match_confidence       TEXT CHECK (
                           match_confidence IN ('exact','fuzzy','campaign','unmatched')
                         )
);

CREATE INDEX idx_ctwa_audit   ON ctwa_conversations(audit_id);
CREATE INDEX idx_ctwa_matched ON ctwa_conversations(matched_meta_row_id);
