# 📥 Guia de Importação - Direto do Excel

## 🎯 Processo Simplificado

Agora você pode exportar sua tabela do Excel **exatamente como está** e importar direto no sistema!

---

## 📋 Colunas Reconhecidas Automaticamente

O importador identifica automaticamente as seguintes colunas:

| Coluna no Excel | Campo no Sistema | Obrigatório |
|----------------|------------------|-------------|
| **Categoria** | Categoria | ✅ Sim |
| **Descrição** | Descrição | ✅ Sim |
| **Data Vencimento** | Data de Vencimento | ✅ Sim |
| **Valor** | Valor | ✅ Sim |
| **Situação** | Status (Pago/Pendente) | Não |
| **Data Pagamento** | Data de Pagamento | Não |
| **Forma Pagamento** | Forma de Pagamento | Não |
| **Tipo** | Tipo (Saída/Entrada) | ✅ Sim |
| **Observação** | Observações | Não |

---

## 🚀 Passo a Passo COMPLETO

### **1️⃣ Exportar do Excel**

1. Abra sua planilha no Excel
2. Selecione a aba com os dados
3. **Arquivo** → **Salvar Como**
4. **Tipo**: Selecione **"CSV UTF-8 (delimitado por vírgulas) (*.csv)"**
5. Nome: `financeiro.csv`
6. Clique em **Salvar**

**⚠️ IMPORTANTE**: O Excel pode avisar que algumas funcionalidades serão perdidas. É normal, clique em **"Sim"** para continuar.

---

### **2️⃣ Importar no Sistema**

1. Abra: **http://localhost:8000/import-data.html**

2. **Clique**: "1. Fazer Login"
   - Digite seu e-mail e senha

3. **Clique**: "2. Selecionar CSV"
   - Escolha o arquivo `financeiro.csv`
   - Aguarde o preview aparecer

4. **IMPORTANTE**: ✅ Marque:
   ```
   ☑ Limpar dados antigos antes de importar
   ```
   *(Para não duplicar dados)*

5. **Clique**: "3. Importar Dados"
   - Aguarde a importação completar
   - Veja cada linha sendo importada no log

6. **Pronto!** ✅
   - Acesse: **http://localhost:8000/pagamentos.html**
   - Veja todos os seus dados importados

---

## 🔍 O que o Importador FAZ Automaticamente:

### **1. Identifica o Tipo de Transação**
- "Saída" → Despesa
- "Entrada" → Receita
- Se não tiver, assume **Despesa**

### **2. Processa o Status**
- "PAGO" → Marca como pago
- "NÃO PAGO" ou vazio → Marca como pendente

### **3. Inteligência do Cartão de Crédito**

**Compra no Cartão:**
```
Se Forma Pagamento = "Cartão de Crédito"
E Descrição NÃO contém "pagamento" ou "fatura"
Então:
  ✅ Registra a compra
  ❌ NÃO afeta o saldo
  💳 Marca como "Compra no cartão"
  📅 Agrupa na fatura do mês
```

**Pagamento de Fatura:**
```
Se Forma Pagamento = "Cartão de Crédito"
E Descrição contém "pagamento" ou "fatura"
Então:
  ✅ Registra o pagamento
  ✅ AFETA o saldo
  💰 Diminui dinheiro da conta
```

### **4. Datas Inteligentes**
- **Data de Lançamento**: Usa "Data Vencimento" se não houver outra
- **Data de Vencimento**: Vem da coluna "Data Vencimento"
- **Data de Pagamento**: Vem da coluna "Data Pagamento" (se pago)

### **5. Valores**
- Aceita: `R$ 1.234,56` ou `1234.56` ou `-1234,56`
- Remove "R$", espaços e sinais
- Converte vírgula decimal para ponto
- Sempre positivo (o tipo define se é entrada ou saída)

---

## 📊 Exemplo de CSV Válido

```csv
Categoria,Descrição,Data Vencimento,Valor,Situação,Data Pagamento,Forma Pagamento,Tipo,Observação
Moradia,Luz Apto Cachoeirinha,18/08/2025,-R$ 298,87,PAGO,01/10/2025,Conta Corrente,Saída,Energia atrasada de agosto
Moradia,Condomínio Santa Maria B3 102,05/09/2025,-R$ 411,24,PAGO,01/10/2025,Conta Corrente,Saída,
Livre,Cartão de Crédito,01/01/2026,-R$ 146,14,PAGO,01/01/2026,Conta Corrente,Saída,
Moradia,Condomínio Santa Maria H3 105,05/12/2025,-R$ 398,89,PAGO,09/12/2025,Conta Corrente,Saída,
```

---

## 💡 Dicas Importantes:

