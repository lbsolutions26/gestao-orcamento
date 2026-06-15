// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uftjltanaiqvdatekroc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GoZlDUtla1khO1uUnQ3nRA_z6u1f-Xa';

// Inicializar Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CONFIGURAÇÃO DA IA (GITHUB MODELS - AZURE AI)
// ==========================================
const AI_API_URL = 'https://models.inference.ai.azure.com/chat/completions';
const AI_MODEL = 'gpt-4o-mini'; // ou 'gpt-4o' para análises mais profundas
const AI_TOKEN_KEY = 'gestao_orcamento_gh_token';
const AI_TOKEN_DEFAULT = ''; // Configure seu token nas configurações do app

// Funções para gerenciar o token
function getGitHubToken() {
    return localStorage.getItem(AI_TOKEN_KEY) || AI_TOKEN_DEFAULT;
}

function setGitHubToken(token) {
    localStorage.setItem(AI_TOKEN_KEY, token.trim());
}

function hasGitHubToken() {
    const token = getGitHubToken();
    return token.length > 0 && (token.startsWith('github_pat_') || token.startsWith('ghp_') || token.startsWith('gho_'));
}

// ==========================================
// ESTADO DA APLICAÇÃO
// ==========================================
let currentUser = null;
let currentFamilyId = null;
let currentFamily = null;
let transactions = [];
let editingTransaction = null; // Armazena transação sendo editada
let currentAttachmentUrl = null; // URL do anexo atual durante edição
let categories = {
    income: ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Outros'],
    expense: ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Educação', 'Outros']
};

// Elementos da tela de cadastro do usuário
const userProfile = {
    form: document.getElementById('user-profile-form'),
    email: document.getElementById('user-email'),
    telegramId: document.getElementById('user-telegram-id'),
    success: document.getElementById('user-profile-success'),
    error: document.getElementById('user-profile-error')
};

// ==========================================
// ELEMENTOS DO DOM
// ==========================================
const screens = {
    loading: document.getElementById('loading-screen'),
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-screen')
};

const auth = {
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    registerName: document.getElementById('register-name'),
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    loginError: document.getElementById('login-error'),
    registerError: document.getElementById('register-error'),
    tabs: document.querySelectorAll('.tab-btn')
};

const app = {
    balanceTotal: document.getElementById('balance-total'),
    balanceIncome: document.getElementById('balance-income'),
    balanceExpense: document.getElementById('balance-expense'),
    balancePending: document.getElementById('balance-pending'),
    balanceOverdue: document.getElementById('balance-overdue'),
    balanceCredit: document.getElementById('balance-credit'),
    pendingCount: document.getElementById('pending-count'),
    overdueCount: document.getElementById('overdue-count'),
    creditCount: document.getElementById('credit-count'),
    searchInput: document.getElementById('search-input'),
    filterMonth: document.getElementById('filter-month'),
    filterYear: document.getElementById('filter-year'),
    transactionsList: document.getElementById('transactions-list'),
    addIncomeBtn: document.getElementById('add-income-btn'),
    addExpenseBtn: document.getElementById('add-expense-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    installBtn: document.getElementById('install-btn'),
    modal: document.getElementById('transaction-modal'),
    modalTitle: document.getElementById('modal-title'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    transactionForm: document.getElementById('transaction-form'),
    transactionType: document.getElementById('transaction-type'),
    transactionDescription: document.getElementById('transaction-description'),
    transactionSupplier: document.getElementById('transaction-supplier'),
    transactionAmount: document.getElementById('transaction-amount'),
    transactionCategory: document.getElementById('transaction-category'),
    transactionDate: document.getElementById('transaction-date'),
    transactionDueDate: document.getElementById('transaction-due-date'),
    transactionPaymentMethod: document.getElementById('transaction-payment-method'),
    transactionStatus: document.getElementById('transaction-status'),
    transactionAffectsBalance: document.getElementById('transaction-affects-balance'),
    transactionBillReference: document.getElementById('transaction-bill-reference'),
    transactionNotes: document.getElementById('transaction-notes'),
    transactionAttachment: document.getElementById('transaction-attachment'),
    currentAttachment: document.getElementById('current-attachment'),
    currentAttachmentName: document.getElementById('current-attachment-name'),
    removeAttachment: document.getElementById('remove-attachment'),
    creditCardFields: document.getElementById('credit-card-fields'),
    billReferenceField: document.getElementById('bill-reference-field'),
    // Card Details Modal
    cardDetailsModal: document.getElementById('card-details-modal'),
    cardDetailsTitle: document.getElementById('card-details-title'),
    cardDetailsList: document.getElementById('card-details-list'),
    closeDetailsModal: document.getElementById('close-details-modal'),
    cardIncome: document.getElementById('card-income'),
    cardExpense: document.getElementById('card-expense'),
    cardPending: document.getElementById('card-pending'),
    cardOverdue: document.getElementById('card-overdue'),
    cardCredit: document.getElementById('card-credit'),
    // Menu e Navegação
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.getElementById('sidebar'),
    sidebarClose: document.getElementById('sidebar-close'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    screens: document.querySelectorAll('.screen'),
    menuItems: document.querySelectorAll('.menu-item[data-screen]'),
    // Gestor Financeiro (IA)
    financialQuestionForm: document.getElementById('financial-question-form'),
    financialQuestionInput: document.getElementById('financial-question-input'),
    financialChatMessages: document.getElementById('financial-chat-messages'),
    financialSuggestionButtons: document.querySelectorAll('.ai-suggestion-btn'),
    financialClearChatBtn: document.getElementById('financial-clear-chat'),
    configAITokenBtn: document.getElementById('config-ai-token-btn')
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    registerServiceWorker();
});

// Variável para controlar se já está inicializado
let isInitializing = false;
let isInitialized = false;

async function initializeApp() {
    // Evitar inicializações múltiplas simultâneas
    if (isInitializing) {
        console.log('⏸️ Inicialização já em andamento - aguardando...');
        return;
    }
    
    if (isInitialized) {
        console.log('✅ App já inicializado - pulando');
        return;
    }
    
    isInitializing = true;
    console.log('🚀 Iniciando aplicação...');
    
    // Timeout de segurança - força remover loading após 15 segundos
    const safetyTimeout = setTimeout(async () => {
        console.warn('⚠️ TIMEOUT DE SEGURANÇA: Forçando remoção do loading');
        screens.loading.classList.add('hidden');
        
        try {
            const sessionResult = await supabaseClient.auth.getSession();
            if (sessionResult?.data?.session) {
                screens.app.classList.remove('hidden');
            } else {
                screens.login.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Erro no timeout:', err);
            screens.login.classList.remove('hidden');
        }
        isInitializing = false;
    }, 15000);
    
    try {
        console.log('🔐 Verificando sessão...');
        
        // Verificar sessão existente com validação adequada
        const sessionResult = await supabaseClient.auth.getSession();
        
        if (!sessionResult || !sessionResult.data) {
            console.error('❌ Resposta inválida do Supabase:', sessionResult);
            clearTimeout(safetyTimeout);
            isInitializing = false;
            showScreen('login');
            return;
        }
        
        const session = sessionResult.data.session;
        
        if (session) {
            console.log('✅ Sessão encontrada');
            currentUser = session.user;
            
            // Tentar carregar do cache PRIMEIRO para mostrar o app rapidamente
            const hasCache = loadUserDataFromCache();
            
            if (hasCache) {
                console.log('⚡ Mostrando app com dados do cache');
                clearTimeout(safetyTimeout);
                isInitialized = true;
                isInitializing = false;
                showScreen('app');
                applyScreenFromHash();
                
                // Atualizar dados em background (sem bloquear a UI)
                console.log('🔄 Atualizando dados em background...');
                loadUserData().then(() => {
                    console.log('✅ Dados atualizados em background');
                }).catch(err => {
                    console.warn('⚠️ Erro ao atualizar em background (usando cache):', err);
                });
            } else {
                console.log('📊 Sem cache - carregando dados...');
                await loadUserData();
                console.log('✅ Dados carregados');
                clearTimeout(safetyTimeout);
                isInitialized = true;
                isInitializing = false;
                showScreen('app');
                applyScreenFromHash();
            }
        } else {
            console.log('ℹ️ Sem sessão - mostrando login');
            clearTimeout(safetyTimeout);
            isInitializing = false;
            showScreen('login');
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar:', error);
        console.error('Stack:', error.stack);
        clearTimeout(safetyTimeout);
        isInitializing = false;
        showScreen('login');
    }
}

function showScreen(screenName) {
    screens.loading.classList.add('hidden');
    screens.login.classList.add('hidden');
    screens.app.classList.add('hidden');
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
}

// Carregar dados do usuário no formulário de cadastro
async function loadUserProfileForm() {
    if (!currentUser) return;
    if (userProfile.email) userProfile.email.value = currentUser.email || '';
    if (userProfile.success) userProfile.success.style.display = 'none';
    if (userProfile.error) userProfile.error.style.display = 'none';
    // Buscar Telegram ID do Supabase
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('telegram_chat_id')
            .eq('id', currentUser.id)
            .single();
        if (error) throw error;
        if (userProfile.telegramId) userProfile.telegramId.value = data?.telegram_chat_id || '';
    } catch (err) {
        if (userProfile.telegramId) userProfile.telegramId.value = '';
    }
}

// Salvar Telegram ID
async function handleUserProfileSubmit(e) {
    e.preventDefault();
    if (userProfile.success) userProfile.success.style.display = 'none';
    if (userProfile.error) userProfile.error.style.display = 'none';
    const telegramId = userProfile.telegramId.value.trim();
    try {
        // upsert: cria ou atualiza o registro do usuário
        const { error } = await supabaseClient
            .from('users')
            .upsert({
                id: currentUser.id,
                email: currentUser.email,
                telegram_chat_id: telegramId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
        if (error) throw error;
        if (userProfile.success) userProfile.success.style.display = 'block';
        if (userProfile.error) userProfile.error.style.display = 'none';
    } catch (err) {
        if (userProfile.success) userProfile.success.style.display = 'none';
        if (userProfile.error) {
            userProfile.error.textContent = 'Erro ao salvar: ' + (err.message || '');
            userProfile.error.style.display = 'block';
        }
    }
}

// ==========================================
// SERVICE WORKER
// ==========================================
// DESABILITAR E LIMPAR SERVICE WORKER
// ==========================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Desregistrar TODOS os service workers existentes
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
                console.log('🗑️ Service Worker desregistrado');
            }
            
            // Limpar TODOS os caches
            const cacheNames = await caches.keys();
            for (let cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log('🗑️ Cache removido:', cacheName);
            }
            
            console.log('✅ Service Worker e caches completamente removidos');
        } catch (error) {
            console.error('⚠️ Erro ao limpar Service Worker:', error);
        }
    }
}

function showInstallPrompt(deferredPrompt) {
    // Função mantida para compatibilidade (não será chamada)
    console.log('📱 PWA desabilitado temporariamente');
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
        // Cadastro do usuário (Telegram ID)
        if (userProfile.form) {
            userProfile.form.addEventListener('submit', handleUserProfileSubmit);
        }
    // Auth tabs
    auth.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // Auth forms
    auth.loginForm.addEventListener('submit', handleLogin);
    auth.registerForm.addEventListener('submit', handleRegister);

    // App actions
    if (app.addIncomeBtn) app.addIncomeBtn.addEventListener('click', () => openTransactionModal('income'));
    if (app.addExpenseBtn) app.addExpenseBtn.addEventListener('click', () => openTransactionModal('expense'));
    if (app.logoutBtn) app.logoutBtn.addEventListener('click', handleLogout);
    
    // Filtros
    if (app.searchInput) app.searchInput.addEventListener('input', applyFilters);
    if (app.filterMonth) app.filterMonth.addEventListener('change', applyFilters);
    if (app.filterYear) app.filterYear.addEventListener('change', applyFilters);

    // Cards clicáveis
    if (app.cardIncome) app.cardIncome.addEventListener('click', () => openCardDetails('income'));
    if (app.cardExpense) app.cardExpense.addEventListener('click', () => openCardDetails('expense'));
    if (app.cardPending) app.cardPending.addEventListener('click', () => openCardDetails('pending'));
    if (app.cardOverdue) app.cardOverdue.addEventListener('click', () => openCardDetails('overdue'));
    if (app.cardCredit) app.cardCredit.addEventListener('click', () => openCardDetails('credit'));

    // Modal de detalhes
    if (app.closeDetailsModal) app.closeDetailsModal.addEventListener('click', closeCardDetails);
    if (app.cardDetailsModal) {
        app.cardDetailsModal.addEventListener('click', (e) => {
            if (e.target === app.cardDetailsModal) closeCardDetails();
        });
    }

    // Modal
    if (app.closeModalBtn) app.closeModalBtn.addEventListener('click', closeTransactionModal);
    if (app.modal) {
        app.modal.addEventListener('click', (e) => {
            if (e.target === app.modal) closeTransactionModal();
        });
    }
    if (app.transactionForm) app.transactionForm.addEventListener('submit', handleTransactionSubmit);
    
    // Payment method change
    if (app.transactionPaymentMethod) app.transactionPaymentMethod.addEventListener('change', handlePaymentMethodChange);
    if (app.transactionAffectsBalance) app.transactionAffectsBalance.addEventListener('change', handleAffectsBalanceChange);
    
    // Attachment handling
    if (app.removeAttachment) {
        app.removeAttachment.addEventListener('click', () => {
            currentAttachmentUrl = null;
            if (app.currentAttachment) app.currentAttachment.style.display = 'none';
            if (app.transactionAttachment) app.transactionAttachment.value = '';
        });
    }

    // Menu hambúrguer e navegação
    if (app.menuToggle) app.menuToggle.addEventListener('click', openSidebar);
    if (app.sidebarClose) app.sidebarClose.addEventListener('click', closeSidebar);
    if (app.sidebarOverlay) app.sidebarOverlay.addEventListener('click', closeSidebar);
    
    app.menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const screen = e.currentTarget.dataset.screen;
            if (screen) {
                navigateToScreen(screen);
                closeSidebar();
            }
        });
    });

    // Fecha sidebar ao clicar em links externos (Pagamentos, Diário, etc)
    document.querySelectorAll('.sidebar a.menu-item').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    if (app.financialQuestionForm) {
        app.financialQuestionForm.addEventListener('submit', handleFinancialQuestionSubmit);
    }

    if (app.financialClearChatBtn) {
        app.financialClearChatBtn.addEventListener('click', clearFinancialChat);
    }

    if (app.financialSuggestionButtons && app.financialSuggestionButtons.length > 0) {
        app.financialSuggestionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const question = button.dataset.question || '';
                if (!question || !app.financialQuestionInput) return;
                app.financialQuestionInput.value = question;
                handleFinancialQuestion(question);
            });
        });
    }

    if (app.configAITokenBtn) {
        app.configAITokenBtn.addEventListener('click', openAITokenConfig);
    }

    window.addEventListener('hashchange', applyScreenFromHash);

    // Event listeners da tela de Família
    const sendInviteBtn = document.getElementById('send-invite');
    const saveFamilyNameBtn = document.getElementById('save-family-name');
    
    if (sendInviteBtn) {
        sendInviteBtn.addEventListener('click', sendFamilyInvitation);
    }
    
    if (saveFamilyNameBtn) {
        saveFamilyNameBtn.addEventListener('click', saveFamilyName);
    }

    // Auth state changes são gerenciados pelo initializeApp()
    // Listener de SIGNED_OUT para logout
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('🔔 Auth event:', event);
        
        // APENAS processar logout - login é gerenciado por initializeApp()
        if (event === 'SIGNED_OUT') {
            console.log('👋 Logout detectado');
            currentUser = null;
            transactions = [];
            isInitialized = false;
            showScreen('login');
        }
        // Outros eventos (SIGNED_IN, TOKEN_REFRESHED, etc) são IGNORADOS
        // pois initializeApp() já cuida deles
    });
}

