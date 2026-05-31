# 💳 Estratégia para Cartão de Crédito

## 🤔 O Problema

No cartão de crédito temos **duas operações distintas**:
1. **Compras** (ao longo do mês) - NÃO sai dinheiro da conta ainda
2. **Pagamento da Fatura** (uma vez por mês) - Aí sim sai o dinheiro

---

## ✅ Solução Proposta (sua forma está CORRETA!)

### **Abordagem: Separar Compras de Pagamento**

```
┌─────────────────────────────────────┐
│  Compras no Cartão (agosto)         │
│  - 15/ago: Mercado R$ 350           │  ← NÃO afeta saldo
│  - 20/ago: Gasolina R$ 200          │  ← NÃO afeta saldo  
│  - 25/ago: Farmácia R$ 150          │  ← NÃO afeta saldo
│  Total: R$ 700                      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Pagamento Fatura (setembro)        │
│  - 10/set: Fatura Agosto R$ 700     │  ← AFETA saldo (sai da conta)
└─────────────────────────────────────┘
```

---

## 🗂️ Estrutura de Dados Atualizada

### **Campos Novos na Tabela:**

| Campo              | Tipo    | Descrição                                      |
|--------------------|---------|------------------------------------------------|
| `payment_method`   | TEXT    | Forma: Conta Corrente, PIX, Cartão de Crédito |
| `due_date`         | DATE    | Data de vencimento                             |
| `payment_date`     | DATE    | Data real que pagou (NULL se pendente)         |
| `affects_balance`  | BOOLEAN | Se impacta saldo (FALSE para compras cartão)   |
| `is_bill_payment`  | BOOLEAN | Se é pagamento de fatura                       |
| `bill_reference`   | TEXT    | Referência da fatura (ex: "2025-08")           |
| `notes`            | TEXT    | Observações                                    |

---

## 📊 Como Funciona no Sistema

### **1️⃣ Registrar Compra no Cartão**

```javascript
{
  type: 'expense',
  description: 'Compra no Mercado',
  amount: 350.00,
  category: 'Alimentação',
  date: '2025-08-15',           // Quando comprou
  payment_method: 'Cartão de Crédito',
  affects_balance: FALSE,        // ← NÃO entra no saldo!
  bill_reference: '2025-08',     // Fatura de agosto
  status: 'pending'
}
```

### **2️⃣ Registrar Pagamento da Fatura**

```javascript
{
  type: 'expense',
  description: 'Pagamento Fatura Cartão Agosto',
  amount: 700.00,
  category: 'Cartão de Crédito',
  date: '2025-09-10',           // Quando pagou
  due_date: '2025-09-10',
  payment_date: '2025-09-10',
  payment_method: 'Conta Corrente',
  affects_balance: TRUE,         // ← ENTRA no saldo!
  is_bill_payment: TRUE,
  bill_reference: '2025-08',     // Vincula às compras
  status: 'paid'
}
```

---

## 💰 Cálculo de Saldo

### **Saldo Real** (o que tem na conta):
```sql
SELECT SUM(
  CASE 
    WHEN type = 'income' THEN amount
    WHEN type = 'expense' THEN -amount
  END
)
FROM transactions
WHERE affects_balance = TRUE  -- ← Só conta o que afeta saldo
  AND status = 'paid'
```

### **Fatura Pendente do Cartão**:
```sql
SELECT SUM(amount)
FROM transactions
WHERE payment_method = 'Cartão de Crédito'
  AND affects_balance = FALSE  -- Compras que ainda não viraram fatura paga
  AND bill_reference = '2025-08'
```

---

## 🎨 Interface Proposta

