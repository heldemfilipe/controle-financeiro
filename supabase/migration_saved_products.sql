-- ============================================================
-- MIGRATION: Produtos salvos (edição do histórico do autocomplete)
-- Execute no SQL Editor do Supabase (uma única vez)
-- ============================================================
-- Os produtos continuam nascendo dos lançamentos de cartão. Esta tabela guarda
-- apenas o que o usuário alterou: nome, categoria e valor sugeridos, ou se o
-- produto foi ocultado das sugestões.

CREATE TABLE IF NOT EXISTS saved_products (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,            -- nome em minúsculas e sem acentos
  name       TEXT NOT NULL,
  category   TEXT,                            -- NULL = usa a categoria do histórico
  amount     DECIMAL(10,2),                   -- NULL = usa o valor típico do histórico
  hidden     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;

-- Somente usuários logados
DROP POLICY IF EXISTS "authenticated_all" ON saved_products;
CREATE POLICY "authenticated_all" ON saved_products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
