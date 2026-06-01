-- ============================================
-- Tabela de transações pendentes (estado entre cliques no Telegram)
-- Execute uma vez no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS public.telegram_pending (
    id          TEXT PRIMARY KEY,                 -- id curto (10 chars) usado no callback_data
    chat_id     TEXT NOT NULL,
    user_id     UUID NOT NULL,
    family_id   UUID,
    payload     JSONB NOT NULL,                   -- proposta de transação + opções alternativas
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS telegram_pending_chat_idx
    ON public.telegram_pending (chat_id, created_at DESC);

-- RLS: o webhook usa Service Role Key, então pode ler/escrever sem políticas,
-- mas habilitamos RLS para barrar acesso anônimo direto.
ALTER TABLE public.telegram_pending ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Limpeza automática: remove registros com mais de 1 dia
-- (chamada pelo webhook em cada execução; não precisa cron)
-- ============================================
