-- ============================================================
-- MIGRATION — Execute no SQL Editor do Supabase
-- Receitas recorrentes com início em data futura/específica
-- (ex: "salário novo a partir de agora", "benefício a partir de agosto")
-- ============================================================

-- start_month/start_year = mês/ano a partir do qual a receita recorrente
-- passa a aparecer. NULL = sempre valeu (comportamento anterior).
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS start_month INTEGER;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS start_year  INTEGER;

-- ─── Verificação final ────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'income_sources' AND column_name IN ('start_month','start_year');
