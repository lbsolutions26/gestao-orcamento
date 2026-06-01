// ==========================================
// WEBHOOK DO TELEGRAM — GESTÃO DE ORÇAMENTO
// Recebe comandos e mensagens do usuário
// ==========================================
// Configurar webhook (executar 1 vez):
// https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://gestao-orcamento-sigma.vercel.app/api/telegram-webhook
// ==========================================

const { createClient } = require('@supabase/supabase-js');

const AI_API_URL = 'https://models.inference.ai.azure.com/chat/completions';
const AI_MODEL = 'gpt-4o-mini';

module.exports = async function handler(req, res) {
  // Telegram envia POST. GET serve só para teste.
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Webhook ativo. Envie comandos via Telegram.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    console.error('Variáveis de ambiente faltando');
    return res.status(200).json({ ok: true }); // sempre 200 para o Telegram não reenviar
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const update = req.body || {};

  try {
    // 1) Mensagem de texto / comando
    if (update.message) {
      await handleMessage(update.message, supabase, botToken);
    }
    // 2) Clique em botão inline
    else if (update.callback_query) {
      await handleCallback(update.callback_query, supabase, botToken);
    }
  } catch (err) {
    console.error('Erro no webhook:', err);
  }

  // Telegram exige resposta 200 rápida
  return res.status(200).json({ ok: true });
};

// ==========================================
// HANDLERS
// ==========================================

async function handleMessage(message, supabase, botToken) {
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();

  if (!text) return;

  // Identifica usuário pelo telegram_chat_id
  const user = await findUserByChatId(supabase, chatId);
  if (!user) {
    return sendMessage(botToken, chatId,
      '⚠️ Seu Telegram não está vinculado a nenhuma conta.\n\n' +
      'Acesse o app, vá em *Perfil* e cadastre seu chat ID:\n' +
      `\`${chatId}\``,
      { parse_mode: 'Markdown' }
    );
  }

  // Roteamento de comandos
  const lower = text.toLowerCase();

  if (lower === '/start' || lower === '/menu' || lower === 'menu') {
    return sendMenu(botToken, chatId, user);
  }
  if (lower === '/saldo' || lower === 'saldo') {
    return responderSaldo(botToken, chatId, supabase, user);
  }
  if (lower === '/mes' || lower === 'mes' || lower === 'mês') {
    return responderResumoMes(botToken, chatId, supabase, user);
  }
  if (lower === '/pendentes' || lower === 'pendentes') {
    return responderPendentes(botToken, chatId, supabase, user);
  }
  if (lower === '/atrasadas' || lower === 'atrasadas') {
    return responderAtrasadas(botToken, chatId, supabase, user);
  }
  if (lower === '/ajuda' || lower === '/help' || lower === 'ajuda') {
    return sendAjuda(botToken, chatId);
  }
  // /despesa 50 Almoço no shopping
  if (lower.startsWith('/despesa') || lower.startsWith('/d ')) {
    return sugerirTransacao(botToken, chatId, supabase, user, text, 'expense');
  }
  // /receita 3000 Salário
  if (lower.startsWith('/receita') || lower.startsWith('/r ')) {
    return sugerirTransacao(botToken, chatId, supabase, user, text, 'income');
  }

  // Heurística: texto curto com valor monetário → tratar como lançamento
  // Ex.: "Mercadinho 39,90", "39,90 mercado", "Uber 25"
  const intencao = detectarIntencaoLancamento(text);
  if (intencao) {
    const textoComCmd = `/${intencao.tipo === 'expense' ? 'despesa' : 'receita'} ${intencao.valor} ${intencao.descricao}`.trim();
    return sugerirTransacao(botToken, chatId, supabase, user, textoComCmd, intencao.tipo);
  }

  // Texto livre → IA
  return responderComIA(botToken, chatId, supabase, user, text);
}

// Detecta se um texto livre parece um lançamento de transação.
// Retorna { tipo, valor, descricao } ou null.
function detectarIntencaoLancamento(text) {
  const t = text.trim();
  if (!t || t.startsWith('/')) return null;

  // No máximo 8 palavras — perguntas tendem a ser maiores
  const palavras = t.split(/\s+/);
  if (palavras.length > 8) return null;

  // Procura um número monetário (50 | 50,90 | 1.234,56 | R$ 50)
  const matchValor = t.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!matchValor) return null;
  const valor = parseValorMonetario(matchValor[1]);
  if (!valor || valor <= 0) return null;

  // Remove o trecho do valor (incluindo "R$") e usa o resto como descrição
  const descricao = t
    .replace(matchValor[0], ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!descricao) return null;

  // Palavras que sugerem pergunta → não tratar como lançamento
  const lower = t.toLowerCase();
  const padraoPergunta = /[?]|^(qua[lnt]|quem|como|onde|por que|porque|quando|me (mostre|diga|fale)|liste|resumo|saldo|gastei|gasto|gastou|recebi|sobrou|sobra|previs|tend[êe]nc|comp(are|aração))/;
  if (padraoPergunta.test(lower)) return null;

  // Heurística de tipo: "recebi", "salário", "entrou" → receita; demais → despesa
  const padraoReceita = /\b(recebi|sal[áa]rio|sal[áa]rios|entrou|cr[ée]dito|recebimento|prov[êe]nto|pix recebido)\b/i;
  const tipo = padraoReceita.test(lower) ? 'income' : 'expense';

  return { tipo, valor, descricao };
}

