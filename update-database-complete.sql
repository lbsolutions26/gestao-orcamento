-- ========================================
-- ATUALIZAÇÃO COMPLETA DA ESTRUTURA
-- Adiciona campos essenciais do controle financeiro
-- ========================================

-- 1. Adicionar campo de FORMA DE PAGAMENTO
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 2. Adicionar DATA DE VENCIMENTO (diferente da data de lançamento)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS due_date DATE;

-- 3. Adicionar DATA REAL DE PAGAMENTO (quando foi efetivamente pago)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_date DATE;

-- 4. Adicionar flag se AFETA O SALDO (crucial para cartão de crédito)
-- Compras no cartão: affects_balance = FALSE
-- Pagamento de fatura: affects_balance = TRUE
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS affects_balance BOOLEAN DEFAULT TRUE;

-- 5. Adicionar campo de OBSERVAÇÕES
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Adicionar flag se é PAGAMENTO DE FATURA
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_bill_payment BOOLEAN DEFAULT FALSE;

-- 7. Adicionar referência à FATURA (para vincular compras do cartão com o pagamento)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS bill_reference TEXT;

-- ========================================
-- COMENTÁRIOS NOS CAMPOS (documentação)
-- ========================================

COMMENT ON COLUMN transactions.date IS 'Data de lançamento/competência da transação';
COMMENT ON COLUMN transactions.due_date IS 'Data de vencimento da conta/boleto';
COMMENT ON COLUMN transactions.payment_date IS 'Data real em que foi pago (NULL se pendente)';
COMMENT ON COLUMN transactions.payment_method IS 'Forma de pagamento: Conta Corrente, PIX, Cartão de Crédito, Dinheiro, etc.';
COMMENT ON COLUMN transactions.affects_balance IS 'Se deve impactar o saldo (FALSE para compras no cartão de crédito)';
COMMENT ON COLUMN transactions.is_bill_payment IS 'Se é um pagamento de fatura de cartão';
COMMENT ON COLUMN transactions.bill_reference IS 'Referência da fatura (ex: 2025-08 para agrupar compras do cartão)';
COMMENT ON COLUMN transactions.notes IS 'Observações adicionais';

-- ========================================
-- ÍNDICES PARA PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_date ON transactions(payment_date);
CREATE INDEX IF NOT EXISTS idx_transactions_affects_balance ON transactions(affects_balance);
CREATE INDEX IF NOT EXISTS idx_transactions_bill_reference ON transactions(bill_reference);

-- ========================================
-- ATUALIZAR DADOS EXISTENTES
-- ========================================

-- Marcar transações existentes com valores padrão inteligentes
UPDATE transactions 
SET 
    due_date = date,  -- Se não tem vencimento, assume a data de lançamento
    payment_method = CASE 
        WHEN description ILIKE '%cartão%' OR description ILIKE '%crédito%' THEN 'Cartão de Crédito'
        WHEN description ILIKE '%pix%' THEN 'PIX'
        WHEN description ILIKE '%dinheiro%' THEN 'Dinheiro'
        ELSE 'Conta Corrente'
    END,
    affects_balance = CASE
        -- Compras no cartão NÃO afetam saldo
        WHEN description ILIKE '%cartão de crédito%' 
             AND NOT description ILIKE '%pagamento%' 
             AND NOT description ILIKE '%fatura%' 
        THEN FALSE
        -- Pagamento de fatura afeta saldo
        ELSE TRUE
    END,
    is_bill_payment = CASE
        WHEN description ILIKE '%fatura%' OR 
             (description ILIKE '%cartão%' AND description ILIKE '%pagamento%')
        THEN TRUE
        ELSE FALSE
    END,
    payment_date = CASE
        WHEN status = 'paid' THEN date  -- Se está pago, assume pagamento na data de lançamento
        ELSE NULL  -- Se pendente, não tem data de pagamento
    END
WHERE payment_method IS NULL;

-- ========================================
-- VIEW PARA SALDO REAL
-- Calcula apenas transações que afetam o saldo
-- ========================================

CREATE OR REPLACE VIEW v_balance_transactions AS
SELECT 
    *,
    CASE 
        WHEN type = 'income' THEN amount
        WHEN type = 'expense' THEN -amount
        ELSE 0
    END as balance_impact
FROM transactions
WHERE affects_balance = TRUE;

-- ========================================
-- VIEW PARA COMPRAS NO CARTÃO
-- Agrupa por fatura (mês de referência)
-- ========================================

CREATE OR REPLACE VIEW v_credit_card_purchases AS
SELECT 
    COALESCE(bill_reference, TO_CHAR(date, 'YYYY-MM')) as bill_month,
    COUNT(*) as purchase_count,
    SUM(amount) as bill_total,
    user_id
FROM transactions
WHERE payment_method = 'Cartão de Crédito' 
  AND affects_balance = FALSE
  AND type = 'expense'
GROUP BY user_id, bill_month
ORDER BY bill_month DESC;

-- ========================================
-- FUNCTION PARA CALCULAR SALDO REAL
-- ========================================

CREATE OR REPLACE FUNCTION get_real_balance(p_user_id UUID, p_up_to_date DATE DEFAULT CURRENT_DATE)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(
            CASE 
                WHEN type = 'income' THEN amount
                WHEN type = 'expense' THEN -amount
                ELSE 0
            END
        ), 0)
    INTO v_balance
    FROM transactions
    WHERE user_id = p_user_id
      AND affects_balance = TRUE
      AND (payment_date IS NOT NULL AND payment_date <= p_up_to_date)
       OR (status = 'paid' AND date <= p_up_to_date);
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- DADOS DE EXEMPLO (para testes)
-- ========================================

-- Exemplo 1: Compra no cartão (NÃO afeta saldo)
-- INSERT INTO transactions (user_id, type, description, amount, category, date, payment_method, affects_balance, bill_reference, status)
-- VALUES (auth.uid(), 'expense', 'Compra no Mercado - Cartão', 350.00, 'Alimentação', '2025-08-15', 'Cartão de Crédito', FALSE, '2025-08', 'pending');

-- Exemplo 2: Pagamento da fatura (AFETA saldo)
-- INSERT INTO transactions (user_id, type, description, amount, category, date, due_date, payment_date, payment_method, affects_balance, is_bill_payment, status)
-- VALUES (auth.uid(), 'expense', 'Pagamento Fatura Cartão Agosto', 1500.00, 'Cartão de Crédito', '2025-09-10', '2025-09-10', '2025-09-10', 'Conta Corrente', TRUE, TRUE, 'paid');

-- Exemplo 3: Conta normal (afeta saldo)
-- INSERT INTO transactions (user_id, type, description, amount, category, date, due_date, payment_method, affects_balance, status)
-- VALUES (auth.uid(), 'expense', 'Conta de Luz', 298.87, 'Moradia', '2025-08-18', '2025-08-18', 'Conta Corrente', TRUE, 'paid');
