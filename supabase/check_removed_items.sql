-- ============================================================
-- CONFERÊNCIA DE CONTAS E RECEITAS REMOVIDAS (somente leitura)
-- Execute no SQL Editor do Supabase. Esta consulta não altera nenhum dado.
-- ============================================================
-- Lista o que está com active = false e, por isso, sumiu de todos os meses,
-- inclusive dos passados. O app não guarda a data de remoção; os registros mensais
-- são a única pista de até quando cada item valeu.
--   registros        meses com pagamento ou recebimento gravado
--   primeiro/ultimo  primeiro e último mês com registro
--   soma_registrada  total desses registros, hoje fora dos saldos

WITH bill_records AS (
  SELECT
    p.bill_id AS item_id,
    COUNT(*) AS records,
    MIN(p.year * 12 + p.month - 1) AS first_index,
    MAX(p.year * 12 + p.month - 1) AS last_index,
    SUM(COALESCE(p.amount, b.amount)) AS total
  FROM monthly_bill_payments p
  JOIN fixed_bills b ON b.id = p.bill_id
  GROUP BY p.bill_id
),
income_records AS (
  SELECT
    i.source_id AS item_id,
    COUNT(*) AS records,
    MIN(i.year * 12 + i.month - 1) AS first_index,
    MAX(i.year * 12 + i.month - 1) AS last_index,
    SUM(i.amount) AS total
  FROM monthly_incomes i
  GROUP BY i.source_id
),
removed AS (
  SELECT
    'Conta' AS tipo,
    b.name AS nome,
    b.amount AS valor_padrao,
    CASE WHEN b.installment_total IS NOT NULL THEN 'Parcelada' ELSE 'Recorrente' END AS frequencia,
    b.created_at,
    r.records, r.first_index, r.last_index, r.total
  FROM fixed_bills b
  LEFT JOIN bill_records r ON r.item_id = b.id
  WHERE b.active = false

  UNION ALL

  SELECT
    'Receita',
    s.name,
    s.base_amount,
    CASE WHEN s.is_recurring = false THEN 'Avulsa' ELSE 'Recorrente' END,
    s.created_at,
    r.records, r.first_index, r.last_index, r.total
  FROM income_sources s
  LEFT JOIN income_records r ON r.item_id = s.id
  WHERE s.active = false
)
SELECT
  tipo,
  nome,
  frequencia,
  valor_padrao,
  created_at::date AS criado_em,
  COALESCE(records, 0) AS registros,
  CASE WHEN first_index IS NOT NULL
    THEN LPAD(((first_index % 12) + 1)::TEXT, 2, '0') || '/' || (first_index / 12)::TEXT
  END AS primeiro,
  CASE WHEN last_index IS NOT NULL
    THEN LPAD(((last_index % 12) + 1)::TEXT, 2, '0') || '/' || (last_index / 12)::TEXT
  END AS ultimo,
  COALESCE(total, 0) AS soma_registrada
FROM removed
ORDER BY tipo, nome;