function switchAuthTab(tab) {
    auth.tabs.forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'login') {
        auth.loginForm.classList.remove('hidden');
        auth.registerForm.classList.add('hidden');
    } else {
        auth.loginForm.classList.add('hidden');
        auth.registerForm.classList.remove('hidden');
    }
    
    auth.loginError.textContent = '';
    auth.registerError.textContent = '';
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================
async function handleLogin(e) {
    e.preventDefault();
    auth.loginError.textContent = '';
    
    const email = auth.loginEmail.value;
    const password = auth.loginPassword.value;
    
    const loginBtn = e.target.querySelector('button[type="submit"]');
    const originalText = loginBtn.textContent;
    
    try {
        loginBtn.textContent = 'Entrando...';
        loginBtn.disabled = true;
        
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Login bem-sucedido - carregar dados do usuário
        console.log('✅ Login bem-sucedido');
        currentUser = data.user;
        
        // Tentar usar cache primeiro
        const hasCache = loadUserDataFromCache();
        
        if (hasCache) {
            loginBtn.textContent = 'Pronto!';
            isInitialized = true;
            if (!window.location.search.includes('stay')) {
                window.location.replace('diario.html');
                return;
            }
            showScreen('app');
            applyScreenFromHash();
            
            // Atualizar em background
            loadUserData().catch(err => {
                console.warn('⚠️ Erro ao atualizar em background:', err);
            });
        } else {
            loginBtn.textContent = 'Carregando dados...';
            
            // Aguardar um momento para o Supabase processar
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Carregar dados
            await loadUserData();
            isInitialized = true;
            
            if (!window.location.search.includes('stay')) {
                window.location.replace('diario.html');
                return;
            }
            // Mostrar app
            showScreen('app');
            applyScreenFromHash();
        }
    } catch (error) {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
        
        console.error('❌ Erro no login:', error);
        
        // Mensagens de erro mais amigáveis
        let errorMessage = error.message || 'Erro ao fazer login';
        
        if (error.message?.includes('Invalid login credentials')) {
            errorMessage = 'E-mail ou senha incorretos.';
        } else if (error.message?.includes('Email not confirmed')) {
            errorMessage = 'Confirme seu e-mail antes de fazer login.';
        } else if (error.status === 429) {
            errorMessage = '⏱️ Muitas tentativas. Aguarde um momento.';
        }
        
        auth.loginError.textContent = errorMessage;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    auth.registerError.textContent = '';
    
    const name = auth.registerName.value;
    const email = auth.registerEmail.value;
    const password = auth.registerPassword.value;
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name
                }
            }
        });
        
        if (error) throw error;
        
        auth.registerError.textContent = 'Conta criada! Verifique seu e-mail.';
        auth.registerError.style.color = 'var(--success)';
        
        // Limpar formulário
        auth.registerForm.reset();
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        
        // Mensagens de erro mais amigáveis
        let errorMessage = error.message || 'Erro ao criar conta';
        
        if (error.message?.includes('59 seconds') || error.status === 429) {
            errorMessage = '⏱️ Aguarde 1 minuto antes de tentar novamente';
        } else if (error.message?.includes('already registered')) {
            errorMessage = 'Este e-mail já está cadastrado. Tente fazer login.';
        } else if (error.message?.includes('Invalid email')) {
            errorMessage = 'E-mail inválido. Verifique o formato.';
        } else if (error.message?.includes('Password')) {
            errorMessage = 'Senha deve ter no mínimo 6 caracteres.';
        }
        
        auth.registerError.textContent = errorMessage;
        auth.registerError.style.color = 'var(--danger)';
    }
}

async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('❌ Erro ao sair:', error);
    }
}

// ==========================================
// DADOS DO USUÁRIO
// ==========================================
// Carregar dados do cache para mostrar o app rapidamente
function loadUserDataFromCache() {
    console.log('⚡ Carregando dados do cache...');
    
    // Tentar carregar família do cache
    const cachedFamilyId = localStorage.getItem('cached_family_id');
    if (cachedFamilyId) {
        currentFamilyId = cachedFamilyId;
        currentFamily = { id: cachedFamilyId, name: 'Família' };
        console.log('✅ Family ID do cache:', cachedFamilyId);
    }
    
    // Tentar carregar transações do cache
    const cachedTransactions = localStorage.getItem('cached_transactions');
    if (cachedTransactions) {
        try {
            transactions = JSON.parse(cachedTransactions);
            console.log('✅ Transações do cache:', transactions.length);
            populateYearFilter();
            updateBalance();
            renderTransactions();
            return true; // Sucesso
        } catch (e) {
            console.error('❌ Erro ao parsear cache:', e);
        }
    }
    
    return false; // Sem dados em cache
}

async function loadUserData() {
    try {
        console.log('👨‍👩‍👧 Carregando família...');
        await loadUserFamily();
        console.log('💰 Carregando transações...');
        await loadTransactions();
        console.log('🧮 Atualizando saldo...');
        updateBalance();
        console.log('📋 Renderizando transações...');
        renderTransactions();
        console.log('✅ Todos os dados carregados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        throw error; // Propagar erro para tratamento superior
    }
}

// Helper para fazer queries com timeout
async function queryWithTimeout(queryPromise, timeoutMs = 8000, operationName = 'Query') {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`TIMEOUT: ${operationName} demorou mais de ${timeoutMs/1000}s`)), timeoutMs)
    );
    return Promise.race([queryPromise, timeoutPromise]);
}

async function checkPendingInvitations() {
    console.log('📧 [1/3] Verificando convites pendentes...');
    try {
        // TIMEOUT DE SEGURANÇA: Se demorar mais de 3 segundos, pula a verificação
        const queryPromise = supabaseClient
            .from('family_invitations')
            .select('*')
            .eq('email', currentUser.email)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT: Query de convites demorou mais de 3s')), 3000)
        );
        
        const { data: invitations, error } = await Promise.race([queryPromise, timeoutPromise]);
        
        console.log('📧 [2/3] Resposta recebida - convites:', invitations ? invitations.length : 0);
        
        if (error) throw error;
        
        if (invitations && invitations.length > 0) {
            console.log('📧 [3/3] Convite encontrado - mostrando prompt');
            const inv = invitations[0];
            const accept = confirm(
                `🎉 Você foi convidado para uma família!\n\n` +
                `Aceitar este convite? Suas transações atuais permanecerão visíveis apenas para você.`
            );
            
            if (accept) {
                await acceptFamilyInvitation(inv.id, inv.family_id);
            }
        } else {
            console.log('📧 [3/3] Nenhum convite pendente');
        }
    } catch (error) {
        console.error('❌ [ERRO] Erro ao verificar convites (pulando):', error.message);
        console.log('📧 [3/3] Pulando verificação de convites devido a timeout');
        // NÃO BLOQUEIA - apenas pula a verificação de convites
    }
}

