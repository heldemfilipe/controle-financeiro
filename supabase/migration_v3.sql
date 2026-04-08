-- ============================================================
-- MIGRATION v3 — Adiantamento de parcelas/contas
-- Execute após schema.sql e migration_v2.sql
-- ============================================================

-- ─── BILL ADVANCES (Adiantamentos de Contas/Parcelas) ─────────────────────────
-- Registra pagamentos antecipados de contas fixas.
-- paid_month/paid_year = mês em que o adiantamento foi feito
-- target_month/target_year = mês da parcela sendo adiantada
CREATE TABLE IF NOT EXISTS bill_advances (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id      UUID REFERENCES fixed_bills(id) ON DELETE CASCADE,
  target_month INTEGER NOT NULL,
  target_year  INTEGER NOT NULL,
  paid_month   INTEGER NOT NULL,
  paid_year    INTEGER NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  -- Uma conta só pode ser adiantada uma vez por mês alvo
  UNIQUE (bill_id, target_month, target_year)
);

-- Índices para queries por mês
CREATE INDEX IF NOT EXISTS idx_bill_advances_paid   ON bill_advances(paid_month, paid_year);
CREATE INDEX IF NOT EXISTS idx_bill_advances_target ON bill_advances(target_month, target_year);

-- RLS
ALTER TABLE bill_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON bill_advances FOR ALL USING (true) WITH CHECK (true);