### **✅ FAÇA:**

1. **Mantenha os cabeçalhos** na primeira linha
2. **Não mude os nomes** das colunas (Categoria, Descrição, etc.)
3. **Marque "Limpar dados antigos"** para evitar duplicatas
4. **Verifique o preview** antes de importar

### **❌ EVITE:**

1. **Células mescladas** - Separe antes de exportar
2. **Linhas vazias** no meio dos dados
3. **Fórmulas** - Cole como valores antes de exportar
4. **Formatação exótica** - Use texto simples

---

## 🎨 Mapeamento de Formas de Pagamento:

| No Excel | Reconhecido Como |
|----------|------------------|
| Conta Corrente | Conta Corrente |
| PIX | PIX |
| Cartão de Crédito | Cartão de Crédito |
| Dinheiro | Dinheiro |
| Transferência | Transferência |
| *(vazio)* | Conta Corrente (padrão) |

---

## 🔧 Solução de Problemas:

### **Erro: "Nenhuma transação válida encontrada"**
**Causa**: Cabeçalhos não reconhecidos  
**Solução**: Certifique-se que a primeira linha tem exatamente:
- `Categoria`
- `Descrição`
- `Data Vencimento` ou `Valor`

### **Erro: "Valor inválido"**
**Causa**: Formatação do valor  
**Solução**: Certifique-se que:
- Usa vírgula ou ponto decimal
- Não tem texto misturado (ex: "R$ 100 reais")

### **Erro: "Data inválida"**
**Causa**: Formato de data não reconhecido  
**Solução**: Use um destes formatos:
- `DD/MM/AAAA` (ex: 18/08/2025)
- `DD/MM/AA` (ex: 18/08/25)
- `AAAA-MM-DD` (ex: 2025-08-18)

### **Importou mas valores estranhos**
**Causa**: CSV com encoding errado  
**Solução**: Ao salvar, escolha **"CSV UTF-8"** (não apenas "CSV")

---

## 📈 Depois de Importar:

### **1. Verificar no Dashboard**
- Vá para: http://localhost:8000/index.html
- Veja o saldo atualizado
- Confirme receitas e despesas

### **2. Conferir em Pagamentos**
- Vá para: http://localhost:8000/pagamentos.html
- Use filtros para ver por período
- Teste os agrupamentos:
  - Por mês
  - Por status (pago/pendente)
  - Por forma de pagamento
  - Por categoria

### **3. Marcar Pendências**
- Use os botões "✓ Pagar"
- Acompanhe o que falta pagar

---

## 🎯 Exemplo Completo:

### **Sua Tabela Excel:**
```
┌─────────┬──────────────┬────────────┬─────────┬──────────┬───────────────┬────────────────┬───────┬────────────┐
│Categoria│ Descrição    │ Data Venc  │ Valor   │ Situação │ Data Pgto     │ Forma Pgto     │ Tipo  │ Observação │
├─────────┼──────────────┼────────────┼─────────┼──────────┼───────────────┼────────────────┼───────┼────────────┤
│ Moradia │ Luz          │ 18/08/2025 │ -298,87 │ PAGO     │ 01/10/2025    │ Conta Corrente │ Saída │ Atrasada   │
│ Livre   │ Mercado      │ 15/08/2025 │ -350,00 │ NÃO PAGO │               │ Cartão Crédito │ Saída │            │
└─────────┴──────────────┴────────────┴─────────┴──────────┴───────────────┴────────────────┴───────┴────────────┘
```

### **Resultado no Sistema:**

**Luz:**
- ✅ Importada como **Despesa**
- ✅ Status: **Pago** (01/10/2025)
- ✅ Forma: **Conta Corrente**
- ✅ **Afeta o saldo** (diminui R$ 298,87)
- ✅ Observação: "Atrasada"

**Mercado:**
- ✅ Importada como **Despesa**
- ✅ Status: **Pendente**
- ✅ Forma: **Cartão de Crédito**
- ❌ **NÃO afeta o saldo** (compra no cartão)
- 💳 Tag: "Compra no cartão"
- 📅 Fatura: 2025-08

---

## ✅ Checklist Final:

Antes de importar, confirme:

- [ ] Arquivo salvo como **CSV UTF-8**
- [ ] Primeira linha tem **cabeçalhos**
- [ ] Coluna "Descrição" preenchida
- [ ] Coluna "Valor" com números
- [ ] Marcou **"Limpar dados antigos"** (se for reimportar)
- [ ] Fez **backup** dos dados antigos (se precisar)

---

**Pronto para importar? Siga o passo a passo acima!** 🚀

*Qualquer dúvida, consulte os exemplos ou me avise!*
