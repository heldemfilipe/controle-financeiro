-- ============================================================
-- MIGRATION v2 — Execute no SQL Editor do Supabase
-- 1. Parcelas dinâmicas em fixed_bills
-- 2. Categorias customizadas
-- 3. Receitas avulsas (não recorrentes)
-- ============================================================

-- ─── 1. Parcelas dinâmicas ────────────────────────────────────────────────────
-- Guarda quando a 1ª parcela ocorreu, permitindo cálculo automático por mês

ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS installment_start_month INTEGER;
ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS installment_start_year  INTEGER;

-- Migra dados existentes: calcula o mês de início baseado no mês de referência
-- AJUSTE: altere 3 e 2026 para o mês/ano atual quando executar esta migration
DO $$
DECLARE
  ref_month INTEGER := 3;   -- mês de referência (ex: março)
  ref_year  INTEGER := 2026; -- ano de referência
  ref_total INTEGER;
BEGIN
  ref_total := ref_year * 12 + ref_month - 1; -- total de meses desde o ano 0

  UPDATE fixed_bills
  SET
    installment_start_month = (ref_total - (installment_current - 1)) % 12 + 1,
    installment_start_year  = (ref_total - (installment_current - 1)) / 12
  WHERE installment_current IS NOT NULL
    AND installment_total   IS NOT NULL
    AND installment_start_month IS NULL; -- evita reprocessar
END $$;

-- ─── 2. Categorias customizadas ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Pré-popula com categorias padrão
INSERT INTO categories (name, color) VALUES
  ('essencial', '#6366f1'),
  ('outros',    '#f59e0b')
ON CONFLICT (name) DO NOTHING;

-- Remove a constraint de CHECK para aceitar categorias customizadas
ALTER TABLE fixed_bills DROP CONSTRAINT IF EXISTS fixed_bills_category_check;

-- ─── 3. Receitas avulsas (não recorrentes) ────────────────────────────────────
-- is_recurring = false → aparece só no mês/ano especificado

ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS is_recurring    BOOLEAN DEFAULT true;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS one_time_month  INTEGER;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS one_time_year   INTEGER;

-- ─── Verificação final ────────────────────────────────────────────────────────
SELECT 'fixed_bills' AS tabela, column_name FROM information_schema.columns
WHERE table_name = 'fixed_bills' AND column_name IN ('installment_start_month','installment_start_year')
UNION ALL
SELECT 'income_sources', column_name FROM information_schema.columns
WHERE table_name = 'income_sources' AND column_name IN ('is_recurring','one_time_month','one_time_year')
UNION ALL
SELECT 'categories', name FROM categories;