async function acceptFamilyInvitation(invitationId, familyId) {
    try {
        // Aceitar o convite
        const { error: updateError } = await supabaseClient
            .from('family_invitations')
            .update({ status: 'accepted' })
            .eq('id', invitationId);
        
        if (updateError) throw updateError;
        
        // Adicionar usuário à família
        const { error: insertError } = await supabaseClient
            .from('family_members')
            .insert([{
                family_id: familyId,
                user_id: currentUser.id,
                role: 'member'
            }]);
        
        if (insertError) throw insertError;
        
        alert('✅ Você agora faz parte da família!\n\nRecarregando dados...');
        location.reload();
        
    } catch (error) {
        console.error('❌ Erro ao aceitar convite:', error);
        alert('Erro ao aceitar convite: ' + error.message);
    }
}

async function loadUserFamily() {
    console.log('👨‍👩‍👧 [1/5] Iniciando loadUserFamily...');
    try {
        console.log('👨‍👩‍👧 [2/5] Verificando convites pendentes...');
        // Verificar convites pendentes ANTES de buscar família
        await checkPendingInvitations();
        console.log('👨‍👩‍👧 [3/5] Convites verificados. Buscando família no Supabase...');
        
        // Buscar TODAS as famílias do usuário (não usar .single() pois pode ter mais de uma)
        const familyQueryPromise = supabaseClient
            .from('family_members')
            .select('family_id, role, families(*)')
            .eq('user_id', currentUser.id);
        
        const { data: familyMembers, error: memberError } = await queryWithTimeout(
            familyQueryPromise, 
            8000, 
            'Query family_members'
        );

        console.log('👨‍👩‍👧 [4/5] Resposta do Supabase recebida');
        console.log('🔍 [DEBUG] user_id:', currentUser.id);
        console.log('🔍 [DEBUG] familyMembers resultado:', JSON.stringify(familyMembers));
        console.log('🔍 [DEBUG] memberError:', memberError);
        
        if (memberError || !familyMembers || familyMembers.length === 0) {
            console.warn('⚠️ Usuário sem família. Criando família padrão...');
            
            const createFamilyPromise = supabaseClient
                .from('families')
                .insert([{ name: 'Minha Família', owner_id: currentUser.id }])
                .select()
                .single();
            
            const { data: newFamily, error: createError } = await queryWithTimeout(
                createFamilyPromise,
                8000,
                'Criar família'
            );
            
            if (createError) throw createError;
            
            const insertMemberPromise = supabaseClient
                .from('family_members')
                .insert([{ 
                    family_id: newFamily.id, 
                    user_id: currentUser.id, 
                    role: 'owner' 
                }]);
            
            await queryWithTimeout(insertMemberPromise, 8000, 'Inserir membro da família');
            
            currentFamilyId = newFamily.id;
            currentFamily = newFamily;
            
            // Salvar no cache
            localStorage.setItem('cached_family_id', currentFamilyId);
            
            console.log('✅ [5/5] Família criada:', currentFamilyId);
            return;
        }
        
        // Se tem mais de uma família, priorizar onde é MEMBRO (família compartilhada)
        // Se só tem uma, usar ela
        let selectedMember;
        if (familyMembers.length === 1) {
            selectedMember = familyMembers[0];
        } else {
            // Priorizar família onde é membro (foi convidado) sobre família própria
            const memberFamily = familyMembers.find(fm => fm.role === 'member');
            selectedMember = memberFamily || familyMembers[0];
        }
        
        currentFamilyId = selectedMember.family_id;
        currentFamily = selectedMember.families;
        
        // Salvar no cache para recuperação em caso de timeout futuro
        localStorage.setItem('cached_family_id', currentFamilyId);
        
        console.log('✅ [5/5] currentFamilyId definido:', currentFamilyId);
        
    } catch (error) {
        console.error('❌ [ERRO] Erro ao carregar família:', error.message);
        console.log('🔄 Tentando recuperação com dados do localStorage...');
        
        // Tentar recuperar family_id do cache local
        const cachedFamilyId = localStorage.getItem('cached_family_id');
        if (cachedFamilyId) {
            console.log('✅ Family ID recuperado do cache:', cachedFamilyId);
            currentFamilyId = cachedFamilyId;
            currentFamily = { id: cachedFamilyId, name: 'Família (cache)' };
        } else {
            console.error('❌ Não foi possível recuperar família - continuando sem família');
            currentFamilyId = null;
            currentFamily = null;
        }
    }
}

async function loadTransactions() {
    console.log('💰 [1/4] Iniciando loadTransactions...');
    try {
        if (!currentFamilyId) {
            console.warn('⚠️ [2/4] Sem família definida - pulando transações');
            transactions = [];
            return;
        }
        
        console.log('💰 [2/4] Buscando transações no Supabase para family_id:', currentFamilyId);
        
        const transactionsQueryPromise = supabaseClient
            .from('transactions')
            .select('*')
            .eq('family_id', currentFamilyId)
            .order('date', { ascending: false });
        
        const { data, error } = await queryWithTimeout(
            transactionsQueryPromise,
            8000,
            'Query transactions'
        );

        console.log('💰 [3/4] Resposta do Supabase recebida');
        console.log('🔍 [DEBUG] transactions query family_id:', currentFamilyId);
        console.log('🔍 [DEBUG] transactions error:', error);
        console.log('🔍 [DEBUG] transactions count:', data ? data.length : 0);
        
        if (error) throw error;
        
        transactions = data || [];
        
        // Salvar no cache para recuperação futura
        try {
            localStorage.setItem('cached_transactions', JSON.stringify(transactions));
        } catch (e) {
            console.warn('⚠️ Não foi possível salvar transações no cache:', e);
        }
        
        console.log('💰 [4/4] Populando filtro de anos...');
        populateYearFilter();
        console.log('✅ [4/4] Transações carregadas:', transactions.length);
    } catch (error) {
        console.error('❌ [ERRO] Erro ao carregar transações:', error.message);
        
        if (error.message.includes('TIMEOUT')) {
            console.warn('⚠️ Timeout na query de transações - tentando cache...');
            
            // Tentar recuperar do cache
            const cachedTransactions = localStorage.getItem('cached_transactions');
            if (cachedTransactions) {
                try {
                    transactions = JSON.parse(cachedTransactions);
                    console.log('✅ Transações recuperadas do cache:', transactions.length);
                    populateYearFilter();
                    return;
                } catch (e) {
                    console.error('❌ Erro ao parsear cache:', e);
                }
            }
        }
        
        // Se a tabela não existe, mostrar mensagem
        if (error.message.includes('relation')) {
            console.warn('⚠️ Tabela "transactions" não encontrada. Crie a tabela no Supabase!');
        }
        
        console.log('⚠️ Continuando com lista vazia de transações');
        transactions = [];
    }
}

