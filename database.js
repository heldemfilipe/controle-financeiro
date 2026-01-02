const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "financeiro.db");

let db = null;

// Função para salvar o banco automaticamente após cada operação
function saveDatabase() {
  if (!db) return;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error("❌ Erro ao salvar banco:", error);
  }
}

// ==================== INICIALIZAR BANCO ====================

async function initDatabase() {
  try {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      console.log("✅ Banco de dados SQLite carregado de:", DB_PATH);
    } else {
      db = new SQL.Database();
      console.log("✅ Novo banco de dados SQLite criado");
    }

    createTables();
    saveDatabase();
  } catch (error) {
    console.error("❌ Erro ao inicializar banco:", error);
    throw error;
  }
}

function createTables() {
  // Tabela de Rendas
  db.run(`
        CREATE TABLE IF NOT EXISTS rendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            valor REAL NOT NULL,
            dia_recebimento INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Cartões
  db.run(`
        CREATE TABLE IF NOT EXISTS cartoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            limite REAL NOT NULL,
            dia_fechamento INTEGER NOT NULL,
            dia_vencimento INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Parcelamentos
  db.run(`
        CREATE TABLE IF NOT EXISTS parcelamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            cartao TEXT NOT NULL,
            valor_total REAL NOT NULL,
            parcelas INTEGER NOT NULL,
            parcela_atual INTEGER NOT NULL,
            categoria TEXT NOT NULL,
            mes_inicio TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Contas
  db.run(`
        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            dia_vencimento INTEGER NOT NULL,
            categoria TEXT NOT NULL,
            recorrencia TEXT NOT NULL DEFAULT 'monthly',
            mes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Parcelamentos Dinheiro
  db.run(`
        CREATE TABLE IF NOT EXISTS parcelamentos_dinheiro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT NOT NULL,
            valor_total REAL NOT NULL,
            parcelas INTEGER NOT NULL,
            parcela_atual INTEGER NOT NULL,
            dia_vencimento INTEGER NOT NULL,
            categoria TEXT NOT NULL,
            mes_inicio TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Categorias
  db.run(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Pagamentos
  db.run(`
        CREATE TABLE IF NOT EXISTS pagamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT NOT NULL UNIQUE,
            tipo TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            mes TEXT NOT NULL,
            data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'paid',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  // Tabela de Configurações
  db.run(`
        CREATE TABLE IF NOT EXISTS configuracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

  console.log("✅ Tabelas criadas/verificadas");
}

// ==================== RENDAS ====================

const rendas = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM rendas ORDER BY dia_recebimento");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  getById(id) {
    const stmt = db.prepare("SELECT * FROM rendas WHERE id = ?");
    stmt.bind([id]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  },

  insert(nome, valor, dia_recebimento) {
    db.run(
      "INSERT INTO rendas (nome, valor, dia_recebimento) VALUES (?, ?, ?)",
      [nome, valor, dia_recebimento]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  update(id, nome, valor, dia_recebimento) {
    db.run(
      "UPDATE rendas SET nome = ?, valor = ?, dia_recebimento = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [nome, valor, dia_recebimento, id]
    );
    saveDatabase();
    return { changes: 1 };
  },

  delete(id) {
    db.run("DELETE FROM rendas WHERE id = ?", [id]);
    saveDatabase();
    return { changes: 1 };
  },

  deleteAll() {
    db.run("DELETE FROM rendas");
    saveDatabase();
  },
};

// ==================== CARTÕES ====================

const cartoes = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM cartoes ORDER BY nome");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  getById(id) {
    const stmt = db.prepare("SELECT * FROM cartoes WHERE id = ?");
    stmt.bind([id]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  },

  insert(nome, limite, dia_fechamento, dia_vencimento) {
    db.run(
      "INSERT INTO cartoes (nome, limite, dia_fechamento, dia_vencimento) VALUES (?, ?, ?, ?)",
      [nome, limite, dia_fechamento, dia_vencimento]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  update(id, nome, limite, dia_fechamento, dia_vencimento) {
    db.run(
      "UPDATE cartoes SET nome = ?, limite = ?, dia_fechamento = ?, dia_vencimento = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [nome, limite, dia_fechamento, dia_vencimento, id]
    );
    saveDatabase();
    return { changes: 1 };
  },

  delete(id) {
    db.run("DELETE FROM cartoes WHERE id = ?", [id]);
    saveDatabase();
    return { changes: 1 };
  },

  deleteAll() {
    db.run("DELETE FROM cartoes");
    saveDatabase();
  },
};

// ==================== PARCELAMENTOS ====================

const parcelamentos = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM parcelamentos ORDER BY id");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  insert(
    descricao,
    cartao,
    valor_total,
    parcelas,
    parcela_atual,
    categoria,
    mes_inicio
  ) {
    db.run(
      "INSERT INTO parcelamentos (descricao, cartao, valor_total, parcelas, parcela_atual, categoria, mes_inicio) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [descricao, cartao, valor_total, parcelas, parcela_atual, categoria, mes_inicio]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  update(
    id,
    descricao,
    cartao,
    valor_total,
    parcelas,
    parcela_atual,
    categoria,
    mes_inicio
  ) {
    db.run(
      "UPDATE parcelamentos SET descricao = ?, cartao = ?, valor_total = ?, parcelas = ?, parcela_atual = ?, categoria = ?, mes_inicio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [descricao, cartao, valor_total, parcelas, parcela_atual, categoria, mes_inicio, id]
    );
    saveDatabase();
    return { changes: 1 };
  },

  delete(id) {
    db.run("DELETE FROM parcelamentos WHERE id = ?", [id]);
    saveDatabase();
    return { changes: 1 };
  },

  deleteAll() {
    db.run("DELETE FROM parcelamentos");
    saveDatabase();
  },
};

// ==================== CONTAS ====================

const contas = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM contas ORDER BY dia_vencimento");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  insert(descricao, valor, dia_vencimento, categoria, recorrencia, mes) {
    db.run(
      "INSERT INTO contas (descricao, valor, dia_vencimento, categoria, recorrencia, mes) VALUES (?, ?, ?, ?, ?, ?)",
      [descricao, valor, dia_vencimento, categoria, recorrencia, mes]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  update(id, descricao, valor, dia_vencimento, categoria, recorrencia, mes) {
    db.run(
      "UPDATE contas SET descricao = ?, valor = ?, dia_vencimento = ?, categoria = ?, recorrencia = ?, mes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [descricao, valor, dia_vencimento, categoria, recorrencia, mes, id]
    );
    saveDatabase();
    return { changes: 1 };
  },

  delete(id) {
    db.run("DELETE FROM contas WHERE id = ?", [id]);
    saveDatabase();
    return { changes: 1 };
  },

  deleteAll() {
    db.run("DELETE FROM contas");
    saveDatabase();
  },
};

// ==================== PARCELAMENTOS DINHEIRO ====================

const parcelamentosDinheiro = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM parcelamentos_dinheiro ORDER BY id");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  insert(
    descricao,
    valor_total,
    parcelas,
    parcela_atual,
    dia_vencimento,
    categoria,
    mes_inicio
  ) {
    db.run(
      "INSERT INTO parcelamentos_dinheiro (descricao, valor_total, parcelas, parcela_atual, dia_vencimento, categoria, mes_inicio) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [descricao, valor_total, parcelas, parcela_atual, dia_vencimento, categoria, mes_inicio]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  update(
    id,
    descricao,
    valor_total,
    parcelas,
    parcela_atual,
    dia_vencimento,
    categoria,
    mes_inicio
  ) {
    db.run(
      "UPDATE parcelamentos_dinheiro SET descricao = ?, valor_total = ?, parcelas = ?, parcela_atual = ?, dia_vencimento = ?, categoria = ?, mes_inicio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [descricao, valor_total, parcelas, parcela_atual, dia_vencimento, categoria, mes_inicio, id]
    );
    saveDatabase();
    return { changes: 1 };
  },

  delete(id) {
    db.run("DELETE FROM parcelamentos_dinheiro WHERE id = ?", [id]);
    saveDatabase();
    return { changes: 1 };
  },

  deleteAll() {
    db.run("DELETE FROM parcelamentos_dinheiro");
    saveDatabase();
  },
};

// ==================== CATEGORIAS ====================

const categorias = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM categorias ORDER BY nome");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  insert(nome) {
    db.run("INSERT INTO categorias (nome) VALUES (?)", [nome]);
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  delete(nome) {
    db.run("DELETE FROM categorias WHERE nome = ?", [nome]);
    saveDatabase();
    return { changes: 1 };
  },
};

// ==================== PAGAMENTOS ====================

const pagamentos = {
  getAll() {
    const stmt = db.prepare("SELECT * FROM pagamentos ORDER BY created_at DESC");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  getByPeriod(mesInicio, mesFim) {
    const stmt = db.prepare(
      "SELECT * FROM pagamentos WHERE mes >= ? AND mes <= ? ORDER BY mes DESC, created_at DESC"
    );
    stmt.bind([mesInicio, mesFim]);
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },

  insert(chave, tipo, item_id, mes, status = "paid") {
    db.run(
      "INSERT INTO pagamentos (chave, tipo, item_id, mes, status) VALUES (?, ?, ?, ?, ?)",
      [chave, tipo, item_id, mes, status]
    );
    saveDatabase();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  },

  delete(chave) {
    db.run("DELETE FROM pagamentos WHERE chave = ?", [chave]);
    saveDatabase();
    return { changes: 1 };
  },

  exists(chave) {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM pagamentos WHERE chave = ?");
    stmt.bind([chave]);
    const result = stmt.step() ? stmt.getAsObject() : { count: 0 };
    stmt.free();
    return result.count > 0;
  },
};

// ==================== CONFIGURAÇÕES ====================

const configuracoes = {
  get(chave) {
    const stmt = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?");
    stmt.bind([chave]);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result ? result.valor : null;
  },

  set(chave, valor) {
    if (!chave || typeof chave !== "string") {
      throw new Error("Chave de configuração inválida");
    }

    db.run(
      "INSERT OR REPLACE INTO configuracoes (chave, valor, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [chave, String(valor)]
    );
    saveDatabase();
    return { changes: 1 };
  },

  getAll() {
    const stmt = db.prepare("SELECT * FROM configuracoes");
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  },
};

// ==================== EXPORTAR ====================

module.exports = {
  initDatabase,
  db,
  rendas,
  cartoes,
  parcelamentos,
  contas,
  parcelamentosDinheiro,
  categorias,
  pagamentos,
  configuracoes,
};
