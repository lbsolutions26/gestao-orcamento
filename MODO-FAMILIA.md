# 👨‍👩‍👧‍👦 Modo Família - Guia de Uso

## 🎯 O que é?

O **Modo Família** permite que múltiplas pessoas compartilhem e gerenciem o mesmo orçamento. Perfeito para casais, famílias ou colegas de casa!

---

## 📋 Passo a Passo para Configurar

### **1. Execute o Script SQL no Supabase**

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `setup-family-mode.sql`
4. Cole todo o conteúdo no editor
5. Clique em **RUN** ✅

Este script irá:
- ✅ Criar tabelas de famílias, membros e convites
- ✅ Adicionar campos `family_id` e `added_by` nas transações
- ✅ Configurar políticas de segurança (RLS)
- ✅ Migrar suas transações existentes para sua família
- ✅ Criar família automática para novos usuários

---

### **2. Convide sua Esposa**

1. **Você:** Faça login no app
2. **Você:** Clique no **menu ☰** → **Família**
3. **Você:** Digite o **email da sua esposa**
4. **Você:** Clique em **Enviar convite**

---

### **3. Sua Esposa Aceita o Convite**

#### Opção A: Se ela já tem conta
1. **Ela:** Faz login com a conta dela
2. **Ela:** Clica no menu **☰** → **Família**
3. **Ela:** Verá o convite pendente
4. **Ela:** Clica em **Aceitar**

#### Opção B: Se ela ainda não tem conta
1. **Ela:** Cria uma conta com o **mesmo email** que você convidou
2. **Ela:** Faz login
3. **Ela:** Vai em **Família** e aceita o convite

---

## ✨ O que vocês podem fazer juntos?

### ✅ Ambos Podem:
- Ver todas as transações da família
- Adicionar novas receitas e despesas
- Editar e excluir qualquer transação
- Marcar contas como pagas
- Filtrar e buscar transações
- Ver os mesmos saldos e totais

### 📊 Sistema de Rastreamento:
- Cada transação mostra "quem adicionou"
- Campo `added_by` registra o autor

---

## 🔐 Níveis de Permissão

| Papel | Pode Ver | Pode Editar | Pode Convidar | Pode Remover |
|-------|----------|-------------|---------------|--------------|
| **👑 Dono** | ✅ Tudo | ✅ Tudo | ✅ Sim | ✅ Membros |
| **⚡ Admin** | ✅ Tudo | ✅ Tudo | ✅ Sim | ✅ Membros |
| **👤 Membro** | ✅ Tudo | ✅ Tudo | ❌ Não | ❌ Não |

---

## ❓ Perguntas Frequentes

### **P: Minha esposa vê minhas transações antigas?**
✅ **Sim!** Todas as suas transações foram migradas para a família compartilhada.

### **P: Posso ter mais de uma família?**
❌ **Não.** Cada usuário pertence a apenas uma família por vez.

### **P: Posso sair da família?**
⚠️ **Sim**, mas você perderá acesso a todas as transações compartilhadas.

### **P: O que acontece se eu deletar um membro?**
🔒 Ele perde acesso imediato, mas as transações que ele adicionou **permanecem**.

### **P: Convites expiram?**
⏰ **Sim!** Convites expiram em **7 dias**. Depois, envie um novo.

### **P: Posso renomear a família?**
✅ **Sim!** Na tela **Família**, altere o nome e clique em **Salvar**.

---

## 🚀 Já está funcionando!

1. ✅ Execute o SQL no Supabase
2. ✅ Faça o convite
3. ✅ Sua esposa aceita
4. 🎉 **Vocês já estão gerenciando o orçamento juntos!**

---

## 🛠️ Troubleshooting

### **Erro: "relation does not exist"**
➡️ Você não executou o `setup-family-mode.sql` no Supabase. Execute agora!

### **Não vejo o convite**
➡️ Certifique-se de que:
- O email usado no convite é o **mesmo** da conta
- O convite **não expirou** (< 7 dias)
- Você está logado na conta certa

### **Erro ao convidar**
➡️ Possíveis causas:
- Email já foi convidado (veja convites pendentes)
- Email já é membro da família
- Você não é dono/admin da família

---

## 💡 Dicas de Uso

### Para Casais:
- 💍 Um de vocês cria a família
- 👫 Convidem um ao outro
- 💰 Gerenciem as finanças juntos
- 📱 Ambos podem adicionar despesas na hora

### Para Famílias Grandes:
- 👨‍👩‍👧‍👦 Pais criam a família
- 👥 Convidem filhos como membros
- 📊 Todos veem os gastos
- 🎯 Transparência financeira total

---

## 📞 Precisa de Ajuda?

Se algo não funcionar, verifique:
1. ✅ Script SQL executado corretamente
2. ✅ Ambos logados com contas ativas
3. ✅ Convite enviado para o email correto
4. ✅ Convite não expirado

**Boa gestão financeira em família! 🏠💰**
