-- ============================================================
-- MIGRATION: Contas com data de encerramento
-- Execute no SQL Editor do Supabase (uma única vez), ANTES de publicar o código novo.
-- É compatível com a versão atual do app, que apenas ignora as colunas novas.
-- ============================================================
-- stop_month/stop_year = primeiro mês/ano SEM a conta, como em income_sources.
-- Os meses anteriores continuam no saldo. NULL = nunca termina.

ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS stop_month INTEGER;
ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS stop_year  INTEGER;

-- Verificação: deve listar as duas colunas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'fixed_bills'
  AND column_name IN ('stop_month', 'stop_year');