async function handleCallback(callback, supabase, botToken) {
  const chatId = String(callback.message.chat.id);
  const data = callback.data || '';

  const user = await findUserByChatId(supabase, chatId);
  if (!user) return;

  // Responder ao callback para o Telegram tirar o "loading" do botão
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callback.id })
  });

  // Callbacks novos baseados em estado: act:<id>:<verbo>
  // verbos: paid | pend | swapS | swapC | cancel
  if (data.startsWith('act:')) {
    const partes = data.split(':');
    const pid = partes[1];
    const verbo = partes[2];
    const pending = await carregarPendente(supabase, pid);
    if (!pending) {
      return sendMessage(botToken, chatId, '⌛ Esta confirmação expirou. Envie o lançamento novamente.');
    }

    if (verbo === 'cancel') {
      await removerPendente(supabase, pid);
      return sendMessage(botToken, chatId, '❌ Cancelado.');
    }
    if (verbo === 'swapS') {
      pending.payload.supplier.usar = pending.payload.supplier.usar === 'cadastrado' ? 'novo' : 'cadastrado';
      await atualizarPendente(supabase, pid, pending.payload);
      return reenviarCardConfirmacao(botToken, chatId, supabase, user, pid, pending.payload);
    }
    if (verbo === 'swapC') {
      pending.payload.categoria.usar = pending.payload.categoria.usar === 'cadastrado' ? 'novo' : 'cadastrado';
      await atualizarPendente(supabase, pid, pending.payload);
      return reenviarCardConfirmacao(botToken, chatId, supabase, user, pid, pending.payload);
    }
    if (verbo === 'paid' || verbo === 'pend') {
      await removerPendente(supabase, pid);
      return confirmarTransacao(botToken, chatId, supabase, user, pending.payload, verbo === 'pend' ? 'pending' : 'paid');
    }
  }

  if (data === 'cancel') {
    return sendMessage(botToken, chatId, '❌ Cancelado.');
  }

  switch (data) {
    case 'saldo': return responderSaldo(botToken, chatId, supabase, user);
    case 'mes': return responderResumoMes(botToken, chatId, supabase, user);
    case 'pendentes': return responderPendentes(botToken, chatId, supabase, user);
    case 'atrasadas': return responderAtrasadas(botToken, chatId, supabase, user);
    case 'ajuda': return sendAjuda(botToken, chatId);
    case 'menu': return sendMenu(botToken, chatId, user);
  }
}

// ==========================================
// COMANDOS
// ==========================================

async function sendMenu(botToken, chatId, user) {
  const nome = user.name || user.email.split('@')[0];
  const texto =
    `🏦 *Gestão de Orçamento*\n` +
    `Olá, *${nome}*! O que você quer ver?\n\n` +
    `💡 Você também pode digitar perguntas livres que eu uso a IA para responder.`;

  const teclado = {
    inline_keyboard: [
      [
        { text: '💰 Saldo', callback_data: 'saldo' },
        { text: '📊 Mês', callback_data: 'mes' }
      ],
      [
        { text: '⏳ Pendentes', callback_data: 'pendentes' },
        { text: '⚠️ Atrasadas', callback_data: 'atrasadas' }
      ],
      [
        { text: '❓ Ajuda', callback_data: 'ajuda' }
      ]
    ]
  };

  return sendMessage(botToken, chatId, texto, {
    parse_mode: 'Markdown',
    reply_markup: teclado
  });
}

async function sendAjuda(botToken, chatId) {
  const texto =
`📖 *Comandos disponíveis:*

/menu — botões interativos
/saldo — saldo atual
/mes — resumo do mês
/pendentes — despesas a pagar
/atrasadas — contas em atraso

💸 *Adicionar transações:*
/despesa 50 Almoço no shopping
/despesa 1924 Tieda - Pensão  _(Fornecedor - Descrição)_
/receita 3000 Salário

Após o comando, escolha:
✅ Paga  |  📅 Pendente  |  ❌ Cancelar

🤖 *Perguntas livres:*
Digite qualquer pergunta que a IA responde com base nos seus dados.
Ex: _"Quanto gastei com mercado este mês?"_`;

  return sendMessage(botToken, chatId, texto, { parse_mode: 'Markdown' });
}

