// API Client para comunicação com backend Node.js + SQLite Local
const API_BASE_URL = 'http://localhost:3000/api';

// Estado global da aplicação (cacheado do backend)
let appData = {
    config: {
        additionalBalance: 0,
        darkMode: false
    },
    incomes: [],
    cards: [],
    installments: [],
    cashInstallments: [],
    bills: [],
    payments: [],
    categories: ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outros']
};

// Variáveis de edição
let editingCardId = null;
let editingInstallmentId = null;
let editingBillId = null;
let editingCashInstallmentId = null;

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', async function() {
    await loadAllDataFromBackend();
    initializeTabs();
    setupDarkMode();
    initAccordions();
    updateDashboard();
    renderIncomes();
    renderCards();
    renderInstallments();
    renderBills();
    renderCashInstallments();
    renderCategories();
    updateCardSelects();
    updateCategorySelects();
    setupBillRecurrenceListener();
    generateCharts();

    // Definir mês atual como padrão
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const installmentStart = document.getElementById('installmentStart');
    const viewMonth = document.getElementById('viewMonth');
    const invoiceMonth = document.getElementById('invoiceMonth');
    const cashInstStart = document.getElementById('cashInstStart');

    if (installmentStart) installmentStart.value = currentMonth;
    if (viewMonth) viewMonth.value = currentMonth;
    if (cashInstStart) cashInstStart.value = currentMonth;
    if (invoiceMonth) {
        invoiceMonth.value = currentMonth;
        renderCardInvoices();
    }
});

// ==================== CARREGAR DADOS DO BACKEND ====================

async function loadAllDataFromBackend() {
    try {
        // Carregar todas as entidades em paralelo
        const [rendasRes, cartoesRes, parcelamentosRes, contasRes, parcelamentosDinheiroRes, configRes, pagamentosRes] = await Promise.all([
            fetch(`${API_BASE_URL}/rendas`),
            fetch(`${API_BASE_URL}/cartoes`),
            fetch(`${API_BASE_URL}/parcelamentos`),
            fetch(`${API_BASE_URL}/contas`),
            fetch(`${API_BASE_URL}/parcelamentos-dinheiro`),
            fetch(`${API_BASE_URL}/configuracoes`),
            fetch(`${API_BASE_URL}/pagamentos`)
        ]);

        const rendas = await rendasRes.json();
        const cartoes = await cartoesRes.json();
        const parcelamentos = await parcelamentosRes.json();
        const contas = await contasRes.json();
        const parcelamentosDinheiro = await parcelamentosDinheiroRes.json();
        const config = await configRes.json();
        const pagamentos = await pagamentosRes.json();

        // Mapear dados para o formato do appData
        appData.incomes = (rendas.data || []).map(r => ({
            id: r.id,
            name: r.nome,
            value: r.valor,
            day: r.dia_recebimento
        }));

        appData.cards = (cartoes.data || []).map(c => ({
            id: c.id,
            name: c.nome,
            limit: c.limite,
            dueDay: c.dia_vencimento,
            closingDay: c.dia_fechamento
        }));

        appData.installments = (parcelamentos.data || []).map(p => ({
            id: p.id,
            cardId: parseInt(p.cartao),
            description: p.descricao,
            total: p.valor_total,
            count: p.parcelas,
            startMonth: p.mes_inicio,
            monthlyValue: p.valor_total / p.parcelas
        }));

        appData.bills = (contas.data || []).map(b => ({
            id: b.id,
            description: b.descricao,
            value: b.valor,
            dueDay: b.dia_vencimento,
            category: b.categoria,
            recurrence: b.recorrencia || 'monthly',
            month: b.mes
        }));

        appData.cashInstallments = (parcelamentosDinheiro.data || []).map(pd => ({
            id: pd.id,
            description: pd.descricao,
            total: pd.valor_total,
            count: pd.parcelas,
            installmentValue: pd.valor_total / pd.parcelas,
            dueDay: pd.dia_vencimento,
            category: pd.categoria,
            startMonth: pd.mes_inicio
        }));

        appData.payments = (pagamentos.data || []).map(p => ({
            key: p.chave,
            type: p.tipo,
            id: p.item_id,
            monthKey: p.mes,
            paidDate: p.data_pagamento,
            status: p.status
        }));

        // Configurações
        const configData = config.data || [];
        const additionalBalanceConfig = configData.find(c => c.chave === 'saldo_adicional');
        const darkModeConfig = configData.find(c => c.chave === 'modo_escuro');

        appData.config.additionalBalance = additionalBalanceConfig ? parseFloat(additionalBalanceConfig.valor) : 0;
        appData.config.darkMode = darkModeConfig ? darkModeConfig.valor === 'true' : false;

        // Aplicar tema
        if (appData.config.darkMode) {
            document.body.classList.add('dark-mode');
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) toggle.checked = true;
        }

        // Preencher campo de saldo
        const balanceInput = document.getElementById('additionalBalance');
        if (balanceInput) {
            balanceInput.value = appData.config.additionalBalance || '';
        }

    } catch (error) {
        console.error('Erro ao carregar dados do backend:', error);
        showNotification('Erro ao carregar dados do servidor', 'error');
    }
}

// ==================== SISTEMA DE ABAS ====================

function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = document.getElementById(tabName);
            if (targetTab) {
                targetTab.classList.add('active');

                if (tabName === 'config') {
                    setTimeout(() => generateCharts(), 100);
                }
            }
        });
    });
}

// ==================== MODO ESCURO ====================

function setupDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;

    toggle.addEventListener('change', async () => {
        appData.config.darkMode = toggle.checked;
        document.body.classList.toggle('dark-mode', toggle.checked);

        await fetch(`${API_BASE_URL}/configuracoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave: 'modo_escuro', valor: toggle.checked.toString() })
        });

        generateCharts();
    });
}

// ==================== CONFIGURAÇÕES ====================

async function saveConfig() {
    const balance = parseFloat(document.getElementById('additionalBalance').value) || 0;
    appData.config.additionalBalance = balance;

    await fetch(`${API_BASE_URL}/configuracoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'saldo_adicional', valor: balance.toString() })
    });

    updateDashboard();
    showNotification('Configurações salvas com sucesso!');
}

// ==================== CATEGORIAS ====================

