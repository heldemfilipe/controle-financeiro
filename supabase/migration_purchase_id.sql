-- ============================================================
-- MIGRATION: Identificador de compra nas parcelas
-- Rode antes check_purchase_groups.sql e confira o resultado.
-- Execute no SQL Editor do Supabase (uma única vez), ANTES de publicar o código novo.
-- É compatível com a versão atual do app, que apenas ignora a coluna nova.
-- ============================================================

ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS purchase_id UUID;

CREATE INDEX IF NOT EXISTS idx_card_transactions_purchase_id
  ON card_transactions(purchase_id);

-- Liga as parcelas existentes à sua compra. Só preenche o que ainda está vazio,
-- portanto rodar de novo não altera as compras já ligadas.
WITH parcels AS (
  SELECT
    t.id,
    t.card_id,
    LOWER(TRIM(t.description)) AS description_key,
    t.installment_total,
    t.year * 12 + (t.month - 1) - (t.installment_current - 1) AS start_index,
    ROW_NUMBER() OVER (
      PARTITION BY
        t.card_id,
        LOWER(TRIM(t.description)),
        t.installment_total,
        t.year * 12 + (t.month - 1) - (t.installment_current - 1),
        t.installment_current
      -- Parcelas lançadas juntas têm o mesmo created_at, mesmo se o valor foi editado
      ORDER BY t.created_at, t.amount, t.id
    ) AS copy
  FROM card_transactions t
  WHERE t.installment_total > 1
    AND t.purchase_id IS NULL
),
purchases AS (
  SELECT
    g.card_id, g.description_key, g.installment_total, g.start_index, g.copy,
    gen_random_uuid() AS purchase_id
  FROM (
    SELECT DISTINCT card_id, description_key, installment_total, start_index, copy
    FROM parcels
  ) g
)
UPDATE card_transactions t
SET purchase_id = pu.purchase_id
FROM parcels pa
JOIN purchases pu
  ON  pu.card_id           = pa.card_id
  AND pu.description_key   = pa.description_key
  AND pu.installment_total = pa.installment_total
  AND pu.start_index       = pa.start_index
  AND pu.copy              = pa.copy
WHERE t.id = pa.id;

-- Verificação: deve retornar 0
SELECT COUNT(*) AS parcelas_sem_compra
FROM card_transactions
WHERE installment_total > 1
  AND purchase_id IS NULL;