### **Tela: Compras no Cartão**
```
┌───────────────────────────────────────────┐
│ 💳 Cartão de Crédito                      │
├───────────────────────────────────────────┤
│ Fatura Agosto/2025            R$ 700,00   │
│  ├─ 15/ago - Mercado         R$ 350,00    │
│  ├─ 20/ago - Gasolina        R$ 200,00    │
│  └─ 25/ago - Farmácia        R$ 150,00    │
│                                            │
│ [📝 Registrar Pagamento da Fatura]        │
├───────────────────────────────────────────┤
│ Fatura Setembro/2025          R$ 450,00   │
│  ├─ 05/set - Restaurant      R$ 280,00    │
│  └─ 10/set - Posto           R$ 170,00    │
└───────────────────────────────────────────┘
```

### **Tela: Pagamentos (Saldo Real)**
```
┌───────────────────────────────────────────┐
│ 💰 Saldo em Conta                         │
├───────────────────────────────────────────┤
│ Receitas:               R$ 10.000,00      │
│ Despesas:              -R$  7.500,00      │
│ ├─ Aluguel              R$  2.722,88      │
│ ├─ Fatura Cartão Ago    R$    700,00  ✓  │
│ ├─ Conta Luz            R$    298,87  ✓  │
│ └─ Outros...                              │
│                                            │
│ SALDO REAL:             R$  2.500,00  ✅  │
└───────────────────────────────────────────┘
```

---

## 🔄 Fluxo Completo de Uso

### **Mês 1 - Agosto (fazendo compras)**

1. Ao longo do mês:
   - Registra cada compra no cartão
   - `affects_balance = FALSE`
   - `bill_reference = '2025-08'`
   - Não impacta o saldo

2. Visualiza:
   - **Saldo em Conta**: R$ 2.500 (não mudou)
   - **Fatura Agosto**: R$ 700 (pendente)

### **Mês 2 - Setembro (pagando fatura)**

3. Dia 10/set (vencimento):
   - Registra pagamento da fatura
   - `amount = 700` (total da fatura de agosto)
   - `affects_balance = TRUE`
   - `is_bill_payment = TRUE`
   - Marca como pago

4. Visualiza:
   - **Saldo em Conta**: R$ 1.800 (diminuiu R$ 700)
   - **Fatura Agosto**: R$ 700 ✅ (paga)
   - **Fatura Setembro**: R$ 450 (nova, pendente)

---

## 📋 Campos da Planilha Original

Baseado na sua imagem:

| Campo Excel          | Campo Banco         | Observação                    |
|----------------------|---------------------|-------------------------------|
| Categoria            | `category`          | ✅ Já existe                  |
| Descrição            | `description`       | ✅ Já existe                  |
| Data Vencimento      | `due_date`          | ✅ NOVO                       |
| Valor                | `amount`            | ✅ Já existe                  |
| Situação             | `status`            | ✅ Já existe (paid/pending)   |
| Data Pagamento       | `payment_date`      | ✅ NOVO                       |
| Forma Pagamento      | `payment_method`    | ✅ NOVO                       |
| Tipo                 | `type`              | ✅ Já existe (income/expense) |
| Observação           | `notes`             | ✅ NOVO                       |

---

## ✅ Vantagens desta Abordagem

1. **Controle Real do Saldo**: Sabe exatamente quanto tem na conta
2. **Visibilidade das Compras**: Vê todas as compras do cartão agrupadas
3. **Histórico Completo**: Mantém registro de quando comprou vs quando pagou
4. **Fatura Mensal**: Agrupa compras por referência (mês/ano)
5. **Relatórios Precisos**: Pode gerar relatórios de gastos reais vs comprometidos

---

## 🎯 Próximos Passos

1. **Executar o SQL**: `update-database-complete.sql`
2. **Atualizar Interface**: Adicionar campos novos nos formulários
3. **Criar Tela de Cartão**: Página específica para gerenciar faturas
4. **Importar Dados**: Adaptar importação para novos campos
5. **Testar Fluxo**: Simular compras e pagamentos

---

**Essa abordagem resolve seu problema?** Ou quer ajustar algo? 💡
