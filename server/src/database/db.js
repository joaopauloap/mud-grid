import sqlite3 from "sqlite3";

const DB_FILE = "database.db";

const sqlite = sqlite3.verbose();
export const db = new sqlite.Database(DB_FILE);

export function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

export function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

export function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

export async function tableHasColumn(table, column) {
    const rows = await all(`PRAGMA table_info(${table})`);
    return rows.some(row => row.name === column);
}

export async function init() {
    await run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT,
        salt TEXT,
        x INTEGER DEFAULT 0,
        y INTEGER DEFAULT 0,
        inventory TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )`);

    // Migração: adiciona colunas auxiliares se a tabela já existia sem elas
    const hasX = await tableHasColumn('users', 'x');
    if (!hasX) {
        await run(`ALTER TABLE users ADD COLUMN x INTEGER DEFAULT 0`);
    }
    const hasY = await tableHasColumn('users', 'y');
    if (!hasY) {
        await run(`ALTER TABLE users ADD COLUMN y INTEGER DEFAULT 0`);
    }
    const hasInventory = await tableHasColumn('users', 'inventory');
    if (!hasInventory) {
        await run(`ALTER TABLE users ADD COLUMN inventory TEXT DEFAULT '[]'`);
    }
    const hasCreatedAt = await tableHasColumn('users', 'created_at');
    if (!hasCreatedAt) {
        await run(`ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now', 'localtime'))`);
    }

    await run(`CREATE TABLE IF NOT EXISTS game_params (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    await run(`CREATE TABLE IF NOT EXISTS world_places (
        x INTEGER,
        y INTEGER,
        city TEXT,
        place TEXT,
        environment TEXT,
        description TEXT,
        PRIMARY KEY(x,y)
    )`);

    // Seed inicial do mundo
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (0, 0, 'Grade', 'Portal da Grade', 'Plataforma do portal', 'Você está na plataforma do portal da Grade, cercada por colunas brilhantes e painéis de energia.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (0, -1, 'Grade', 'Corredor Antigo', 'Corredor sombrio', 'Você está em um corredor sombrio com inscrições antigas nas paredes de metal.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (1, 0, 'Grade', 'Ponte dos Arestos', 'Ponte suspensa', 'Você vê uma ponte suspendida sobre um fosso de energia azul.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (-1, 0, 'Grade', 'Câmara de Cristal', 'Câmara silenciosa', 'Você vê uma câmara silenciosa com cristais pulsando levemente.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (0, 1, 'Grade', 'Salão do Núcleo', 'Salão com parapeitos', 'Você vê um salão com parapeitos e janelas que mostram as luzes do núcleo.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (1, -1, 'Grade', 'Escadaria Espiral', 'Escadaria em espiral', 'Você vê uma escadaria em espiral que sobe em direção a um domo de vidro.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (-1, -1, 'Grade', 'Jardim Bioluminescente', 'Jardim interno', 'Você vê um jardim interno com plantas bioluminescentes.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (1, 1, 'Grade', 'Laboratório Abandonado', 'Laboratório', 'Você vê um laboratório abandonado com mesas cobertas por artefatos.')`);
    await run(`INSERT OR IGNORE INTO world_places (x, y, city, place, environment, description) VALUES (-1, 1, 'Grade', 'Depósito', 'Depósito', 'Você vê um depósito cheio de caixas retorcidas e caminhos estreitos.')`);

    await run(`CREATE TABLE IF NOT EXISTS world_objects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        x INTEGER,
        y INTEGER
    )`);

    await run(`CREATE TABLE IF NOT EXISTS roles (
        name TEXT PRIMARY KEY
    )`);

    await run(`CREATE TABLE IF NOT EXISTS user_roles (
        username TEXT,
        role TEXT,
        PRIMARY KEY(username, role),
        FOREIGN KEY(role) REFERENCES roles(name)
    )`);

    const motd = await get(`SELECT value FROM game_params WHERE key = ?`, ["motd"]);
    if (!motd) {
        await run(`INSERT INTO game_params (key, value) VALUES (?, ?)`, [
            "motd",
            "..."
        ]);
    }

    // Default roles (to avoid circular dependency with RoleRepository during init, we can seed here directly or import)
    await run(`CREATE TABLE IF NOT EXISTS npcs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        x INTEGER NOT NULL,
        y INTEGER NOT NULL
    )`);

    // Migração: remove coluna keyword se existir (substituída por name)
    const hasKeyword = await tableHasColumn('npcs', 'keyword');
    if (hasKeyword) {
        // SQLite não suporta DROP COLUMN diretamente em versões antigas,
        // então recriamos a tabela sem a coluna keyword
        await run(`CREATE TABLE npcs_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL
        )`);
        await run(`INSERT INTO npcs_new (id, name, x, y) SELECT id, name, x, y FROM npcs`);
        await run(`DROP TABLE npcs`);
        await run(`ALTER TABLE npcs_new RENAME TO npcs`);
    }

    await run(`CREATE TABLE IF NOT EXISTS npc_dialogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        npc_id INTEGER NOT NULL,
        trigger TEXT NOT NULL,
        response TEXT NOT NULL,
        UNIQUE(npc_id, trigger),
        FOREIGN KEY(npc_id) REFERENCES npcs(id) ON DELETE CASCADE
    )`);

    // --- Sistema de Árvore de Diálogos (Dialog Tree) ---
    await run(`CREATE TABLE IF NOT EXISTS dialog_trees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        npc_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY(npc_id) REFERENCES npcs(id) ON DELETE CASCADE
    )`);

    await run(`CREATE TABLE IF NOT EXISTS dialog_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tree_id INTEGER NOT NULL,
        parent_id INTEGER,
        trigger TEXT NOT NULL,
        npc_response TEXT NOT NULL,
        npc_hint TEXT,
        sort_order INTEGER DEFAULT 0,
        flags TEXT DEFAULT '',
        condition_type TEXT,
        condition_value TEXT,
        action_commands TEXT DEFAULT '[]',
        FOREIGN KEY(tree_id) REFERENCES dialog_trees(id) ON DELETE CASCADE,
        FOREIGN KEY(parent_id) REFERENCES dialog_nodes(id) ON DELETE SET NULL
    )`);

    // Migração: adiciona coluna action_commands se não existir
    const hasActionCmds = await tableHasColumn('dialog_nodes', 'action_commands');
    if (!hasActionCmds) {
        await run(`ALTER TABLE dialog_nodes ADD COLUMN action_commands TEXT DEFAULT '[]'`);
    }

    // --- Seed NPC Guard e sua árvore de diálogo ---
    await run(`INSERT OR IGNORE INTO npcs (name, x, y) VALUES ('Guard', 0, 0)`);

    // Só cria a árvore se o Guard ainda não tiver uma
    const hasGuardTree = await get(
        `SELECT dt.id FROM dialog_trees dt JOIN npcs n ON dt.npc_id = n.id WHERE n.name = 'Guard'`
    );
    if (!hasGuardTree) {
        await run(
            `INSERT INTO dialog_trees (npc_id, name) VALUES ((SELECT id FROM npcs WHERE name = 'Guard'), 'ArvoreGuard')`
        );
        const { id: treeId } = await get(
            `SELECT dt.id FROM dialog_trees dt JOIN npcs n ON dt.npc_id = n.id WHERE n.name = 'Guard'`
        );
        // Nó raiz sem condição (fallback) — player ainda não tem o disco
        await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, flags)
             VALUES (?, NULL, 'oi', 'Encontre CLU no setor 0-1 ao */norte* e requisite um novo ''Disco''.', 'greeting,goodbye')`,
            [treeId]
        );
        // Nó raiz condicionado — player já possui o disco 'disco'
        await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, flags, condition_type, condition_value, action_commands)
             VALUES (?, NULL, 'oi', 'Disco concedido e sincronizado. Deves enfrentar o desafio da Grade imediatamente. Me acompanhe.', 'greeting,goodbye', 'has_item', 'disco', ?)`,
            [treeId]
        );
    }

    // --- Seed NPC CLU na coordenada (0,1) ---
    await run(`INSERT OR IGNORE INTO npcs (name, x, y) VALUES ('CLU', 0, 1)`);

    const hasCluTree = await get(
        `SELECT dt.id FROM dialog_trees dt JOIN npcs n ON dt.npc_id = n.id WHERE n.name = 'CLU'`
    );
    if (!hasCluTree) {
        await run(
            `INSERT INTO dialog_trees (npc_id, name) VALUES ((SELECT id FROM npcs WHERE name = 'CLU'), 'ArvoreCLU')`
        );
        const { id: treeId } = await get(
            `SELECT dt.id FROM dialog_trees dt JOIN npcs n ON dt.npc_id = n.id WHERE n.name = 'CLU'`
        );

        // Root 1: player já tem disco → saudação curta e encerra
        await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, flags, condition_type, condition_value)
             VALUES (?, NULL, 'oi', 'Saudações, programa. Eu sou CLU.', 'greeting,goodbye', 'has_item', 'disco')`,
            [treeId]
        );

        // Root 2: sem disco (fallback) → saudação, aguarda player falar "disco"
        await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, flags)
             VALUES (?, NULL, 'oi', 'Saudações, programa. Eu sou CLU.', 'greeting')`,
            [treeId]
        );

        // ID do Root 2 para adicionar filhos
        const { id: root2Id } = await get(
            `SELECT id FROM dialog_nodes WHERE tree_id = ? AND parent_id IS NULL AND condition_type IS NULL`,
            [treeId]
        );

        // Único filho: trigger "disco" → concede novo disco
        await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, flags, action_commands)
             VALUES (?, ?, 'disco', 'Você perdeu seu Disco de Identificação? Entendo. Lhe concenderei um novo Disco.', 'goodbye', ?)`,
            [treeId, root2Id, JSON.stringify([
                {
                    type: 'give_item',
                    keyword: 'disco',
                    name: 'Disco de Identificação',
                    description: 'Disco de identificação padrão dos programas da Grade. Guarda informações sobre identificação, diretriz, funções, conquistas e histórico de seu titular.'
                },
                { type: 'broadcast', message: 'Retorne ao Guardião.' }
            ])]
        );
    }

    await run(`INSERT INTO roles (name) VALUES ('user') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('mod') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('admin') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('gm') ON CONFLICT(name) DO NOTHING`);
}
