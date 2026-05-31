-- Adicionar campo de anexo (boleto/fatura) às transações
-- Execute este comando no SQL Editor do Supabase

-- 1. Adicionar coluna attachment_url
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Criar bucket de storage para anexos (se não existir)
-- Execute no SQL Editor ou crie manualmente no Storage do Supabase:
-- Nome do bucket: transaction-attachments
-- Public: true (para permitir visualização dos anexos)

-- 3. Criar política de acesso ao storage
-- Isso permite que usuários autenticados façam upload
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Política para permitir upload (INSERT)
CREATE POLICY "Usuários podem fazer upload de anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-attachments');

-- 5. Política para permitir leitura (SELECT)
CREATE POLICY "Anexos são públicos para visualização"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transaction-attachments');

-- 6. Política para permitir atualização (UPDATE)
CREATE POLICY "Usuários podem atualizar seus anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transaction-attachments');

-- 7. Política para permitir exclusão (DELETE)
CREATE POLICY "Usuários podem deletar anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-attachments');

-- Comentários:
COMMENT ON COLUMN transactions.attachment_url IS 'URL do anexo (boleto, fatura, comprovante) armazenado no Supabase Storage';
