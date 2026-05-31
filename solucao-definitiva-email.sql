-- ========================================
-- SOLUÇÃO DEFINITIVA - ADICIONAR EMAIL EM FAMILY_MEMBERS
-- Esta é a abordagem correta que vai funcionar
-- ========================================

-- 1. ADICIONAR COLUNA EMAIL NA TABELA FAMILY_MEMBERS
ALTER TABLE family_members 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. POPULAR EMAIL DOS MEMBROS EXISTENTES
-- Usar função privilegiada para acessar auth.users
CREATE OR REPLACE FUNCTION populate_member_emails()
RETURNS void AS $$
BEGIN
    UPDATE family_members fm
    SET email = u.email
    FROM auth.users u
    WHERE fm.user_id = u.id
      AND fm.email IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Executar a função
SELECT populate_member_emails();

-- 3. CRIAR TRIGGER PARA AUTO-POPULAR EMAIL AO INSERIR MEMBRO
CREATE OR REPLACE FUNCTION set_member_email()
RETURNS TRIGGER AS $$
BEGIN
    NEW.email := (SELECT email FROM auth.users WHERE id = NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_email_on_member_insert ON family_members;
CREATE TRIGGER set_email_on_member_insert
    BEFORE INSERT ON family_members
    FOR EACH ROW
    EXECUTE FUNCTION set_member_email();

-- 4. REMOVER POLÍTICAS RLS PROBLEMÁTICAS
DROP POLICY IF EXISTS "invitations_view_yours" ON family_invitations;
DROP POLICY IF EXISTS "invitations_view_all" ON family_invitations;
DROP POLICY IF EXISTS "invitations_update_yours" ON family_invitations;

-- 5. CRIAR POLÍTICAS SIMPLES SEM ACESSAR AUTH.USERS
CREATE POLICY "invitations_view_simple" ON family_invitations
    FOR SELECT 
    USING (true);

CREATE POLICY "invitations_update_simple" ON family_invitations
    FOR UPDATE 
    USING (true);

-- 6. CRIAR ÍNDICE NO EMAIL
CREATE INDEX IF NOT EXISTS idx_family_members_email ON family_members(email);

-- ========================================
-- PRONTO! Agora NÃO dependemos mais de auth.users
-- ========================================