// ==========================================
// UPLOAD DE ARQUIVOS
// ==========================================
async function uploadAttachment(file, transactionId) {
    try {
        // Validar tamanho (máx 5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('Arquivo muito grande! Tamanho máximo: 5MB');
        }
        
        // Validar tipo
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            throw new Error('Tipo de arquivo não suportado! Use PDF, JPG, PNG ou WEBP');
        }
        
        // Gerar nome único
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${transactionId}_${timestamp}.${extension}`;
        
        // Upload para Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('transaction-attachments')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Obter URL pública
        const { data: { publicUrl } } = supabaseClient.storage
            .from('transaction-attachments')
            .getPublicUrl(fileName);
        
        return publicUrl;
    } catch (error) {
        console.error('❌ Erro no upload:', error);
        throw error;
    }
}

async function deleteAttachment(url) {
    try {
        if (!url) return;
        
        // Extrair path do arquivo da URL
        const urlParts = url.split('/transaction-attachments/');
        if (urlParts.length < 2) return;
        
        const filePath = urlParts[1];
        
        const { error } = await supabaseClient.storage
            .from('transaction-attachments')
            .remove([filePath]);
        
        if (error) throw error;
    } catch (error) {
        console.error('⚠️ Erro ao deletar anexo:', error);
        // Não falhar a operação se o anexo não puder ser deletado
    }
}

// ==========================================
// TRANSAÇÕES
// ==========================================
function openTransactionModal(type) {
    editingTransaction = null; // Limpar edição
    currentAttachmentUrl = null; // Limpar anexo
    app.transactionType.value = type;
    app.modalTitle.textContent = type === 'income' ? 'Nova Receita' : 'Nova Despesa';
    
    // Preencher categorias
    app.transactionCategory.innerHTML = '<option value="">Selecione...</option>';
    const categoryList = type === 'income' ? categories.income : categories.expense;
    categoryList.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        app.transactionCategory.appendChild(option);
    });
    
    // Definir data de hoje
    const today = new Date().toISOString().split('T')[0];
    app.transactionDate.value = today;
    app.transactionDueDate.value = today;
    
    // Resetar campos de cartão
    app.creditCardFields.style.display = 'none';
    app.billReferenceField.style.display = 'none';
    app.transactionAffectsBalance.checked = false;
    app.transactionPaymentMethod.value = 'Conta Corrente';
    app.transactionStatus.value = 'pending';
    
    // Resetar anexo
    app.transactionAttachment.value = '';
    app.currentAttachment.style.display = 'none';
    
    app.modal.classList.remove('hidden');
}

function openEditTransactionModal(transaction) {
    editingTransaction = transaction;
    currentAttachmentUrl = transaction.attachment_url || null;
    
    app.transactionType.value = transaction.type;
    app.modalTitle.textContent = transaction.type === 'income' ? 'Editar Receita' : 'Editar Despesa';
    
    // Preencher categorias
    app.transactionCategory.innerHTML = '<option value="">Selecione...</option>';
    const categoryList = transaction.type === 'income' ? categories.income : categories.expense;
    categoryList.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        app.transactionCategory.appendChild(option);
    });
    
    // Preencher campos com dados da transação
    app.transactionDescription.value = transaction.description || '';
    app.transactionSupplier.value = transaction.supplier || '';
    app.transactionAmount.value = transaction.amount || '';
    app.transactionCategory.value = transaction.category || '';
    app.transactionDate.value = transaction.date || '';
    app.transactionDueDate.value = transaction.due_date || transaction.date || '';
    app.transactionPaymentMethod.value = transaction.payment_method || 'Conta Corrente';
    app.transactionStatus.value = transaction.status || 'pending';
    app.transactionNotes.value = transaction.notes || '';
    
    // Configurar campos de cartão de crédito
    const isCredit = transaction.payment_method === 'Cartão de Crédito';
    if (isCredit) {
        app.creditCardFields.style.display = 'block';
        app.transactionAffectsBalance.checked = transaction.affects_balance === false;
        
        if (transaction.affects_balance === false) {
            app.billReferenceField.style.display = 'block';
            app.transactionBillReference.value = transaction.bill_reference || '';
        }
    } else {
        app.creditCardFields.style.display = 'none';
        app.billReferenceField.style.display = 'none';
    }
    
    // Mostrar anexo existente
    if (currentAttachmentUrl) {
        const fileName = currentAttachmentUrl.split('/').pop();
        app.currentAttachmentName.textContent = `📄 ${fileName}`;
        app.currentAttachment.style.display = 'block';
    } else {
        app.currentAttachment.style.display = 'none';
    }
    app.transactionAttachment.value = '';
    
    app.modal.classList.remove('hidden');
}

function closeTransactionModal() {
    app.modal.classList.add('hidden');
    app.transactionForm.reset();
    editingTransaction = null;
    currentAttachmentUrl = null;
}

function handlePaymentMethodChange() {
    const paymentMethod = app.transactionPaymentMethod.value;
    const isCredit = paymentMethod === 'Cartão de Crédito';
    
    if (isCredit) {
        app.creditCardFields.style.display = 'block';
    } else {
        app.creditCardFields.style.display = 'none';
        app.billReferenceField.style.display = 'none';
        app.transactionAffectsBalance.checked = false;
    }
}

function handleAffectsBalanceChange() {
    const isChecked = app.transactionAffectsBalance.checked;
    
    if (isChecked) {
        // É compra no cartão, mostrar campo de referência da fatura
        app.billReferenceField.style.display = 'block';
        
        // Sugerir referência baseada na data
        const date = new Date(app.transactionDate.value || new Date());
        const reference = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        app.transactionBillReference.value = reference;
    } else {
        app.billReferenceField.style.display = 'none';
    }
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    console.log('🔄 Iniciando salvamento da transação...');
    
    // Desabilitar botão para evitar cliques múltiplos
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';
    }
    
    try {
        const paymentMethod = app.transactionPaymentMethod.value;
        const isCredit = paymentMethod === 'Cartão de Crédito';
        const isCreditPurchase = isCredit && app.transactionAffectsBalance.checked;
        
        const transactionData = {
            type: app.transactionType.value,
            description: app.transactionDescription.value,
            supplier: app.transactionSupplier.value || null,
            amount: parseFloat(app.transactionAmount.value),
            category: app.transactionCategory.value,
            date: app.transactionDate.value,
            due_date: app.transactionDueDate.value || app.transactionDate.value,
            payment_method: paymentMethod,
            affects_balance: isCreditPurchase ? false : true,
            is_bill_payment: false,
            bill_reference: isCreditPurchase ? app.transactionBillReference.value : null,
            notes: app.transactionNotes.value || null,
            status: app.transactionStatus.value,
            attachment_url: currentAttachmentUrl || null
        };
        
        console.log('📝 Dados da transação:', transactionData);
        
        let savedTransaction;
        
        if (editingTransaction) {
            console.log('✏️ Editando transação existente:', editingTransaction.id);
            
            // Se há novo arquivo, fazer upload
            if (app.transactionAttachment.files.length > 0) {
                console.log('📤 Upload de novo anexo...');
                if (currentAttachmentUrl) {
                    await deleteAttachment(currentAttachmentUrl);
                }
                const file = app.transactionAttachment.files[0];
                const attachmentUrl = await uploadAttachment(file, editingTransaction.id);
                transactionData.attachment_url = attachmentUrl;
                console.log('✅ Anexo enviado:', attachmentUrl);
            }
            
            const { data, error } = await supabaseClient
                .from('transactions')
                .update(transactionData)
                .eq('id', editingTransaction.id)
                .select();
            
            if (error) throw error;
            
            savedTransaction = data[0];
            console.log('✅ Transação atualizada:', savedTransaction);
            
            // Atualizar na lista local
            const index = transactions.findIndex(t => t.id === editingTransaction.id);
            if (index !== -1) {
                transactions[index] = savedTransaction;
            }
        } else {
            console.log('➕ Criando nova transação...');
            console.log('👤 currentUser:', currentUser);
            console.log('👨‍👩‍👧 currentFamilyId:', currentFamilyId);
            
            const transaction = {
                ...transactionData,
                user_id: currentUser.id,
                family_id: currentFamilyId,
                added_by: currentUser.id
            };
            
            console.log('📦 Transação completa:', transaction);
            console.log('🔄 Enviando para Supabase...');
            
            // Adicionar timeout de 10 segundos
            const insertPromise = supabaseClient
                .from('transactions')
                .insert([transaction])
                .select();
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout: Supabase não respondeu em 10 segundos. Verifique as políticas RLS.')), 10000)
            );
            
            let data, error;
            try {
                const result = await Promise.race([insertPromise, timeoutPromise]);
                data = result.data;
                error = result.error;
            } catch (timeoutError) {
                console.error('⏱️ TIMEOUT! A requisição demorou muito.');
                console.error('💡 Possíveis causas:');
                console.error('   1. Políticas RLS bloqueando INSERT');
                console.error('   2. Problema de conexão com Supabase');
                console.error('   3. Algum trigger/constraint travando');
                throw timeoutError;
            }
            
            console.log('📨 Resposta do Supabase - data:', data);
            console.log('📨 Resposta do Supabase - error:', error);
            
            if (error) {
                console.error('❌ Erro no insert:', error);
                console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
                throw error;
            }
            
            if (!data || data.length === 0) {
                throw new Error('Nenhum dado retornado do Supabase após insert');
            }
            
            savedTransaction = data[0];
            console.log('✅ Transação criada:', savedTransaction);
            
            // Se há arquivo, fazer upload e atualizar
            if (app.transactionAttachment.files.length > 0) {
                console.log('📤 Upload de anexo...');
                const file = app.transactionAttachment.files[0];
                const attachmentUrl = await uploadAttachment(file, savedTransaction.id);
                console.log('📎 URL do anexo:', attachmentUrl);
                
                const { data: updatedData, error: updateError } = await supabaseClient
                    .from('transactions')
                    .update({ attachment_url: attachmentUrl })
                    .eq('id', savedTransaction.id)
                    .select();
                
                if (updateError) throw updateError;
                savedTransaction = updatedData[0];
                console.log('✅ Transação atualizada com anexo');
            }
            
            // Adicionar à lista local
            transactions.unshift(savedTransaction);
        }
        
        console.log('🎉 Transação salva com sucesso!');
        
        // Atualizar UI
        updateBalance();
        renderTransactions();
        closeTransactionModal();
    } catch (error) {
        console.error('❌ Erro ao salvar transação:', error);
        console.error('❌ Stack:', error.stack);
        alert('Erro ao salvar transação: ' + error.message);
    } finally {
        // Reabilitar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar';
        }
    }
}

async function deleteTransaction(id) {
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('transactions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Remover da lista local
        transactions = transactions.filter(t => t.id !== id);
        
        // Atualizar UI
        updateBalance();
        renderTransactions();
    } catch (error) {
        console.error('❌ Erro ao excluir transação:', error);
        alert('Erro ao excluir transação');
    }
}

// ==========================================
// UI UPDATES
// ==========================================
function updateBalance() {
    // Bail out se a página atual não possui os elementos do dashboard (ex.: index.html / gráficos).
    if (!app.balanceTotal) {
        return;
    }
    console.log('🧮 Atualizando saldo - transações totais:', transactions.length);
    // SALDO ATUAL: considerar TODAS as transações (sem filtro)
    const balanceTransactions = transactions.filter(t => t.affects_balance !== false);
    
    const totalIncome = balanceTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = balanceTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const total = totalIncome - totalExpense;
    
    // DEMAIS CARDS: usar transações filtradas por mês/ano (sem pesquisa)
    const filteredTransactions = getFilteredTransactions(false);
    
    const income = filteredTransactions
        .filter(t => t.type === 'income' && t.affects_balance !== false)
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = filteredTransactions
        .filter(t => t.type === 'expense' && t.affects_balance !== false)
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Calcular pendentes e atrasados (com filtro)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pendingExpenses = filteredTransactions.filter(t => 
        t.type === 'expense' && 
        t.status === 'pending'
    );
    
    const overdueExpenses = pendingExpenses.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date + 'T00:00:00');
        return dueDate < today;
    });
    
    const pendingTotal = pendingExpenses.reduce((sum, t) => sum + t.amount, 0);
    const overdueTotal = overdueExpenses.reduce((sum, t) => sum + t.amount, 0);
    
    // Calcular compras no cartão de crédito (com filtro)
    const creditCardPurchases = filteredTransactions.filter(t => 
        t.type === 'expense' && 
        t.affects_balance === false &&
        !t.is_bill_payment
    );
    
    const creditTotal = creditCardPurchases.reduce((sum, t) => sum + t.amount, 0);
    
    // Atualizar cards
    app.balanceTotal.textContent = formatCurrency(total);
    app.balanceIncome.textContent = formatCurrency(income);
    app.balanceExpense.textContent = formatCurrency(expense);
    app.balancePending.textContent = formatCurrency(pendingTotal);
    app.balanceOverdue.textContent = formatCurrency(overdueTotal);
    app.balanceCredit.textContent = formatCurrency(creditTotal);
    app.pendingCount.textContent = `${pendingExpenses.length} ${pendingExpenses.length === 1 ? 'despesa' : 'despesas'}`;
    app.overdueCount.textContent = `${overdueExpenses.length} ${overdueExpenses.length === 1 ? 'despesa' : 'despesas'}`;
    app.creditCount.textContent = `${creditCardPurchases.length} ${creditCardPurchases.length === 1 ? 'compra pendente' : 'compras pendentes'}`;
}

function getStatusBadge(transaction) {
    if (transaction.status === 'paid') {
        return '<span class="transaction-status-badge paid">✓ Paga</span>';
    }
    
    // Verificar se está atrasada
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (transaction.due_date) {
        const dueDate = new Date(transaction.due_date + 'T00:00:00');
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
            return '<span class="transaction-status-badge overdue">⚠️ Atrasada</span>';
        }
    }
    
    return '<span class="transaction-status-badge pending">⏳ Pendente</span>';
}

function renderTransactions() {
    // Bail out se a página atual não possui a lista de transações (ex.: index.html / gráficos).
    if (!app.transactionsList) {
        return;
    }
    console.log('📋 Renderizando transações na tela...');
    // Aplicar filtros
    const filteredTransactions = getFilteredTransactions();
    
    if (filteredTransactions.length === 0) {
        app.transactionsList.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                </svg>
                <p>Nenhuma transação encontrada</p>
                <p class="empty-subtitle">Tente ajustar os filtros</p>
            </div>
        `;
        return;
    }
    
    app.transactionsList.innerHTML = filteredTransactions.map(t => `
        <div class="transaction-item" onclick="event.target.closest('.transaction-delete') || event.target.closest('.transaction-attachment') ? null : openEditTransactionModal(${JSON.stringify(t).replace(/"/g, '&quot;')})" style="cursor: pointer;">
            <div class="transaction-icon ${t.type}">
                ${t.type === 'income' ? '↑' : '↓'}
            </div>
            <div class="transaction-info">
                <div class="transaction-description">
                    ${t.description}
                    ${t.attachment_url ? '<span style="margin-left: 6px; cursor: pointer;" class="transaction-attachment" onclick="event.stopPropagation(); window.open(\'' + t.attachment_url + '\', \'_blank\')" title="Ver anexo">📎</span>' : ''}
                </div>
                <div class="transaction-meta">
                    <span class="transaction-category">${t.category}</span>
                    <span>${formatDate(t.date)}</span>
                    ${getStatusBadge(t)}
                </div>
            </div>
            <div class="transaction-amount ${t.type}">
                ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="icon-btn transaction-delete" onclick="event.stopPropagation(); deleteTransaction(${t.id})" title="Excluir">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

function getFilteredTransactions(includeSearch = true) {
    // Se os filtros do dashboard não existirem na página atual, retorna todas as transações.
    if (!app.filterMonth || !app.filterYear) {
        return transactions.slice();
    }
    const selectedMonth = app.filterMonth.value;
    const selectedYear = app.filterYear.value;
    const searchTerm = includeSearch && app.searchInput ? app.searchInput.value.toLowerCase().trim() : '';
    
    return transactions.filter(t => {
        const date = new Date(t.date + 'T00:00:00');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        
        if (selectedMonth && month !== selectedMonth) return false;
        if (selectedYear && year !== selectedYear) return false;
        
        // Pesquisa por texto em múltiplos campos (apenas se includeSearch = true)
        if (searchTerm) {
            const description = (t.description || '').toLowerCase();
            const category = (t.category || '').toLowerCase();
            const supplier = (t.supplier || '').toLowerCase();
            const amount = formatCurrency(t.amount).toLowerCase();
            const paymentMethod = (t.payment_method || '').toLowerCase();
            
            const matchesSearch = 
                description.includes(searchTerm) ||
                category.includes(searchTerm) ||
                supplier.includes(searchTerm) ||
                amount.includes(searchTerm) ||
                paymentMethod.includes(searchTerm);
            
            if (!matchesSearch) return false;
        }
        
        return true;
    });
}

function populateYearFilter() {
    // Bail out se a página atual não possui o filtro de ano (ex.: index.html / gráficos).
    if (!app.filterYear) {
        return;
    }
    if (transactions.length === 0) {
        app.filterYear.innerHTML = '<option value="">Todos os anos</option>';
        return;
    }
    
    const years = [...new Set(transactions.map(t => {
        const date = new Date(t.date + 'T00:00:00');
        return date.getFullYear();
    }))].sort((a, b) => b - a);
    
    app.filterYear.innerHTML = '<option value="">Todos os anos</option>' +
        years.map(year => `<option value="${year}">${year}</option>`).join('');
    
    // Selecionar ano atual por padrão
    const currentYear = new Date().getFullYear();
    if (years.includes(currentYear)) {
        app.filterYear.value = String(currentYear);
    }
    
    // Selecionar mês atual por padrão
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    app.filterMonth.value = currentMonth;
}

function applyFilters() {
    updateBalance();
    renderTransactions();
}

// ==========================================
// MENU E NAVEGAÇÃO
// ==========================================
function openSidebar() {
    app.sidebar.classList.add('open');
    app.sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Previne scroll do body
}

function closeSidebar() {
    app.sidebar.classList.remove('open');
    app.sidebarOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Restaura scroll
}

function navigateToScreen(screenName) {
    // Ocultar todas as telas
    app.screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Mostrar a tela selecionada
    const targetScreen = document.getElementById(screenName);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Atualizar menu ativo
    app.menuItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === screenName) {
            item.classList.add('active');
        }
    });
    
    // Atualizar título do header
    const titles = {
        'dashboard': '💰 Orçamento',
        'graficos': '📊 Gráficos',
        'familia': '👨‍👩‍👧‍👦 Família',
        'gestor-financeiro': '🤖 Gestor Financeiro',
        'cadastro': '👤 Meu Cadastro'
    };
    
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle && titles[screenName]) {
        headerTitle.textContent = titles[screenName];
    }
    
    // Carregar dados específicos da tela
    if (screenName === 'familia') {
        loadFamilyData();
    }
    if (screenName === 'graficos') {
        populateChartYearFilter();
        loadChartBudgets().then(() => renderCharts());
    }
    if (screenName === 'cadastro') {
        loadUserProfileForm();
    }
}

function applyScreenFromHash() {
    const hashScreen = (window.location.hash || '').replace('#', '').trim();
    const validScreens = ['dashboard', 'graficos', 'familia', 'gestor-financeiro', 'cadastro'];

    if (validScreens.includes(hashScreen)) {
        navigateToScreen(hashScreen);
    }

    // Abrir modal de novo lan\u00e7amento via ?add=expense|income
    try {
        const params = new URLSearchParams(window.location.search);
        const addType = params.get('add');
        if (addType === 'expense' || addType === 'income') {
            setTimeout(() => {
                try { openTransactionModal(addType); } catch (e) { console.warn(e); }
            }, 250);
            // Limpa o par\u00e2metro para n\u00e3o reabrir no F5
            params.delete('add');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        }
    } catch (e) { /* ignora */ }
}

// ==========================================
// GESTOR FINANCEIRO (IA)
// ==========================================
function openAITokenConfig() {
    const currentToken = getGitHubToken();
    const newToken = prompt(
        'Configure seu GitHub Personal Access Token para ativar a IA:\n\n' +
        '1. Acesse github.com → Settings → Developer settings\n' +
        '2. Personal access tokens → Tokens (classic)\n' +
        '3. Generate new token (pode ser sem escopos)\n' +
        '4. Cole o token abaixo (começa com ghp_... ou github_pat_...)\n',
        currentToken
    );

    if (newToken === null) return; // Cancelou

    if (!newToken.trim()) {
        if (confirm('Deseja remover o token atual?')) {
            localStorage.removeItem(AI_TOKEN_KEY);
            alert('✅ Token removido com sucesso!');
        }
        return;
    }

    const trimmedToken = newToken.trim();
    if (!trimmedToken.startsWith('github_pat_') && !trimmedToken.startsWith('ghp_') && !trimmedToken.startsWith('gho_')) {
        alert('❌ Token inválido! Deve começar com "ghp_..." (classic) ou "github_pat_..." (fine-grained)');
        return;
    }

    setGitHubToken(trimmedToken);
    alert('✅ Token configurado com sucesso!\n\nAgora você pode fazer perguntas e a IA real vai responder.');
}

function handleFinancialQuestionSubmit(e) {
    e.preventDefault();
    const question = app.financialQuestionInput?.value?.trim();
    if (!question) return;
    handleFinancialQuestion(question);
}

function handleFinancialQuestion(question) {
    if (!app.financialQuestionInput) return;

    addFinancialMessage('user', question);
    app.financialQuestionInput.value = '';

    // Mostrar indicador de carregamento
    const loadingId = addFinancialMessage('assistant', '💭 Analisando seus dados...');

    // Chamar IA real
    askCopilotFinancialQuestion(question)
        .then(answer => {
            removeFinancialMessage(loadingId);
            addFinancialMessage('assistant', answer);
        })
        .catch(error => {
            removeFinancialMessage(loadingId);
            console.error('Erro ao consultar IA:', error);
            addFinancialMessage('assistant', `❌ Erro ao consultar a IA: ${error.message}. Verifique sua conexão.`);
        });
}

function clearFinancialChat() {
    if (!app.financialChatMessages) return;
    app.financialChatMessages.innerHTML = `
        <div class="ai-message ai-message-assistant">
            Conversa limpa. Pode mandar sua próxima pergunta.
        </div>
    `;
}

function addFinancialMessage(role, text) {
    if (!app.financialChatMessages) return;

    const message = document.createElement('div');
    message.className = `ai-message ${role === 'user' ? 'ai-message-user' : 'ai-message-assistant'}`;
    message.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    message.dataset.messageId = Date.now() + Math.random();

    app.financialChatMessages.appendChild(message);
    app.financialChatMessages.scrollTop = app.financialChatMessages.scrollHeight;

    return message.dataset.messageId;
}

function removeFinancialMessage(messageId) {
    if (!app.financialChatMessages || !messageId) return;
    const message = app.financialChatMessages.querySelector(`[data-message-id="${messageId}"]`);
    if (message) message.remove();
}

async function askCopilotFinancialQuestion(question) {
    // Verificar se tem token configurado
    if (!hasGitHubToken()) {
        return [
            '⚠️ Token do GitHub não configurado.',
            '',
            'Para ativar a IA:',
            '1. Acesse github.com → Settings → Developer settings',
            '2. Gere um Personal Access Token (pode ser sem escopos)',
            '3. Clique no botão "⚙️ Configurar Token" acima',
            '',
            'Enquanto isso, aqui está uma análise básica:',
            '',
            analyzeQuestionLocally(question)
        ].join('\n');
    }

    // Preparar contexto financeiro real do usuário
    const financialContext = buildFinancialContext();
    
    const systemPrompt = `Você é um assistente financeiro inteligente especializado em análise de despesas e receitas pessoais.

DADOS FINANCEIROS DO USUÁRIO:
${financialContext}

Sua função é responder perguntas sobre esses dados de forma clara, objetiva e útil. 
- Use formatação em português brasileiro
- Seja direto e prático
- Dê dicas quando identificar problemas ou oportunidades
- Formate valores monetários em R$
- Use bullet points quando listar itens

Responda APENAS com base nos dados fornecidos acima.`;

    try {
        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getGitHubToken()}`
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: question }
                ],
                max_completion_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API retornou ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Erro na chamada à API:', error);
        // Fallback para análise local em caso de erro
        return analyzeQuestionLocally(question);
    }
}

