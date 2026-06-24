-- ============================================================
-- Stage 4 Analysis Table Migration
-- Run: psql "$DATABASE_URL" -f migration_stage4.sql
-- ============================================================

ALTER TABLE castateintel.pal_contacts
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS doc_created_date DATE;

ALTER TABLE castateintel.pal_stage2_analysis
  ADD COLUMN IF NOT EXISTS solution_tags JSONB;

CREATE TABLE IF NOT EXISTS castateintel.pal_stage4_analysis (
  analysis_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                INTEGER NOT NULL,
  document_id               UUID,
  doc_created_date          DATE,

  -- 4.1 General Information
  general_info_raw          JSONB,

  -- 4.2 Submittal Information
  submittal_contacts        JSONB,
  submittal_info            JSONB,

  -- 4.3 Contract Management
  contract_management       JSONB,   -- array of {question, answer, notes}

  -- 4.4 Organizational Readiness
  org_readiness             JSONB,   -- array of {question, answer, notes}

  -- 4.5 Project Readiness
  project_readiness         JSONB,   -- methodology, OTech, resource info

  -- 4.6 Business Objective Valuation
  objectives                JSONB,   -- array of {id, objective, metric, baseline, target, valuation_pct, change}

  -- 4.7 Schedule Baseline
  schedule_baseline         JSONB,   -- start/end dates, variances, milestones
  proposed_project_start    DATE,
  baseline_project_start    DATE,
  proposed_project_end      DATE,
  baseline_project_end      DATE,

  -- 4.8 Cost Baseline
  cost_baseline             JSONB,   -- all cost rows
  total_cost_proposed       TEXT,
  total_cost_baseline       TEXT,
  annual_mo_cost            TEXT,

  -- 4.9 Primary Solicitation Results
  solicitation_results      JSONB,   -- vendor, contract #, dates, cost
  selected_vendor           TEXT,
  contract_number           TEXT,
  contract_start_date       DATE,
  contract_end_date         DATE,
  total_contract_cost       TEXT,

  -- 4.10 Risk Register
  risk_register             JSONB,   -- array of {risk, probability, impact, mitigation}

  -- CDT Use Only
  dot_dates                 JSONB,   -- array of {label, date}
  dot_raw                   JSONB,

  extracted_at              TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stage4_project
  ON castateintel.pal_stage4_analysis(project_id);

DO $$ BEGIN
  CREATE TRIGGER trg_s4_upd BEFORE UPDATE ON castateintel.pal_stage4_analysis
    FOR EACH ROW EXECUTE FUNCTION castateintel.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT 'Stage 4 migration complete' AS status;
