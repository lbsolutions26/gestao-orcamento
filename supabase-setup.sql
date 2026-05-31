-- ==========================================
-- CONFIGURAÇÃO SUPABASE - GESTÃO DE ORÇAMENTO
-- ==========================================
-- Cole este código no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New Query)

-- 1. Criar tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
  ON transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date 
  ON transactions(date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_created 
  ON transactions(created_at DESC);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 4. Política: Usuários podem ver apenas suas transações
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Política: Usuários podem criar suas transações
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;
CREATE POLICY "Users can create own transactions"
  ON transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Política: Usuários podem atualizar suas transações
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions"
  ON transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Política: Usuários podem deletar suas transações
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
CREATE POLICY "Users can delete own transactions"
  ON transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. Verificar se tudo foi criado corretamente
SELECT 
  'Tabela criada!' as status,
  COUNT(*) as total_transactions
FROM transactions;

-- ==========================================
-- CONFIGURAÇÕES OPCIONAIS
-- ==========================================

-- Desabilitar confirmação de email (apenas para desenvolvimento/testes)
-- Vá em: Authentication > Settings
-- E desabilite "Enable email confirmations"

-- ==========================================
-- DADOS DE TESTE (Opcional)
-- ==========================================
-- Descomentar para inserir dados de teste
-- IMPORTANTE: Substitua 'seu-user-id-aqui' pelo ID do seu usuário

/*
INSERT INTO transactions (user_id, type, description, amount, category, date) VALUES
  ('seu-user-id-aqui', 'income', 'Salário', 5000.00, 'Salário', CURRENT_DATE),
  ('seu-user-id-aqui', 'expense', 'Aluguel', 1200.00, 'Moradia', CURRENT_DATE),
  ('seu-user-id-aqui', 'expense', 'Mercado', 450.00, 'Alimentação', CURRENT_DATE),
  ('seu-user-id-aqui', 'income', 'Freelance', 800.00, 'Freelance', CURRENT_DATE - 1),
  ('seu-user-id-aqui', 'expense', 'Gasolina', 200.00, 'Transporte', CURRENT_DATE - 2);
*/

-- ==========================================
-- CONSULTAS ÚTEIS
-- ==========================================

-- Ver todas as transações de um usuário
-- SELECT * FROM transactions WHERE user_id = auth.uid() ORDER BY date DESC;

-- Ver saldo total
-- SELECT 
--   SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as receitas,
--   SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as despesas,
--   SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as saldo
-- FROM transactions 
-- WHERE user_id = auth.uid();

-- Ver total por categoria
-- SELECT 
--   category,
--   type,
--   SUM(amount) as total
-- FROM transactions 
-- WHERE user_id = auth.uid()
-- GROUP BY category, type
-- ORDER BY total DESC;