function analyzeQuestionLocally(question) {
    if (!transactions || transactions.length === 0) {
        return 'Ainda não encontrei transações para analisar. Cadastre receitas/despesas e me pergunte novamente.';
    }

    const normalized = normalizeText(question);
    const asksDueDates = /venc|vence|vencimento|pagar|conta/.test(normalized);
    const asksNextWeek = /proxima semana|semana que vem/.test(normalized);
    const asksCategory = /categoria|grupo|gasto|despesa/.test(normalized);
    const asksSummary = /resumo|visao geral|como esta|situacao|mes atual/.test(normalized);

    const context = buildFinancialContext();

    if (asksDueDates && asksNextWeek) {
        const lines = context.split('\n');
        const vencSection = lines.find(l => l.includes('PRÓXIMOS VENCIMENTOS'));
        if (vencSection) {
            const startIdx = lines.indexOf(vencSection);
            return lines.slice(startIdx, startIdx + 8).join('\n');
        }
    }

    if (asksCategory) {
        const lines = context.split('\n');
        const catSection = lines.find(l => l.includes('DESPESAS POR CATEGORIA'));
        if (catSection) {
            const startIdx = lines.indexOf(catSection);
            return lines.slice(startIdx, startIdx + 8).join('\n');
        }
    }

    if (asksSummary) {
        const lines = context.split('\n');
        const monthSection = lines.find(l => l.includes('MÊS ATUAL'));
        if (monthSection) {
            const startIdx = lines.indexOf(monthSection);
            return lines.slice(startIdx, startIdx + 6).join('\n');
        }
    }

    return [
        '💡 Posso te ajudar com análises como:',
        '• Próximos vencimentos da semana que vem',
        '• Categorias de gasto',
        '• Resumo financeiro do mês atual',
        '• Despesas atrasadas',
        '',
        '⚠️ Para respostas mais inteligentes, configure uma chave de API OpenAI válida no código.'
    ].join('\n');
}

