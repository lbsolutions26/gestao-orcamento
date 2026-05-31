-- ========================================
-- RESET COMPLETO - TORNAR TUDO PÚBLICO TEMPORARIAMENTE
-- Para fazer funcionar primeiro, depois ajustamos segurança
-- ========================================

-- 1. DESABILITAR RLS COMPLETAMENTE (temporário)
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations DISABLE ROW LEVEL SECURITY;

-- 2. GARANTIR QUE EMAIL ESTÁ POPULADO
UPDATE family_members fm
SET email = u.email
FROM auth.users u
WHERE fm.user_id = u.id;

-- 3. VERIFICAR SE HÁ DADOS
SELECT 
    fm.user_id,
    fm.email,
    fm.role,
    f.name as family_name
FROM family_members fm
JOIN families f ON f.id = fm.family_id
LIMIT 5;

-- ========================================
-- AGORA TESTE! Deve funcionar sem RLS
-- ========================================