async function responderSaldo(botToken, chatId, supabase, user) {
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  const { data: todas } = await supabase
    .from('transactions')
    .select('amount, type, affects_balance')
    .eq(filtro.col, filtro.val);

  const lista = todas || [];
  const receitas = lista.filter(t => t.type === 'income' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const despesas = lista.filter(t => t.type === 'expense' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const saldo = receitas - despesas;

  const texto =
    `💰 *Saldo Atual:* ${saldo >= 0 ? '✅' : '🔴'} *R$ ${fmt(saldo)}*\n\n` +
    `• Receitas totais: R$ ${fmt(receitas)}\n` +
    `• Despesas totais: R$ ${fmt(despesas)}`;

  return sendMessage(botToken, chatId, texto, { parse_mode: 'Markdown' });
}

async function responderResumoMes(botToken, chatId, supabase, user) {
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  const now = new Date();
  const mesInicio = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const hoje = now.toISOString().split('T')[0];

  const { data } = await supabase
    .from('transactions')
    .select('amount, type, category, status, affects_balance')
    .eq(filtro.col, filtro.val)
    .gte('date', mesInicio)
    .lte('date', hoje);

  const lista = data || [];
  const receitas = lista.filter(t => t.type === 'income' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const despesas = lista.filter(t => t.type === 'expense' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const pendentes = lista.filter(t => t.type === 'expense' && t.status === 'pending' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Categoria com maior gasto
  const gastosPorCat = {};
  lista.filter(t => t.type === 'expense').forEach(t => {
    gastosPorCat[t.category] = (gastosPorCat[t.category] || 0) + parseFloat(t.amount || 0);
  });
  const maior = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1])[0];

  const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  let texto =
    `📊 *Resumo de ${mesNome}:*\n\n` +
    `• Receitas: R$ ${fmt(receitas)}\n` +
    `• Despesas: R$ ${fmt(despesas)}\n` +
    `• Saldo do mês: ${(receitas - despesas) >= 0 ? '✅' : '🔴'} *R$ ${fmt(receitas - despesas)}*\n`;
  if (pendentes > 0) texto += `• ⏳ Pendentes: R$ ${fmt(pendentes)}\n`;
  if (maior) texto += `• 🏷 Maior gasto: ${maior[0]} (R$ ${fmt(maior[1])})\n`;

  return sendMessage(botToken, chatId, texto, { parse_mode: 'Markdown' });
}

async function responderPendentes(botToken, chatId, supabase, user) {
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  const { data } = await supabase
    .from('transactions')
    .select('description, amount, due_date, date')
    .eq(filtro.col, filtro.val)
    .eq('type', 'expense')
    .eq('status', 'pending')
    .order('due_date', { ascending: true })
    .limit(20);

  const lista = data || [];
  if (lista.length === 0) {
    return sendMessage(botToken, chatId, '✅ Nenhuma despesa pendente!');
  }

  const total = lista.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  let texto = `⏳ *Despesas Pendentes (${lista.length}):*\n\n`;
  lista.forEach(t => {
    const data = t.due_date || t.date || '-';
    texto += `• ${t.description} _(${data})_: R$ ${fmt(parseFloat(t.amount))}\n`;
  });
  texto += `\n💰 *Total: R$ ${fmt(total)}*`;

  return sendMessage(botToken, chatId, texto, { parse_mode: 'Markdown' });
}

async function responderAtrasadas(botToken, chatId, supabase, user) {
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };
  const hoje = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('transactions')
    .select('description, amount, due_date, date')
    .eq(filtro.col, filtro.val)
    .eq('type', 'expense')
    .eq('status', 'pending')
    .lt('due_date', hoje)
    .order('due_date', { ascending: true });

  const lista = data || [];
  if (lista.length === 0) {
    return sendMessage(botToken, chatId, '✅ Nenhuma despesa atrasada!');
  }

  const total = lista.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  let texto = `⚠️ *Despesas Atrasadas (${lista.length}):*\n\n`;
  lista.forEach(t => {
    texto += `• ${t.description} _(${t.due_date})_: *R$ ${fmt(parseFloat(t.amount))}*\n`;
  });
  texto += `\n💰 *Total atrasado: R$ ${fmt(total)}*`;

  return sendMessage(botToken, chatId, texto, { parse_mode: 'Markdown' });
}

// ==========================================
// SUGERIR TRANSAÇÃO COM IA (com confirmação)
// /despesa 50 Almoço no shopping
// /receita 3000 Salário maio
// ==========================================
async function sugerirTransacao(botToken, chatId, supabase, user, text, tipo) {
  const aiToken = process.env.GITHUB_AI_TOKEN;
  
  // Remove comando inicial
  const semCmd = text.replace(/^\/(despesa|receita|d|r)\s+/i, '').trim();

  // Extrair valor e descrição (formato flexível)
  let valor = null;
  let restoInput = semCmd;
  
  const matchValor = semCmd.match(/^([\d.,]+)\s+(.+)$/);
  if (matchValor) {
    valor = parseValorMonetario(matchValor[1]);
    restoInput = matchValor[2].trim();
  }

  // Atalho: "Fornecedor - Descrição" separados por hífen
  let fornecedorInput = '';
  let descricaoInput = restoInput;
  const matchHifen = restoInput.match(/^([^-]+?)\s+-\s+(.+)$/);
  if (matchHifen) {
    fornecedorInput = matchHifen[1].trim();
    descricaoInput = matchHifen[2].trim();
  }

  if (!restoInput) {
    return sendMessage(botToken, chatId,
      `❌ Formato inválido.\n\nUse:\n\`/${tipo === 'expense' ? 'despesa' : 'receita'} <valor> <descrição>\`\n\nEx: \`/${tipo === 'expense' ? 'despesa' : 'receita'} 50 Almoço\`\nOu: \`/${tipo === 'expense' ? 'despesa' : 'receita'} 1924 Tieda - Pensão\``,
      { parse_mode: 'Markdown' }
    );
  }

  // Buscar transações similares no histórico
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  // Carregar cadastros (fonte de verdade)
  const cadastros = await carregarCadastros(supabase, familyId, tipo);

  const { data: historico } = await supabase
    .from('transactions')
    .select('description, amount, category, payment_method, supplier, type')
    .eq(filtro.col, filtro.val)
    .eq('type', tipo)
    .order('date', { ascending: false })
    .limit(100);

  const lista = historico || [];

  // Se tem IA, usar para sugerir
  let sugestao = null;
  if (aiToken && (lista.length > 0 || cadastros.categorias.length > 0)) {
    // Buscar transações com descrição/fornecedor similar
    const alvoTexto = `${fornecedorInput} ${descricaoInput}`.toLowerCase().trim();
    const similares = lista.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const sup = (t.supplier || '').toLowerCase();
      if (fornecedorInput && sup && (sup.includes(fornecedorInput.toLowerCase()) || fornecedorInput.toLowerCase().includes(sup))) return true;
      if (descricaoInput && desc) {
        if (desc.includes(descricaoInput.toLowerCase())) return true;
        if (descricaoInput.toLowerCase().includes(desc.split(' ')[0])) return true;
      }
      if (alvoTexto && (desc.includes(alvoTexto.split(' ')[0]) || sup.includes(alvoTexto.split(' ')[0]))) return true;
      return false;
    }).slice(0, 10);

    {
      const prompt = `Analisar lançamento financeiro e sugerir melhorias.

ENTRADA DO USUÁRIO:
Tipo: ${tipo === 'expense' ? 'Despesa' : 'Receita'}
Valor informado: ${valor ? `R$ ${fmt(valor)}` : 'NÃO INFORMADO'}
Fornecedor informado: ${fornecedorInput || '(não informado — deduzir do histórico)'}
Descrição: "${descricaoInput}"

CADASTROS DISPONÍVEIS (USE EXATAMENTE ESTES NOMES):
- ${tipo === 'expense' ? 'Fornecedores' : 'Clientes'}: ${cadastros.contatos.join(', ') || '(nenhum)'}
- Categorias: ${cadastros.categorias.join(', ') || '(nenhuma)'}
- Métodos de pagamento: ${cadastros.metodos.join(', ') || '(nenhum)'}

HISTÓRICO DE TRANSAÇÕES SIMILARES (${similares.length}):
${similares.map(t => `- [${t.supplier || '-'}] ${t.description || '(sem descrição)'}: R$ ${fmt(parseFloat(t.amount))} | Categoria: ${t.category} | Método: ${t.payment_method || 'Conta Corrente'}`).join('\n') || '(nenhum similar)'}

TAREFA:
Responda APENAS JSON puro (sem markdown):
{
  "fornecedor_sugerido": "nome do fornecedor/cliente (use cadastro se existir similar) ou string vazia",
  "descricao_sugerida": "descrição curta e clara (pode ser vazia se redundante com fornecedor)",
  "valor_sugerido": número (se não informado, use o mais comum do histórico para esse fornecedor/descrição),
  "categoria": "categoria EXATA do cadastro ou 'Outros'",
  "metodo_pagamento": "método EXATO do cadastro ou 'Conta Corrente'",
  "observacao": "texto curto explicando deduções OU null"
}

Regras:
- Se a descrição contém um nome próprio (ex: "Tieda", "Mercado Atacadão"), trate como fornecedor.
- Prefira nomes EXATOS dos cadastros existentes (case-sensitive).
- Descrição é opcional; se o fornecedor já diz tudo, deixe vazia.`;

      try {
        const resp = await fetch(AI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiToken}`
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            max_completion_tokens: 300
          })
        });

        if (resp.ok) {
          const json = await resp.json();
          const respText = json.choices?.[0]?.message?.content?.trim();
          if (respText) {
            // Extrair JSON (pode vir com ```json ou sem)
            const jsonMatch = respText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              sugestao = JSON.parse(jsonMatch[0]);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao consultar IA:', err);
      }
    }
  }

  // Aplicar sugestões ou usar defaults
  const fornecedorFinal = (sugestao?.fornecedor_sugerido || fornecedorInput || '').trim();
  const descricaoFinal = (sugestao?.descricao_sugerida ?? descricaoInput ?? '').trim();
  const valorFinal = valor || sugestao?.valor_sugerido || null;
  const categoriaFinal = (sugestao?.categoria || 'Outros').trim();
  const metodoFinal = (sugestao?.metodo_pagamento || 'Conta Corrente').trim();
  const obs = sugestao?.observacao;

  if (!valorFinal || valorFinal <= 0) {
    return sendMessage(botToken, chatId, '❌ Valor não informado ou inválido. Use:\n`/despesa 50 Descrição`', { parse_mode: 'Markdown' });
  }
  if (!fornecedorFinal && !descricaoFinal) {
    return sendMessage(botToken, chatId, '❌ Informe um fornecedor ou descrição.', { parse_mode: 'Markdown' });
  }

  // Lookup nos cadastros (case-insensitive + similaridade)
  const lookupSup = resolverCadastro(fornecedorFinal, cadastros.contatos);
  const lookupCat = resolverCadastro(categoriaFinal, cadastros.categorias);
  const lookupMet = resolverCadastro(metodoFinal, cadastros.metodos);

  const hojeISO = new Date().toISOString().split('T')[0];

  const payload = {
    tipo,
    valor: valorFinal,
    descricao: descricaoFinal,
    data: hojeISO,
    obs: obs || null,
    supplier: {
      input: fornecedorFinal,
      match: lookupSup.match,
      cadastrado: lookupSup.cadastrado,
      usar: lookupSup.match === 'none' ? 'novo' : 'cadastrado'
    },
    categoria: {
      input: categoriaFinal,
      match: lookupCat.match,
      cadastrado: lookupCat.cadastrado,
      usar: lookupCat.match === 'none' ? 'novo' : 'cadastrado'
    },
    metodo: {
      input: metodoFinal,
      match: lookupMet.match,
      cadastrado: lookupMet.cadastrado,
      // método não tem swap; se ambíguo, usa cadastrado direto
      usar: lookupMet.match === 'none' ? 'novo' : 'cadastrado'
    }
  };

  // Salva estado pendente (id curto para callback)
  const pid = await salvarPendente(supabase, chatId, user.id, familyId, payload);
  if (!pid) {
    return sendMessage(botToken, chatId, '❌ Erro ao preparar confirmação. Tente novamente.');
  }

  return reenviarCardConfirmacao(botToken, chatId, supabase, user, pid, payload);
}