function buildFinancialContext() {
    if (!transactions || transactions.length === 0) {
        return 'NENHUMA TRANSAÇÃO CADASTRADA. O usuário ainda não possui dados financeiros.';
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth();

    // Análise dos últimos 6 meses (incluindo o atual)
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonthNum - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        
        const monthTx = transactions.filter(t => {
            const txDate = new Date(`${t.date}T00:00:00`);
            return txDate.getFullYear() === year && txDate.getMonth() === month;
        });

        const income = monthTx
            .filter(t => t.type === 'income' && t.affects_balance !== false)
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const expense = monthTx
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        last6Months.push({ monthName, income, expense, balance: income - expense });
    }

    const monthlyHistory = last6Months
        .map(m => `  - ${m.monthName}: Receitas R$ ${m.income.toFixed(2)}, Despesas R$ ${m.expense.toFixed(2)}, Saldo R$ ${m.balance.toFixed(2)}`)
        .join('\n');

    // Mês atual detalhado
    const currentMonth = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const monthTransactions = transactions.filter(t => {
        const date = new Date(`${t.date}T00:00:00`);
        return date.getFullYear() === currentYear && date.getMonth() === currentMonthNum;
    });

    const currentIncome = monthTransactions
        .filter(t => t.type === 'income' && t.affects_balance !== false)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const currentExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const pending = monthTransactions
        .filter(t => t.type === 'expense' && t.status === 'pending')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    // Categorias do mês atual
    const expensesByCategory = {};
    monthTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const cat = t.category || 'Outros';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(t.amount || 0);
        });

    const categoryList = Object.entries(expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, val]) => `  - ${cat}: R$ ${val.toFixed(2)}`)
        .join('\n');

    // Próximos vencimentos
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const upcomingDue = transactions
        .filter(t => t.type === 'expense' && t.status === 'pending' && t.due_date)
        .filter(t => {
            const dueDate = new Date(`${t.due_date}T00:00:00`);
            return dueDate >= today && dueDate <= in7Days;
        })
        .sort((a, b) => new Date(`${a.due_date}T00:00:00`) - new Date(`${b.due_date}T00:00:00`))
        .slice(0, 5)
        .map(t => `  - ${t.due_date}: ${t.description} (R$ ${Number(t.amount).toFixed(2)})`)
        .join('\n');

    // Despesas atrasadas
    const overdue = transactions
        .filter(t => t.type === 'expense' && t.status === 'pending' && t.due_date)
        .filter(t => new Date(`${t.due_date}T00:00:00`) < today);

    const overdueTotal = overdue.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return `
HISTÓRICO DOS ÚLTIMOS 6 MESES:
${monthlyHistory}

MÊS ATUAL (${currentMonth}):
- Receitas: R$ ${currentIncome.toFixed(2)}
- Despesas totais: R$ ${currentExpense.toFixed(2)}
- Saldo: R$ ${(currentIncome - currentExpense).toFixed(2)}
- Despesas pendentes: R$ ${pending.toFixed(2)}

DESPESAS POR CATEGORIA NO MÊS ATUAL (top 5):
${categoryList || '  (nenhuma)'}

PRÓXIMOS VENCIMENTOS (próximos 7 dias):
${upcomingDue || '  (nenhum)'}

DESPESAS ATRASADAS:
- Total: ${overdue.length} despesa(s) no valor de R$ ${overdueTotal.toFixed(2)}

TOTAL DE TRANSAÇÕES NO HISTÓRICO: ${transactions.length}
`.trim();
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };

    return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

// ==========================================
// CARD DETAILS MODAL
// ==========================================
function openCardDetails(type) {
    const filteredTransactions = getFilteredTransactions(false); // Sem filtro de pesquisa
    let cardTransactions = [];
    let title = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch(type) {
        case 'income':
            cardTransactions = filteredTransactions.filter(t => 
                t.type === 'income' && t.affects_balance !== false
            );
            title = '📈 Receitas';
            break;
            
        case 'expense':
            cardTransactions = filteredTransactions.filter(t => 
                t.type === 'expense' && t.affects_balance !== false
            );
            title = '📉 Despesas';
            break;
            
        case 'pending':
            cardTransactions = filteredTransactions.filter(t => 
                t.type === 'expense' && t.status === 'pending'
            );
            title = '⏳ Despesas Pendentes';
            break;
            
        case 'overdue':
            cardTransactions = filteredTransactions.filter(t => {
                if (t.type !== 'expense' || t.status !== 'pending') return false;
                if (!t.due_date) return false;
                const dueDate = new Date(t.due_date + 'T00:00:00');
                return dueDate < today;
            });
            title = '⚠️ Despesas Atrasadas';
            break;
            
        case 'credit':
            cardTransactions = filteredTransactions.filter(t => 
                t.type === 'expense' && 
                t.affects_balance === false &&
                !t.is_bill_payment
            );
            title = '💳 Compras no Cartão de Crédito';
            break;
    }
    
    // Adicionar período do filtro ao título
    const selectedMonth = app.filterMonth.value;
    const selectedYear = app.filterYear.value;
    let periodText = '';
    
    if (selectedMonth && selectedYear) {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        periodText = ` - ${monthNames[parseInt(selectedMonth) - 1]} de ${selectedYear}`;
    } else if (selectedMonth) {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        periodText = ` - ${monthNames[parseInt(selectedMonth) - 1]}`;
    } else if (selectedYear) {
        periodText = ` - ${selectedYear}`;
    }
    
    app.cardDetailsTitle.textContent = title + periodText;
    renderCardDetails(cardTransactions);
    app.cardDetailsModal.classList.remove('hidden');
}

function closeCardDetails() {
    app.cardDetailsModal.classList.add('hidden');
}

