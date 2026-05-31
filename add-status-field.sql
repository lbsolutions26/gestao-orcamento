-- Adicionar campo de status às transações
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('paid', 'pending'));

-- Atualizar transações antigas para 'paid' por padrão
UPDATE transactions 
SET status = 'paid' 
WHERE status IS NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_transactions_status 
  ON transactions(status);

-- Verificar
SELECT 'Campo status adicionado com sucesso!' as message;
