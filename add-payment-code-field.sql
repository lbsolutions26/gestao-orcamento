-- ============================================
-- Adicionar campo de código de barras/PIX
-- Execute no SQL Editor do Supabase
-- ============================================

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS payment_code TEXT;

COMMENT ON COLUMN transactions.payment_code IS 'Código de barras ou código PIX para facilitar pagamento';
