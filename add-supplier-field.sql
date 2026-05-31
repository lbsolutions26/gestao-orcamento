-- Adicionar campo fornecedor às transações
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS supplier TEXT;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_transactions_supplier 
  ON transactions(supplier);

-- Atualizar algumas transações com fornecedores baseado na descrição
UPDATE transactions 
SET supplier = CASE
  WHEN description ILIKE '%moinhos%' THEN 'MOINHOS'
  WHEN description ILIKE '%cofelma%' THEN 'COFELMA'
  WHEN description ILIKE '%quinto andar%' THEN 'Quinto Andar'
  WHEN description ILIKE '%santander%' THEN 'Santander'
  WHEN description ILIKE '%nubank%' THEN 'Nubank'
  WHEN description ILIKE '%customic%' THEN 'Customic'
  WHEN description ILIKE '%contador%' OR description ILIKE '%rodrigo%' THEN 'Contador Rodrigo'
  WHEN description ILIKE '%unimed%' THEN 'Unimed'
  WHEN description ILIKE '%rge%' THEN 'RGE'
  WHEN description ILIKE '%ceee%' THEN 'CEEE'
  WHEN description ILIKE '%caixa%' THEN 'Caixa Econômica'
  WHEN description ILIKE '%condominio%' THEN 'Condomínio'
  ELSE 'Outros'
END
WHERE supplier IS NULL;

-- Verificar
SELECT 'Campo fornecedor adicionado com sucesso!' as message;
