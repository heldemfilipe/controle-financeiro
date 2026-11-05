-- ============================================================
-- MIGRATION: Segurança
-- Execute no SQL Editor do Supabase (uma única vez), ANTES de publicar o código novo.
-- É compatível com a versão atual do app, que continua funcionando depois de rodar.
-- ============================================================

-- ─── 1. Apenas usuários logados acessam os dados ─────────────────────────────
-- Remove todas as policies destas tabelas (inclusive "allow_all", que liberava o
-- acesso pela chave pública) e cria uma única policy restrita a `authenticated`.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'income_sources', 'income_source_amounts', 'fixed_bills', 'credit_cards',
    'card_transactions', 'monthly_bill_payments', 'monthly_card_payments',
    'monthly_incomes', 'monthly_balance_overrides', 'bill_advances', 'categories'
  ] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "authenticated_all" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl
    );
  END LOOP;
END $$;

-- ─── 2. Papel de admin em app_metadata ───────────────────────────────────────
-- user_metadata pode ser alterado pelo próprio usuário; app_metadata, não.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
WHERE raw_user_meta_data->>'role' = 'admin';

-- ─── Verificações ────────────────────────────────────────────────────────────
-- Deve listar somente tabelas com roles = {authenticated}:
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Confira se todos os admins abaixo são esperados. Para rebaixar alguém:
--   UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'role' WHERE email = '...';
SELECT email, created_at, last_sign_in_at
FROM auth.users
WHERE raw_app_meta_data->>'role' = 'admin'
ORDER BY created_at;