// ==========================================
// CARD DE CONFIRMAÇÃO (usa estado em telegram_pending)
// ==========================================
function nomeFinalCampo(campo) {
  if (campo.usar === 'cadastrado' && campo.cadastrado) return campo.cadastrado;
  return campo.input;
}

async function reenviarCardConfirmacao(botToken, chatId, supabase, user, pid, payload) {
  const tipo = payload.tipo;
  const emoji = tipo === 'expense' ? '💸' : '💵';
  const label = tipo === 'expense' ? 'Despesa' : 'Receita';
  const supLabel = tipo === 'expense' ? 'Fornecedor' : 'Cliente';
  const hojeBR = new Date().toLocaleDateString('pt-BR');

  const supNome = nomeFinalCampo(payload.supplier);
  const catNome = nomeFinalCampo(payload.categoria);
  const metNome = nomeFinalCampo(payload.metodo);

  const supMark = marcadorCampo(payload.supplier);
  const catMark = marcadorCampo(payload.categoria);
  const metMark = marcadorCampo(payload.metodo);

  let mensagem = `${emoji} *Confirmar ${label}?*\n\n`;
  if (supNome) mensagem += `• ${supLabel}: ${supNome} ${supMark}\n`;
  if (payload.descricao) mensagem += `• Descrição: ${payload.descricao}\n`;
  mensagem += `• Valor: *R$ ${fmt(payload.valor)}*\n`;
  mensagem += `• Categoria: ${catNome} ${catMark}\n`;
  mensagem += `• Data: ${hojeBR}\n`;
  mensagem += `• Método: ${metNome} ${metMark}\n`;

  // Avisos / observações
  const avisos = [];
  if (payload.supplier.match === 'similar') {
    const alt = payload.supplier.usar === 'cadastrado' ? payload.supplier.input : payload.supplier.cadastrado;
    avisos.push(`💡 ${supLabel} "${payload.supplier.input}" parece com "${payload.supplier.cadastrado}" (cadastrado). Use 🔄 abaixo para alternar para "${alt}".`);
  } else if (payload.supplier.match === 'none' && supNome) {
    avisos.push(`🆕 ${supLabel} *${supNome}* será criado ao confirmar.`);
  }
  if (payload.categoria.match === 'similar') {
    const altC = payload.categoria.usar === 'cadastrado' ? payload.categoria.input : payload.categoria.cadastrado;
    avisos.push(`💡 Categoria "${payload.categoria.input}" parece com "${payload.categoria.cadastrado}". Use 🔄 para alternar para "${altC}".`);
  } else if (payload.categoria.match === 'none' && catNome && catNome !== 'Outros') {
    avisos.push(`🆕 Categoria *${catNome}* será criada ao confirmar.`);
  }
  if (payload.obs) avisos.push(`ℹ️ ${payload.obs}`);
  if (avisos.length) mensagem += `\n` + avisos.join('\n');

  // Botões
  const linhas = [];
  if (tipo === 'expense') {
    linhas.push([
      { text: '✅ Paga', callback_data: `act:${pid}:paid` },
      { text: '📅 Pendente', callback_data: `act:${pid}:pend` }
    ]);
  } else {
    linhas.push([
      { text: '✅ Confirmar', callback_data: `act:${pid}:paid` }
    ]);
  }
  if (payload.supplier.match === 'similar') {
    const alt = payload.supplier.usar === 'cadastrado' ? payload.supplier.input : payload.supplier.cadastrado;
    linhas.push([{ text: `🔄 Usar "${alt}"`, callback_data: `act:${pid}:swapS` }]);
  }
  if (payload.categoria.match === 'similar') {
    const altC = payload.categoria.usar === 'cadastrado' ? payload.categoria.input : payload.categoria.cadastrado;
    linhas.push([{ text: `🔄 Categoria: "${altC}"`, callback_data: `act:${pid}:swapC` }]);
  }
  linhas.push([{ text: '❌ Cancelar', callback_data: `act:${pid}:cancel` }]);

  return sendMessage(botToken, chatId, mensagem, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: linhas }
  });
}

