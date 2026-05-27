-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ad_rows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctwa_conversations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- CONSENT RECORDS
-- ============================================================
CREATE POLICY "consent_select" ON consent_records
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "consent_insert" ON consent_records
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- AUDITS
-- ============================================================
CREATE POLICY "audits_select" ON audits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "audits_insert" ON audits
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "audits_update" ON audits
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================
-- META AD ROWS
-- ============================================================
CREATE POLICY "meta_ad_rows_select" ON meta_ad_rows
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM audits a WHERE a.id = meta_ad_rows.audit_id)
  );

CREATE POLICY "meta_ad_rows_insert" ON meta_ad_rows
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- CTWA CONVERSATIONS
-- ============================================================
CREATE POLICY "ctwa_select" ON ctwa_conversations
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM audits a WHERE a.id = ctwa_conversations.audit_id)
  );

CREATE POLICY "ctwa_insert" ON ctwa_conversations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ctwa_update" ON ctwa_conversations
  FOR UPDATE USING (auth.role() = 'authenticated');
