-- ============================================================
-- DIAGNÓSTICO COMPLETO DA TABELA TRANSACTIONS
-- Execute TODO este bloco e me envie os resultados
-- ============================================================

-- 1️⃣ Verificar se RLS está realmente desabilitado
SELECT 
    tablename, 
    rowsecurity as rls_habilitado 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'transactions';
-- Deve mostrar: rls_habilitado = false

-- 2️⃣ Ver estrutura completa da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 3️⃣ Ver constraints (NOT NULL, UNIQUE, etc)
SELECT
    conname as constraint_name,
    contype as tipo,
    pg_get_constraintdef(oid) as definicao
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass;

-- 4️⃣ Ver triggers (que podem estar travando)
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'transactions';

-- 5️⃣ Testar INSERT direto (sem application)
INSERT INTO transactions (
    user_id,
    family_id,
    added_by,
    type,
    description,
    amount,
    category,
    date,
    due_date,
    payment_method,
    status,
    affects_balance,
    is_bill_payment
) VALUES (
    '8ac69f07-89f0-41c3-ae1d-6e401e7fbbdd'::uuid,
    'adff22a2-f99f-404e-98a2-fafe90e4238a'::uuid,
    '8ac69f07-89f0-41c3-ae1d-6e401e7fbbdd'::uuid,
    'expense',
    'TESTE DIRETO SQL',
    100.00,
    'Saúde',
    '2026-04-20',
    '2026-04-20',
    'Conta Corrente',
    'pending',
    true,
    false
);
-- Se der erro aqui, me mostre o erro exato!

-- 6️⃣ Se inseriu, deletar o teste
DELETE FROM transactions WHERE description = 'TESTE DIRETO SQL';