async function addCategory() {
    const categoryName = document.getElementById('newCategory').value.trim();

    if (!categoryName) {
        showNotification('Por favor, preencha o nome da categoria', 'error');
        return;
    }

    if (appData.categories.includes(categoryName)) {
        showNotification('Esta categoria já existe', 'warning');
        return;
    }

    try {
        await fetch(`${API_BASE_URL}/categorias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: categoryName })
        });

        appData.categories.push(categoryName);
        renderCategories();
        updateCategorySelects();
        generateCharts();

        document.getElementById('newCategory').value = '';
        showNotification('Categoria adicionada com sucesso!');
    } catch (error) {
        showNotification('Erro ao adicionar categoria', 'error');
    }
}

async function deleteCategory(categoryName) {
    const defaultCategories = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outros'];
    if (defaultCategories.includes(categoryName)) {
        showNotification('Não é possível excluir categorias padrão', 'warning');
        return;
    }

    if (confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)) {
        try {
            await fetch(`${API_BASE_URL}/categorias/${encodeURIComponent(categoryName)}`, {
                method: 'DELETE'
            });

            appData.categories = appData.categories.filter(cat => cat !== categoryName);
            renderCategories();
            updateCategorySelects();
            generateCharts();
            showNotification('Categoria excluída com sucesso!');
        } catch (error) {
            showNotification('Erro ao excluir categoria', 'error');
        }
    }
}

function renderCategories() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    const defaultCategories = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outros'];

    container.innerHTML = appData.categories.map(cat => {
        const isDefault = defaultCategories.includes(cat);
        return `
            <div class="category-item">
                <span class="category-name">${cat}</span>
                ${!isDefault ? `
                    <button class="btn btn-danger btn-small" onclick="deleteCategory('${cat}')">Excluir</button>
                ` : `
                    <span class="badge badge-secondary">Padrão</span>
                `}
            </div>
        `;
    }).join('');
}

function updateCategorySelects() {
    const billCategorySelect = document.getElementById('billCategory');
    if (billCategorySelect) {
        const currentValue = billCategorySelect.value;
        billCategorySelect.innerHTML = appData.categories
            .map(cat => `<option value="${cat}"${currentValue === cat ? ' selected' : ''}>${cat}</option>`)
            .join('');
    }

    const cashInstCategorySelect = document.getElementById('cashInstCategory');
    if (cashInstCategorySelect) {
        const currentValue = cashInstCategorySelect.value;
        const loanCategories = ['Outros', 'Empréstimo', 'Financiamento', 'Consórcio'];
        cashInstCategorySelect.innerHTML = loanCategories
            .map(cat => `<option value="${cat}"${currentValue === cat ? ' selected' : ''}>${cat}</option>`)
            .join('');
    }
}

// ==================== FONTES DE RENDA ====================

async function addIncome() {
    const name = document.getElementById('incomeName').value.trim();
    const value = parseFloat(document.getElementById('incomeValue').value) || 0;
    const day = parseInt(document.getElementById('incomeDay').value);

    if (!name) {
        showNotification('Por favor, preencha o nome da fonte de renda', 'error');
        return;
    }

    if (value <= 0) {
        showNotification('Por favor, preencha um valor válido', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/rendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: name, valor: value, dia_recebimento: day })
        });

        const result = await response.json();

        appData.incomes.push({
            id: result.id,
            name,
            value,
            day
        });

        renderIncomes();
        updateDashboard();
        generateCharts();

        document.getElementById('incomeName').value = '';
        document.getElementById('incomeValue').value = '';

        showNotification('Renda adicionada com sucesso!');
    } catch (error) {
        showNotification('Erro ao adicionar renda', 'error');
    }
}

async function deleteIncome(id) {
    if (confirm('Tem certeza que deseja excluir esta fonte de renda?')) {
        try {
            await fetch(`${API_BASE_URL}/rendas/${id}`, {
                method: 'DELETE'
            });

            appData.incomes = appData.incomes.filter(income => income.id !== id);
            renderIncomes();
            updateDashboard();
            generateCharts();
        } catch (error) {
            showNotification('Erro ao deletar renda', 'error');
        }
    }
}

function renderIncomes() {
    const container = document.getElementById('incomeList');
    if (!container) return;

    if (appData.incomes.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma fonte de renda cadastrada ainda</div>';
    } else {
        container.innerHTML = appData.incomes.map(income => `
            <div class="item-card">
                <div class="item-info">
                    <div class="item-title">${income.name}</div>
                    <div class="item-details">
                        <span>Valor: ${formatMoney(income.value)}</span>
                        <span>Recebimento: Dia ${income.day}</span>
                    </div>
                </div>
                <button class="btn btn-danger" onclick="deleteIncome(${income.id})">Excluir</button>
            </div>
        `).join('');
    }

    const income15 = appData.incomes.filter(i => i.day === 15).reduce((sum, i) => sum + i.value, 0);
    const income30 = appData.incomes.filter(i => i.day === 30).reduce((sum, i) => sum + i.value, 0);
    const total = income15 + income30;

    const elem15 = document.getElementById('income15');
    const elem30 = document.getElementById('income30');
    const elemTotal = document.getElementById('incomeTotal');

    if (elem15) elem15.textContent = formatMoney(income15);
    if (elem30) elem30.textContent = formatMoney(income30);
    if (elemTotal) elemTotal.textContent = formatMoney(total);
}

// ==================== CARTÕES ====================

async function addCard() {
    const name = document.getElementById('cardName').value.trim();
    const limit = parseFloat(document.getElementById('cardLimit').value) || 0;
    const dueDay = parseInt(document.getElementById('cardDueDay').value) || 1;
    const closingDay = parseInt(document.getElementById('cardClosingDay').value) || 1;

    if (!name) {
        showNotification('Por favor, preencha o nome do cartão', 'error');
        return;
    }

    try {
        if (editingCardId) {
            await fetch(`${API_BASE_URL}/cartoes/${editingCardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: name, limite: limit, dia_fechamento: closingDay, dia_vencimento: dueDay })
            });

            const cardIndex = appData.cards.findIndex(c => c.id === editingCardId);
            if (cardIndex !== -1) {
                appData.cards[cardIndex] = { ...appData.cards[cardIndex], name, limit, dueDay, closingDay };
            }
            showNotification('Cartão atualizado com sucesso!');
            editingCardId = null;
            document.getElementById('cardSubmitBtn').textContent = 'Adicionar Cartão';
        } else {
            const response = await fetch(`${API_BASE_URL}/cartoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: name, limite: limit, dia_fechamento: closingDay, dia_vencimento: dueDay })
            });

            const result = await response.json();

            appData.cards.push({ id: result.id, name, limit, dueDay, closingDay });
            showNotification('Cartão adicionado com sucesso!');
        }

        renderCards();
        updateCardSelects();
        generateCharts();

        document.getElementById('cardName').value = '';
        document.getElementById('cardLimit').value = '';
        document.getElementById('cardDueDay').value = '';
        document.getElementById('cardClosingDay').value = '';
    } catch (error) {
        showNotification('Erro ao salvar cartão', 'error');
    }
}

function editCard(id) {
    const card = appData.cards.find(c => c.id === id);
    if (!card) return;

    document.getElementById('cardName').value = card.name;
    document.getElementById('cardLimit').value = card.limit;
    document.getElementById('cardDueDay').value = card.dueDay;
    document.getElementById('cardClosingDay').value = card.closingDay;

    editingCardId = id;
    document.getElementById('cardSubmitBtn').textContent = 'Atualizar Cartão';

    document.querySelector('#cards .form-section').scrollIntoView({ behavior: 'smooth' });
    showNotification('Editando cartão - atualize os campos e clique em Atualizar', 'info');
}

async function deleteCard(id) {
    if (confirm('Tem certeza que deseja excluir este cartão? Todos os parcelamentos associados também serão removidos.')) {
        try {
            await fetch(`${API_BASE_URL}/cartoes/${id}`, {
                method: 'DELETE'
            });

            appData.cards = appData.cards.filter(card => card.id !== id);
            appData.installments = appData.installments.filter(inst => inst.cardId !== id);

            renderCards();
            renderInstallments();
            updateCardSelects();
            updateDashboard();
            generateCharts();
        } catch (error) {
            showNotification('Erro ao deletar cartão', 'error');
        }
    }
}

function renderCards() {
    const container = document.getElementById('cardsList');
    if (!container) return;

    if (appData.cards.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado ainda</div>';
        return;
    }

    container.innerHTML = appData.cards.map(card => `
        <div class="item-card">
            <div class="item-info">
                <div class="item-title">${card.name}</div>
                <div class="item-details">
                    <span>Limite: ${formatMoney(card.limit)}</span>
                    <span>Vencimento: dia ${card.dueDay}</span>
                    <span>Fechamento: dia ${card.closingDay}</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="btn btn-secondary btn-small" onclick="editCard(${card.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCard(${card.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function updateCardSelects() {
    const select = document.getElementById('installmentCard');
    if (!select) return;

    if (appData.cards.length === 0) {
        select.innerHTML = '<option value="">Cadastre um cartão primeiro</option>';
        return;
    }

    select.innerHTML = '<option value="">Selecione um cartão</option>' +
        appData.cards.map(card => `<option value="${card.id}">${card.name}</option>`).join('');
}

// ==================== PARCELAMENTOS ====================

async function addInstallment() {
    const cardId = parseInt(document.getElementById('installmentCard').value);
    const description = document.getElementById('installmentDescription').value.trim();
    const monthlyValue = parseFloat(document.getElementById('installmentMonthlyValue').value) || 0;
    const count = parseInt(document.getElementById('installmentCount').value) || 1;
    const startMonth = document.getElementById('installmentStart').value;
    const total = monthlyValue * count;

    if (!cardId) {
        showNotification('Por favor, selecione um cartão', 'error');
        return;
    }

    if (!description) {
        showNotification('Por favor, preencha a descrição', 'error');
        return;
    }

    if (monthlyValue <= 0) {
        showNotification('Por favor, preencha o valor da parcela', 'error');
        return;
    }

    if (!startMonth) {
        showNotification('Por favor, selecione o mês de início', 'error');
        return;
    }

    try {
        if (editingInstallmentId) {
            await fetch(`${API_BASE_URL}/parcelamentos/${editingInstallmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    cartao: cardId.toString(),
                    valor_total: total,
                    parcelas: count,
                    parcela_atual: 1,
                    categoria: 'Cartão',
                    mes_inicio: startMonth
                })
            });

            const instIndex = appData.installments.findIndex(i => i.id === editingInstallmentId);
            if (instIndex !== -1) {
                appData.installments[instIndex] = {
                    ...appData.installments[instIndex],
                    cardId, description, total, count, startMonth,
                    monthlyValue
                };
            }
            showNotification('Parcelamento atualizado com sucesso!');
            editingInstallmentId = null;
            document.getElementById('installmentSubmitBtn').textContent = 'Adicionar Parcelamento';
        } else {
            const response = await fetch(`${API_BASE_URL}/parcelamentos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    cartao: cardId.toString(),
                    valor_total: total,
                    parcelas: count,
                    parcela_atual: 1,
                    categoria: 'Cartão',
                    mes_inicio: startMonth
                })
            });

            const result = await response.json();

            appData.installments.push({
                id: result.id,
                cardId, description, total, count, startMonth,
                monthlyValue
            });
            showNotification('Parcelamento adicionado com sucesso!');
        }

        renderInstallments();
        updateDashboard();
        generateCharts();

        document.getElementById('installmentCard').value = '';
        document.getElementById('installmentDescription').value = '';
        document.getElementById('installmentMonthlyValue').value = '';
        document.getElementById('installmentCount').value = '';
        document.getElementById('installmentStart').value = '';
    } catch (error) {
        showNotification('Erro ao salvar parcelamento', 'error');
    }
}

