# ✅ Passo a Passo Rápido - Reimportação

## 🎯 O que foi feito:
✅ Ferramenta de importação ATUALIZADA  
✅ Agora aceita qualquer arquivo CSV  
✅ Opção para limpar dados antigos  
✅ Preview dos dados antes de importar  

---

## 📋 COMO USAR (3 passos simples):

### **1️⃣ Preparar o CSV do Excel**

No Excel (já aberto):

1. **Copie todas as linhas** de dados (Ctrl + A, Ctrl + C)
2. Abra: https://sheets.google.com
3. Cole (Ctrl + V)
4. Organize em **4 colunas**:
   ```
   Data       | Valor    | Descrição              | Tipo
   01/08/2025 | 1093.91  | MOINHOS diferença     | Receita
   01/08/2025 | 416.27   | Limite Santander      | Despesa
   05/08/2025 | 9500.00  | COFELMA               | Receita
   ```
5. **Arquivo** → **Download** → **CSV (.csv)**
6. Salvar como: **dados-completos.csv**

---

### **2️⃣ Importar no App**

Na página que acabou de abrir: **http://localhost:8000/import-data.html**

1. **Clique**: "1. Fazer Login"
   - Digite seu e-mail e senha

2. **Clique**: "2. Selecionar CSV"
   - Escolha o arquivo **dados-completos.csv**
   - Verá preview dos dados

3. **IMPORTANTE**: ✅ Marque:
   ```
   ☑ Limpar dados antigos antes de importar
   ```

4. **Clique**: "3. Importar Dados"
   - Confirme a ação
   - Aguarde conclusão

---

### **3️⃣ Verificar Resultado**

1. Veja o log verde com "✅" para cada linha importada
2. Ao final verá:
   ```
   ✅ Importação concluída! XXX/XXX transações importadas
   ```
3. Acesse: **http://localhost:8000/pagamentos.html**
4. Teste os agrupamentos!

---

## 🔍 Formatos de CSV Aceitos:

### **Opção A** (4 colunas - Recomendado):
```csv
Data,Valor,Descrição,Tipo
01/08/2025,1093.91,MOINHOS diferença,Receita
01/08/2025,-416.27,Limite Santander,Despesa
```

### **Opção B** (5 colunas - Com categoria):
```csv
Data,Valor,Descrição,Tipo,Categoria
01/08/2025,1093.91,MOINHOS,Receita,Salário
01/08/2025,-416.27,Santander,Despesa,Bancos
```

### **Formatos de Data Aceitos**:
- ✅ `01/08/2025` (DD/MM/YYYY)
- ✅ `01/08/25` (DD/MM/YY)
- ✅ `01/ago` (converte para ano atual)
- ✅ `2025-08-01` (ISO)

### **Formatos de Valor Aceitos**:
- ✅ `1093.91` (ponto decimal)
- ✅ `1.093,91` (vírgula decimal brasileira)
- ✅ `R$ 1.093,91` (com símbolo R$)
- ✅ `-416.27` (negativo para despesas)

---

## ⚠️ IMPORTANTE:

### **Antes de importar**:
- ✅ Marque "Limpar dados antigos" se quiser substituir tudo
- ❌ Desmaque se quiser ADICIONAR aos dados existentes

### **Depois de importar**:
1. **Execute o SQL do fornecedor** (já copiado):
   - Abra: Supabase SQL Editor
   - Ctrl + V (colar)
   - Run
   - Isso categoriza fornecedores automaticamente

2. **Marque as despesas como pagas**:
   - Em pagamentos.html
   - Use os botões "✓ Pagar"

---

## 🚀 Pronto!

Agora você terá:
- ✅ TODOS os dados do Excel importados
- ✅ Agrupamentos funcionando
- ✅ Filtros por data, status, categoria
- ✅ Estatísticas completas

**Qualquer problema, me avise!** 🎉
