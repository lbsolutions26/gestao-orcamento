-- ============================================
-- TABELAS DE CADASTROS (cadastros base)
-- Execute uma vez no SQL Editor do Supabase
-- ============================================

-- 1) Fornecedores e Clientes (mesma tabela, diferenciados por kind)
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('supplier','client')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (family_id, kind, lower(name))
);

-- 2) Categorias / grupos de despesa e receita
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income','expense')),
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (family_id, type, lower(name))
);

-- 3) Formas de pagamento (cartão, pix, dinheiro, etc)
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,           -- card / cash / pix / transfer / boleto / debit
    affects_balance BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (family_id, lower(name))
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "contacts_family_all" ON public.contacts;
    DROP POLICY IF EXISTS "categories_family_all" ON public.categories;
    DROP POLICY IF EXISTS "payment_methods_family_all" ON public.payment_methods;
END $$;

CREATE POLICY "contacts_family_all" ON public.contacts
    FOR ALL USING (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    ) WITH CHECK (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    );

CREATE POLICY "categories_family_all" ON public.categories
    FOR ALL USING (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    ) WITH CHECK (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    );

CREATE POLICY "payment_methods_family_all" ON public.payment_methods
    FOR ALL USING (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    ) WITH CHECK (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    );

-- ============================================
-- SEED: deriva dos dados existentes em transactions
-- (executa para cada family do usuário)
-- ============================================

-- Fornecedores (de despesas que tenham supplier preenchido)
INSERT INTO public.contacts (family_id, name, kind)
SELECT DISTINCT family_id, TRIM(supplier), 'supplier'
FROM public.transactions
WHERE supplier IS NOT NULL
  AND TRIM(supplier) <> ''
  AND type = 'expense'
ON CONFLICT (family_id, kind, lower(name)) DO NOTHING;

-- Clientes (de receitas com supplier preenchido)
INSERT INTO public.contacts (family_id, name, kind)
SELECT DISTINCT family_id, TRIM(supplier), 'client'
FROM public.transactions
WHERE supplier IS NOT NULL
  AND TRIM(supplier) <> ''
  AND type = 'income'
ON CONFLICT (family_id, kind, lower(name)) DO NOTHING;

-- Categorias
INSERT INTO public.categories (family_id, name, type)
SELECT DISTINCT family_id, TRIM(category), type
FROM public.transactions
WHERE category IS NOT NULL
  AND TRIM(category) <> ''
ON CONFLICT (family_id, type, lower(name)) DO NOTHING;

-- Formas de pagamento
INSERT INTO public.payment_methods (family_id, name)
SELECT DISTINCT family_id, TRIM(payment_method)
FROM public.transactions
WHERE payment_method IS NOT NULL
  AND TRIM(payment_method) <> ''
ON CONFLICT (family_id, lower(name)) DO NOTHING;

-- Pronto! Verifique:
-- SELECT 'contacts' tabela, count(*) FROM public.contacts UNION ALL
-- SELECT 'categories', count(*) FROM public.categories UNION ALL
-- SELECT 'payment_methods', count(*) FROM public.payment_methods;
