-- ============================================================
-- CONFERÊNCIA ANTES DA migration_purchase_id.sql (somente leitura)
-- Execute no SQL Editor do Supabase. Esta consulta não altera nenhum dado.
-- ============================================================
-- Cada parcela é ligada à compra por cartão + descrição + total de parcelas + mês
-- em que a parcela 1 cairia. Compras iguais em meses diferentes já ficam separadas.
-- Aqui aparecem apenas os casos que essa regra não garante:
--   * "Compras iguais com valores alterados": duas compras iguais no mesmo mês, com
--     valores diferentes e parcelas criadas em momentos distintos; as parcelas podem
--     trocar de compra. Parcelas criadas juntas têm o mesmo created_at e não entram aqui.
--   * "Falta parcela no meio": a sequência tem um buraco, então uma parcela pode ter
--     sido apagada ou movida para outro mês.
-- Nenhuma linha no resultado significa que todas as compras foram separadas com segurança.

WITH parcels AS (
  SELECT
    t.*,
    LOWER(TRIM(t.description)) AS description_key,
    t.year * 12 + (t.month - 1) - (t.installment_current - 1) AS start_index
  FROM card_transactions t
  WHERE t.installment_total > 1
),
numbered AS (
  SELECT
    p.*,
    ROW_NUMBER() OVER (
      PARTITION BY p.card_id, p.description_key, p.installment_total, p.start_index, p.installment_current
      ORDER BY p.created_at, p.amount, p.id
    ) AS copy
  FROM parcels p
),
purchases AS (
  SELECT
    n.card_id, n.description_key, n.installment_total, n.start_index, n.copy,
    MIN(n.description) AS description,
    COUNT(*) AS parcel_count,
    MIN(n.installment_current) AS first_parcel,
    MAX(n.installment_current) AS last_parcel,
    COUNT(DISTINCT n.amount) AS distinct_amounts,
    COUNT(DISTINCT n.created_at) AS distinct_batches,
    STRING_AGG(DISTINCT ABS(n.amount)::TEXT, ' / ') AS amounts
  FROM numbered n
  GROUP BY n.card_id, n.description_key, n.installment_total, n.start_index, n.copy
),
flagged AS (
  SELECT
    p.*,
    MAX(p.copy) OVER (
      PARTITION BY p.card_id, p.description_key, p.installment_total, p.start_index
    ) AS copies
  FROM purchases p
)
SELECT
  CASE
    WHEN f.copies > 1 AND f.distinct_amounts > 1 AND f.distinct_batches > 1
      THEN 'Compras iguais com valores alterados'
    ELSE 'Falta parcela no meio'
  END AS motivo,
  c.name AS cartao,
  f.description AS descricao,
  f.installment_total AS total_parcelas,
  LPAD(((f.start_index % 12) + 1)::TEXT, 2, '0') || '/' || (f.start_index / 12)::TEXT AS mes_da_parcela_1,
  f.parcel_count AS parcelas_encontradas,
  f.first_parcel || ' a ' || f.last_parcel AS intervalo,
  f.amounts AS valores
FROM flagged f
LEFT JOIN credit_cards c ON c.id = f.card_id
WHERE (f.copies > 1 AND f.distinct_amounts > 1 AND f.distinct_batches > 1)
   OR f.parcel_count < f.last_parcel - f.first_parcel + 1
ORDER BY motivo, cartao, descricao, f.start_index, f.copy;
