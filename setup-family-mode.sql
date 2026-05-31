-- ========================================
-- MODO FAMÍLIA - SISTEMA DE COMPARTILHAMENTO
-- Permite que múltiplos usuários compartilhem o mesmo orçamento
-- ========================================

-- 1. TABELA DE FAMÍLIAS
CREATE TABLE IF NOT EXISTS families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE MEMBROS DA FAMÍLIA
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(family_id, user_id)
);

-- 3. TABELA DE CONVITES
CREATE TABLE IF NOT EXISTS family_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(family_id, email, status)
);

-- 4. ADICIONAR CAMPO family_id NAS TRANSAÇÕES
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;

-- 5. ADICIONAR CAMPO added_by PARA RASTREAR QUEM ADICIONOU
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- 6. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_families_owner ON families(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_family ON family_invitations(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON family_invitations(email);
CREATE INDEX IF NOT EXISTS idx_transactions_family ON transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_transactions_added_by ON transactions(added_by);

-- ========================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ========================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA FAMILIES
CREATE POLICY "Usuários podem ver famílias das quais são membros"
ON families FOR SELECT
USING (
    id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Usuários podem criar suas próprias famílias"
ON families FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners podem atualizar suas famílias"
ON families FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners podem deletar suas famílias"
ON families FOR DELETE
USING (owner_id = auth.uid());

-- POLÍTICAS PARA FAMILY_MEMBERS
CREATE POLICY "Membros podem ver outros membros da mesma família"
ON family_members FOR SELECT
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Owners e admins podem adicionar membros"
ON family_members FOR INSERT
WITH CHECK (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Owners e admins podem remover membros"
ON family_members FOR DELETE
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Membros podem sair da família"
ON family_members FOR DELETE
USING (user_id = auth.uid());

-- POLÍTICAS PARA FAMILY_INVITATIONS
CREATE POLICY "Membros podem ver convites da sua família"
ON family_invitations FOR SELECT
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Owners e admins podem criar convites"
ON family_invitations FOR INSERT
WITH CHECK (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

CREATE POLICY "Owners e admins podem atualizar convites"
ON family_invitations FOR UPDATE
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

-- ATUALIZAR POLÍTICA DE TRANSACTIONS
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Membros podem ver transações da família"
ON transactions FOR SELECT
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Membros podem adicionar transações na família"
ON transactions FOR INSERT
WITH CHECK (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
    AND added_by = auth.uid()
);

CREATE POLICY "Membros podem atualizar transações da família"
ON transactions FOR UPDATE
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Membros podem deletar transações da família"
ON transactions FOR DELETE
USING (
    family_id IN (
        SELECT family_id FROM family_members 
        WHERE user_id = auth.uid()
    )
);

-- ========================================
-- FUNCTIONS ÚTEIS
-- ========================================

-- Função para criar família automaticamente ao registrar
CREATE OR REPLACE FUNCTION create_default_family()
RETURNS TRIGGER AS $$
DECLARE
    new_family_id UUID;
BEGIN
    -- Criar família padrão
    INSERT INTO families (name, owner_id)
    VALUES ('Minha Família', NEW.id)
    RETURNING id INTO new_family_id;
    
    -- Adicionar usuário como owner
    INSERT INTO family_members (family_id, user_id, role)
    VALUES (new_family_id, NEW.id, 'owner');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar família ao registrar
DROP TRIGGER IF EXISTS on_auth_user_created_family ON auth.users;
CREATE TRIGGER on_auth_user_created_family
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION create_default_family();

-- Função para aceitar convite
CREATE OR REPLACE FUNCTION accept_family_invitation(invitation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    invitation_record RECORD;
    user_email TEXT;
BEGIN
    -- Pegar email do usuário atual
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    -- Buscar convite
    SELECT * INTO invitation_record 
    FROM family_invitations 
    WHERE id = invitation_id 
    AND email = user_email 
    AND status = 'pending'
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Adicionar usuário à família
    INSERT INTO family_members (family_id, user_id, role)
    VALUES (invitation_record.family_id, auth.uid(), 'member')
    ON CONFLICT (family_id, user_id) DO NOTHING;
    
    -- Atualizar status do convite
    UPDATE family_invitations 
    SET status = 'accepted' 
    WHERE id = invitation_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para migrar transações existentes para família
CREATE OR REPLACE FUNCTION migrate_user_transactions_to_family(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_family_id UUID;
BEGIN
    -- Pegar família do usuário
    SELECT family_id INTO user_family_id
    FROM family_members
    WHERE user_id = p_user_id
    AND role = 'owner'
    LIMIT 1;
    
    IF user_family_id IS NOT NULL THEN
        -- Atualizar todas as transações do usuário
        UPDATE transactions
        SET family_id = user_family_id,
            added_by = p_user_id
        WHERE user_id = p_user_id
        AND family_id IS NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- ========================================

-- Criar famílias para usuários existentes
DO $$
DECLARE
    user_record RECORD;
    new_family_id UUID;
BEGIN
    FOR user_record IN 
        SELECT id, email FROM auth.users 
        WHERE id NOT IN (SELECT user_id FROM family_members)
    LOOP
        -- Criar família
        INSERT INTO families (name, owner_id)
        VALUES ('Minha Família', user_record.id)
        RETURNING id INTO new_family_id;
        
        -- Adicionar como owner
        INSERT INTO family_members (family_id, user_id, role)
        VALUES (new_family_id, user_record.id, 'owner');
        
        -- Migrar transações
        UPDATE transactions
        SET family_id = new_family_id,
            added_by = user_record.id
        WHERE user_id = user_record.id
        AND family_id IS NULL;
    END LOOP;
END $$;

-- ========================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ========================================

COMMENT ON TABLE families IS 'Famílias/grupos que compartilham orçamento';
COMMENT ON TABLE family_members IS 'Membros de cada família';
COMMENT ON TABLE family_invitations IS 'Convites pendentes para entrar na família';
COMMENT ON COLUMN transactions.family_id IS 'Família dona desta transação';
COMMENT ON COLUMN transactions.added_by IS 'Usuário que adicionou esta transação';
COMMENT ON COLUMN family_members.role IS 'Papel do membro: owner (dono), admin (administrador), member (membro)';