function marcadorCampo(campo) {
  if (!campo || !campo.input) return '';
  if (campo.match === 'exact') return '✅';
  if (campo.match === 'similar') return campo.usar === 'cadastrado' ? '✅' : '🆕';
  return '🆕';
}

// Carrega cadastros (fonte de verdade) para uma família
async function carregarCadastros(supabase, familyId, tipo) {
  const vazio = { contatos: [], categorias: [], metodos: [] };
  if (!familyId) return vazio;
  try {
    const kind = tipo === 'expense' ? 'supplier' : 'client';
    const [ct, cat, pm] = await Promise.all([
      supabase.from('contacts').select('name').eq('family_id', familyId).eq('kind', kind).limit(200),
      supabase.from('categories').select('name').eq('family_id', familyId).eq('type', tipo).limit(200),
      supabase.from('payment_methods').select('name').eq('family_id', familyId).limit(100)
    ]);
    return {
      contatos: (ct.data || []).map(r => r.name),
      categorias: (cat.data || []).map(r => r.name),
      metodos: (pm.data || []).map(r => r.name)
    };
  } catch (err) {
    console.error('Erro ao carregar cadastros:', err);
    return vazio;
  }
}

// Cria cadastro se não existir (lookup case-insensitive antes do insert).
// Recebe nomes JÁ finais (cadastrado ou novo). Só insere quando realmente novo.
async function garantirCadastro(supabase, familyId, tipo, { supplier, category, payment_method }) {
  if (!familyId) return;
  const tasks = [];
  if (supplier && supplier.trim()) {
    const kind = tipo === 'expense' ? 'supplier' : 'client';
    tasks.push((async () => {
      const { data: existe } = await supabase
        .from('contacts')
        .select('id')
        .eq('family_id', familyId)
        .eq('kind', kind)
        .ilike('name', supplier.trim())
        .maybeSingle();
      if (!existe) {
        await supabase.from('contacts').insert({ family_id: familyId, name: supplier.trim(), kind });
      }
    })());
  }
  if (category && category.trim() && category.trim().toLowerCase() !== 'outros') {
    tasks.push((async () => {
      const { data: existe } = await supabase
        .from('categories')
        .select('id')
        .eq('family_id', familyId)
        .eq('type', tipo)
        .ilike('name', category.trim())
        .maybeSingle();
      if (!existe) {
        await supabase.from('categories').insert({ family_id: familyId, name: category.trim(), type: tipo });
      }
    })());
  }
  if (payment_method && payment_method.trim()) {
    tasks.push((async () => {
      const { data: existe } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('family_id', familyId)
        .ilike('name', payment_method.trim())
        .maybeSingle();
      if (!existe) {
        await supabase.from('payment_methods').insert({ family_id: familyId, name: payment_method.trim() });
      }
    })());
  }
  await Promise.all(tasks.map(p => p.then(() => {}).catch(() => {})));
}

