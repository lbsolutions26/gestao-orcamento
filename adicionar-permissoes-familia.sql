-- ========================================
-- ADICIONAR PERMISSÕES PARA TELA DE FAMÍLIA
-- Execute no Supabase SQL Editor
-- ========================================

-- 1. Permitir ver TODOS os membros (vamos filtrar no app)
DROP POLICY IF EXISTS "members_view_all" ON family_members;
CREATE POLICY "members_view_all" ON family_members
    FOR SELECT 
    USING (true);

-- 2. Permitir ver TODOS os convites relacionados a você
DROP POLICY IF EXISTS "invitations_view_all" ON family_invitations;
CREATE POLICY "invitations_view_all" ON family_invitations
    FOR SELECT 
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR invited_by = auth.uid()
    );

-- 3. Permitir ver TODAS as famílias (vamos filtrar no app)
DROP POLICY IF EXISTS "families_view_all" ON families;
CREATE POLICY "families_view_all" ON families
    FOR SELECT 
    USING (true);

-- 4. Permitir criar convites se você é owner de alguma família
DROP POLICY IF EXISTS "invitations_owners_create" ON family_invitations;
CREATE POLICY "invitations_owners_create" ON family_invitations
    FOR INSERT 
    WITH CHECK (
        invited_by = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM families 
            WHERE families.id = family_invitations.family_id 
            AND families.owner_id = auth.uid()
        )
    );

-- 5. Permitir deletar membros (vamos validar no app)
DROP POLICY IF EXISTS "members_delete_any" ON family_members;
CREATE POLICY "members_delete_any" ON family_members
    FOR DELETE 
    USING (true);

-- ========================================
-- PRONTO! Agora recarregue a página
-- ========================================