function renderCardDetails(transactions) {
    if (transactions.length === 0) {
        app.cardDetailsList.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <p>Nenhuma transação encontrada neste período</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por data (mais recente primeiro)
    const sortedTransactions = [...transactions].sort((a, b) => {
        const dateA = new Date(a.date + 'T00:00:00');
        const dateB = new Date(b.date + 'T00:00:00');
        return dateB - dateA;
    });
    
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    app.cardDetailsList.innerHTML = `
        <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">Total: ${transactions.length} ${transactions.length === 1 ? 'transação' : 'transações'}</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${formatCurrency(total)}</span>
            </div>
        </div>
        ${sortedTransactions.map(t => `
            <div class="transaction-item" style="margin-bottom: 0.75rem;">
                <div class="transaction-icon ${t.type}">
                    ${t.type === 'income' ? '↑' : '↓'}
                </div>
                <div class="transaction-info">
                    <div class="transaction-description">
                        ${t.description}
                        ${t.attachment_url ? '<span style="margin-left: 6px; cursor: pointer;" onclick="event.stopPropagation(); window.open(\'' + t.attachment_url + '\', \'_blank\')" title="Ver anexo">📎</span>' : ''}
                    </div>
                    <div class="transaction-meta">
                        <span class="transaction-category">${t.category}</span>
                        <span>Venc: ${formatDate(t.due_date)}</span>
                        ${getStatusBadge(t)}
                    </div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
                </div>
            </div>
        `).join('')}
    `;
}

// ==========================================
// GERENCIAMENTO DE FAMÍLIA
// ==========================================

async function loadFamilyData() {
    if (!currentFamilyId) return;
    
    try {
        // Carregar membros (sem JOIN com auth.users)
        const { data: members, error: membersError } = await supabaseClient
            .from('family_members')
            .select('*')
            .eq('family_id', currentFamilyId);
        
        if (membersError) throw membersError;
        
        renderFamilyMembers(members || []);
        
        // Carregar convites pendentes
        const { data: invitations, error: invitationsError } = await supabaseClient
            .from('family_invitations')
            .select('*')
            .eq('family_id', currentFamilyId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString());
        
        if (invitationsError) throw invitationsError;
        
        renderPendingInvitations(invitations || []);
        
        // Preencher nome da família
        if (currentFamily) {
            const familyNameInput = document.getElementById('family-name');
            if (familyNameInput) {
                familyNameInput.value = currentFamily.name || 'Minha Família';
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados da família:', error);
    }
}

function renderFamilyMembers(members) {
    const container = document.getElementById('family-members-list');
    if (!container) return;
    
    if (members.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                <p>Nenhum membro ainda</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = members.map(member => {
        const roleLabels = {
            'owner': '👑 Dono',
            'admin': '⚡ Admin',
            'member': '👤 Membro'
        };
        
        const isCurrentUser = member.user_id === currentUser.id;
        const displayEmail = member.email || 'Email não disponível';
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--gray-200);">
                <div>
                    <div style="font-weight: 600; color: var(--gray-900);">
                        ${displayEmail}
                        ${isCurrentUser ? '<span style="color: var(--primary); font-size: 0.875rem;"> (Você)</span>' : ''}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.25rem;">
                        ${roleLabels[member.role] || member.role}
                    </div>
                </div>
                ${!isCurrentUser && member.role !== 'owner' ? `
                    <button onclick="removeFamilyMember('${member.id}')" class="btn btn-danger btn-sm">
                        Remover
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderPendingInvitations(invitations) {
    const container = document.getElementById('pending-invitations-list');
    if (!container) return;
    
    if (invitations.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                <p>Nenhum convite pendente</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = invitations.map(inv => {
        const expiresDate = new Date(inv.expires_at);
        const daysLeft = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--gray-200);">
                <div>
                    <div style="font-weight: 600; color: var(--gray-900);">${inv.email}</div>
                    <div style="font-size: 0.875rem; color: var(--gray-600); margin-top: 0.25rem;">
                        Expira em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}
                    </div>
                </div>
                <button onclick="cancelInvitation('${inv.id}')" class="btn btn-secondary btn-sm">
                    Cancelar
                </button>
            </div>
        `;
    }).join('');
}

async function sendFamilyInvitation() {
    const emailInput = document.getElementById('invite-email');
    const email = emailInput?.value?.trim();
    
    if (!email) {
        alert('Digite um email válido');
        return;
    }
    
    if (!currentFamilyId) {
        alert('Erro: Família não encontrada');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('family_invitations')
            .insert([{
                family_id: currentFamilyId,
                invited_by: currentUser.id,
                email: email,
                status: 'pending'
            }])
            .select();
        
        if (error) throw error;
        
        alert(`Convite enviado para ${email}!\n\nPeça para ela:\n1. Criar uma conta com este email\n2. Fazer login no app\n3. Aceitar o convite na tela de Família`);
        
        emailInput.value = '';
        loadFamilyData();
        
    } catch (error) {
        console.error('❌ Erro ao enviar convite:', error);
        if (error.message.includes('duplicate')) {
            alert('Este email já foi convidado!');
        } else {
            alert('Erro ao enviar convite: ' + error.message);
        }
    }
}

async function cancelInvitation(invitationId) {
    if (!confirm('Cancelar este convite?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('family_invitations')
            .update({ status: 'cancelled' })
            .eq('id', invitationId);
        
        if (error) throw error;
        
        loadFamilyData();
        
    } catch (error) {
        console.error('❌ Erro ao cancelar convite:', error);
        alert('Erro ao cancelar convite');
    }
}

async function removeFamilyMember(memberId) {
    if (!confirm('Remover este membro da família?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('family_members')
            .delete()
            .eq('id', memberId);
        
        if (error) throw error;
        
        loadFamilyData();
        
    } catch (error) {
        console.error('❌ Erro ao remover membro:', error);
        alert('Erro ao remover membro');
    }
}

async function saveFamilyName() {
    const nameInput = document.getElementById('family-name');
    const newName = nameInput?.value?.trim();
    
    if (!newName) {
        alert('Digite um nome válido');
        return;
    }
    
    if (!currentFamilyId) {
        alert('Erro: Família não encontrada');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('families')
            .update({ name: newName })
            .eq('id', currentFamilyId);
        
        if (error) throw error;
        
        currentFamily.name = newName;
        alert('Nome da família atualizado!');
        
    } catch (error) {
        console.error('❌ Erro ao salvar nome:', error);
        alert('Erro ao salvar nome da família');
    }
}

// ==========================================
// UTILIDADES
// ==========================================
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}


// ==========================================
// GR�FICOS
// ==========================================
let chartInstances = {};

// Cache dos budgets carregados do Supabase para o gráfico de orçamento
let chartBudgets = [];

// Filtros cruzados entre os gráficos de Categoria e Fornecedor
let chartCrossFilter = {
    category: null,   // quando setado, gráfico de fornecedor mostra só essa categoria
    supplier: null    // quando setado, gráfico de categoria mostra só esse fornecedor
};

function populateChartYearFilter() {
    const years = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a,b) => b-a);
    const sel = document.getElementById('chart-filter-year');
    if (!sel) return;
    sel.innerHTML = '<option value="all">Todos os anos</option>';
    years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        sel.appendChild(opt);
    });

    // Default: ano atual (se existir) e mês atual
    const currentYear = new Date().getFullYear();
    if (years.includes(currentYear)) {
        sel.value = String(currentYear);
    }
    const monthSel = document.getElementById('chart-filter-month');
    if (monthSel) {
        monthSel.value = String(new Date().getMonth() + 1);
    }
}

function getChartTransactions() {
    const year = document.getElementById('chart-filter-year')?.value || 'all';
    const month = document.getElementById('chart-filter-month')?.value || 'all';
    return transactions.filter(t => {
        const d = new Date(t.date);
        if (year !== 'all' && d.getFullYear() !== parseInt(year)) return false;
        if (month !== 'all' && (d.getMonth() + 1) !== parseInt(month)) return false;
        return true;
    });
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function renderCharts() {
    const data = getChartTransactions();
    renderInfoCards(data);
    renderChartCategorias(data);
    renderChartFornecedores(data);
    renderChartSaldo(data);
    renderChartBudgetVsRealizado(data);
    updateCrossFilterIndicators();
}

function renderInfoCards(data) {
    const receitas = data.filter(t => t.type === 'income' && t.affects_balance !== false);
    const despesas = data.filter(t => t.type === 'expense' && t.affects_balance !== false);
    const totalReceitas = receitas.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const totalDespesas = despesas.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const saldo = totalReceitas - totalDespesas;

    const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const elReceitas = document.getElementById('info-card-receitas');
    const elDespesas = document.getElementById('info-card-despesas');
    const elSaldo = document.getElementById('info-card-saldo');
    const elReceitasCount = document.getElementById('info-card-receitas-count');
    const elDespesasCount = document.getElementById('info-card-despesas-count');

    if (elReceitas) elReceitas.textContent = fmt(totalReceitas);
    if (elDespesas) elDespesas.textContent = fmt(totalDespesas);
    if (elSaldo) {
        elSaldo.textContent = fmt(saldo);
        elSaldo.style.color = saldo >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    if (elReceitasCount) elReceitasCount.textContent = `${receitas.length} ${receitas.length === 1 ? 'lançamento' : 'lançamentos'}`;
    if (elDespesasCount) elDespesasCount.textContent = `${despesas.length} ${despesas.length === 1 ? 'lançamento' : 'lançamentos'}`;
}

async function loadChartBudgets() {
    if (!currentFamilyId) {
        chartBudgets = [];
        return;
    }
    const year = document.getElementById('chart-filter-year')?.value || 'all';
    const month = document.getElementById('chart-filter-month')?.value || 'all';
    try {
        let query = supabaseClient
            .from('category_budgets')
            .select('*')
            .eq('family_id', currentFamilyId);
        if (year !== 'all') query = query.eq('year', parseInt(year));
        if (month !== 'all') query = query.eq('month', parseInt(month));
        const { data, error } = await query;
        if (error) throw error;
        chartBudgets = data || [];
    } catch (err) {
        console.warn('⚠️ Erro ao carregar budgets para gráfico:', err);
        chartBudgets = [];
    }
}

function updateCrossFilterIndicators() {
    const catInfo = document.getElementById('filter-info-categorias');
    const supInfo = document.getElementById('filter-info-fornecedores');
    if (catInfo) {
        if (chartCrossFilter.supplier) {
            catInfo.style.display = 'inline-block';
            const lbl = catInfo.querySelector('[data-label]');
            if (lbl) lbl.textContent = `Fornecedor: ${chartCrossFilter.supplier}`;
            catInfo.onclick = () => { chartCrossFilter.supplier = null; renderCharts(); };
        } else {
            catInfo.style.display = 'none';
            catInfo.onclick = null;
        }
    }
    if (supInfo) {
        if (chartCrossFilter.category) {
            supInfo.style.display = 'inline-block';
            const lbl = supInfo.querySelector('[data-label]');
            if (lbl) lbl.textContent = `Categoria: ${chartCrossFilter.category}`;
            supInfo.onclick = () => { chartCrossFilter.category = null; renderCharts(); };
        } else {
            supInfo.style.display = 'none';
            supInfo.onclick = null;
        }
    }
}

function renderChartCategorias(data) {
    destroyChart('categorias');
    let despesas = data.filter(t => t.type === 'expense');
    // Aplica filtro cruzado por fornecedor (se houver)
    if (chartCrossFilter.supplier) {
        despesas = despesas.filter(t => {
            const sup = (t.supplier && t.supplier.trim()) ? t.supplier.trim() : 'Sem fornecedor';
            return sup === chartCrossFilter.supplier;
        });
    }
    const cats = {};
    despesas.forEach(t => {
        const c = t.category || 'Outros';
        cats[c] = (cats[c] || 0) + parseFloat(t.amount || 0);
    });
    // Ordenar por valor decrescente para visualização em barras
    const ordenadas = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const labels = ordenadas.map(e => e[0]);
    const valores = ordenadas.map(e => e[1]);
    const cores = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];
    const ctx = document.getElementById('chart-categorias');
    if (!ctx) return;
    chartInstances['categorias'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Despesas por Categoria',
                data: valores,
                backgroundColor: labels.map((_, i) => cores[i % cores.length]),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const idx = elements[0].index;
                const cat = labels[idx];
                openChartActionModal('category', cat);
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` R$ ${ctx.parsed.x.toLocaleString('pt-BR', {minimumFractionDigits:2})}` } }
            },
            scales: {
                x: { ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } }
            }
        }
    });
}

function renderChartFornecedores(data) {
    destroyChart('fornecedores');
    let despesas = data.filter(t => t.type === 'expense');
    // Aplica filtro cruzado por categoria (se houver)
    if (chartCrossFilter.category) {
        despesas = despesas.filter(t => (t.category || 'Outros') === chartCrossFilter.category);
    }
    const fornecedores = {};
    despesas.forEach(t => {
        const f = (t.supplier && t.supplier.trim()) ? t.supplier.trim() : 'Sem fornecedor';
        fornecedores[f] = (fornecedores[f] || 0) + parseFloat(t.amount || 0);
    });
    // Ordenar por valor decrescente
    const ordenadas = Object.entries(fornecedores).sort((a, b) => b[1] - a[1]);
    const labels = ordenadas.map(e => e[0]);
    const valores = ordenadas.map(e => e[1]);
    const cores = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];
    const ctx = document.getElementById('chart-fornecedores');
    if (!ctx) return;
    chartInstances['fornecedores'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Despesas por Fornecedor',
                data: valores,
                backgroundColor: labels.map((_, i) => cores[i % cores.length]),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const idx = elements[0].index;
                const sup = labels[idx];
                openChartActionModal('supplier', sup);
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` R$ ${ctx.parsed.x.toLocaleString('pt-BR', {minimumFractionDigits:2})}` } }
            },
            scales: {
                x: { ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } }
            }
        }
    });
}

// ===== Modal de ação ao clicar em barra do gráfico =====
function openChartActionModal(kind, label) {
    // kind: 'category' | 'supplier'
    const modal = document.getElementById('chart-action-modal');
    const title = document.getElementById('chart-action-title');
    const filterLbl = document.getElementById('chart-action-filter-label');
    const btnFilter = document.getElementById('chart-action-filter');
    const btnDetails = document.getElementById('chart-action-details');
    const btnClose = document.getElementById('close-chart-action-modal');
    if (!modal) return;

    const niceKind = kind === 'category' ? 'Categoria' : 'Fornecedor';
    title.textContent = `${niceKind}: ${label}`;
    // Se este filtro JÁ está ativo, oferece "Remover filtro" em vez de aplicar
    const isActive = (kind === 'category' && chartCrossFilter.category === label)
                  || (kind === 'supplier' && chartCrossFilter.supplier === label);
    filterLbl.textContent = isActive ? 'Remover filtro dos outros gráficos' : 'Filtrar outros gráficos';

    const close = () => modal.classList.add('hidden');
    btnClose.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    btnFilter.onclick = () => {
        if (kind === 'category') {
            chartCrossFilter.category = isActive ? null : label;
        } else {
            chartCrossFilter.supplier = isActive ? null : label;
        }
        close();
        renderCharts();
    };
    btnDetails.onclick = () => {
        close();
        openChartDetailModal(kind, label);
    };

    modal.classList.remove('hidden');
}

