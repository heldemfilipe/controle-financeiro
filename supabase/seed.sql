-- ============================================================
-- SEED DATA — Dados de exemplo para começar
-- Execute APÓS o schema.sql
--
-- Personalize os valores conforme sua realidade:
--   - owner: use qualquer identificador (ex: "joao", "maria", "casal")
--   - Ajuste nomes, valores, datas de vencimento
--   - Adicione/remova cartões e contas conforme necessário
-- ============================================================

-- ─── FONTES DE RENDA ──────────────────────────────────────────────────────────
INSERT INTO income_sources (name, base_amount, due_day, owner, type) VALUES
  ('Salário Pessoa 1',       3000.00, 15, 'pessoa1', 'salary'),
  ('Salário Pessoa 2',       3000.00, 30, 'pessoa2', 'salary'),
  ('Renda Extra Casal',       500.00, 30, 'casal',   'extra')
ON CONFLICT DO NOTHING;

-- ─── CARTÕES DE CRÉDITO ───────────────────────────────────────────────────────
INSERT INTO credit_cards (name, owner, bank, due_day, color) VALUES
  ('CARTÃO BANCO 1',  'pessoa1', 'Banco 1', 10, '#6366f1'),
  ('CARTÃO BANCO 2',  'pessoa1', 'Banco 2', 15, '#820AD1'),
  ('CARTÃO BANCO 3',  'pessoa2', 'Banco 3',  5, '#10b981'),
  ('CARTÃO BANCO 4',  'casal',   'Banco 4', 20, '#f59e0b')
ON CONFLICT DO NOTHING;

-- ─── CONTAS FIXAS ─────────────────────────────────────────────────────────────

-- Essenciais — 1ª Quinzena (dias 1–15)
INSERT INTO fixed_bills (name, amount, due_day, category, period) VALUES
  ('Mercado',   600.00, 10, 'essencial', '1-15'),
  ('Farmácia',   80.00,  5, 'essencial', '1-15')
ON CONFLICT DO NOTHING;

-- Outros — 1ª Quinzena (dias 1–15)
INSERT INTO fixed_bills (name, amount, due_day, category, period) VALUES
  ('Aluguel',  1200.00,  5, 'outros', '1-15'),
  ('Condomínio', 350.00, 10, 'outros', '1-15')
ON CONFLICT DO NOTHING;

-- Essenciais — 2ª Quinzena (dias 16–30)
-- Dízimo (is_tithe=true): calculado automaticamente como 10% da renda
INSERT INTO fixed_bills (name, amount, due_day, category, period, is_tithe) VALUES
  ('Dízimo',      0.00, NULL, 'essencial', '16-30', true)
ON CONFLICT DO NOTHING;

INSERT INTO fixed_bills (name, amount, due_day, category, period) VALUES
  ('Internet',  100.00, 20, 'essencial', '16-30'),
  ('Energia',   150.00, 18, 'essencial', '16-30'),
  ('Água',       60.00, 22, 'essencial', '16-30')
ON CONFLICT DO NOTHING;

-- Outros — 2ª Quinzena (dias 16–30)
INSERT INTO fixed_bills (name, amount, due_day, category, period) VALUES
  ('Streaming',  55.00, 17, 'outros', '16-30'),
  ('Academia',   89.90, 20, 'outros', '16-30')
ON CONFLICT DO NOTHING;

-- Exemplo de conta parcelada (installment_current = parcela atual)
-- O sistema calcula automaticamente as demais parcelas a partir deste ponto
INSERT INTO fixed_bills (name, amount, due_day, category, period, installment_current, installment_total, notes) VALUES
  ('Financiamento', 800.00, 25, 'outros', '16-30', 12, 48, '12/48 parcelas')
ON CONFLICT DO NOTHING;
