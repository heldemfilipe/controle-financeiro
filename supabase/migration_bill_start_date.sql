-- ============================================================
-- MIGRATION: Contas com data de início
-- Execute no SQL Editor do Supabase (uma única vez), ANTES de publicar o código novo.
-- É compatível com a versão atual do app, que apenas ignora as colunas novas.
-- ============================================================
-- start_month/start_year = primeiro mês/ano COM a conta, como em income_sources.
-- NULL = vale em todos os meses, então as contas existentes e os saldos não mudam.
-- Em contas parceladas o início continua vindo de installment_start_month/year.

ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS start_month INTEGER;
ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS start_year  INTEGER;

-- Verificação: deve listar as duas colunas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'fixed_bills'
  AND column_name IN ('start_month', 'start_year');
