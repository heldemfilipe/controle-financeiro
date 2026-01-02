const express = require("express");
const cors = require("cors");
const path = require("path");

const {
  initDatabase,
  rendas,
  cartoes,
  parcelamentos,
  contas,
  parcelamentosDinheiro,
  categorias,
  pagamentos,
  configuracoes,
} = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Inicializar banco de dados
initDatabase();
console.log("✅ Banco de dados inicializado");

// ==================== ROTA PRINCIPAL ====================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ==================== API ENDPOINTS ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: "SQLite (arquivo local)",
    version: "2.0",
  });
});

// ==================== CRUD - RENDAS ====================

app.get("/api/rendas", (req, res) => {
  try {
    const rows = rendas.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar rendas:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/rendas", (req, res) => {
  try {
    const { nome, valor, dia_recebimento } = req.body;
    const result = rendas.insert(nome, valor, dia_recebimento);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir renda:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/rendas/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { nome, valor, dia_recebimento } = req.body;
    rendas.update(id, nome, valor, dia_recebimento);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar renda:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/rendas/:id", (req, res) => {
  try {
    const { id } = req.params;
    rendas.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar renda:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - CARTÕES ====================

app.get("/api/cartoes", (req, res) => {
  try {
    const rows = cartoes.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar cartões:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/cartoes", (req, res) => {
  try {
    const { nome, limite, dia_fechamento, dia_vencimento } = req.body;
    const result = cartoes.insert(nome, limite, dia_fechamento, dia_vencimento);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir cartão:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/cartoes/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { nome, limite, dia_fechamento, dia_vencimento } = req.body;
    cartoes.update(id, nome, limite, dia_fechamento, dia_vencimento);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar cartão:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/cartoes/:id", (req, res) => {
  try {
    const { id } = req.params;
    // Também deletar parcelamentos associados
    const allParcelamentos = parcelamentos.getAll();
    allParcelamentos.forEach((p) => {
      if (p.cartao === id.toString()) {
        parcelamentos.delete(p.id);
      }
    });
    cartoes.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar cartão:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - PARCELAMENTOS ====================

app.get("/api/parcelamentos", (req, res) => {
  try {
    const rows = parcelamentos.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar parcelamentos:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/parcelamentos", (req, res) => {
  try {
    const {
      descricao,
      cartao,
      valor_total,
      parcelas,
      parcela_atual,
      categoria,
      mes_inicio,
    } = req.body;
    const result = parcelamentos.insert(
      descricao,
      cartao,
      valor_total,
      parcelas,
      parcela_atual || 1,
      categoria || "Outros",
      mes_inicio
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir parcelamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/parcelamentos/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      descricao,
      cartao,
      valor_total,
      parcelas,
      parcela_atual,
      categoria,
      mes_inicio,
    } = req.body;
    parcelamentos.update(
      id,
      descricao,
      cartao,
      valor_total,
      parcelas,
      parcela_atual,
      categoria,
      mes_inicio
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar parcelamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/parcelamentos/:id", (req, res) => {
  try {
    const { id } = req.params;
    parcelamentos.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar parcelamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - CONTAS ====================

app.get("/api/contas", (req, res) => {
  try {
    const rows = contas.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar contas:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/contas", (req, res) => {
  try {
    const { descricao, valor, dia_vencimento, categoria, recorrencia, mes } =
      req.body;
    const result = contas.insert(
      descricao,
      valor,
      dia_vencimento,
      categoria,
      recorrencia || "monthly",
      mes
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir conta:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/contas/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, valor, dia_vencimento, categoria, recorrencia, mes } =
      req.body;
    contas.update(
      id,
      descricao,
      valor,
      dia_vencimento,
      categoria,
      recorrencia,
      mes
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/contas/:id", (req, res) => {
  try {
    const { id } = req.params;
    contas.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar conta:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - PARCELAMENTOS DINHEIRO ====================

app.get("/api/parcelamentos-dinheiro", (req, res) => {
  try {
    const rows = parcelamentosDinheiro.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar parcelamentos dinheiro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/parcelamentos-dinheiro", (req, res) => {
  try {
    const {
      descricao,
      valor_total,
      parcelas,
      parcela_atual,
      dia_vencimento,
      categoria,
      mes_inicio,
    } = req.body;
    const result = parcelamentosDinheiro.insert(
      descricao,
      valor_total,
      parcelas,
      parcela_atual || 1,
      dia_vencimento,
      categoria || "Outros",
      mes_inicio
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir parcelamento dinheiro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put("/api/parcelamentos-dinheiro/:id", (req, res) => {
  try {
    const { id } = req.params;
    const {
      descricao,
      valor_total,
      parcelas,
      parcela_atual,
      dia_vencimento,
      categoria,
      mes_inicio,
    } = req.body;
    parcelamentosDinheiro.update(
      id,
      descricao,
      valor_total,
      parcelas,
      parcela_atual,
      dia_vencimento,
      categoria,
      mes_inicio
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar parcelamento dinheiro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/parcelamentos-dinheiro/:id", (req, res) => {
  try {
    const { id } = req.params;
    parcelamentosDinheiro.delete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar parcelamento dinheiro:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - CATEGORIAS ====================

app.get("/api/categorias", (req, res) => {
  try {
    const rows = categorias.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/categorias", (req, res) => {
  try {
    const { nome } = req.body;
    const result = categorias.insert(nome);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir categoria:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/categorias/:nome", (req, res) => {
  try {
    const { nome } = req.params;
    categorias.delete(nome);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar categoria:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - PAGAMENTOS ====================

app.get("/api/pagamentos", (req, res) => {
  try {
    const { mes_inicio, mes_fim } = req.query;
    let rows;
    if (mes_inicio && mes_fim) {
      rows = pagamentos.getByPeriod(mes_inicio, mes_fim);
    } else {
      rows = pagamentos.getAll();
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/pagamentos", (req, res) => {
  try {
    const { chave, tipo, item_id, mes, status } = req.body;
    const result = pagamentos.insert(
      chave,
      tipo,
      item_id,
      mes,
      status || "paid"
    );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error("Erro ao inserir pagamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/pagamentos/:chave", (req, res) => {
  try {
    const { chave } = req.params;
    pagamentos.delete(decodeURIComponent(chave));
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar pagamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/pagamentos/exists/:chave", (req, res) => {
  try {
    const { chave } = req.params;
    const exists = pagamentos.exists(decodeURIComponent(chave));
    res.json({ success: true, exists });
  } catch (error) {
    console.error("Erro ao verificar pagamento:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CRUD - CONFIGURAÇÕES ====================

app.get("/api/configuracoes", (req, res) => {
  try {
    const rows = configuracoes.getAll();
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/configuracoes/:chave", (req, res) => {
  try {
    const { chave } = req.params;
    const valor = configuracoes.get(chave);
    res.json({ success: true, valor });
  } catch (error) {
    console.error("Erro ao buscar configuração:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/configuracoes", (req, res) => {
  try {
    const { chave, valor } = req.body;
    if (!chave) {
      return res.status(400).json({
        error: "Campo 'chave' é obrigatório",
      });
    }
    configuracoes.set(chave, valor);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   💰 Controle Financeiro - SQLite Local                     ║
║                                                              ║
║   🚀 Servidor: http://localhost:${PORT}                          ║
║   💾 Armazenamento: SQLite (financeiro.db)                  ║
║   📁 Arquivo local persistente                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📝 Endpoints disponíveis:
   GET  /                               - Interface web
   GET  /api/health                     - Status do servidor

   💰 Rendas:
   GET    /api/rendas                   - Listar rendas
   POST   /api/rendas                   - Criar renda
   PUT    /api/rendas/:id               - Atualizar renda
   DELETE /api/rendas/:id               - Deletar renda

   💳 Cartões:
   GET    /api/cartoes                  - Listar cartões
   POST   /api/cartoes                  - Criar cartão
   PUT    /api/cartoes/:id              - Atualizar cartão
   DELETE /api/cartoes/:id              - Deletar cartão

   📦 Parcelamentos:
   GET    /api/parcelamentos            - Listar parcelamentos
   POST   /api/parcelamentos            - Criar parcelamento
   PUT    /api/parcelamentos/:id        - Atualizar parcelamento
   DELETE /api/parcelamentos/:id        - Deletar parcelamento

   💵 Contas:
   GET    /api/contas                   - Listar contas
   POST   /api/contas                   - Criar conta
   PUT    /api/contas/:id               - Atualizar conta
   DELETE /api/contas/:id               - Deletar conta

   💸 Parcelamentos Dinheiro:
   GET    /api/parcelamentos-dinheiro   - Listar parcelamentos
   POST   /api/parcelamentos-dinheiro   - Criar parcelamento
   PUT    /api/parcelamentos-dinheiro/:id    - Atualizar
   DELETE /api/parcelamentos-dinheiro/:id    - Deletar

   🏷️  Categorias:
   GET    /api/categorias               - Listar categorias
   POST   /api/categorias               - Criar categoria
   DELETE /api/categorias/:nome         - Deletar categoria

   ✅ Pagamentos:
   GET    /api/pagamentos               - Listar pagamentos
   POST   /api/pagamentos               - Registrar pagamento
   DELETE /api/pagamentos/:chave        - Remover pagamento
   GET    /api/pagamentos/exists/:chave - Verificar se existe

   ⚙️  Configurações:
   GET    /api/configuracoes            - Listar configurações
   GET    /api/configuracoes/:chave     - Buscar configuração
   POST   /api/configuracoes            - Salvar configuração
`);
});
