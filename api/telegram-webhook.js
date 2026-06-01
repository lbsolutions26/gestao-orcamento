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

  // Texto livre → IA
  return responderComIA(botToken, chatId, supabase, user, text);
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

  // Callbacks de transação confirmada
  if (data.startsWith('tx:')) {
    const encoded = data.replace('tx:', '');
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      // Formato: tipo|valor|cat|metodo|desc
      const partes = decoded.split('|');
      if (partes.length >= 5) {
        const txData = {
          t: partes[0] === 'e' ? 'expense' : 'income',
          a: parseFloat(partes[1]),
          c: partes[2],
          p: partes[3],
          d: partes.slice(4).join('|') // descrição pode ter | internamente
        };
        return confirmarTransacao(botToken, chatId, supabase, user, txData);
      }
    } catch (err) {
      console.error('Erro ao decodificar transação:', err);
      return sendMessage(botToken, chatId, '❌ Erro ao processar confirmação.');
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
/receita 3000 Salário

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
  let descricaoInput = semCmd;
  
  const matchValor = semCmd.match(/^([\d.,]+)\s+(.+)$/);
  if (matchValor) {
    const valorStr = matchValor[1].replace(/\./g, '').replace(',', '.');
    valor = parseFloat(valorStr);
    descricaoInput = matchValor[2].trim();
  }

  if (!descricaoInput) {
    return sendMessage(botToken, chatId,
      `❌ Formato inválido.\n\nUse:\n\`/${tipo === 'expense' ? 'despesa' : 'receita'} <valor> <descrição>\`\n\nEx: \`/${tipo === 'expense' ? 'despesa' : 'receita'} 50 Almoço\``,
      { parse_mode: 'Markdown' }
    );
  }

  // Buscar transações similares no histórico
  const { familyId } = await getUserScope(supabase, user.id);
  const filtro = familyId ? { col: 'family_id', val: familyId } : { col: 'user_id', val: user.id };

  const { data: historico } = await supabase
    .from('transactions')
    .select('description, amount, category, payment_method, type')
    .eq(filtro.col, filtro.val)
    .eq('type', tipo)
    .order('date', { ascending: false })
    .limit(100);

  const lista = historico || [];

  // Se tem IA, usar para sugerir
  let sugestao = null;
  if (aiToken && lista.length > 0) {
    // Buscar transações com descrição similar
    const similares = lista.filter(t => 
      t.description.toLowerCase().includes(descricaoInput.toLowerCase()) ||
      descricaoInput.toLowerCase().includes(t.description.toLowerCase().split(' ')[0])
    ).slice(0, 10);

    if (similares.length > 0) {
      const prompt = `Analisar lançamento financeiro e sugerir melhorias.

ENTRADA DO USUÁRIO:
Tipo: ${tipo === 'expense' ? 'Despesa' : 'Receita'}
Valor informado: ${valor ? `R$ ${fmt(valor)}` : 'NÃO INFORMADO'}
Descrição: "${descricaoInput}"

HISTÓRICO DE TRANSAÇÕES SIMILARES (${similares.length}):
${similares.map(t => `- ${t.description}: R$ ${fmt(parseFloat(t.amount))} | Categoria: ${t.category} | Método: ${t.payment_method || 'Conta Corrente'}`).join('\n')}

TAREFA:
Com base no histórico, responda em formato JSON puro (sem markdown):
{
  "descricao_sugerida": "descrição completa e consistente com histórico",
  "valor_sugerido": número (se não informado, use o mais comum do histórico),
  "categoria": "categoria do histórico ou 'Outros'",
  "metodo_pagamento": "método mais usado no histórico ou 'Conta Corrente'",
  "observacao": "texto curto explicando sugestões OU null se input está perfeito"
}

Exemplo de observacao: "Geralmente essa despesa é de R$ 850,00" ou "Categoria sugerida: Pensão (baseado em histórico)" ou null`;

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
  const descricaoFinal = sugestao?.descricao_sugerida || descricaoInput;
  const valorFinal = valor || sugestao?.valor_sugerido || null;
  const categoriaFinal = sugestao?.categoria || 'Outros';
  const metodoFinal = sugestao?.metodo_pagamento || 'Conta Corrente';
  const obs = sugestao?.observacao;

  if (!valorFinal || valorFinal <= 0) {
    return sendMessage(botToken, chatId, '❌ Valor não informado ou inválido. Use:\n`/despesa 50 Descrição`', { parse_mode: 'Markdown' });
  }

  // Montar mensagem de confirmação
  const emoji = tipo === 'expense' ? '💸' : '💵';
  const label = tipo === 'expense' ? 'Despesa' : 'Receita';
  const hoje = new Date().toLocaleDateString('pt-BR');
  
  let mensagem = `${emoji} *Confirmar ${label}?*\n\n`;
  mensagem += `• Descrição: ${descricaoFinal}\n`;
  mensagem += `• Valor: *R$ ${fmt(valorFinal)}*\n`;
  mensagem += `• Categoria: ${categoriaFinal}\n`;
  mensagem += `• Data: ${hoje}\n`;
  mensagem += `• Método: ${metodoFinal}\n`;
  
  if (obs) {
    mensagem += `\n💡 ${obs}`;
  }

  // Codificar dados para o callback (compacto para limite de 64 bytes)
  // Formato: tipo|valor|cat|metodo|desc (truncar desc se necessário)
  let descCompacta = descricaoFinal.substring(0, 20); // limitar
  const compacto = `${tipo === 'expense' ? 'e' : 'r'}|${valorFinal}|${categoriaFinal.substring(0,10)}|${metodoFinal.substring(0,10)}|${descCompacta}`;
  const encoded = Buffer.from(compacto).toString('base64');
  
  const callbackData = `tx:${encoded}`;
  
  // Se ainda assim passar de 64, salvar direto
  if (callbackData.length > 64) {
    const txData = { t: tipo, d: descricaoFinal, a: valorFinal, c: categoriaFinal, p: metodoFinal };
    return confirmarTransacao(botToken, chatId, supabase, user, txData);
  }

  const teclado = {
    inline_keyboard: [
      [
        { text: '✅ Confirmar', callback_data: callbackData },
        { text: '❌ Cancelar', callback_data: 'cancel' }
      ]
    ]
  };

  return sendMessage(botToken, chatId, mensagem, {
    parse_mode: 'Markdown',
    reply_markup: teclado
  });
}

async function confirmarTransacao(botToken, chatId, supabase, user, txData) {
  const { familyId } = await getUserScope(supabase, user.id);
  const hoje = new Date().toISOString().split('T')[0];

  const tipo = txData.t;
  const payload = {
    user_id: user.id,
    type: tipo,
    description: txData.d,
    amount: txData.a,
    category: txData.c,
    date: hoje,
    due_date: hoje,
    payment_method: txData.p,
    affects_balance: true,
    status: 'paid',
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
    `✅ ${emoji} *${label} registrada!*\n\n` +
    `• ${txData.d}\n` +
    `• R$ ${fmt(txData.a)}\n` +
    `• ${txData.c}`,
    { parse_mode: 'Markdown' }
  );
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

  const valorStr = match[1].replace(/\./g, '').replace(',', '.');
  const valor = parseFloat(valorStr);
  const descricao = match[2].trim();

  if (isNaN(valor) || valor <= 0) {
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

Você tem acesso ao HISTÓRICO COMPLETO de transações do usuário, incluindo:
- Últimos 6 meses detalhados
- Todas as categorias de gastos
- Top 10 maiores despesas
- Tendências e padrões

DADOS FINANCEIROS DO USUÁRIO:
${contexto}

Use esses dados para dar respostas completas e insights úteis. Quando relevante, compare períodos, aponte tendências e dê recomendações.`;

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

function pad(n) {
  return String(n).padStart(2, '0');
}
