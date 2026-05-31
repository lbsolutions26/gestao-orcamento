// ==========================================
// NOTIFICAÇÕES TELEGRAM - GESTÃO DE ORÇAMENTO
// Vercel Serverless Function
// Chamada via Cron Job: 7:00 e 12:30 (BRT)
// ==========================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Só aceita GET (chamada pelo cron) ou POST (teste manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificação de segurança: Vercel passa CRON_SECRET automaticamente
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validar variáveis de ambiente obrigatórias
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !serviceRoleKey || !botToken) {
    return res.status(500).json({
      error: 'Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN'
    });
  }

  // Cliente Supabase com service role (bypassa RLS para ler dados de todos usuários)
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const today = new Date().toISOString().split('T')[0];

  // Buscar todos usuários com telegram_chat_id cadastrado
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)
    .neq('telegram_chat_id', '');

  if (usersError) {
    console.error('Erro ao buscar usuários:', usersError);
    return res.status(500).json({ error: usersError.message });
  }

  if (!users || users.length === 0) {
    return res.status(200).json({ message: 'Nenhum usuário com Telegram cadastrado', sent: 0 });
  }

  const results = [];

  // Datas do mês atual
  const now = new Date();
  const mesInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const proximosSete = new Date(now);
  proximosSete.setDate(proximosSete.getDate() + 7);
  const seteDate = proximosSete.toISOString().split('T')[0];

  for (const user of users) {
    try {
      // Verificar se o usuário pertence a uma família
      const { data: familyMember } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const familyId = familyMember?.family_id;

      // Query 1: TODAS as transações (para saldo total)
      const queryTodas = familyId
        ? supabase.from('transactions').select('amount, type, affects_balance').eq('family_id', familyId)
        : supabase.from('transactions').select('amount, type, affects_balance').eq('user_id', user.id);

      // Query 2: Transações do mês atual (para resumo mensal)
      const queryMes = familyId
        ? supabase.from('transactions').select('description, amount, due_date, date, category, type, status, affects_balance').eq('family_id', familyId).gte('date', mesInicio).lte('date', today)
        : supabase.from('transactions').select('description, amount, due_date, date, category, type, status, affects_balance').eq('user_id', user.id).gte('date', mesInicio).lte('date', today);

      // Query 3: Próximas despesas (7 dias)
      const queryProximas = familyId
        ? supabase.from('transactions').select('description, amount, due_date, date, category').eq('family_id', familyId).eq('type', 'expense').eq('status', 'pending').lte('due_date', seteDate).order('due_date', { ascending: true })
        : supabase.from('transactions').select('description, amount, due_date, date, category').eq('user_id', user.id).eq('type', 'expense').eq('status', 'pending').lte('due_date', seteDate).order('due_date', { ascending: true });

      const { data: todasTransacoes, error: txAllError } = await queryTodas;
      const { data: todasMes, error: txError } = await queryMes;
      const { data: proximasDespesas } = await queryProximas;

      if (txAllError || txError) {
        console.error(`Erro ao buscar transações de ${user.email}:`, txAllError || txError);
        results.push({ user: user.email, ok: false, error: (txAllError || txError).message });
        continue;
      }

      const todas = todasTransacoes || [];
      const mes = todasMes || [];

      // SALDO ATUAL: Calcular com TODAS as transações (de todos os tempos)
      const totalReceitasGeral = todas
        .filter(t => t.type === 'income' && t.affects_balance !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const totalDespesasGeral = todas
        .filter(t => t.type === 'expense' && t.affects_balance !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const saldoAtual = totalReceitasGeral - totalDespesasGeral;

      // RESUMO DO MÊS: Calcular apenas transações do mês atual
      const totalReceitas = mes
        .filter(t => t.type === 'income' && t.affects_balance !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      const totalDespesas = mes
        .filter(t => t.type === 'expense' && t.affects_balance !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      
      // Calcular pendentes do mês separadamente
      const despesasPendentes = mes
        .filter(t => t.type === 'expense' && t.status === 'pending' && t.affects_balance !== false)
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      // Categoria com maior gasto
      const gastosPorCategoria = {};
      mes.filter(t => t.type === 'expense').forEach(t => {
        gastosPorCategoria[t.category] = (gastosPorCategoria[t.category] || 0) + parseFloat(t.amount || 0);
      });
      const maiorCategoria = Object.entries(gastosPorCategoria).sort((a, b) => b[1] - a[1])[0];

      // Despesas pendentes (vencidas ou vencem hoje)
      const todasPendentes = proximasDespesas || [];
      const pendentes = todasPendentes.filter(t => {
        const dataReferencia = t.due_date || t.date;
        return dataReferencia && dataReferencia <= today;
      });

      const vencidas = pendentes.filter(t => (t.due_date || t.date) < today);
      const vencem_hoje = pendentes.filter(t => (t.due_date || t.date) === today);

      // Próximas (vencem nos próximos 7 dias, excluindo hoje e vencidas)
      const proximas = todasPendentes.filter(t => {
        const dataRef = t.due_date || t.date;
        return dataRef && dataRef > today && dataRef <= seteDate;
      });

      const totalPendente = pendentes.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const nomeUsuario = user.name || user.email.split('@')[0];

      // Montar mensagem
      const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      let mensagem = `🏦 *Gestão de Orçamento*\n`;
      mensagem += `Olá, *${nomeUsuario}*! Resumo de ${mesNome}:\n\n`;

      // Saldo Atual (todas as transações)
      mensagem += `💰 *Saldo Atual: ${saldoAtual >= 0 ? '✅' : '🔴'} R$ ${saldoAtual.toFixed(2)}*\n\n`;

      // Resumo financeiro do mês
      mensagem += `📊 *Resumo do mês:*\n`;
      mensagem += `• Receitas: R$ ${totalReceitas.toFixed(2)}\n`;
      mensagem += `• Despesas: R$ ${totalDespesas.toFixed(2)}\n`;
      if (despesasPendentes > 0) {
        mensagem += `• ⏳ Pendentes: R$ ${despesasPendentes.toFixed(2)}\n`;
      }
      if (maiorCategoria) {
        mensagem += `• Maior gasto: ${maiorCategoria[0]} (R$ ${maiorCategoria[1].toFixed(2)})\n`;
      }
      mensagem += '\n';

      // Vencem hoje
      if (vencem_hoje.length > 0) {
        mensagem += `📅 *Vencem HOJE:*\n`;
        vencem_hoje.forEach(t => {
          mensagem += `• ${t.description}: *R$ ${parseFloat(t.amount).toFixed(2)}*\n`;
        });
        mensagem += '\n';
      }

      // Em atraso
      if (vencidas.length > 0) {
        mensagem += `⚠️ *Em atraso:*\n`;
        vencidas.forEach(t => {
          const dataRef = t.due_date || t.date;
          mensagem += `• ${t.description} _(${dataRef})_: *R$ ${parseFloat(t.amount).toFixed(2)}*\n`;
        });
        mensagem += '\n';
      }

      // Próximas a vencer
      if (proximas.length > 0) {
        mensagem += `🗓 *Próximas a vencer (7 dias):*\n`;
        proximas.forEach(t => {
          const dataRef = t.due_date || t.date;
          mensagem += `• ${t.description} _(${dataRef})_: R$ ${parseFloat(t.amount).toFixed(2)}\n`;
        });
        mensagem += '\n';
      }

      if (pendentes.length > 0) {
        mensagem += `💰 *Total pendente/atrasado: R$ ${totalPendente.toFixed(2)}*\n\n`;
      } else if (proximas.length === 0) {
        mensagem += `✅ *Nenhuma pendência para hoje!*\n\n`;
      }

      mensagem += `👉 Acesse o app para marcar como pago.`;

      // Enviar via Telegram
      const telegramRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegram_chat_id,
            text: mensagem,
            parse_mode: 'Markdown'
          })
        }
      );

      const telegramData = await telegramRes.json();

      results.push({
        user: user.email,
        ok: telegramData.ok,
        pendentes: pendentes.length,
        proximas: proximas.length,
        totalPendente: totalPendente.toFixed(2),
        saldo: saldo.toFixed(2),
        telegram_error: telegramData.ok ? undefined : telegramData
      });

    } catch (err) {
      console.error(`Erro ao processar ${user.email}:`, err);
      results.push({ user: user.email, ok: false, error: err.message });
    }
  }

  return res.status(200).json({
    date: today,
    usersProcessed: users.length,
    sent: results.filter(r => r.ok).length,
    results
  });
};
