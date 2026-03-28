-- Migration: monthly_balance_overrides
-- Permite ajustar/zerar o saldo de um mês específico (ex: empréstimo cobriu déficit)

CREATE TABLE IF NOT EXISTS monthly_balance_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  override_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  auto_zero BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (month, year)
);

CREATE INDEX IF NOT EXISTS idx_balance_overrides_month_year
  ON monthly_balance_overrides (month, year);

ALTER TABLE monthly_balance_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON monthly_balance_overrides
  FOR ALL USING (true) WITH CHECK (true);
