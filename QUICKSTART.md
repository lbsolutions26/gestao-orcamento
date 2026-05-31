# ⚡ INÍCIO RÁPIDO

## 🎯 3 Passos para Começar

### 1. Configure o Supabase

1. Acesse: https://supabase.com
2. Crie um projeto GRATUITO
3. Vá em Settings > API
4. Copie `URL` e `anon public key`
5. Cole em `app.js` (linhas 5-6)

### 2. Crie a Tabela

No Supabase, vá em **SQL Editor** e cole isto:

```sql
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON transactions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
```

### 3. Teste Local

Opção A - Python (se tiver instalado):
```bash
python -m http.server 8000
```

Opção B - Node.js:
```bash
npx serve
```

Abra: http://localhost:8000

---

## 📱 Instalar no Celular

### Android (Chrome):
1. Abra o site
2. Menu (⋮) > "Adicionar à tela inicial"
3. Pronto! 🎉

### iPhone (Safari):
1. Abra o site
2. Botão compartilhar
3. "Adicionar à Tela de Início"
4. Pronto! 🎉

---

## 🌐 Hospedar (Grátis)

### Vercel (Mais Fácil):
```bash
npm install -g vercel
vercel
```

### Netlify:
1. Acesse netlify.com
2. Arraste a pasta
3. Pronto!

---

## 🎨 Gerar Ícones PNG

1. Acesse: https://favicon.io/favicon-converter/
2. Upload uma imagem 512x512 (ou use `icon.svg`)
3. Baixe os ícones
4. Renomeie para `icon-192.png` e `icon-512.png`
5. Coloque na pasta do projeto

---

## ✅ Checklist

- [ ] Criar conta no Supabase
- [ ] Configurar URL e Key no app.js
- [ ] Criar tabela no SQL Editor
- [ ] Gerar ícones PNG
- [ ] Testar localmente
- [ ] Hospedar online
- [ ] Instalar no celular

---

**Dúvidas? Veja o README.md completo!**
