# 📎 Sistema de Anexos - Configuração

## Funcionalidade Implementada

Agora você pode anexar **boletos, faturas e comprovantes** (PDF ou imagem) nas transações!

## ⚙️ Configuração Necessária no Supabase

### 1️⃣ Executar Script SQL

Acesse o **SQL Editor** do Supabase e execute o arquivo `add-attachment-field.sql`:

```sql
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;
```

### 2️⃣ Criar Bucket de Storage

**Opção A - Manual (Recomendado):**

1. Acesse o painel do Supabase
2. Vá em **Storage** no menu lateral
3. Clique em **"New bucket"**
4. Configure assim:
   - **Name:** `transaction-attachments`
   - **Public:** ✅ **SIM** (marcar como público)
   - **File size limit:** 5 MB
   - **Allowed MIME types:** `application/pdf,image/jpeg,image/jpg,image/png,image/webp`

**Opção B - Via SQL:**

Execute no SQL Editor:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-attachments', 'transaction-attachments', true)
ON CONFLICT (id) DO NOTHING;
```

### 3️⃣ Configurar Políticas de Acesso (RLS)

Execute no SQL Editor:

```sql
-- Permitir upload
CREATE POLICY "Usuários podem fazer upload de anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'transaction-attachments');

-- Permitir visualização pública
CREATE POLICY "Anexos são públicos para visualização"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'transaction-attachments');

-- Permitir atualização
CREATE POLICY "Usuários podem atualizar seus anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'transaction-attachments');

-- Permitir exclusão
CREATE POLICY "Usuários podem deletar anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'transaction-attachments');
```

## 📱 Como Usar

### Adicionar Anexo

1. Ao criar/editar uma transação
2. Role até o campo **"📎 Anexar Boleto/Fatura"**
3. Clique em **"Escolher arquivo"**
4. Selecione o arquivo (PDF, JPG, PNG, WEBP - máx 5MB)
5. Salve a transação

### Ver Anexo

- Na lista de transações, clique no ícone **📎** ao lado da descrição
- O arquivo abrirá em nova aba

### Remover Anexo

- Ao editar a transação, clique em **"❌ Remover"** ao lado do nome do arquivo
- Ou faça novo upload que substitui o anterior automaticamente

## 🔒 Segurança

- Arquivos organizados por usuário: `user_id/transaction_id_timestamp.ext`
- Apenas usuários autenticados podem fazer upload
- Validação de tipo de arquivo (apenas PDF e imagens)
- Validação de tamanho (máximo 5MB)
- Anexos antigos são automaticamente deletados ao substituir

## ✅ Validações

- **Tamanho máximo:** 5MB
- **Formatos aceitos:** PDF, JPG, JPEG, PNG, WEBP
- **Nome único:** Gerado automaticamente com timestamp

## 🚀 Após Configuração

Depois de executar os scripts SQL e criar o bucket:

1. Faça deploy do código atualizado (já feito)
2. Teste criando uma transação com anexo
3. Verifique se o ícone 📎 aparece na lista
4. Clique no 📎 para abrir o arquivo

## 🐛 Troubleshooting

**Erro ao fazer upload:**
- Verifique se o bucket foi criado
- Confirme que o bucket está marcado como público
- Confira se as políticas RLS foram aplicadas

**Anexo não abre:**
- Verifique se o bucket é público
- Confirme a política de SELECT para public

**Arquivo muito grande:**
- Reduza o tamanho ou qualidade do PDF/imagem
- Limite máximo: 5MB
