-- ============================================================
-- Migration: income_source_amounts
-- Histórico de valores por fonte de renda (ex: reajustes de salário)
-- ============================================================

CREATE TABLE IF NOT EXISTS income_source_amounts (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id       UUID REFERENCES income_sources(id) ON DELETE CASCADE,
  effective_month INTEGER NOT NULL CHECK (effective_month BETWEEN 1 AND 12),
  effective_year  INTEGER NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_id, effective_month, effective_year)
);

CREATE INDEX IF NOT EXISTS idx_income_source_amounts_source
  ON income_source_amounts(source_id);

CREATE INDEX IF NOT EXISTS idx_income_source_amounts_effective
  ON income_source_amounts(effective_year DESC, effective_month DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE income_source_amounts ENABLE ROW LEVEL SECURITY;

-- Necessário dropar a policy antiga (allow_authenticated) se existir
DROP POLICY IF EXISTS "allow_authenticated" ON income_source_amounts;
DROP POLICY IF EXISTS "allow_all"           ON income_source_amounts;

CREATE POLICY "allow_all" ON income_source_amounts FOR ALL USING (true) WITH CHECK (true);

-- ─── GRANTs (obrigatório para tabelas criadas após Mai/2026 no Supabase) ─────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_source_amounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_source_amounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_source_amounts TO service_role;
