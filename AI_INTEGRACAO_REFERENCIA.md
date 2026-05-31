# Integração com IA — Referência Técnica (Cofelma Dashboard)

## Visão Geral

O dashboard usa **GitHub Models** para gerar análises e recomendações estratégicas diretamente no navegador, sem nenhum backend. A integração é 100% client-side via `fetch()` para a API do Azure Inference — que é a mesma API que serve os modelos disponíveis no [GitHub Marketplace de Modelos](https://github.com/marketplace/models).

---

## Provider e Endpoint

| Campo         | Valor                                                              |
|---------------|--------------------------------------------------------------------|
| **Provider**  | GitHub Models (powered by Azure AI)                                |
| **Endpoint**  | `https://models.inference.ai.azure.com/chat/completions`          |
| **Protocolo** | OpenAI-compatible (JSON REST)                                      |
| **Custo**     | Gratuito com limites de rate (via GitHub account)                 |

---

## Autenticação

A autenticação é feita com um **Personal Access Token (PAT) do GitHub**:

```http
Authorization: Bearer <GITHUB_PAT>
Content-Type: application/json
```

### Como obter o token

1. Acesse [github.com](https://github.com) → **Settings**
2. Vá em **Developer settings** → **Personal access tokens** → **Fine-grained tokens** (ou Classic)
3. Clique em **Generate new token**
4. Selecione scope: pode ser sem nenhum escopo específico para uso com GitHub Models
5. Copie o token gerado (começa com `github_pat_...`)

### Onde o token é armazenado

O token é persistido no `localStorage` do navegador:

```js
// Salvar
localStorage.setItem('cofelma_gh_token', 'github_pat_...');

// Ler
const ghToken = localStorage.getItem('cofelma_gh_token') || '';
```

> **Atenção de segurança:** O token fica exposto no localStorage e pode ser lido por qualquer script da mesma origem. Nunca use tokens com permissões amplas. Para uso em dashboard interno (intranet/local), o risco é aceitável.

---

## Modelos Disponíveis

| Modelo         | Quando usar                                           |
|----------------|-------------------------------------------------------|
| `gpt-4o-mini`  | Padrão. Maior rate limit, resposta rápida, gratuito  |
| `gpt-4o`       | Análises mais longas e detalhadas                    |
| `o4-mini`      | Raciocínio estruturado e tarefas lógicas complexas   |

O modelo selecionado pelo usuário também fica no `localStorage`:

```js
const ghModel = localStorage.getItem('cofelma_gh_model') || 'gpt-4o-mini';
```

---

## Estrutura da Requisição (fetch)

```js
const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ghToken}`
  },
  body: JSON.stringify({
    model: ghModel,              // 'gpt-4o-mini' | 'gpt-4o' | 'o4-mini'
    messages: [
      { role: 'user', content: prompt }
    ],
    max_completion_tokens: 8000  // ajuste por use case
  })
});

if (!resp.ok) {
  const err = await resp.json().catch(() => ({}));
  throw new Error(err.error?.message || `HTTP ${resp.status}`);
}

const result = await resp.json();
const content = result.choices[0].message.content.trim();
```

---

## Parâmetros Usados por Caso de Uso

| Use Case                     | `max_completion_tokens` | Notas                                         |
|------------------------------|-------------------------|-----------------------------------------------|
| Recomendações estratégicas   | `8000`                  | Retorna JSON array `[{title, text}]`          |
| Follow-up / Chat             | `1500`                  | Sempre usa `gpt-4o-mini` para maior rate limit|
| Análise completa de mercado  | `8000`                  | Retorna JSON objeto `{}`                      |

> **Nota:** `temperature` não foi necessário especificar — o padrão da API é suficiente para outputs estruturados.

---

## Padrão de Saída — JSON Estruturado

Para garantir saídas previsíveis, o prompt instrui o modelo a retornar **JSON puro dentro do texto**. A extração é feita via regex:

```js
// Para array (recomendações):
const match = content.match(/\[[\s\S]*\]/);
if (!match) throw new Error('Resposta não contém array JSON.');
const recs = JSON.parse(match[0]);

// Para objeto (análise completa):
const jsonMatch = content.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('Resposta da IA não contém JSON válido.');
const data = JSON.parse(jsonMatch[0]);
```

---

## Cache das Respostas

Para evitar chamadas repetidas à API (rate limits + UX), as respostas são cacheadas no `localStorage`:

```js
const cacheKey = 'cofelma_recs_cache';
const dataFingerprint = currentFileName + '_' + updatedAt.toISOString() + '_v2';

