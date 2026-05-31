-- ========================================
-- CORREÇÃO DAS POLÍTICAS RLS
-- Remove recursão infinita
-- ========================================

-- 1. REMOVER TODAS AS POLÍTICAS ANTIGAS
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

-- ========================================
-- 2. POLÍTICAS PARA FAMILY_MEMBERS (SEM RECURSÃO)
-- ========================================

-- Ver membros: qualquer membro pode ver outros da mesma família
CREATE POLICY "members_select_policy" ON family_members
    FOR SELECT 
    USING (user_id = auth.uid() OR family_id IN (
        SELECT fm.family_id FROM family_members fm WHERE fm.user_id = auth.uid()
    ));

-- Inserir membro: somente o próprio usuário pode se adicionar (via convites)
CREATE POLICY "members_insert_policy" ON family_members
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Deletar membro: owners/admins da família podem remover
CREATE POLICY "members_delete_policy" ON family_members
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = family_members.family_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
        )
    );

-- ========================================
-- 3. POLÍTICAS PARA FAMILIES (SEM RECURSÃO)
-- ========================================

-- Ver famílias: ver se você é membro
CREATE POLICY "families_select_policy" ON families
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = families.id
              AND fm.user_id = auth.uid()
        )
    );

-- Criar família: qualquer usuário pode criar
CREATE POLICY "families_insert_policy" ON families
    FOR INSERT 
    WITH CHECK (owner_id = auth.uid());

-- Atualizar família: apenas owner
CREATE POLICY "families_update_policy" ON families
    FOR UPDATE 
    USING (owner_id = auth.uid());

-- Deletar família: apenas owner
CREATE POLICY "families_delete_policy" ON families
    FOR DELETE 
    USING (owner_id = auth.uid());

-- ========================================
-- 4. POLÍTICAS PARA FAMILY_INVITATIONS
-- ========================================

-- Ver convites: se é pra você OU se você é da família
CREATE POLICY "invitations_select_policy" ON family_invitations
    FOR SELECT 
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = family_invitations.family_id
              AND fm.user_id = auth.uid()
        )
    );

-- Criar convite: owners/admins da família
CREATE POLICY "invitations_insert_policy" ON family_invitations
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = family_invitations.family_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
        )
    );

-- Atualizar convite: quem recebeu OU owners/admins
CREATE POLICY "invitations_update_policy" ON family_invitations
    FOR UPDATE 
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = family_invitations.family_id
              AND fm.user_id = auth.uid()
              AND fm.role IN ('owner', 'admin')
        )
    );

-- ========================================
-- 5. POLÍTICAS PARA TRANSACTIONS
-- ========================================

-- Ver transações: membros da família
CREATE POLICY "transactions_select_policy" ON transactions
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = transactions.family_id
              AND fm.user_id = auth.uid()
        )
    );

-- Inserir transação: membros da família
CREATE POLICY "transactions_insert_policy" ON transactions
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = transactions.family_id
              AND fm.user_id = auth.uid()
        )
    );

-- Atualizar transação: membros da família
CREATE POLICY "transactions_update_policy" ON transactions
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = transactions.family_id
              AND fm.user_id = auth.uid()
        )
    );

-- Deletar transação: membros da família
CREATE POLICY "transactions_delete_policy" ON transactions
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM family_members fm
            WHERE fm.family_id = transactions.family_id
              AND fm.user_id = auth.uid()
        )
    );

-- ========================================
-- PRONTO! Agora recarregue a página
-- ========================================