async function confirmarTransacao(botToken, chatId, supabase, user, payload, status) {
  const { familyId } = await getUserScope(supabase, user.id);
  const hoje = new Date().toISOString().split('T')[0];

  const tipo = payload.tipo;
  const supplierFinal = nomeFinalCampo(payload.supplier).trim() || null;
  const categoriaFinal = nomeFinalCampo(payload.categoria).trim() || 'Outros';
  const metodoFinal = nomeFinalCampo(payload.metodo).trim() || 'Conta Corrente';
  const descricaoFinal = (payload.descricao || '').trim() || null;

  const row = {
    user_id: user.id,
    type: tipo,
    description: descricaoFinal,
    supplier: supplierFinal,
    amount: payload.valor,
    category: categoriaFinal,
    date: hoje,
    due_date: hoje,
    payment_method: metodoFinal,
    affects_balance: true,
    status,
    payment_date: status === 'paid' ? hoje : null
  };
  if (familyId) row.family_id = familyId;

  const { error } = await supabase.from('transactions').insert(row);

  if (error) {
    console.error('Erro ao inserir:', error);
    return sendMessage(botToken, chatId, `❌ Erro ao salvar: ${error.message}`);
  }

  // Auto-cadastrar fornecedor/categoria/método APENAS quando realmente novo
  garantirCadastro(supabase, familyId, tipo, {
    supplier: payload.supplier.usar === 'novo' ? supplierFinal : null,
    category: payload.categoria.usar === 'novo' ? categoriaFinal : null,
    payment_method: payload.metodo.usar === 'novo' ? metodoFinal : null
  }).catch(() => {});

  const emoji = tipo === 'expense' ? '💸' : '💵';
  const statusLabel = status === 'pending' ? ' (pendente)' : '';
  const titulo = tipo === 'expense' ? `Despesa${statusLabel}` : `Receita${statusLabel}`;
  let resposta = `✅ ${emoji} *${titulo} registrada!*\n\n`;
  if (supplierFinal) resposta += `• ${tipo === 'expense' ? 'Fornecedor' : 'Cliente'}: ${supplierFinal}\n`;
  if (descricaoFinal) resposta += `• Descrição: ${descricaoFinal}\n`;
  resposta += `• R$ ${fmt(payload.valor)}\n• ${categoriaFinal}`;
  return sendMessage(botToken, chatId, resposta, { parse_mode: 'Markdown' });
}

// ==========================================
// ADICIONAR TRANSAÇÃO (FUNÇÃO ANTIGA - não usada)
// /despesa 50 Almoço no shopping
// /receita 3000 Salário maio
// ==========================================
async function adicionarTransacao(botToken, chatId, supabase, user, text, tipo) {
  // Remove comando inicial
  const semCmd = text.replace(/^\/(despesa|receita|d|r)\s+/i, '').trim();

  // Primeira "palavra" deve ser o valor (aceita 50, 50.50, 50,50)
  const match = semCmd.match(/^([\d.,]+)\s+(.+)$/);
  if (!match) {
    return sendMessage(botToken, chatId,
      `❌ Formato inválido.\n\nUse:\n\`/${tipo === 'expense' ? 'despesa' : 'receita'} <valor> <descrição>\`\n\nEx: \`/${tipo === 'expense' ? 'despesa' : 'receita'} 50 Almoço\``,
      { parse_mode: 'Markdown' }
    );
  }

  const valor = parseValorMonetario(match[1]);
  const descricao = match[2].trim();

  if (!valor || valor <= 0) {
    return sendMessage(botToken, chatId, '❌ Valor inválido.');
  }

  const { familyId } = await getUserScope(supabase, user.id);
  const hoje = new Date().toISOString().split('T')[0];

  const categoria = tipo === 'expense' ? 'Outros' : 'Outros';

  const payload = {
    user_id: user.id,
    type: tipo,
    description: descricao,
    amount: valor,
    category: categoria,
    date: hoje,
    due_date: hoje,
    payment_method: 'Conta Corrente',
    affects_balance: true,
    status: tipo === 'expense' ? 'paid' : 'paid',
    payment_date: hoje
  };
  if (familyId) payload.family_id = familyId;

  const { error } = await supabase.from('transactions').insert(payload);

  if (error) {
    console.error('Erro ao inserir:', error);
    return sendMessage(botToken, chatId, `❌ Erro ao salvar: ${error.message}`);
  }

  const emoji = tipo === 'expense' ? '💸' : '💵';
  const label = tipo === 'expense' ? 'Despesa' : 'Receita';
  return sendMessage(botToken, chatId,
    `✅ ${emoji} *${label} adicionada:*\n\n` +
    `• ${descricao}\n` +
    `• R$ ${fmt(valor)}\n` +
    `• ${hoje}\n\n` +
    `_Categoria: Outros (edite no app se precisar)_`,
    { parse_mode: 'Markdown' }
  );
}

