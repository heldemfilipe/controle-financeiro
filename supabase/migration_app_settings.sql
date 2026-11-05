-- ============================================================
-- MIGRATION: Configurações compartilhadas entre aparelhos
-- Execute no SQL Editor do Supabase (uma única vez), ANTES de publicar o código novo.
-- ============================================================
-- Guarda o saldo inicial e os integrantes, que antes ficavam só no navegador.
-- O primeiro aparelho que abrir o app depois da publicação envia para cá o que tinha
-- salvo. A partir daí, todos os aparelhos usam o valor do banco.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Somente usuários logados
DROP POLICY IF EXISTS "authenticated_all" ON app_settings;
CREATE POLICY "authenticated_all" ON app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verificação: deve retornar a policy com roles = {authenticated}
SELECT tablename, policyname, roles
FROM pg_policies
WHERE tablename = 'app_settings';
