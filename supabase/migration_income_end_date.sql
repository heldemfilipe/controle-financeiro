-- ============================================================
-- MIGRATION — Execute no SQL Editor do Supabase
-- Receitas recorrentes com data de término
-- (ex: "fui demitido, o salário zera a partir de março")
-- ============================================================

-- stop_month/stop_year = primeiro mês/ano SEM a receita. A partir dele a
-- fonte deixa de aparecer. NULL = nunca termina (comportamento anterior).
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS stop_month INTEGER;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS stop_year  INTEGER;

-- ─── Verificação final ────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'income_sources' AND column_name IN ('stop_month','stop_year');