// ==========================================
// IA — Resposta a perguntas livres
// ==========================================
async function responderComIA(botToken, chatId, supabase, user, pergunta) {
  const token = process.env.GITHUB_AI_TOKEN;
  if (!token) {
    return sendMessage(botToken, chatId,
      '🤖 IA não configurada.\n\nDigite /menu para ver os comandos disponíveis.'
    );
  }

  // Sinaliza que está digitando
  fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  }).catch(() => {});

  // Monta contexto financeiro
  const contexto = await montarContextoFinanceiro(supabase, user);

  const systemPrompt = `Você é um assistente financeiro pessoal via Telegram.
Responda em português, de forma clara e prática. Use formatação Markdown simples (negrito com *texto*).
Valores em R$ com 2 casas. Use bullets quando listar itens.

⚠️ IMPORTANTE — VOCÊ NÃO PODE REGISTRAR, EDITAR NEM EXCLUIR TRANSAÇÕES.
Você é APENAS um analista que lê os dados. NUNCA diga frases como
"despesa registrada", "adicionei", "atualizei seu saldo", "novo saldo".
Se o usuário quiser lançar algo, oriente-o a usar o comando:
  /despesa <valor> <descrição>     ex.: /despesa 39,90 Mercadinho
  /receita <valor> <descrição>     ex.: /receita 3000 Salário
Após o comando, ele deve confirmar nos botões ✅ Paga / 📅 Pendente.

Você tem acesso ao HISTÓRICO COMPLETO de transações do usuário (somente leitura):
- Últimos 6 meses detalhados
- Todas as categorias de gastos
- Top 10 maiores despesas
- Tendências e padrões

DADOS FINANCEIROS DO USUÁRIO:
${contexto}

Use esses dados para dar respostas completas e insights úteis. Quando relevante, compare períodos, aponte tendências e dê recomendações — mas sempre lembrando que você apenas LÊ os dados, não os altera.`;

  try {
    const resp = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: pergunta }
        ],
        max_completion_tokens: 1500
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Erro IA:', errText);
      return sendMessage(botToken, chatId, '⚠️ Não consegui consultar a IA agora. Tente /menu para comandos rápidos.');
    }

    const json = await resp.json();
    const resposta = json.choices?.[0]?.message?.content?.trim();
    if (!resposta) {
      return sendMessage(botToken, chatId, '⚠️ Resposta vazia da IA.');
    }

    return sendMessage(botToken, chatId, resposta, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Erro ao chamar IA:', err);
    return sendMessage(botToken, chatId, '⚠️ Erro ao consultar a IA.');
  }
}

async function montarContextoFinanceiro(supabase, user) {
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  const now = new Date();
  const mesInicio = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const hoje = now.toISOString().split('T')[0];

  // BUSCAR TODAS AS TRANSAÇÕES (histórico completo)
  const { data: todas } = await supabase
    .from('transactions')
    .select('description, amount, type, category, status, due_date, date, affects_balance, payment_method')
    .eq(filtro.col, filtro.val)
    .order('date', { ascending: false })
    .limit(500); // limite de segurança

  const todasList = todas || [];
  
  // Saldo total
  const recTotal = todasList.filter(t => t.type === 'income' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const despTotal = todasList.filter(t => t.type === 'expense' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Mês atual
  const mesList = todasList.filter(t => t.date >= mesInicio && t.date <= hoje);
  const recMes = mesList.filter(t => t.type === 'income' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const despMes = mesList.filter(t => t.type === 'expense' && t.affects_balance !== false)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Despesas por categoria (TODO O HISTÓRICO)
  const porCatTotal = {};
  todasList.filter(t => t.type === 'expense').forEach(t => {
    porCatTotal[t.category] = (porCatTotal[t.category] || 0) + parseFloat(t.amount || 0);
  });
  const catTotalLinhas = Object.entries(porCatTotal)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c, v]) => `  - ${c}: R$ ${fmt(v)}`)
    .join('\n');

  // Despesas por categoria (mês atual)
  const porCatMes = {};
  mesList.filter(t => t.type === 'expense').forEach(t => {
    porCatMes[t.category] = (porCatMes[t.category] || 0) + parseFloat(t.amount || 0);
  });
  const catMesLinhas = Object.entries(porCatMes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c, v]) => `  - ${c}: R$ ${fmt(v)}`)
    .join('\n');

  // Últimos 6 meses (resumo)
  const mesesAnteriores = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const inicio = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const txMes = todasList.filter(t => t.date >= inicio && t.date <= fim);
    const rec = txMes.filter(t => t.type === 'income' && t.affects_balance !== false)
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const desp = txMes.filter(t => t.type === 'expense' && t.affects_balance !== false)
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    
    const mesNomeHistorico = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    mesesAnteriores.push(`  ${mesNomeHistorico}: Rec R$ ${fmt(rec)} | Desp R$ ${fmt(desp)} | Saldo R$ ${fmt(rec - desp)}`);
  }

  // Pendentes
  const pendentes = todasList.filter(t => 
    t.type === 'expense' && 
    t.status === 'pending' && 
    t.affects_balance !== false
  );
  const pendLinhas = pendentes.slice(0, 20)
    .map(t => `  - ${t.description} (${t.due_date || t.date}): R$ ${fmt(parseFloat(t.amount))}`)
    .join('\n');

  // Top 10 maiores despesas (histórico)
  const maioresDespesas = todasList
    .filter(t => t.type === 'expense')
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
    .slice(0, 10)
    .map(t => `  - ${t.description} (${t.date}): R$ ${fmt(parseFloat(t.amount))}`)
    .join('\n');

  const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const totalTx = todasList.length;

  return `
SALDO ATUAL: R$ ${fmt(recTotal - despTotal)}
Total de transações registradas: ${totalTx}
Receitas acumuladas: R$ ${fmt(recTotal)} | Despesas acumuladas: R$ ${fmt(despTotal)}

═══════════════════════════════════
MÊS ATUAL (${mesNome}):
═══════════════════════════════════
• Receitas: R$ ${fmt(recMes)}
• Despesas: R$ ${fmt(despMes)}
• Saldo do mês: R$ ${fmt(recMes - despMes)}

Despesas por categoria (mês):
${catMesLinhas || '  (nenhuma)'}

═══════════════════════════════════
HISTÓRICO (últimos 6 meses):
═══════════════════════════════════
${mesesAnteriores.join('\n')}

═══════════════════════════════════
DESPESAS POR CATEGORIA (TODO PERÍODO):
═══════════════════════════════════
${catTotalLinhas || '  (nenhuma)'}

═══════════════════════════════════
TOP 10 MAIORES DESPESAS (histórico):
═══════════════════════════════════
${maioresDespesas || '  (nenhuma)'}

═══════════════════════════════════
PENDENTES (${pendentes.length}):
═══════════════════════════════════
${pendLinhas || '  (nenhuma)'}
`.trim();
}

