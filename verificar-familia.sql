-- ========================================
-- VERIFICAÇÃO DO SISTEMA DE FAMÍLIA
-- Execute este script para diagnosticar problemas
-- ========================================

-- 1. VERIFICAR SE AS TABELAS EXISTEM
SELECT 
    tablename,
    CASE 
        WHEN tablename IN ('families', 'family_members', 'family_invitations') THEN '✅ Existe'
        ELSE '❌ Não encontrada'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members', 'family_invitations');

-- 2. VERIFICAR SE RLS ESTÁ HABILITADO
SELECT 
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members', 'family_invitations', 'transactions');

-- 3. CONTAR POLÍTICAS RLS POR TABELA
SELECT 
    schemaname,
    tablename,
    COUNT(*) as total_politicas
FROM pg_policies
WHERE tablename IN ('families', 'family_members', 'family_invitations', 'transactions')
GROUP BY schemaname, tablename;

-- 4. VERIFICAR ESTRUTURA DA TABELA TRANSACTIONS
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
  AND column_name IN ('family_id', 'added_by')
ORDER BY ordinal_position;

-- 5. VERIFICAR SE O TRIGGER DE CRIAÇÃO AUTOMÁTICA EXISTE
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name LIKE '%family%';
