-- ========================================
-- MIGRAR TRANSAÇÕES PARA A FAMÍLIA CORRETA
-- ========================================

-- 1. VERIFICAR SITUAÇÃO ATUAL
SELECT 
    'Transações SEM family_id' as tipo,
    COUNT(*) as quantidade
FROM transactions
WHERE family_id IS NULL

UNION ALL

SELECT 
    'Transações COM family_id' as tipo,
    COUNT(*) as quantidade
FROM transactions
WHERE family_id IS NOT NULL;

-- 2. VERIFICAR QUAL É O FAMILY_ID CORRETO
SELECT 
    f.id as family_id,
    f.name,
    f.owner_id,
    COUNT(fm.user_id) as total_membros,
    STRING_AGG(fm.email, ', ') as membros_emails
FROM families f
LEFT JOIN family_members fm ON fm.family_id = f.id
GROUP BY f.id, f.name, f.owner_id
ORDER BY f.created_at;

-- 3. ATUALIZAR TRANSAÇÕES DO USUÁRIO PARA SEU FAMILY_ID
-- Substitua 'SEU_USER_ID' pelo user_id do rodrigo.lara@rede.ulbra.br

-- Primeiro, vamos identificar o family_id correto:
WITH correct_family AS (
    SELECT 
        fm.family_id,
        fm.user_id as owner_user_id
    FROM family_members fm
    JOIN families f ON f.id = fm.family_id
    WHERE fm.role = 'owner'
      AND fm.email = 'rodrigo.lara@rede.ulbra.br'
    LIMIT 1
)
-- Atualizar as transações
UPDATE transactions t
SET family_id = cf.family_id,
    added_by = cf.owner_user_id
FROM correct_family cf
WHERE t.user_id = cf.owner_user_id
  AND (t.family_id IS NULL OR t.family_id != cf.family_id);

-- 4. VERIFICAR RESULTADO
SELECT 
    t.id,
    t.description,
    t.amount,
    t.family_id,
    f.name as family_name,
    t.added_by
FROM transactions t
LEFT JOIN families f ON f.id = t.family_id
ORDER BY t.date DESC
LIMIT 10;

-- ========================================
-- PRONTO! Agora ambos devem ver as transações
-- ========================================