// ==========================================
// HELPERS
// ==========================================

async function findUserByChatId(supabase, chatId) {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, telegram_chat_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  return data;
}

async function getUserScope(supabase, userId) {
  const { data } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle();
  return { familyId: data?.family_id || null };
}

async function sendMessage(botToken, chatId, text, extra = {}) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('Erro Telegram:', err);
    }
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
  }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Parse robusto de valores monetários (suporta formatos BR e US)
function parseValorMonetario(str) {
  if (!str) return null;
  const s = String(str).trim();
  
  // Remove espaços, R$, etc
  const limpo = s.replace(/[R$\s]/g, '');
  
  // Caso 1: tem vírgula → assume formato BR (1.234,56 ou 59,9)
  if (limpo.includes(',')) {
    const semPontos = limpo.replace(/\./g, ''); // remove separadores de milhares
    const comPonto = semPontos.replace(',', '.'); // vírgula vira ponto decimal
    const val = parseFloat(comPonto);
    return isFinite(val) ? val : null;
  }
  
  // Caso 2: só tem ponto(s) → pode ser decimal OU separador de milhares
  if (limpo.includes('.')) {
    const partes = limpo.split('.');
    
    // Se último grupo tem 1 ou 2 dígitos → é decimal (ex: 59.9, 59.90)
    if (partes[partes.length - 1].length <= 2) {
      const val = parseFloat(limpo);
      return isFinite(val) ? val : null;
    }
    
    // Se último grupo tem 3 dígitos mas há só 1 ponto → ambíguo, assume decimal
    // Ex: 1.234 pode ser mil e duzentos OU um vírgula duzentos e trinta e quatro
    // Decisão: se valor < 10 assume decimal, senão assume milhares
    if (partes.length === 2 && partes[1].length === 3) {
      const asDecimal = parseFloat(limpo);
      // Se o número inteiro é pequeno (< 10), provavelmente é decimal
      if (parseInt(partes[0]) < 10) {
        return isFinite(asDecimal) ? asDecimal : null;
      }
      // Senão, assume separador de milhares
      const semPontos = limpo.replace(/\./g, '');
      const val = parseFloat(semPontos);
      return isFinite(val) ? val : null;
    }
    
    // Múltiplos pontos → separador de milhares (ex: 1.234.567)
    const semPontos = limpo.replace(/\./g, '');
    const val = parseFloat(semPontos);
    return isFinite(val) ? val : null;
  }
  
  // Caso 3: só dígitos → parse direto
  const val = parseFloat(limpo);
  return isFinite(val) ? val : null;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// ==========================================
// LOOKUP DE CADASTROS + SIMILARIDADE
// ==========================================

const SIM_THRESHOLD = 0.75;

function normalizarNome(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de Levenshtein
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const linha = new Array(n + 1);
  for (let j = 0; j <= n; j++) linha[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = linha[0];
    linha[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = linha[j];
      linha[j] = a[i - 1] === b[j - 1]
        ? prev
        : Math.min(prev, linha[j], linha[j - 1]) + 1;
      prev = tmp;
    }
  }
  return linha[n];
}

function similaridade(a, b) {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const maxLen = Math.max(x.length, y.length);
  return 1 - levenshtein(x, y) / maxLen;
}

// Resolve um nome digitado contra a lista de cadastros.
// Retorna { match: 'exact'|'similar'|'none', cadastrado: <nome cadastrado>|null }
function resolverCadastro(nomeDigitado, listaCadastrados) {
  if (!nomeDigitado || !Array.isArray(listaCadastrados) || listaCadastrados.length === 0) {
    return { match: 'none', cadastrado: null };
  }
  const alvo = normalizarNome(nomeDigitado);

  // 1) exato (case/acento-insensitive)
  for (const c of listaCadastrados) {
    if (normalizarNome(c) === alvo) {
      return { match: 'exact', cadastrado: c };
    }
  }
  // 2) similar (acima do threshold) — escolhe o mais próximo
  let melhor = null;
  let melhorScore = 0;
  for (const c of listaCadastrados) {
    const s = similaridade(nomeDigitado, c);
    if (s > melhorScore) {
      melhorScore = s;
      melhor = c;
    }
  }
  if (melhor && melhorScore >= SIM_THRESHOLD) {
    return { match: 'similar', cadastrado: melhor };
  }
  return { match: 'none', cadastrado: null };
}

// ==========================================
// ESTADO PENDENTE (tabela telegram_pending)
// ==========================================

function gerarPid() {
  // 10 chars base36 (~52 bits) — suficiente
  return Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 7);
}

async function salvarPendente(supabase, chatId, userId, familyId, payload) {
  const pid = gerarPid();
  const { error } = await supabase.from('telegram_pending').insert({
    id: pid,
    chat_id: String(chatId),
    user_id: userId,
    family_id: familyId || null,
    payload
  });
  if (error) {
    console.error('Erro ao salvar pendente:', error);
    return null;
  }
  // limpeza oportunista de registros antigos (> 1 dia)
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  supabase.from('telegram_pending').delete().lt('created_at', ontem).then(() => {}).catch(() => {});
  return pid;
}

async function carregarPendente(supabase, pid) {
  if (!pid) return null;
  const { data, error } = await supabase
    .from('telegram_pending')
    .select('id, payload')
    .eq('id', pid)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function atualizarPendente(supabase, pid, payload) {
  const { error } = await supabase
    .from('telegram_pending')
    .update({ payload })
    .eq('id', pid);
  if (error) console.error('Erro ao atualizar pendente:', error);
}

async function removerPendente(supabase, pid) {
  await supabase.from('telegram_pending').delete().eq('id', pid);
}