function editInstallment(id) {
    const inst = appData.installments.find(i => i.id === id);
    if (!inst) return;

    document.getElementById('installmentCard').value = inst.cardId;
    document.getElementById('installmentDescription').value = inst.description;
    document.getElementById('installmentMonthlyValue').value = inst.monthlyValue;
    document.getElementById('installmentCount').value = inst.count;
    document.getElementById('installmentStart').value = inst.startMonth;

    editingInstallmentId = id;
    document.getElementById('installmentSubmitBtn').textContent = 'Atualizar Parcelamento';

    document.querySelector('#installments .form-section').scrollIntoView({ behavior: 'smooth' });
    showNotification('Editando parcelamento - atualize os campos e clique em Atualizar', 'info');
}

async function deleteInstallment(id) {
    if (confirm('Tem certeza que deseja excluir este parcelamento?')) {
        try {
            await fetch(`${API_BASE_URL}/parcelamentos/${id}`, {
                method: 'DELETE'
            });

            appData.installments = appData.installments.filter(inst => inst.id !== id);
            renderInstallments();
            updateDashboard();
            generateCharts();
        } catch (error) {
            showNotification('Erro ao deletar parcelamento', 'error');
        }
    }
}

function renderInstallments() {
    const container = document.getElementById('installmentsList');
    if (!container) return;

    if (appData.installments.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum parcelamento cadastrado ainda</div>';
        return;
    }

    container.innerHTML = appData.installments.map(inst => {
        const card = appData.cards.find(c => c.id === inst.cardId);
        const cardName = card ? card.name : 'Cartão excluído';

        return `
            <div class="item-card">
                <div class="item-info">
                    <div class="item-title">${inst.description}</div>
                    <div class="item-details">
                        <span>Cartão: ${cardName}</span>
                        <span>Total: ${formatMoney(inst.total)}</span>
                        <span>${inst.count}x de ${formatMoney(inst.monthlyValue)}</span>
                        <span>Início: ${formatDate(inst.startMonth)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small" onclick="editInstallment(${inst.id})">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="deleteInstallment(${inst.id})">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== CONTAS A PAGAR ====================

function setupBillRecurrenceListener() {
    const recurrenceSelect = document.getElementById('billRecurrence');
    const monthGroup = document.getElementById('billMonthGroup');

    if (!recurrenceSelect || !monthGroup) return;

    recurrenceSelect.addEventListener('change', () => {
        if (recurrenceSelect.value === 'once') {
            monthGroup.style.display = 'block';
            const today = new Date();
            document.getElementById('billMonth').value = today.toISOString().slice(0, 7);
        } else {
            monthGroup.style.display = 'none';
        }
    });

    monthGroup.style.display = 'none';
}

async function addBill() {
    const description = document.getElementById('billDescription').value.trim();
    const value = parseFloat(document.getElementById('billValue').value) || 0;
    const dueDay = parseInt(document.getElementById('billDueDay').value);
    const category = document.getElementById('billCategory').value;
    const recurrence = document.getElementById('billRecurrence').value;
    const month = recurrence === 'once' ? document.getElementById('billMonth').value : null;

    if (!description) {
        showNotification('Por favor, preencha a descrição', 'error');
        return;
    }

    if (value <= 0) {
        showNotification('Por favor, preencha um valor válido', 'error');
        return;
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
        showNotification('Por favor, preencha um dia de vencimento válido (1-31)', 'error');
        return;
    }

    if (recurrence === 'once' && !month) {
        showNotification('Por favor, selecione o mês para a conta única', 'error');
        return;
    }

    try {
        if (editingBillId) {
            await fetch(`${API_BASE_URL}/contas/${editingBillId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    valor: value,
                    dia_vencimento: dueDay,
                    categoria: category,
                    recorrencia: recurrence,
                    mes: month
                })
            });

            const billIndex = appData.bills.findIndex(b => b.id === editingBillId);
            if (billIndex !== -1) {
                appData.bills[billIndex] = { ...appData.bills[billIndex], description, value, dueDay, category, recurrence, month };
            }
            showNotification('Conta atualizada com sucesso!');
            editingBillId = null;
            document.getElementById('billSubmitBtn').textContent = 'Adicionar Conta';
        } else {
            const response = await fetch(`${API_BASE_URL}/contas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    valor: value,
                    dia_vencimento: dueDay,
                    categoria: category,
                    recorrencia: recurrence,
                    mes: month
                })
            });

            const result = await response.json();

            appData.bills.push({ id: result.id, description, value, dueDay, category, recurrence, month });
            showNotification('Conta adicionada com sucesso!');
        }

        renderBills();
        updateDashboard();
        generateCharts();

        document.getElementById('billDescription').value = '';
        document.getElementById('billValue').value = '';
        document.getElementById('billDueDay').value = '';
        document.getElementById('billCategory').value = 'Outros';
        document.getElementById('billRecurrence').value = 'monthly';
        document.getElementById('billMonthGroup').style.display = 'none';
    } catch (error) {
        showNotification('Erro ao salvar conta', 'error');
    }
}

function editBill(id) {
    const bill = appData.bills.find(b => b.id === id);
    if (!bill) return;

    document.getElementById('billDescription').value = bill.description;
    document.getElementById('billValue').value = bill.value;
    document.getElementById('billDueDay').value = bill.dueDay;
    document.getElementById('billCategory').value = bill.category || 'Outros';
    document.getElementById('billRecurrence').value = bill.recurrence;

    if (bill.recurrence === 'once' && bill.month) {
        document.getElementById('billMonth').value = bill.month;
        document.getElementById('billMonthGroup').style.display = 'block';
    }

    editingBillId = id;
    document.getElementById('billSubmitBtn').textContent = 'Atualizar Conta';

    document.querySelector('#bills .form-section').scrollIntoView({ behavior: 'smooth' });
    showNotification('Editando conta - atualize os campos e clique em Atualizar', 'info');
}

async function deleteBill(id) {
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
        try {
            await fetch(`${API_BASE_URL}/contas/${id}`, {
                method: 'DELETE'
            });

            appData.bills = appData.bills.filter(bill => bill.id !== id);
            renderBills();
            updateDashboard();
            generateCharts();
        } catch (error) {
            showNotification('Erro ao deletar conta', 'error');
        }
    }
}

function renderBills() {
    const container = document.getElementById('billsList');
    if (!container) return;

    if (appData.bills.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhuma conta cadastrada ainda</div>';
        return;
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    container.innerHTML = appData.bills.map(bill => {
        const recurrenceText = bill.recurrence === 'monthly' ? 'Mensal' : `Única (${formatDate(bill.month)})`;
        const monthToCheck = bill.recurrence === 'once' ? bill.month : currentMonth;
        const paid = isPaid('bill', bill.id, monthToCheck);
        const paidClass = paid ? 'paid-item' : '';

        return `
            <div class="item-card ${paidClass}">
                <div class="item-info">
                    <div class="item-title">
                        ${bill.description}
                        ${paid ? '<span class="badge badge-success">✓ Pago</span>' : ''}
                    </div>
                    <div class="item-details">
                        <span>Valor: ${formatMoney(bill.value)}</span>
                        <span>Vencimento: Dia ${bill.dueDay}</span>
                        <span>Categoria: ${bill.category || 'Outros'}</span>
                        <span>${recurrenceText}</span>
                    </div>
                </div>
                <div class="item-actions">
                    ${paid
                        ? `<button class="btn btn-small" onclick="unmarkAsPaid('bill', ${bill.id}, '${monthToCheck}')">Desmarcar</button>`
                        : `<button class="btn btn-small btn-success" onclick="markAsPaid('bill', ${bill.id}, '${monthToCheck}')">Pagar</button>`
                    }
                    <button class="btn btn-secondary btn-small" onclick="editBill(${bill.id})">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="deleteBill(${bill.id})">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== PARCELAMENTOS EM DINHEIRO ====================

async function addCashInstallment() {
    const description = document.getElementById('cashInstDesc').value.trim();
    const installmentValue = parseFloat(document.getElementById('cashInstValue').value) || 0;
    const count = parseInt(document.getElementById('cashInstCount').value) || 0;
    const dueDay = parseInt(document.getElementById('cashInstDay').value);
    const category = document.getElementById('cashInstCategory').value;
    const startMonth = document.getElementById('cashInstStart').value;
    const total = installmentValue * count;

    if (!description) {
        showNotification('Por favor, preencha a descrição', 'error');
        return;
    }

    if (installmentValue <= 0) {
        showNotification('Por favor, preencha o valor da parcela', 'error');
        return;
    }

    if (count <= 0) {
        showNotification('Por favor, preencha um número de parcelas válido', 'error');
        return;
    }

    if (!dueDay || dueDay < 1 || dueDay > 31) {
        showNotification('Por favor, preencha um dia de vencimento válido (1-31)', 'error');
        return;
    }

    if (!startMonth) {
        showNotification('Por favor, selecione o mês de início', 'error');
        return;
    }

    try {
        if (editingCashInstallmentId) {
            await fetch(`${API_BASE_URL}/parcelamentos-dinheiro/${editingCashInstallmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    valor_total: total,
                    parcelas: count,
                    parcela_atual: 1,
                    dia_vencimento: dueDay,
                    categoria: category,
                    mes_inicio: startMonth
                })
            });

            const instIndex = appData.cashInstallments.findIndex(i => i.id === editingCashInstallmentId);
            if (instIndex !== -1) {
                appData.cashInstallments[instIndex] = {
                    ...appData.cashInstallments[instIndex],
                    description, total, count, installmentValue, dueDay, category, startMonth
                };
            }
            showNotification('Parcelamento em dinheiro atualizado com sucesso!');
            editingCashInstallmentId = null;
            document.getElementById('cashInstSubmitBtn').textContent = 'Adicionar Parcelamento';
        } else {
            const response = await fetch(`${API_BASE_URL}/parcelamentos-dinheiro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    descricao: description,
                    valor_total: total,
                    parcelas: count,
                    parcela_atual: 1,
                    dia_vencimento: dueDay,
                    categoria: category,
                    mes_inicio: startMonth
                })
            });

            const result = await response.json();

            appData.cashInstallments.push({
                id: result.id,
                description, total, count, installmentValue, dueDay, category, startMonth
            });
            showNotification('Parcelamento em dinheiro adicionado com sucesso!');
        }

        renderCashInstallments();
        updateDashboard();
        generateCharts();

        document.getElementById('cashInstDesc').value = '';
        document.getElementById('cashInstValue').value = '';
        document.getElementById('cashInstCount').value = '';
        document.getElementById('cashInstDay').value = '';
        document.getElementById('cashInstCategory').value = 'Outros';
        document.getElementById('cashInstStart').value = '';
    } catch (error) {
        showNotification('Erro ao salvar parcelamento em dinheiro', 'error');
    }
}

