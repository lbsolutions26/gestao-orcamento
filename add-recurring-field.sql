-- ========================================
-- ADICIONA SUPORTE A CONTAS RECORRENTES
-- Necessário para a página "Diário" (diario.html)
-- ========================================

-- Flag indicando que essa despesa é uma conta recorrente
-- (deve aparecer todo mês como lembrete)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Dia do mês padrão de vencimento (1-31). Opcional.
-- Usado para sugerir a data ao "lançar este mês" a partir de um recorrente.
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS recurring_day SMALLINT;

COMMENT ON COLUMN transactions.is_recurring IS 'Marca a despesa como recorrente (aluguel, luz, etc) para lembrete mensal';
COMMENT ON COLUMN transactions.recurring_day IS 'Dia do mês padrão de vencimento (1-31) para contas recorrentes';

CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring ON transactions(is_recurring) WHERE is_recurring = TRUE;

-- Verificação
SELECT 'OK - campos is_recurring e recurring_day criados' AS status;
