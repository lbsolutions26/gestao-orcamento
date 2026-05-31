# 💰 Gestão de Orçamento - PWA

Um aplicativo PWA (Progressive Web App) moderno para gestão de orçamento pessoal, conectado ao Supabase.

## ✨ Funcionalidades

- 📱 **Instalável** - Funciona como app nativo no Android e iOS
- 🔐 **Autenticação** - Login e registro com Supabase Auth
- 💵 **Receitas e Despesas** - Controle completo de transações
- 📊 **Dashboard** - Visualize seu saldo em tempo real
- 🏷️ **Categorias** - Organize suas transações
- 📴 **Offline** - Funciona mesmo sem internet
- 🎨 **Design Moderno** - Interface limpa e responsiva

## 🚀 Como Usar

### 1️⃣ Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um novo projeto
3. Copie a **URL do projeto** e a **anon key** (em Settings > API)
4. Abra o arquivo `app.js` e substitua:
   ```javascript
   const SUPABASE_URL = 'https://seu-projeto.supabase.co';
   const SUPABASE_ANON_KEY = 'sua-chave-anon-key-aqui';
   ```

### 2️⃣ Criar a Tabela no Supabase

No Supabase, vá em **SQL Editor** e execute este comando:

```sql
-- Criar tabela de transações
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

-- Habilitar RLS (Row Level Security)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só veem suas próprias transações
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Política: Usuários podem criar suas transações
CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar suas transações
CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Criar índices para melhor performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
```

### 3️⃣ Configurar Email (Opcional)

Por padrão, o Supabase pede confirmação de e-mail. Para desenvolvimento:

1. Vá em **Authentication > Settings**
2. Desabilite **"Enable email confirmations"** (apenas para testes)

### 4️⃣ Hospedar o PWA

Você pode hospedar gratuitamente em:

#### **Opção A: Vercel** (Recomendado)
1. Instale o Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. No terminal, navegue até a pasta do projeto:
   ```bash
   cd c:\Users\ADM\Documents\Projetos\Gestao_Orcamento
   ```
3. Faça deploy:
   ```bash
   vercel
   ```

#### **Opção B: Netlify**
1. Acesse [netlify.com](https://netlify.com)
2. Arraste a pasta do projeto para fazer upload
3. Pronto!

#### **Opção C: GitHub Pages**
1. Crie um repositório no GitHub
2. Faça upload dos arquivos
3. Ative GitHub Pages nas configurações
4. Acesse via `https://seu-usuario.github.io/nome-do-repo`

#### **Opção D: Servidor Local (para testes)**
```bash
# Usando Python
python -m http.server 8000

# Ou usando Node.js
npx serve
```
Acesse `http://localhost:8000`

### 5️⃣ Instalar no Celular

#### **Android:**
1. Abra o site no Chrome
2. Toque no menu (⋮) > "Adicionar à tela inicial"
3. Pronto! O app aparecerá como um ícone normal

#### **iPhone:**
1. Abra o site no Safari
2. Toque no botão de compartilhar
3. Selecione "Adicionar à Tela de Início"
4. Pronto!

## 📱 Distribuição sem App Store

### Android - APK
Se quiser distribuir como APK real:
1. Use [PWABuilder](https://www.pwabuilder.com/)
2. Cole a URL do seu PWA hospedado
3. Clique em "Build" > "Android"
4. Baixe o APK e distribua

### iOS - TestFlight
Para distribuir no iOS sem App Store:
1. Use [PWABuilder](https://www.pwabuilder.com/) para iOS
2. Ou distribua como PWA (melhor opção gratuita)

## 📁 Estrutura do Projeto

```
Gestao_Orcamento/
├── index.html          # Página principal
├── style.css           # Estilos CSS
├── app.js              # Lógica e integração Supabase
├── manifest.json       # Configuração PWA
├── service-worker.js   # Service Worker para offline
├── icon-192.png        # Ícone 192x192
├── icon-512.png        # Ícone 512x512
└── README.md           # Este arquivo
```

## 🎨 Gerar Ícones

Para criar os ícones PNG a partir do SVG:

1. Acesse [favicon.io](https://favicon.io/favicon-converter/)
2. Faça upload de uma imagem 512x512
3. Baixe os ícones gerados
4. Renomeie para `icon-192.png` e `icon-512.png`

Ou use uma ferramenta como [RealFaviconGenerator](https://realfavicongenerator.net/)

## 🔧 Tecnologias

- **HTML5** - Estrutura
- **CSS3** - Estilos modernos com variáveis CSS
- **JavaScript** - Lógica vanilla (sem frameworks)
- **Supabase** - Backend (autenticação + banco de dados)
- **Service Worker** - Funcionalidade offline
- **PWA** - Progressive Web App

## 🐛 Solução de Problemas

### Erro "relation 'transactions' does not exist"
- Execute o SQL no Supabase para criar a tabela

### Não consigo fazer login
- Verifique se as credenciais do Supabase estão corretas
- Verifique no console do navegador (F12) se há erros

### PWA não aparece opção de instalar
- Certifique-se que está usando HTTPS (localhost ou site hospedado)
- Verifique se o Service Worker está registrado (F12 > Application)

### Transações não aparecem
- Verifique as políticas RLS no Supabase
- Confira no console se há erros de permissão

## 📝 Licença

Livre para uso pessoal e comercial.

## 🤝 Contribuindo

Sinta-se à vontade para melhorar o código e adicionar novas funcionalidades!

## 📞 Suporte

Para dúvidas sobre:
- **Supabase**: [docs.supabase.com](https://docs.supabase.com)
- **PWA**: [web.dev/progressive-web-apps](https://web.dev/progressive-web-apps/)

---

**Desenvolvido com ❤️ usando Supabase e PWA**
