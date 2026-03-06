-- ============================================================
-- CONTROLE FINANCEIRO — Schema Supabase
-- Execute este arquivo ANTES do seed.sql
-- ============================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── INCOME SOURCES (Fontes de Renda) ────────────────────────────────────────
-- owner: valor livre (ex: "pessoa1", "pessoa2", "casal"). Personalize conforme sua família.
CREATE TABLE IF NOT EXISTS income_sources (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name         TEXT NOT NULL,
  base_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  due_day      INTEGER,
  owner        TEXT NOT NULL DEFAULT 'casal',
  type         TEXT NOT NULL DEFAULT 'salary' CHECK (type IN ('salary', 'extra', 'other')),
  is_recurring BOOLEAN DEFAULT true,
  one_time_month INTEGER,
  one_time_year  INTEGER,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FIXED BILLS (Contas Fixas) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_bills (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name                    TEXT NOT NULL,
  amount                  DECIMAL(10,2) NOT NULL DEFAULT 0,
  due_day                 INTEGER,
  category                TEXT NOT NULL DEFAULT 'outros',
  period                  TEXT CHECK (period IN ('1-15', '16-30')),
  installment_current     INTEGER,
  installment_total       INTEGER,
  installment_start_month INTEGER,
  installment_start_year  INTEGER,
  notes                   TEXT,
  is_tithe                BOOLEAN DEFAULT false,
  active                  BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CREDIT CARDS (Cartões de Crédito) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_cards (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       TEXT NOT NULL,
  owner      TEXT NOT NULL DEFAULT 'casal',
  bank       TEXT NOT NULL,
  due_day    INTEGER NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CARD TRANSACTIONS (Lançamentos no Cartão) ───────────────────────────────
CREATE TABLE IF NOT EXISTS card_transactions (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id             UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  amount              DECIMAL(10,2) NOT NULL,
  transaction_date    DATE,
  installment_current INTEGER DEFAULT 1,
  installment_total   INTEGER DEFAULT 1,
  month               INTEGER NOT NULL,
  year                INTEGER NOT NULL,
  category            TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MONTHLY BILL PAYMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_bill_payments (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bill_id    UUID REFERENCES fixed_bills(id) ON DELETE CASCADE,
  month      INTEGER NOT NULL,
  year       INTEGER NOT NULL,
  paid       BOOLEAN DEFAULT false,
  paid_date  DATE,
  amount     DECIMAL(10,2),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bill_id, month, year)
);

-- ─── MONTHLY CARD PAYMENTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_card_payments (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id      UUID REFERENCES credit_cards(id) ON DELETE CASCADE,
  month        INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  paid         BOOLEAN DEFAULT false,
  paid_date    DATE,
  total_amount DECIMAL(10,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (card_id, month, year)
);

-- ─── MONTHLY INCOMES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_incomes (
  id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_id      UUID REFERENCES income_sources(id) ON DELETE CASCADE,
  month          INTEGER NOT NULL,
  year           INTEGER NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  received       BOOLEAN DEFAULT false,
  received_date  DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_id, month, year)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_card_transactions_month_year ON card_transactions(month, year);
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id    ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_monthly_bill_payments_month  ON monthly_bill_payments(month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_card_payments_month  ON monthly_card_payments(month, year);
CREATE INDEX IF NOT EXISTS idx_monthly_incomes_month        ON monthly_incomes(month, year);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- App pessoal sem autenticação: RLS habilitado com acesso total via anon key.
-- Para multi-usuário, substitua as policies por `auth.uid() = user_id`.
ALTER TABLE income_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_bills           ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_card_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_incomes       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON income_sources        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON fixed_bills           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON credit_cards          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON card_transactions     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON monthly_bill_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON monthly_card_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON monthly_incomes       FOR ALL USING (true) WITH CHECK (true);