// Verificar cache antes de chamar a API
const cacheRaw = localStorage.getItem(cacheKey);
if (cacheRaw) {
  const cache = JSON.parse(cacheRaw);
  if (cache.fingerprint === dataFingerprint && cache.html) {
    container.innerHTML = cache.html;
    return; // não chama a API
  }
}

// Após a chamada bem-sucedida, salvar cache
localStorage.setItem(cacheKey, JSON.stringify({
  fingerprint: dataFingerprint,
  html: generatedHtml,
  timestamp: Date.now()
}));
```

### Chaves de cache usadas

| Chave                         | Conteúdo                          |
|-------------------------------|-----------------------------------|
| `cofelma_recs_cache`          | HTML das recomendações estratégicas |
| `cofelma_full_analysis_cache` | HTML da análise completa de mercado |

---

## Use Cases Implementados

### 1. Recomendações Estratégicas 2026
- **Onde:** Guia Oportunidades → Projeções
- **Prompt:** Dados da tabela de subfamílias (receita, CAGR, crescimento, meta vs. realizado) + clientes com redução
- **Output:** Array JSON `[{ title: string, text: string }]` → renderizado como lista de cards
- **Feature:** Cada recomendação tem botão "Aprofundar" que abre chat contextual

### 2. Follow-up / Chat Contextual
- **Onde:** Dentro de cada card de recomendação
- **Prompt:** Contexto da recomendação + pergunta do usuário + dados de subfamílias e clientes Diamante/Ouro
- **Output:** Texto livre em markdown → `answer.replace(/\n/g,'<br>')`
- **Modelo:** Sempre `gpt-4o-mini` (maior rate limit para interatividade)

### 3. Análise Completa de Inteligência de Mercado
- **Onde:** Guia "Análise IA"
- **Prompt:** Dados selecionados pelo usuário (commodities, oportunidades, impactos, faturamento histórico, compras)
- **Output:** JSON objeto com seções de análise → renderizado como relatório formatado
- **Feature:** Caixa de seleção de fontes de dados antes de gerar

---

## Exemplo Mínimo Reutilizável

```html
<!DOCTYPE html>
<html>
<body>
  <button onclick="callAI()">Gerar Análise</button>
  <pre id="output"></pre>

  <script>
    async function callAI() {
      const ghToken = localStorage.getItem('my_gh_token');
      if (!ghToken) {
        alert('Configure o token: localStorage.setItem("my_gh_token", "github_pat_...")');
        return;
      }

      const prompt = `Analise os seguintes dados e gere 3 recomendações em JSON:
[{"title": "...", "text": "..."}]

Dados: receita 2025 = R$ 12Mi, crescimento = +8%, principal produto = Implementos Agrícolas.`;

      try {
        const resp = await fetch('https://models.inference.ai.azure.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ghToken}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 2000
          })
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const result = await resp.json();
        const content = result.choices[0].message.content.trim();

        // Extrai JSON da resposta
        const match = content.match(/\[[\s\S]*\]/);
        const recs = JSON.parse(match[0]);

        document.getElementById('output').textContent = JSON.stringify(recs, null, 2);
      } catch(e) {
        document.getElementById('output').textContent = 'Erro: ' + e.message;
      }
    }
  </script>
</body>
</html>
```

---

## Rate Limits (GitHub Models — Free Tier)

Os limites são por **modelo** e por **conta GitHub**:

| Modelo        | Requests/min | Tokens/dia (aprox.) |
|---------------|--------------|----------------------|
| `gpt-4o-mini` | ~15          | ~150.000             |
| `gpt-4o`      | ~8           | ~80.000              |
| `o4-mini`     | ~8           | ~80.000              |

> Para limites atualizados, consulte [github.com/marketplace/models](https://github.com/marketplace/models) e clique no modelo desejado.

---

## Referências

- [GitHub Models — Documentação oficial](https://docs.github.com/en/github-models)
- [GitHub Marketplace de Modelos](https://github.com/marketplace/models)
- [Azure AI Inference API (formato OpenAI-compatible)](https://learn.microsoft.com/azure/ai-studio/reference/reference-model-inference-chat-completions)
