-- ============================================
-- Adicionar campo de fornecedor aos orçamentos
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar coluna supplier
ALTER TABLE category_budgets 
ADD COLUMN IF NOT EXISTS supplier TEXT;

-- 2. Remover constraint UNIQUE antigo
ALTER TABLE category_budgets 
DROP CONSTRAINT IF EXISTS category_budgets_family_id_category_type_month_year_key;

-- 3. Criar novo constraint UNIQUE incluindo supplier
ALTER TABLE category_budgets 
ADD CONSTRAINT category_budgets_family_id_category_type_month_year_supplier_key 
UNIQUE(family_id, category, type, month, year, supplier);

COMMENT ON COLUMN category_budgets.supplier IS 'Fornecedor/Cliente específico para diferenciar orçamentos na mesma categoria';
