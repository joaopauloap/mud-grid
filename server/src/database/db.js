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
        inventory TEXT DEFAULT '[]'
    )`);

    // Adiciona as colunas na tabela users se ela já existia antes sem elas
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
    await run(`INSERT INTO roles (name) VALUES ('user') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('mod') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('admin') ON CONFLICT(name) DO NOTHING`);
    await run(`INSERT INTO roles (name) VALUES ('gm') ON CONFLICT(name) DO NOTHING`);
}
