-- ==========================================
-- ADICIONAR TABELA DE PERFIL DE USUÁRIO
-- COM SUPORTE A TELEGRAM ID
-- ==========================================
-- Cole este código no SQL Editor do Supabase
-- (Dashboard > SQL Editor > New Query)

-- 1. Criar tabela pública de perfil de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Política: Cada usuário vê e edita apenas o próprio registro
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. Trigger para criar perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Popular perfil para usuários já existentes (migração)
INSERT INTO public.users (id, email, name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', '')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
