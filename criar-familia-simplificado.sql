-- ========================================
-- RECRIAÇÃO SIMPLES DO SISTEMA DE FAMÍLIA
-- Execute APENAS se a verificação mostrar que as tabelas não existem
-- ========================================

-- 1. CRIAR TABELA DE FAMÍLIAS
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Minha Família',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR TABELA DE MEMBROS
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(family_id, user_id)
);

-- 3. CRIAR TABELA DE CONVITES
CREATE TABLE IF NOT EXISTS family_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 4. ADICIONAR CAMPOS NA TABELA TRANSACTIONS (se não existirem)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON family_invitations(email);
CREATE INDEX IF NOT EXISTS idx_transactions_family ON transactions(family_id);

-- 6. HABILITAR RLS
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS PARA FAMILIES
DROP POLICY IF EXISTS "Users can view their families" ON families;
CREATE POLICY "Users can view their families" ON families
    FOR SELECT USING (
        id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Owners can update their family" ON families;
CREATE POLICY "Owners can update their family" ON families
    FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create families" ON families;
CREATE POLICY "Users can create families" ON families
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- 8. POLÍTICAS PARA FAMILY_MEMBERS
DROP POLICY IF EXISTS "Users can view family members" ON family_members;
CREATE POLICY "Users can view family members" ON family_members
    FOR SELECT USING (
        family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can join families" ON family_members;
CREATE POLICY "Users can join families" ON family_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners can manage members" ON family_members;
CREATE POLICY "Owners can manage members" ON family_members
    FOR DELETE USING (
        family_id IN (
            SELECT family_id FROM family_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 9. POLÍTICAS PARA FAMILY_INVITATIONS
DROP POLICY IF EXISTS "Users can view invitations" ON family_invitations;
CREATE POLICY "Users can view invitations" ON family_invitations
    FOR SELECT USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Members can create invitations" ON family_invitations;
CREATE POLICY "Members can create invitations" ON family_invitations
    FOR INSERT WITH CHECK (
        family_id IN (
            SELECT family_id FROM family_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can update invitations" ON family_invitations;
CREATE POLICY "Users can update invitations" ON family_invitations
    FOR UPDATE USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR family_id IN (
            SELECT family_id FROM family_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- 10. ATUALIZAR POLÍTICA DE TRANSACTIONS (filtrar por family_id)
DROP POLICY IF EXISTS "Users can view family transactions" ON transactions;
CREATE POLICY "Users can view family transactions" ON transactions
    FOR SELECT USING (
        family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert family transactions" ON transactions;
CREATE POLICY "Users can insert family transactions" ON transactions
    FOR INSERT WITH CHECK (
        family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update family transactions" ON transactions;
CREATE POLICY "Users can update family transactions" ON transactions
    FOR UPDATE USING (
        family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete family transactions" ON transactions;
CREATE POLICY "Users can delete family transactions" ON transactions
    FOR DELETE USING (
        family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
    );

-- 11. MIGRAR TRANSAÇÕES EXISTENTES
-- Criar família para cada usuário que tem transações sem family_id
DO $$
DECLARE
    user_record RECORD;
    new_family_id UUID;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM transactions 
        WHERE family_id IS NULL
    LOOP
        -- Gerar UUID para a nova família
        new_family_id := gen_random_uuid();
        
        -- Criar família para o usuário
        INSERT INTO families (id, name, owner_id)
        VALUES (new_family_id, 'Minha Família', user_record.user_id);
        
        -- Adicionar usuário como owner
        INSERT INTO family_members (family_id, user_id, role)
        VALUES (new_family_id, user_record.user_id, 'owner');
        
        -- Migrar transações
        UPDATE transactions
        SET family_id = new_family_id,
            added_by = user_record.user_id
        WHERE user_id = user_record.user_id
          AND family_id IS NULL;
          
        RAISE NOTICE 'Família criada para usuário %', user_record.user_id;
    END LOOP;
END $$;

-- 12. FUNÇÃO PARA CRIAR FAMÍLIA AUTOMÁTICA (novo usuário)
CREATE OR REPLACE FUNCTION create_default_family_for_user()
RETURNS TRIGGER AS $$
DECLARE
    new_family_id UUID;
BEGIN
    -- Gerar UUID para nova família
    new_family_id := gen_random_uuid();
    
    -- Criar família
    INSERT INTO families (id, name, owner_id)
    VALUES (new_family_id, 'Minha Família', NEW.id);
    
    -- Adicionar como owner
    INSERT INTO family_members (family_id, user_id, role)
    VALUES (new_family_id, NEW.id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. TRIGGER PARA NOVOS USUÁRIOS
DROP TRIGGER IF EXISTS create_family_on_signup ON auth.users;
CREATE TRIGGER create_family_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_family_for_user();

-- ========================================
-- PRONTO! Agora faça logout e login novamente
-- ========================================
