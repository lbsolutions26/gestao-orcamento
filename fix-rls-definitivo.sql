-- ============================================================
-- CORREÇÃO DEFINITIVA DAS POLÍTICAS RLS
-- Problema: as políticas antigas tinham recursão infinita:
-- transactions → family_members → family_members (loop)
-- Solução: usar função SECURITY DEFINER que bypassa RLS
-- ============================================================

-- PASSO 1: Criar função que retorna os family_ids do usuário logado
-- SECURITY DEFINER = roda como dono da função (sem RLS), quebrando a recursão
CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS TABLE(family_id UUID) AS $$
    SELECT family_id FROM family_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Garantir que todos os usuários autenticados podem chamar a função
GRANT EXECUTE ON FUNCTION public.get_my_family_ids() TO authenticated;

-- ============================================================
-- PASSO 2: Remover TODAS as políticas antigas
-- ============================================================
DROP POLICY IF EXISTS "transactions_select_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON transactions;

DROP POLICY IF EXISTS "members_select_policy" ON family_members;
DROP POLICY IF EXISTS "members_insert_policy" ON family_members;
DROP POLICY IF EXISTS "members_delete_policy" ON family_members;

DROP POLICY IF EXISTS "families_select_policy" ON families;
DROP POLICY IF EXISTS "families_insert_policy" ON families;
DROP POLICY IF EXISTS "families_update_policy" ON families;
DROP POLICY IF EXISTS "families_delete_policy" ON families;

DROP POLICY IF EXISTS "invitations_select_policy" ON family_invitations;
DROP POLICY IF EXISTS "invitations_insert_policy" ON family_invitations;
DROP POLICY IF EXISTS "invitations_update_policy" ON family_invitations;

-- Remover também políticas com nomes antigos (se existirem)
DROP POLICY IF EXISTS "Users can view their families" ON families;
DROP POLICY IF EXISTS "Owners can update their family" ON families;
DROP POLICY IF EXISTS "Users can create families" ON families;
DROP POLICY IF EXISTS "Users can view family members" ON family_members;
DROP POLICY IF EXISTS "Users can join families" ON family_members;
DROP POLICY IF EXISTS "Owners can manage members" ON family_members;
DROP POLICY IF EXISTS "Users can view invitations" ON family_invitations;
DROP POLICY IF EXISTS "Members can create invitations" ON family_invitations;
DROP POLICY IF EXISTS "Users can update invitations" ON family_invitations;
DROP POLICY IF EXISTS "Users can view family transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert family transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update family transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete family transactions" ON transactions;

-- ============================================================
-- PASSO 3: Recriar políticas SEM recursão (usando a função)
-- ============================================================

-- TRANSACTIONS: qualquer membro da família pode ver/editar
CREATE POLICY "tx_select" ON transactions FOR SELECT
    USING (family_id IN (SELECT family_id FROM public.get_my_family_ids()));

CREATE POLICY "tx_insert" ON transactions FOR INSERT
    WITH CHECK (family_id IN (SELECT family_id FROM public.get_my_family_ids()));

CREATE POLICY "tx_update" ON transactions FOR UPDATE
    USING (family_id IN (SELECT family_id FROM public.get_my_family_ids()));

CREATE POLICY "tx_delete" ON transactions FOR DELETE
    USING (family_id IN (SELECT family_id FROM public.get_my_family_ids()));

-- FAMILY_MEMBERS: ver seus próprios registros ou da mesma família
CREATE POLICY "fm_select" ON family_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR family_id IN (SELECT family_id FROM public.get_my_family_ids())
    );

CREATE POLICY "fm_insert" ON family_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "fm_delete" ON family_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.get_my_family_ids() gf
            WHERE gf.family_id = family_members.family_id
        )
        AND EXISTS (
            SELECT 1 FROM family_members fm2
            WHERE fm2.family_id = family_members.family_id
              AND fm2.user_id = auth.uid()
              AND fm2.role IN ('owner', 'admin')
        )
    );

-- FAMILIES: ver famílias das quais é membro
CREATE POLICY "fam_select" ON families FOR SELECT
    USING (id IN (SELECT family_id FROM public.get_my_family_ids()));

CREATE POLICY "fam_insert" ON families FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "fam_update" ON families FOR UPDATE
    USING (owner_id = auth.uid());

CREATE POLICY "fam_delete" ON families FOR DELETE
    USING (owner_id = auth.uid());

-- FAMILY_INVITATIONS
CREATE POLICY "inv_select" ON family_invitations FOR SELECT
    USING (
        email = auth.email()
        OR family_id IN (SELECT family_id FROM public.get_my_family_ids())
    );

CREATE POLICY "inv_insert" ON family_invitations FOR INSERT
    WITH CHECK (family_id IN (SELECT family_id FROM public.get_my_family_ids()));

CREATE POLICY "inv_update" ON family_invitations FOR UPDATE
    USING (
        email = auth.email()
        OR family_id IN (SELECT family_id FROM public.get_my_family_ids())
    );

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT 
    schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('transactions', 'family_members', 'families', 'family_invitations')
ORDER BY tablename, cmd;