function editCashInstallment(id) {
    const inst = appData.cashInstallments.find(i => i.id === id);
    if (!inst) return;

    document.getElementById('cashInstDesc').value = inst.description;
    document.getElementById('cashInstValue').value = inst.installmentValue;
    document.getElementById('cashInstCount').value = inst.count;
    document.getElementById('cashInstDay').value = inst.dueDay;
    document.getElementById('cashInstCategory').value = inst.category || 'Outros';
    document.getElementById('cashInstStart').value = inst.startMonth;

    editingCashInstallmentId = id;
    document.getElementById('cashInstSubmitBtn').textContent = 'Atualizar Parcelamento';

    const forms = document.querySelectorAll('#bills .form-section');
    if (forms[1]) {
        forms[1].scrollIntoView({ behavior: 'smooth' });
    }
    showNotification('Editando parcelamento - atualize os campos e clique em Atualizar', 'info');
}

async function deleteCashInstallment(id) {
    if (confirm('Tem certeza que deseja excluir este parcelamento?')) {
        try {
            await fetch(`${API_BASE_URL}/parcelamentos-dinheiro/${id}`, {
                method: 'DELETE'
            });

            appData.cashInstallments = appData.cashInstallments.filter(inst => inst.id !== id);
            renderCashInstallments();
            updateDashboard();
            generateCharts();
            showNotification('Parcelamento excluído com sucesso!');
        } catch (error) {
            showNotification('Erro ao deletar parcelamento', 'error');
        }
    }
}

function renderCashInstallments() {
    const container = document.getElementById('cashInstallmentsList');
    if (!container) return;

    if (appData.cashInstallments.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum parcelamento em dinheiro cadastrado ainda</div>';
        return;
    }

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    container.innerHTML = appData.cashInstallments.map(inst => {
        const startDate = new Date(inst.startMonth + '-01');
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + inst.count - 1);
        const endMonthKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;

        const paymentId = `cash-inst-${inst.id}-${currentMonth}`;
        const paid = isPaid('cash-installment', inst.id, currentMonth);
        const paidClass = paid ? 'paid-item' : '';

        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const [currentYear, currentMonthNum] = currentMonth.split('-').map(Number);
        const monthsDiff = (currentYear - startYear) * 12 + (currentMonthNum - startMonth);
        const currentInstallment = monthsDiff >= 0 && monthsDiff < inst.count ? monthsDiff + 1 : null;

        return `
            <div class="item-card ${paidClass}">
                <div class="item-info">
                    <div class="item-title">
                        ${inst.description}
                        ${paid && currentInstallment ? '<span class="badge badge-success">✓ Pago este mês</span>' : ''}
                    </div>
                    <div class="item-details">
                        <span>Total: ${formatMoney(inst.total)}</span>
                        <span>Parcelas: ${inst.count}x de ${formatMoney(inst.installmentValue)}</span>
                        ${currentInstallment ? `<span>Parcela Atual: ${currentInstallment}/${inst.count}</span>` : ''}
                        <span>Vencimento: Dia ${inst.dueDay}</span>
                        <span>Categoria: ${inst.category}</span>
                        <span>Período: ${formatDate(inst.startMonth)} a ${formatDate(endMonthKey)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    ${currentInstallment && !paid
                        ? `<button class="btn btn-small btn-success" onclick="markAsPaid('cash-installment', ${inst.id}, '${currentMonth}')">Pagar Parcela</button>`
                        : currentInstallment && paid
                        ? `<button class="btn btn-small" onclick="unmarkAsPaid('cash-installment', ${inst.id}, '${currentMonth}')">Desmarcar</button>`
                        : ''
                    }
                    <button class="btn btn-secondary btn-small" onclick="editCashInstallment(${inst.id})">Editar</button>
                    <button class="btn btn-danger btn-small" onclick="deleteCashInstallment(${inst.id})">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== PAGAMENTOS ====================

async function markAsPaid(type, id, monthKey) {
    const paymentKey = `${type}-${id}-${monthKey}`;

    const existingPayment = appData.payments.find(p => p.key === paymentKey);
    if (existingPayment) {
        showNotification('Este item já foi marcado como pago', 'warning');
        return;
    }

    try {
        await fetch(`${API_BASE_URL}/pagamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chave: paymentKey, tipo: type, item_id: id, mes: monthKey, status: 'paid' })
        });

        appData.payments.push({
            key: paymentKey,
            type, id, monthKey,
            paidDate: new Date().toISOString(),
            status: 'paid'
        });

        showNotification('Marcado como pago!');

        if (type === 'bill' || type === 'installment') {
            generatePaymentView();
            renderCardInvoices();
        }
        renderBills();
        renderCashInstallments();
    } catch (error) {
        showNotification('Erro ao marcar como pago', 'error');
    }
}

