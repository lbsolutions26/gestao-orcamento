-- Torna a coluna description opcional em transactions
ALTER TABLE public.transactions ALTER COLUMN description DROP NOT NULL;
