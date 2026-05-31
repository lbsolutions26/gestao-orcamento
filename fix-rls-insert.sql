-- Corrigir políticas RLS para permitir INSERT em transactions
-- Execute este SQL no Supabase se o INSERT estiver travando

-- 1. Ver políticas atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'transactions';

-- 2. Remover política antiga de INSERT se existir
DROP POLICY IF EXISTS "Usuários podem criar transações" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON transactions;

-- 3. Criar nova política de INSERT mais permissiva
CREATE POLICY "Usuários autenticados podem inserir transações"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id 
    OR 
    family_id IN (
        SELECT family_id 
        FROM family_members 
        WHERE user_id = auth.uid()
    )
);

-- 4. Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'transactions';

-- Se RLS não estiver habilitado, habilitar:
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 5. Ver todas as políticas novamente para confirmar
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'transactions'
ORDER BY cmd, policyname;
