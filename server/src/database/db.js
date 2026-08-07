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

    await run(`CREATE TABLE IF NOT EXISTS world_objects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT,
        type TEXT,
        name TEXT,
        description TEXT,
        x INTEGER,
        y INTEGER,
        pickup_permission TEXT DEFAULT 'all',
        drop_permission TEXT DEFAULT 'all'
    )`);

    // Migração: adiciona colunas de permissão se a tabela já existia sem elas
    const hasPickupPerm = await tableHasColumn('world_objects', 'pickup_permission');
    if (!hasPickupPerm) {
        await run(`ALTER TABLE world_objects ADD COLUMN pickup_permission TEXT DEFAULT 'all'`);
    }
    const hasDropPerm = await tableHasColumn('world_objects', 'drop_permission');
    if (!hasDropPerm) {
        await run(`ALTER TABLE world_objects ADD COLUMN drop_permission TEXT DEFAULT 'all'`);
    }

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

    // --- Sistema de Quests ---
    await run(`CREATE TABLE IF NOT EXISTS player_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        quest_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        progress TEXT DEFAULT '{}',
        started_at TEXT DEFAULT (datetime('now', 'localtime')),
        completed_at TEXT,
        UNIQUE(username, quest_name)
    )`);

    await run(`INSERT INTO roles (name) VALUES ('user') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('mod') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('admin') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('gm') ON CONFLICT(name) DO NOTHING`);
}
