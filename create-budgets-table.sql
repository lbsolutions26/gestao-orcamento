-- ============================================
-- Tabela de orçamentos (budgets) por categoria
-- Execute no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.category_budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID NOT NULL,
    category    TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    budget_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    month       INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year        INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(family_id, category, type, month, year)
);

CREATE INDEX IF NOT EXISTS category_budgets_family_idx
    ON public.category_budgets (family_id, year, month);

-- RLS: apenas membros da família podem ver/editar budgets
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários podem ver budgets da própria família" ON public.category_budgets;
DROP POLICY IF EXISTS "Usuários podem criar budgets da própria família" ON public.category_budgets;
DROP POLICY IF EXISTS "Usuários podem atualizar budgets da própria família" ON public.category_budgets;
DROP POLICY IF EXISTS "Usuários podem deletar budgets da própria família" ON public.category_budgets;

-- Cria políticas
CREATE POLICY "Usuários podem ver budgets da própria família"
ON public.category_budgets FOR SELECT
USING (
    family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem criar budgets da própria família"
ON public.category_budgets FOR INSERT
WITH CHECK (
    family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem atualizar budgets da própria família"
ON public.category_budgets FOR UPDATE
USING (
    family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem deletar budgets da própria família"
ON public.category_budgets FOR DELETE
USING (
    family_id IN (
        SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
);

COMMENT ON TABLE public.category_budgets IS 'Orçamentos/metas mensais por categoria para controle de gastos';
