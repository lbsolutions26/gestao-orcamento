-- ========================================
-- DIAGNÓSTICO E CORREÇÃO DO PROBLEMA DA ESPOSA
-- ========================================

-- 1. Ver quais famílias cada usuário pertence
SELECT 
    fm.email,
    fm.role,
    fm.family_id,
    f.name as family_name,
    f.owner_id
FROM family_members fm
JOIN families f ON f.id = fm.family_id
ORDER BY fm.email;

-- 2. Ver se as transações têm o family_id correto
SELECT 
    COUNT(*) as total_transacoes,
    family_id
FROM transactions
GROUP BY family_id;

-- 3. CORRIGIR: Remover família pessoal da esposa se ela tiver 2
-- Vamos manter apenas a família do Rodrigo onde ela é membro
-- (Remove a família pessoal dela que foi criada automaticamente)
DELETE FROM families 
WHERE owner_id = (
    SELECT user_id FROM family_members 
    WHERE email = 'nairab.lara@gmail.com' 
    AND role = 'owner'
    LIMIT 1
)
AND id != (
    -- Manter a família onde ela é MEMBRO (família do Rodrigo)
    SELECT family_id FROM family_members
    WHERE email = 'nairab.lara@gmail.com'
    AND role = 'member'
    LIMIT 1
);

-- 4. Verificar resultado
SELECT 
    fm.email,
    fm.role,
    f.name as family_name
FROM family_members fm
JOIN families f ON f.id = fm.family_id
ORDER BY fm.email;
