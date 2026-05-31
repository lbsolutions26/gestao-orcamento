-- ========================================
-- CORREÇÃO DEFINITIVA - SEM RECURSÃO
-- ========================================

-- 1. DESABILITAR RLS TEMPORARIAMENTE PARA LIMPAR
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER TODAS AS POLÍTICAS
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
DROP POLICY IF EXISTS "transactions_select_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON transactions;

-- 3. REABILITAR RLS
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. POLÍTICAS SIMPLES PARA FAMILY_MEMBERS (SEM RECURSÃO)
-- ========================================

-- Permitir ver apenas seus próprios registros
CREATE POLICY "members_view_own" ON family_members
    FOR SELECT 
    USING (user_id = auth.uid());

-- Permitir inserir apenas para si mesmo
CREATE POLICY "members_insert_own" ON family_members
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- ========================================
-- 5. POLÍTICAS PARA FAMILIES (SEM RECURSÃO)
-- ========================================

-- Ver famílias onde você é owner
CREATE POLICY "families_view_own" ON families
    FOR SELECT 
    USING (owner_id = auth.uid());

-- Criar família
CREATE POLICY "families_insert_own" ON families
    FOR INSERT 
    WITH CHECK (owner_id = auth.uid());

-- Atualizar apenas sua família
CREATE POLICY "families_update_own" ON families
    FOR UPDATE 
    USING (owner_id = auth.uid());

-- ========================================
-- 6. POLÍTICAS PARA INVITATIONS (SEM RECURSÃO)
-- ========================================

-- Ver convites enviados pra você
CREATE POLICY "invitations_view_yours" ON family_invitations
    FOR SELECT 
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Owners podem criar convites (checagem simples)
CREATE POLICY "invitations_insert_as_owner" ON family_invitations
    FOR INSERT 
    WITH CHECK (invited_by = auth.uid());

-- Atualizar convites (aceitar)
CREATE POLICY "invitations_update_yours" ON family_invitations
    FOR UPDATE 
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR invited_by = auth.uid());

-- ========================================
-- 7. POLÍTICAS PARA TRANSACTIONS (SEM RECURSÃO)
-- ========================================

-- Ver suas próprias transações (por enquanto, vamos simplificar)
CREATE POLICY "transactions_view_own" ON transactions
    FOR SELECT 
    USING (user_id = auth.uid());

-- Inserir transações
CREATE POLICY "transactions_insert_own" ON transactions
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Atualizar transações
CREATE POLICY "transactions_update_own" ON transactions
    FOR UPDATE 
    USING (user_id = auth.uid());

-- Deletar transações
CREATE POLICY "transactions_delete_own" ON transactions
    FOR DELETE 
    USING (user_id = auth.uid());

-- ========================================
-- PRONTO! Agora você deve ver suas transações novamente
-- ========================================