async function unmarkAsPaid(type, id, monthKey) {
    const paymentKey = `${type}-${id}-${monthKey}`;

    try {
        await fetch(`${API_BASE_URL}/pagamentos/${encodeURIComponent(paymentKey)}`, {
            method: 'DELETE'
        });

        appData.payments = appData.payments.filter(p => p.key !== paymentKey);

        showNotification('Desmarcado como pago');
        generatePaymentView();
        renderCardInvoices();
        renderBills();
        renderCashInstallments();
    } catch (error) {
        showNotification('Erro ao desmarcar pagamento', 'error');
    }
}

function isPaid(type, id, monthKey) {
    const paymentKey = `${type}-${id}-${monthKey}`;
    return appData.payments.some(p => p.key === paymentKey);
}

async function payFullInvoice(cardId, monthKey) {
    const message = 'Tem certeza que deseja marcar TODA a fatura deste cartão como paga?';

    if (!confirm(message)) return;

    const [year, month] = monthKey.split('-').map(Number);

    for (const inst of appData.installments) {
        if (inst.cardId !== cardId) continue;

        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1);
        const currentDate = new Date(year, month - 1);

        const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());

        if (monthsDiff >= 0 && monthsDiff < inst.count) {
            const paymentKey = `installment-${inst.id}-${monthKey}`;
            const existing = appData.payments.find(p => p.key === paymentKey);

            if (!existing) {
                await fetch(`${API_BASE_URL}/pagamentos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chave: paymentKey,
                        tipo: 'installment',
                        item_id: inst.id,
                        mes: monthKey,
                        status: 'paid'
                    })
                });

                appData.payments.push({
                    key: paymentKey,
                    type: 'installment',
                    id: inst.id,
                    monthKey,
                    paidDate: new Date().toISOString(),
                    status: 'paid'
                });
            }
        }
    }

    showNotification('Fatura completa marcada como paga!');
    renderCardInvoices();
}

// Continua no próximo arquivo devido ao limite de caracteres...
// (Falta Dashboard, Visualizações, Projeções, Gráficos, Histórico e Accordion)
// PARTE 2 DO SCRIPT.JS - Copie e cole este conteúdo no final do script.js

// ==================== DASHBOARD ====================

function updateDashboard() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const monthData = calculateMonthData(currentMonth, appData.config.additionalBalance);
    const totalIncome = appData.incomes.reduce((sum, inc) => sum + inc.value, 0);

    const incomeEl = document.getElementById('currentIncome');
    const expensesEl = document.getElementById('currentExpenses');
    const balanceEl = document.getElementById('currentBalance');

    if (incomeEl) incomeEl.textContent = formatMoney(totalIncome);
    if (expensesEl) expensesEl.textContent = formatMoney(monthData.totalExpenses);

    if (balanceEl) {
        balanceEl.textContent = formatMoney(monthData.finalBalance);
        balanceEl.className = 'value ' + (monthData.finalBalance >= 0 ? 'positive' : 'negative');
    }
}

// ==================== VISUALIZAÇÃO DE PAGAMENTOS ====================

function generatePaymentView() {
    const monthKey = document.getElementById('viewMonth').value;
    if (!monthKey) {
        showNotification('Por favor, selecione um mês', 'error');
        return;
    }

    const container = document.getElementById('paymentViewContent');
    const [year, month] = monthKey.split('-').map(Number);

    const income15 = appData.incomes.filter(i => i.day === 15).reduce((sum, i) => sum + i.value, 0);
    const income30 = appData.incomes.filter(i => i.day === 30).reduce((sum, i) => sum + i.value, 0);

    const expenses = getMonthExpenses(monthKey);

    const payments15 = expenses.filter(e => e.dueDay >= 1 && e.dueDay <= 15);
    const payments30 = expenses.filter(e => e.dueDay > 15);

    const total15 = payments15.reduce((sum, p) => sum + p.value, 0);
    const total30 = payments30.reduce((sum, p) => sum + p.value, 0);

    const balance15 = income15 - total15;
    const balance30 = income30 - total30 + balance15;

    container.innerHTML = `
        <div class="payment-periods">
            <div class="period-card">
                <div class="period-header">
                    <div>
                        <div class="period-title">Período 1-15 (Salário dia 15)</div>
                    </div>
                    <div class="period-balance ${balance15 >= 0 ? 'positive' : 'negative'}">
                        ${formatMoney(balance15)}
                    </div>
                </div>

                <div class="payment-list">
                    ${payments15.length === 0 ? '<div class="empty-state">Nenhum pagamento neste período</div>' :
                      payments15.map(p => {
                        const paid = isPaid(p.type === 'card' ? 'installment' : 'bill', p.id, monthKey);
                        return `
                        <div class="payment-item ${p.type} ${paid ? 'paid' : ''}">
                            <div class="payment-item-left">
                                <div class="payment-description">
                                    ${paid ? '<span class="paid-badge">✓</span>' : ''}
                                    ${p.description}
                                </div>
                                <div class="payment-type">${p.typeLabel} - Vence dia ${p.dueDay}</div>
                            </div>
                            <div class="payment-item-right">
                                <div class="payment-value">${formatMoney(p.value)}</div>
                                <div class="payment-actions">
                                    ${paid ? `
                                        <button class="btn-small btn-secondary" onclick="unmarkAsPaid('${p.type === 'card' ? 'installment' : 'bill'}', ${p.id}, '${monthKey}')">
                                            Desmarcar
                                        </button>
                                    ` : `
                                        <button class="btn-small btn-success" onclick="markAsPaid('${p.type === 'card' ? 'installment' : 'bill'}', ${p.id}, '${monthKey}')">
                                            Pagar
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        `;
                      }).join('')}
                </div>

                <div class="period-summary">
                    <div class="period-summary-item">
                        <span class="label">Renda</span>
                        <span class="value" style="color: var(--success);">${formatMoney(income15)}</span>
                    </div>
                    <div class="period-summary-item">
                        <span class="label">Despesas</span>
                        <span class="value" style="color: var(--danger);">${formatMoney(total15)}</span>
                    </div>
                    <div class="period-summary-item">
                        <span class="label">Saldo</span>
                        <span class="value ${balance15 >= 0 ? '' : 'negative-balance'}">${formatMoney(balance15)}</span>
                    </div>
                </div>
            </div>

            <div class="period-card">
                <div class="period-header">
                    <div>
                        <div class="period-title">Período 16-30 (Salário dia 30)</div>
                    </div>
                    <div class="period-balance ${balance30 >= 0 ? 'positive' : 'negative'}">
                        ${formatMoney(balance30)}
                    </div>
                </div>

                <div class="payment-list">
                    ${payments30.length === 0 ? '<div class="empty-state">Nenhum pagamento neste período</div>' :
                      payments30.map(p => {
                        const paid = isPaid(p.type === 'card' ? 'installment' : 'bill', p.id, monthKey);
                        return `
                        <div class="payment-item ${p.type} ${paid ? 'paid' : ''}">
                            <div class="payment-item-left">
                                <div class="payment-description">
                                    ${paid ? '<span class="paid-badge">✓</span>' : ''}
                                    ${p.description}
                                </div>
                                <div class="payment-type">${p.typeLabel} - Vence dia ${p.dueDay}</div>
                            </div>
                            <div class="payment-item-right">
                                <div class="payment-value">${formatMoney(p.value)}</div>
                                <div class="payment-actions">
                                    ${paid ? `
                                        <button class="btn-small btn-secondary" onclick="unmarkAsPaid('${p.type === 'card' ? 'installment' : 'bill'}', ${p.id}, '${monthKey}')">
                                            Desmarcar
                                        </button>
                                    ` : `
                                        <button class="btn-small btn-success" onclick="markAsPaid('${p.type === 'card' ? 'installment' : 'bill'}', ${p.id}, '${monthKey}')">
                                            Pagar
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        `;
                      }).join('')}
                </div>

                <div class="period-summary">
                    <div class="period-summary-item">
                        <span class="label">Saldo Anterior</span>
                        <span class="value ${balance15 >= 0 ? '' : 'negative-balance'}">${formatMoney(balance15)}</span>
                    </div>
                    <div class="period-summary-item">
                        <span class="label">Renda</span>
                        <span class="value" style="color: var(--success);">${formatMoney(income30)}</span>
                    </div>
                    <div class="period-summary-item">
                        <span class="label">Despesas</span>
                        <span class="value" style="color: var(--danger);">${formatMoney(total30)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getMonthExpenses(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    const expenses = [];

    appData.installments.forEach(inst => {
        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1);
        const currentDate = new Date(year, month - 1);

        const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());

        if (monthsDiff >= 0 && monthsDiff < inst.count) {
            const card = appData.cards.find(c => c.id === inst.cardId);
            expenses.push({
                id: inst.id,
                description: `${inst.description} (${card ? card.name : 'Cartão'})`,
                value: inst.monthlyValue,
                dueDay: card ? card.dueDay : 10,
                type: 'card',
                typeLabel: card ? card.name : 'Cartão de Crédito',
                category: card ? card.name : 'Cartão'
            });
        }
    });

    appData.bills.forEach(bill => {
        if (bill.recurrence === 'monthly') {
            expenses.push({
                id: bill.id,
                description: bill.description,
                value: bill.value,
                dueDay: bill.dueDay,
                type: 'cash',
                typeLabel: 'Dinheiro',
                category: bill.category || 'Dinheiro'
            });
        } else if (bill.month === monthKey) {
            expenses.push({
                id: bill.id,
                description: bill.description,
                value: bill.value,
                dueDay: bill.dueDay,
                type: 'cash',
                typeLabel: 'Dinheiro',
                category: bill.category || 'Dinheiro'
            });
        }
    });

    appData.cashInstallments.forEach(inst => {
        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1);
        const currentDate = new Date(year, month - 1);

        const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());

        if (monthsDiff >= 0 && monthsDiff < inst.count) {
            const currentInstallment = monthsDiff + 1;
            expenses.push({
                id: inst.id,
                description: `${inst.description} (${currentInstallment}/${inst.count})`,
                value: inst.installmentValue,
                dueDay: inst.dueDay,
                type: 'cash-installment',
                typeLabel: 'Empréstimo/Parcelamento',
                category: inst.category || 'Outros'
            });
        }
    });

    return expenses.sort((a, b) => a.dueDay - b.dueDay);
}

// ==================== PROJEÇÃO ====================

function generateProjection() {
    const months = parseInt(document.getElementById('projectionMonths').value) || 12;
    const container = document.getElementById('projectionTable');

    const totalIncome = appData.incomes.reduce((sum, inc) => sum + inc.value, 0);

    if (!totalIncome) {
        container.innerHTML = '<div class="empty-state">Configure suas fontes de renda primeiro</div>';
        return;
    }

    const today = new Date();
    const projectionData = [];
    let carryOverBalance = appData.config.additionalBalance;

    for (let i = 0; i < months; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const monthData = calculateMonthData(monthKey, carryOverBalance);
        projectionData.push({
            month: monthKey,
            monthName: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
            income: totalIncome,
            initialBalance: carryOverBalance,
            expenses: monthData.totalExpenses,
            finalBalance: monthData.finalBalance,
            details: monthData.details
        });

        carryOverBalance = monthData.finalBalance;
    }

    // Layout responsivo - deixa o CSS Grid gerenciar automaticamente
    let html = '<div class="projection-container"><div class="projection-row">';

    projectionData.forEach(data => {
        const balanceClass = data.finalBalance >= 0 ? 'positive' : 'negative';
        html += `
            <div class="projection-card">
                <div class="projection-month">${data.monthName}</div>
                <div class="projection-values">
                    <div class="projection-item">
                        <span class="label">Saldo Anterior</span>
                        <span class="value">${formatMoney(data.initialBalance)}</span>
                    </div>
                    <div class="projection-item positive">
                        <span class="label">Renda</span>
                        <span class="value">+${formatMoney(data.income)}</span>
                    </div>
                    <div class="projection-item negative">
                        <span class="label">Despesas</span>
                        <span class="value">-${formatMoney(data.expenses)}</span>
                    </div>
                    <div class="projection-item final ${balanceClass}">
                        <span class="label">Saldo Final</span>
                        <span class="value">${formatMoney(data.finalBalance)}</span>
                    </div>
                </div>
                ${data.details.length > 0 ? `
                    <details class="projection-details">
                        <summary>Ver despesas (${data.details.length})</summary>
                        <div class="projection-details-list">
                            ${data.details.map(d => `
                                <div class="detail-item">
                                    <span>${d.description}</span>
                                    <span>${formatMoney(d.value)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                ` : ''}
            </div>
        `;
    });

    html += '</div></div>';
    container.innerHTML = html;
}

// ==================== CÁLCULOS ====================

function calculateMonthData(monthKey, previousBalance) {
    const [year, month] = monthKey.split('-').map(Number);
    const totalIncome = appData.incomes.reduce((sum, inc) => sum + inc.value, 0);
    let totalExpenses = 0;

    // Agrupar despesas por cartão e tipo
    const cardExpensesByCard = {};
    let cashExpenses = 0;
    let loanExpenses = 0;

    // Calcular despesas de cartões (agrupados por cartão)
    appData.installments.forEach(inst => {
        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1);
        const currentDate = new Date(year, month - 1);

        const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());

        if (monthsDiff >= 0 && monthsDiff < inst.count) {
            const card = appData.cards.find(c => c.id === inst.cardId);
            const cardName = card ? card.name : 'Cartão Desconhecido';

            if (!cardExpensesByCard[cardName]) {
                cardExpensesByCard[cardName] = 0;
            }
            cardExpensesByCard[cardName] += inst.monthlyValue;
            totalExpenses += inst.monthlyValue;
        }
    });

    // Calcular despesas em dinheiro
    appData.bills.forEach(bill => {
        if (bill.recurrence === 'monthly') {
            cashExpenses += bill.value;
            totalExpenses += bill.value;
        } else if (bill.month === monthKey) {
            cashExpenses += bill.value;
            totalExpenses += bill.value;
        }
    });

    // Calcular parcelamentos/empréstimos em dinheiro
    appData.cashInstallments.forEach(inst => {
        const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1);
        const currentDate = new Date(year, month - 1);

        const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());

        if (monthsDiff >= 0 && monthsDiff < inst.count) {
            loanExpenses += inst.installmentValue;
            totalExpenses += inst.installmentValue;
        }
    });

    const finalBalance = previousBalance + totalIncome - totalExpenses;

    // Criar array de detalhes agrupados por tipo
    const details = [];

    // Adicionar cada cartão separadamente
    Object.keys(cardExpensesByCard).sort().forEach(cardName => {
        details.push({
            description: `💳 ${cardName}`,
            value: cardExpensesByCard[cardName]
        });
    });

    // Adicionar dinheiro
    if (cashExpenses > 0) {
        details.push({
            description: '💵 Dinheiro',
            value: cashExpenses
        });
    }

    // Adicionar empréstimos
    if (loanExpenses > 0) {
        details.push({
            description: '💸 Empréstimos/Financiamentos',
            value: loanExpenses
        });
    }

    return {
        totalExpenses,
        finalBalance,
        details
    };
}

// ==================== GRÁFICOS ====================

function generateCharts() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const expenses = getMonthExpenses(currentMonth);

    const expensesByCategory = {};
    expenses.forEach(exp => {
        const cat = exp.category || exp.typeLabel;
        if (!expensesByCategory[cat]) {
            expensesByCategory[cat] = 0;
        }
        expensesByCategory[cat] += exp.value;
    });

    const pieCtx = document.getElementById('expensesPieChart');
    if (pieCtx) {
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e2e8f0' : '#1e293b';

        if (window.pieChart) window.pieChart.destroy();

        window.pieChart = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(expensesByCategory),
                datasets: [{
                    data: Object.values(expensesByCategory),
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: textColor }
                    },
                    title: {
                        display: true,
                        text: 'Despesas por Tipo de Pagamento',
                        color: textColor
                    }
                }
            }
        });
    }

    const barCtx = document.getElementById('incomeExpensesChart');
    if (barCtx) {
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const gridColor = isDark ? '#475569' : '#e2e8f0';

        const totalIncome = appData.incomes.reduce((sum, inc) => sum + inc.value, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.value, 0);

        if (window.barChart) window.barChart.destroy();

        window.barChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Mês Atual'],
                datasets: [
                    {
                        label: 'Renda',
                        data: [totalIncome],
                        backgroundColor: '#10b981'
                    },
                    {
                        label: 'Despesas',
                        data: [totalExpenses],
                        backgroundColor: '#ef4444'
                    },
                    {
                        label: 'Saldo',
                        data: [totalIncome - totalExpenses],
                        backgroundColor: totalIncome - totalExpenses >= 0 ? '#3b82f6' : '#f59e0b'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: textColor }
                    },
                    title: {
                        display: true,
                        text: 'Renda vs Despesas',
                        color: textColor
                    }
                },
                scales: {
                    y: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }

    const catCtx = document.getElementById('categoriesChart');
    if (catCtx) {
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const gridColor = isDark ? '#475569' : '#e2e8f0';

        const categoryExpenses = {};

        expenses.forEach(exp => {
            let cat = 'Outros';

            if (exp.type === 'cash' || exp.type === 'cash-installment') {
                cat = exp.category || 'Outros';
            } else if (exp.type === 'card') {
                cat = 'Cartão de Crédito';
            }

            if (!categoryExpenses[cat]) {
                categoryExpenses[cat] = 0;
            }
            categoryExpenses[cat] += exp.value;
        });

        const sortedCategories = Object.entries(categoryExpenses)
            .sort((a, b) => b[1] - a[1]);

        if (window.catChart) window.catChart.destroy();

        window.catChart = new Chart(catCtx, {
            type: 'bar',
            data: {
                labels: sortedCategories.map(c => c[0]),
                datasets: [{
                    label: 'Despesas',
                    data: sortedCategories.map(c => c[1]),
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
                        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
                    ]
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Despesas por Categoria',
                        color: textColor
                    }
                },
                scales: {
                    y: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(2);
                            }
                        },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }
}

// ==================== EXPORTAR PARA EXCEL ====================

function exportToExcel() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const data = {
        config: appData.config,
        incomes: appData.incomes,
        cards: appData.cards,
        installments: appData.installments,
        bills: appData.bills,
        expenses: getMonthExpenses(currentMonth)
    };

    const wb = XLSX.utils.book_new();

    const incomeData = appData.incomes.map(i => ({
        'Nome': i.name,
        'Valor': i.value,
        'Dia Recebimento': i.day
    }));
    const wsIncome = XLSX.utils.json_to_sheet(incomeData);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'Fontes de Renda');

    const cardsData = appData.cards.map(c => ({
        'Nome': c.name,
        'Limite': c.limit,
        'Vencimento': c.dueDay,
        'Fechamento': c.closingDay
    }));
    const wsCards = XLSX.utils.json_to_sheet(cardsData);
    XLSX.utils.book_append_sheet(wb, wsCards, 'Cartoes');

    const installmentsData = appData.installments.map(inst => {
        const card = appData.cards.find(c => c.id === inst.cardId);
        return {
            'Descrição': inst.description,
            'Cartão': card ? card.name : 'N/A',
            'Total': inst.total,
            'Parcelas': inst.count,
            'Valor Mensal': inst.monthlyValue,
            'Início': inst.startMonth
        };
    });
    const wsInst = XLSX.utils.json_to_sheet(installmentsData);
    XLSX.utils.book_append_sheet(wb, wsInst, 'Parcelamentos');

    const billsData = appData.bills.map(b => ({
        'Descrição': b.description,
        'Valor': b.value,
        'Vencimento': b.dueDay,
        'Recorrência': b.recurrence === 'monthly' ? 'Mensal' : 'Única',
        'Mês': b.month || 'N/A'
    }));
    const wsBills = XLSX.utils.json_to_sheet(billsData);
    XLSX.utils.book_append_sheet(wb, wsBills, 'Contas a Pagar');

    const expensesData = data.expenses.map(e => ({
        'Descrição': e.description,
        'Valor': e.value,
        'Vencimento': e.dueDay,
        'Tipo': e.typeLabel
    }));
    const wsExp = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExp, 'Despesas Mês Atual');

    const fileName = `financeiro_${today.toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification('Dados exportados com sucesso!');
}

// ==================== HISTÓRICO DE PAGAMENTOS ====================

function generateHistory() {
    const startMonth = document.getElementById('historyStartMonth').value;
    const endMonth = document.getElementById('historyEndMonth').value;
    const filterType = document.getElementById('historyType').value;
    const container = document.getElementById('historyContent');
    const summaryContainer = document.getElementById('historySummary');

    if (!startMonth || !endMonth) {
        container.innerHTML = '<div class="empty-state">Selecione o período para visualizar o histórico</div>';
        summaryContainer.innerHTML = '';
        return;
    }

    const filteredPayments = appData.payments.filter(p => {
        const paidMonth = p.monthKey;
        if (paidMonth < startMonth || paidMonth > endMonth) return false;
        if (filterType !== 'all' && p.type !== filterType) return false;
        return true;
    });

    if (filteredPayments.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum pagamento encontrado neste período</div>';
        summaryContainer.innerHTML = '';
        return;
    }

    const paymentsByMonth = {};
    filteredPayments.forEach(payment => {
        if (!paymentsByMonth[payment.monthKey]) {
            paymentsByMonth[payment.monthKey] = [];
        }
        paymentsByMonth[payment.monthKey].push(payment);
    });

    let html = '<div class="history-timeline">';
    let totalPaid = 0;
    let totalCount = 0;

    Object.keys(paymentsByMonth).sort().reverse().forEach(monthKey => {
        const payments = paymentsByMonth[monthKey];
        const monthDate = new Date(monthKey + '-01');
        const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        html += `
            <div class="history-month-section">
                <h3 class="history-month-title">${monthName}</h3>
                <div class="history-items">
        `;

        payments.forEach(payment => {
            const item = getPaymentItemDetails(payment);
            if (!item) return;

            totalPaid += item.value;
            totalCount++;

            const typeIcon = payment.type === 'bill' ? '💵' :
                           payment.type === 'installment' ? '💳' : '📝';
            const typeLabel = payment.type === 'bill' ? 'Conta em Dinheiro' :
                            payment.type === 'installment' ? 'Cartão de Crédito' :
                            'Parcelamento em Dinheiro';

            html += `
                <div class="history-item">
                    <div class="history-item-icon">${typeIcon}</div>
                    <div class="history-item-content">
                        <div class="history-item-title">${item.description}</div>
                        <div class="history-item-meta">
                            <span class="history-type">${typeLabel}</span>
                            <span class="history-date">Pago em ${new Date(payment.paidDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                    </div>
                    <div class="history-item-value">${formatMoney(item.value)}</div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    summaryContainer.innerHTML = `
        <div class="summary-grid">
            <div class="summary-box">
                <div class="summary-label">Total de Pagamentos</div>
                <div class="summary-value">${totalCount}</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Valor Total Pago</div>
                <div class="summary-value negative">${formatMoney(totalPaid)}</div>
            </div>
            <div class="summary-box">
                <div class="summary-label">Média por Pagamento</div>
                <div class="summary-value">${formatMoney(totalPaid / totalCount)}</div>
            </div>
        </div>
    `;
}

function getPaymentItemDetails(payment) {
    let item = null;

    if (payment.type === 'bill') {
        const bill = appData.bills.find(b => b.id === payment.id);
        if (bill) {
            item = {
                description: bill.description,
                value: bill.value
            };
        }
    } else if (payment.type === 'installment') {
        const inst = appData.installments.find(i => i.id === payment.id);
        if (inst) {
            const card = appData.cards.find(c => c.id === inst.cardId);
            item = {
                description: `${inst.description} (${card ? card.name : 'Cartão'})`,
                value: inst.monthlyValue
            };
        }
    } else if (payment.type === 'cash-installment') {
        const inst = appData.cashInstallments.find(i => i.id === payment.id);
        if (inst) {
            item = {
                description: inst.description,
                value: inst.installmentValue
            };
        }
    }

    return item;
}

function exportHistoryToExcel() {
    const startMonth = document.getElementById('historyStartMonth').value;
    const endMonth = document.getElementById('historyEndMonth').value;
    const filterType = document.getElementById('historyType').value;

    if (!startMonth || !endMonth) {
        showNotification('Selecione o período para exportar', 'error');
        return;
    }

    const filteredPayments = appData.payments.filter(p => {
        const paidMonth = p.monthKey;
        if (paidMonth < startMonth || paidMonth > endMonth) return false;
        if (filterType !== 'all' && p.type !== filterType) return false;
        return true;
    });

    if (filteredPayments.length === 0) {
        showNotification('Nenhum pagamento para exportar', 'warning');
        return;
    }

    const excelData = filteredPayments.map(payment => {
        const item = getPaymentItemDetails(payment);
        if (!item) return null;

        const typeLabel = payment.type === 'bill' ? 'Conta em Dinheiro' :
                        payment.type === 'installment' ? 'Cartão de Crédito' :
                        'Parcelamento em Dinheiro';

        return {
            'Data Pagamento': new Date(payment.paidDate).toLocaleDateString('pt-BR'),
            'Mês Referência': formatDate(payment.monthKey),
            'Tipo': typeLabel,
            'Descrição': item.description,
            'Valor': item.value,
            'Status': payment.status === 'advanced' ? 'Adiantado' : 'Pago'
        };
    }).filter(item => item !== null);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Pagamentos');

    const fileName = `historico_pagamentos_${startMonth}_${endMonth}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showNotification('Histórico exportado com sucesso!');
}

// ==================== VISUALIZAR FATURAS POR CARTÃO ====================

function renderCardInvoices() {
    const container = document.getElementById('cardInvoicesContent');
    if (!container) return;

    const monthSelect = document.getElementById('invoiceMonth');
    if (!monthSelect || !monthSelect.value) {
        container.innerHTML = '<div class="empty-state">Selecione um mês para visualizar as faturas</div>';
        return;
    }

    const monthKey = monthSelect.value;

    if (appData.cards.length === 0) {
        container.innerHTML = '<div class="empty-state">Nenhum cartão cadastrado ainda</div>';
        return;
    }

    const cardsHTML = appData.cards.map(card => {
        const [year, month] = monthKey.split('-').map(Number);
        const cardExpenses = [];

        appData.installments.forEach(inst => {
            if (inst.cardId !== card.id) return;

            const [startYear, startMonth] = inst.startMonth.split('-').map(Number);
            const startDate = new Date(startYear, startMonth - 1);
            const currentDate = new Date(year, month - 1);

            const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                              (currentDate.getMonth() - startDate.getMonth());

            if (monthsDiff >= 0 && monthsDiff < inst.count) {
                const paid = isPaid('installment', inst.id, monthKey);
                cardExpenses.push({
                    id: inst.id,
                    description: inst.description,
                    value: inst.monthlyValue,
                    installment: `${monthsDiff + 1}/${inst.count}`,
                    paid,
                    type: 'installment'
                });
            }
        });

        const totalCard = cardExpenses.reduce((sum, exp) => sum + exp.value, 0);
        const totalPaid = cardExpenses.filter(e => e.paid).reduce((sum, exp) => sum + exp.value, 0);
        const totalPending = totalCard - totalPaid;
        const usagePercent = card.limit > 0 ? (totalCard / card.limit * 100).toFixed(1) : 0;

        return `
            <div class="invoice-card">
                <div class="invoice-header">
                    <div class="invoice-card-info">
                        <h3>${card.name}</h3>
                        <div class="invoice-meta">
                            <span>Vencimento: dia ${card.dueDay}</span>
                            <span>Limite: ${formatMoney(card.limit)}</span>
                        </div>
                    </div>
                    <div class="invoice-total">
                        <div class="invoice-amount">${formatMoney(totalCard)}</div>
                        <div class="invoice-usage">
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: ${Math.min(usagePercent, 100)}%; background: ${usagePercent > 80 ? 'var(--danger)' : 'var(--primary)'}"></div>
                            </div>
                            <span>${usagePercent}% do limite</span>
                        </div>
                    </div>
                </div>

                <div class="invoice-summary">
                    <div class="summary-item">
                        <span>Total da Fatura</span>
                        <strong>${formatMoney(totalCard)}</strong>
                    </div>
                    <div class="summary-item success">
                        <span>Pago</span>
                        <strong>${formatMoney(totalPaid)}</strong>
                    </div>
                    <div class="summary-item ${totalPending > 0 ? 'danger' : ''}">
                        <span>Pendente</span>
                        <strong>${formatMoney(totalPending)}</strong>
                    </div>
                    ${totalPending > 0 ? `
                        <div class="summary-item" style="grid-column: 1 / -1;">
                            <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="payFullInvoice(${card.id}, '${monthKey}')">
                                💳 Pagar Fatura Completa
                            </button>
                        </div>
                    ` : ''}
                </div>

                ${cardExpenses.length === 0 ? '<div class="empty-state">Nenhuma despesa neste mês</div>' : `
                    <div class="invoice-items">
                        ${cardExpenses.map(exp => `
                            <div class="invoice-item ${exp.paid ? 'paid' : ''}">
                                <div class="item-info">
                                    <div class="item-description">
                                        ${exp.paid ? '<span class="paid-badge">✓ Pago</span>' : ''}
                                        ${exp.description}
                                    </div>
                                    <div class="item-details">Parcela ${exp.installment}</div>
                                </div>
                                <div class="item-actions">
                                    <div class="item-value">${formatMoney(exp.value)}</div>
                                    ${exp.paid ? `
                                        <button class="btn-icon btn-secondary" onclick="unmarkAsPaid('${exp.type}', ${exp.id}, '${monthKey}')" title="Desmarcar como pago">
                                            ↩
                                        </button>
                                    ` : `
                                        <button class="btn-icon btn-success" onclick="markAsPaid('${exp.type}', ${exp.id}, '${monthKey}')" title="Marcar como pago">
                                            ✓
                                        </button>
                                    `}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }).join('');

    container.innerHTML = cardsHTML;
}

// ==================== ACCORDION ====================

function toggleAccordion(element) {
    const accordion = element.closest('.accordion');
    accordion.classList.toggle('active');
}

function initAccordions() {
    document.querySelectorAll('.card').forEach(card => {
        const firstAccordion = card.querySelector('.accordion');
        if (firstAccordion) {
            firstAccordion.classList.add('active');
        }
    });
}

// ==================== NOTIFICAÇÕES ====================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== FUNÇÕES UTILITÁRIAS ====================

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const [year, month] = dateString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ==================== ATUALIZAÇÃO AUTOMÁTICA ====================

let autoRefreshInterval = null;
let lastDataHash = null;

// Calcula um hash simples dos dados para detectar mudanças
function calculateDataHash() {
    const dataString = JSON.stringify({
        incomes: appData.incomes,
        cards: appData.cards,
        installments: appData.installments,
        cashInstallments: appData.cashInstallments,
        bills: appData.bills,
        payments: appData.payments,
        config: appData.config
    });

    // Hash simples usando length e primeiros/últimos caracteres
    return dataString.length + dataString.slice(0, 100) + dataString.slice(-100);
}

// Atualiza os dados e a interface se houver mudanças
async function autoRefreshData() {
    try {
        const previousHash = lastDataHash;

        // Recarrega dados do backend
        await loadAllDataFromBackend();

        // Calcula novo hash
        const newHash = calculateDataHash();

        // Se os dados mudaram, atualiza a interface
        if (previousHash !== null && previousHash !== newHash) {
            console.log('📊 Dados atualizados automaticamente');
            refreshAllViews();
        }

        lastDataHash = newHash;
    } catch (error) {
        console.error('Erro ao atualizar dados automaticamente:', error);
    }
}

// Atualiza todas as visualizações da interface
function refreshAllViews() {
    // Atualiza todas as renderizações
    updateDashboard();
    renderIncomes();
    renderCards();
    renderInstallments();
    renderBills();
    renderCashInstallments();
    renderCategories();
    updateCardSelects();
    updateCategorySelects();
    generateCharts();

    // Atualiza visualizações específicas se estiverem abertas
    const viewMonth = document.getElementById('viewMonth');
    if (viewMonth && viewMonth.value) {
        generatePaymentView();
    }

    const invoiceMonth = document.getElementById('invoiceMonth');
    if (invoiceMonth && invoiceMonth.value) {
        renderCardInvoices();
    }

    const projectionMonths = document.getElementById('projectionMonths');
    if (projectionMonths && projectionMonths.value) {
        generateProjection();
    }

    const historyStartMonth = document.getElementById('historyStartMonth');
    const historyEndMonth = document.getElementById('historyEndMonth');
    if (historyStartMonth && historyEndMonth && historyStartMonth.value && historyEndMonth.value) {
        generateHistory();
    }
}

// Inicia a atualização automática
function startAutoRefresh(intervalSeconds = 5) {
    // Para qualquer intervalo anterior
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    // Calcula hash inicial
    lastDataHash = calculateDataHash();

    // Inicia novo intervalo
    autoRefreshInterval = setInterval(autoRefreshData, intervalSeconds * 1000);

    console.log(`✅ Atualização automática iniciada (a cada ${intervalSeconds}s)`);
}

// Para a atualização automática
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('⏸️ Atualização automática pausada');
    }
}

// Inicia atualização automática quando a página carrega
window.addEventListener('load', () => {
    startAutoRefresh(5); // Atualiza a cada 5 segundos
});

// Para atualização quando a página é descarregada
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
