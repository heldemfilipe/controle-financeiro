-- ============================================================
-- MIGRATION: Adiciona coluna is_tithe em fixed_bills
-- Execute no SQL Editor do Supabase (uma única vez)
-- ============================================================

-- 1. Adiciona a coluna (safe — não faz nada se já existir)
ALTER TABLE fixed_bills ADD COLUMN IF NOT EXISTS is_tithe BOOLEAN DEFAULT false;

-- 2. Marca o Dízimo como is_tithe = true
UPDATE fixed_bills
SET is_tithe = true
WHERE LOWER(name) LIKE '%dízimo%'
   OR LOWER(name) LIKE '%dizimo%';

-- Verificação: deve retornar a linha do Dízimo com is_tithe = true
SELECT id, name, amount, is_tithe FROM fixed_bills WHERE is_tithe = true;