function openChartDetailModal(kind, label) {
    const modal = document.getElementById('chart-detail-modal');
    const title = document.getElementById('chart-detail-title');
    const summary = document.getElementById('chart-detail-summary');
    const list = document.getElementById('chart-detail-list');
    const btnClose = document.getElementById('close-chart-detail-modal');
    if (!modal) return;

    const niceKind = kind === 'category' ? 'Categoria' : 'Fornecedor';
    title.textContent = `${niceKind}: ${label}`;

    // Pega base = dados filtrados pelo mês/ano + cross-filter cruzado (mesma lógica do gráfico clicado)
    let base = getChartTransactions().filter(t => t.type === 'expense');
    if (kind === 'category') {
        // Lista de despesas dessa categoria, respeitando cross-filter de fornecedor
        if (chartCrossFilter.supplier) {
            base = base.filter(t => {
                const sup = (t.supplier && t.supplier.trim()) ? t.supplier.trim() : 'Sem fornecedor';
                return sup === chartCrossFilter.supplier;
            });
        }
        base = base.filter(t => (t.category || 'Outros') === label);
    } else {
        if (chartCrossFilter.category) {
            base = base.filter(t => (t.category || 'Outros') === chartCrossFilter.category);
        }
        base = base.filter(t => {
            const sup = (t.supplier && t.supplier.trim()) ? t.supplier.trim() : 'Sem fornecedor';
            return sup === label;
        });
    }

    // Ordena por data desc
    base.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const total = base.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const fmtMoney = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d) => { if (!d) return '—'; const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('pt-BR'); };
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    summary.innerHTML = `<strong>${base.length}</strong> lançamento(s) · Total: <strong style="color:#ef4444;">${fmtMoney(total)}</strong>`;

    if (base.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:32px; color:#9ca3af;">Nenhum lançamento encontrado.</div>`;
    } else {
        list.innerHTML = base.map(t => {
            const sup = (t.supplier && t.supplier.trim()) ? t.supplier.trim() : '—';
            const desc = t.description ? esc(t.description) : '<em style="color:#9ca3af;">sem descrição</em>';
            const cat = t.category || 'Outros';
            const paid = t.status === 'paid';
            const statusBadge = paid
                ? '<span style="font-size:.7rem; background:#dcfce7; color:#166534; padding:2px 8px; border-radius:8px; font-weight:600;">PAGO</span>'
                : '<span style="font-size:.7rem; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:8px; font-weight:600;">PENDENTE</span>';
            return `
            <div style="display:flex; gap:10px; padding:12px; border-bottom:1px solid #f1f5f9; align-items:flex-start;">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <strong style="font-size:.95rem;">${desc}</strong>
                        ${statusBadge}
                    </div>
                    <div style="font-size:.78rem; color:#6b7280; margin-top:4px;">
                        📅 ${fmtDate(t.date)} · 🏷️ ${esc(cat)}${kind === 'category' ? ` · 🏪 ${esc(sup)}` : ''}
                    </div>
                </div>
                <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <strong style="font-size:1rem; color:#ef4444;">${fmtMoney(t.amount)}</strong>
                    <button class="chart-detail-edit-btn" data-tx-id="${esc(t.id)}" style="padding:4px 10px; font-size:.75rem; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">✏️ Editar</button>
                </div>
            </div>`;
        }).join('');

        // Bind edit buttons → vai para diario.html com query param
        list.querySelectorAll('.chart-detail-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.txId;
                if (!id) return;
                window.location.href = `diario.html?edit=${encodeURIComponent(id)}`;
            });
        });
    }

    const close = () => modal.classList.add('hidden');
    btnClose.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.classList.remove('hidden');
}

function renderChartSaldo(data) {
    destroyChart('saldo');
    // Ordenar por data e acumular saldo
    const sorted = [...data].sort((a,b) => new Date(a.date) - new Date(b.date));
    let saldo = 0;
    const pontos = [];
    const mesesVisto = new Set();
    sorted.forEach(t => {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (t.type === 'income' && t.affects_balance !== false) saldo += parseFloat(t.amount || 0);
        if (t.type === 'expense') saldo -= parseFloat(t.amount || 0);
        if (!mesesVisto.has(key)) {
            mesesVisto.add(key);
            const [mesesNomes] = [['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']];
            const [y, m] = key.split('-');
            pontos.push({ label: `${mesesNomes[parseInt(m)-1]}/${y.slice(2)}`, value: saldo });
        } else {
            pontos[pontos.length - 1].value = saldo;
        }
    });
    const ctx = document.getElementById('chart-saldo');
    if (!ctx) return;
    chartInstances['saldo'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: pontos.map(p => p.label),
            datasets: [{
                label: 'Saldo',
                data: pontos.map(p => p.value),
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99,102,241,0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#6366f1',
                pointRadius: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } } }
        }
    });
}

function renderChartBudgetVsRealizado(data) {
    destroyChart('budget-vs-realizado');
    const tipo = document.getElementById('chart-budget-type')?.value || 'expense';
    const emptyMsg = document.getElementById('chart-budget-empty');

    // Soma o or\u00e7amento por categoria (agrega caso m\u00faltiplos meses no filtro)
    const orcadoPorCat = {};
    chartBudgets.filter(b => b.type === tipo).forEach(b => {
        const cat = b.category || 'Outros';
        orcadoPorCat[cat] = (orcadoPorCat[cat] || 0) + parseFloat(b.budget_amount || 0);
    });

    // Soma o realizado por categoria
    const realizadoPorCat = {};
    data.filter(t => t.type === tipo && t.affects_balance !== false).forEach(t => {
        const cat = t.category || 'Outros';
        realizadoPorCat[cat] = (realizadoPorCat[cat] || 0) + parseFloat(t.amount || 0);
    });

    // Une categorias dos dois lados
    const categorias = [...new Set([...Object.keys(orcadoPorCat), ...Object.keys(realizadoPorCat)])];
    // Ordena por or\u00e7ado desc, depois realizado desc
    categorias.sort((a, b) => (orcadoPorCat[b] || 0) - (orcadoPorCat[a] || 0) || (realizadoPorCat[b] || 0) - (realizadoPorCat[a] || 0));

    const ctx = document.getElementById('chart-budget-vs-realizado');
    if (!ctx) return;

    if (categorias.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = (Object.keys(orcadoPorCat).length === 0) ? 'block' : 'none';

    const orcado = categorias.map(c => orcadoPorCat[c] || 0);
    const realizado = categorias.map(c => realizadoPorCat[c] || 0);

    // ===== Resumo total (orçado, realizado, %) =====
    const totalOrcado = orcado.reduce((s, v) => s + v, 0);
    const totalRealizado = realizado.reduce((s, v) => s + v, 0);
    const pct = totalOrcado > 0 ? (totalRealizado / totalOrcado * 100) : 0;
    const summary = document.getElementById('chart-budget-summary');
    if (summary) {
        if (totalOrcado > 0) {
            summary.style.display = 'block';
            const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('chart-budget-total-orcado').textContent = fmt(totalOrcado);
            document.getElementById('chart-budget-total-realizado').textContent = fmt(totalRealizado);
            const pctEl = document.getElementById('chart-budget-total-pct');
            const barEl = document.getElementById('chart-budget-total-bar');
            pctEl.textContent = pct.toFixed(1) + '%';
            // Cores: para despesa, ruim quando > 100%; para receita, bom quando >= 100%
            let cor;
            if (tipo === 'expense') {
                cor = pct > 100 ? '#ef4444' : (pct > 80 ? '#f59e0b' : '#10b981');
            } else {
                cor = pct >= 100 ? '#10b981' : (pct >= 80 ? '#f59e0b' : '#ef4444');
            }
            pctEl.style.color = cor;
            barEl.style.background = cor;
            barEl.style.width = Math.min(pct, 100).toFixed(1) + '%';
        } else {
            summary.style.display = 'none';
        }
    }

    // ===== Altura dinâmica do gráfico para não omitir categorias =====
    const wrapper = document.getElementById('chart-budget-wrapper');
    if (wrapper) {
        // ~46px por categoria (caber as duas barras Orçado/Realizado) + margem para eixo/legenda
        const altura = Math.max(280, categorias.length * 46 + 60);
        wrapper.style.height = altura + 'px';
    }

    // Cor do realizado: vermelho quando estoura, verde quando ok (para despesas);
    // para receitas, invertido (verde quando atinge/excede, amarelo se abaixo).
    const corRealizado = categorias.map((c, i) => {
        const o = orcado[i];
        const r = realizado[i];
        if (tipo === 'expense') {
            if (o === 0) return '#9ca3af'; // sem or\u00e7amento
            if (r > o) return '#ef4444';   // estourou
            if (r > o * 0.8) return '#f59e0b'; // alerta
            return '#10b981';
        } else {
            if (o === 0) return '#9ca3af';
            if (r >= o) return '#10b981';
            return '#f59e0b';
        }
    });

    chartInstances['budget-vs-realizado'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categorias,
            datasets: [
                { label: 'Or\u00e7ado', data: orcado, backgroundColor: '#6366f1', borderRadius: 6 },
                { label: 'Realizado', data: realizado, backgroundColor: corRealizado, borderRadius: 6 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            // Garante espaçamento de barras e exibição de TODOS os rótulos
            categoryPercentage: 0.85,
            barPercentage: 0.9,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const val = ctx.parsed.x;
                            const cat = ctx.label;
                            const o = orcadoPorCat[cat] || 0;
                            const r = realizadoPorCat[cat] || 0;
                            const base = `${ctx.dataset.label}: R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
                            if (ctx.dataset.label === 'Realizado' && o > 0) {
                                const pct = (r / o * 100).toFixed(0);
                                return `${base}  (${pct}% do or\u00e7ado)`;
                            }
                            return base;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { callback: v => 'R$ ' + v.toLocaleString('pt-BR') } },
                y: { ticks: { autoSkip: false } }
            }
        }
    });
}

// ==========================================
// PWA INSTALLATION
// ==========================================
let deferredPrompt;

// Capturar o evento de instalação
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📲 PWA pode ser instalado');
    // Prevenir o prompt automático
    e.preventDefault();
    // Guardar o evento para uso posterior
    deferredPrompt = e;
    // Mostrar botão de instalação
    if (app.installBtn) {
        app.installBtn.style.display = 'block';
    }
});

// Lidar com clique no botão de instalação
if (app.installBtn) {
    app.installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            // Se não tiver o prompt, mostrar instruções manuais
            alert(
                '📱 Para instalar o app:\n\n' +
                '• Android Chrome: Menu (⋮) → "Adicionar à tela inicial"\n' +
                '• iPhone Safari: Compartilhar (⬆️) → "Adicionar à Tela de Início"\n' +
                '• Desktop: Menu do navegador → "Instalar Orçamento"'
            );
            return;
        }
        
        // Mostrar o prompt de instalação
        deferredPrompt.prompt();
        
        // Aguardar a escolha do usuário
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`📲 Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);
        
        // Limpar o prompt
        deferredPrompt = null;
        
        // Esconder o botão
        app.installBtn.style.display = 'none';
    });
}

// Detectar quando o app foi instalado
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA instalado com sucesso!');
    // Esconder o botão
    if (app.installBtn) {
        app.installBtn.style.display = 'none';
    }
    deferredPrompt = null;
});

// Mostrar botão se não estiver rodando como PWA standalone
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (!isStandalone) {
    console.log('🌐 Rodando no navegador - mostrar botão instalar');
    if (app.installBtn) app.installBtn.style.display = 'block';
} else {
    console.log('📱 Rodando como PWA standalone');
    if (app.installBtn) {
        app.installBtn.style.display = 'none';
    }
}
