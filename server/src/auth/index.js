import sqlite3 from "sqlite3";
import crypto from "crypto";

const DB_FILE = "database.db";

const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_FILE);

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function tableHasColumn(table, column) {
    const rows = await all(`PRAGMA table_info(${table})`);
    return rows.some(row => row.name === column);
}

export async function init() {
    await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    salt TEXT
  )`);

    await run(`CREATE TABLE IF NOT EXISTS game_params (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

    await run(`CREATE TABLE IF NOT EXISTS player_locations (
    username TEXT PRIMARY KEY,
    x INTEGER,
    y INTEGER
  )`);

    const hasInventory = await tableHasColumn('player_locations', 'inventory');
    if (!hasInventory) {
        await run(`ALTER TABLE player_locations ADD COLUMN inventory TEXT`);
    }

    await run(`CREATE TABLE IF NOT EXISTS world_descriptions (
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

    // Ensure default roles exist
    await seedRoles(["user", "mod", "admin"]);
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
}

export async function createUser(username, password) {
    const existing = await get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) throw new Error("Usuário já existe");

    const salt = crypto.randomBytes(16).toString("hex");
    const password_hash = hashPassword(password, salt);

    await run(`INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)`, [username, password_hash, salt]);
    // assign default role
    await assignRole(username, 'user').catch(() => { });
    // initialize location and inventory
    await savePlayerLocation(username, { x: 0, y: 0, inventory: [{ id: 'caneta', name: 'Caneta', type: 'item', description: 'Uma caneta simples de tinta azul.' }] }).catch(() => { });
    return true;
}

export async function authenticate(username, password) {
    const row = await get(`SELECT password_hash, salt FROM users WHERE username = ?`, [username]);
    if (!row) return false;

    const computed = hashPassword(password, row.salt);
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(row.password_hash, "hex");

    if (a.length !== b.length) return false;

    return crypto.timingSafeEqual(a, b);
}

export async function userExists(username) {
    const row = await get(`SELECT id FROM users WHERE username = ?`, [username]);
    return !!row;
}

export async function getGameParam(key) {
    const row = await get(`SELECT value FROM game_params WHERE key = ?`, [key]);
    return row ? row.value : null;
}

export async function getLocation(username) {
    const row = await get(`SELECT x, y, inventory FROM player_locations WHERE username = ?`, [username]);
    if (!row) return null;
    return {
        x: row.x,
        y: row.y,
        inventory: row.inventory ? JSON.parse(row.inventory) : []
    };
}

export async function savePlayerLocation(username, location) {
    await run(`INSERT INTO player_locations (username, x, y, inventory) VALUES (?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET x = excluded.x, y = excluded.y, inventory = excluded.inventory`, [username, location.x, location.y, JSON.stringify(location.inventory || [])]);
}

export async function getAllWorldDescriptions() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT x, y, city, place, environment, description FROM world_descriptions`, [], (err, rows) => {
            if (err) return reject(err);
            const parsed = (rows || []).map(r => ({
                x: r.x,
                y: r.y,
                city: r.city,
                place: r.place,
                environment: r.environment,
                description: r.description
            }));
            resolve(parsed);
        });
    });
}

export async function getWorldCount() {
    const row = await get(`SELECT COUNT(*) as cnt FROM world_descriptions`);
    return row ? row.cnt : 0;
}

export async function seedWorld(rows) {
    for (const r of rows) {
        await run(`INSERT INTO world_descriptions (x, y, city, place, environment, description) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(x,y) DO UPDATE SET city = excluded.city, place = excluded.place, environment = excluded.environment, description = excluded.description`, [
            r.x,
            r.y,
            r.city,
            r.place,
            r.environment,
            r.description
        ]);
    }
}

export async function saveWorldDescription(location) {
    await run(`INSERT INTO world_descriptions (x, y, city, place, environment, description) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(x,y) DO UPDATE SET city = excluded.city, place = excluded.place, environment = excluded.environment, description = excluded.description`, [
        location.x,
        location.y,
        location.city,
        location.place,
        location.environment,
        location.description
    ]);
}

export async function createWorldObject(object) {
    const result = await run(`INSERT INTO world_objects (keyword, type, name, description, x, y) VALUES (?, ?, ?, ?, ?, ?)`, [
        object.keyword,
        object.type,
        object.name,
        object.description,
        object.x,
        object.y
    ]);
    return {
        id: result.lastID,
        keyword: object.keyword,
        type: object.type,
        name: object.name,
        description: object.description,
        x: object.x,
        y: object.y
    };
}

export async function getAllWorldObjects() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, keyword, type, name, description, x, y FROM world_objects`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

export async function getWorldObjectsByLocation(x, y) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE x = ? AND y = ?`, [x, y], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

export async function getWorldObjectById(id) {
    const row = await get(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE id = ?`, [id]);
    return row || null;
}

export async function updateWorldObjectLocation(id, x, y) {
    await run(`UPDATE world_objects SET x = ?, y = ? WHERE id = ?`, [x, y, id]);
    return await getWorldObjectById(id);
}

export async function seedWorldObjects(objects) {
    for (const obj of objects) {
        await run(`INSERT OR IGNORE INTO world_objects (keyword, type, name, description, x, y) VALUES (?, ?, ?, ?, ?, ?)`, [
            obj.keyword,
            obj.type,
            obj.name,
            obj.description,
            obj.x,
            obj.y
        ]);
    }
}

export async function getWorldObjectCount() {
    const row = await get(`SELECT COUNT(*) as cnt FROM world_objects`);
    return row ? row.cnt : 0;
}

export async function deleteWorldObjectById(id) {
    await run(`DELETE FROM world_objects WHERE id = ?`, [id]);
}

export async function getWorldObjectsByKeyword(keyword) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE keyword = ?`, [keyword], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

export async function createRole(name) {
    await run(`INSERT INTO roles (name) VALUES (?) ON CONFLICT(name) DO NOTHING`, [name]);
}

export async function getAllRoles() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT name FROM roles`, [], (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(r => r.name));
        });
    });
}

export async function deleteRole(name) {
    // remove from user_roles first, then from roles
    await run(`DELETE FROM user_roles WHERE role = ?`, [name]);
    await run(`DELETE FROM roles WHERE name = ?`, [name]);
}

export async function seedRoles(names) {
    for (const n of names) {
        await createRole(n);
    }
}

export async function assignRole(username, role) {
    // Ensure role exists
    await createRole(role);
    await run(`INSERT INTO user_roles (username, role) VALUES (?, ?)
    ON CONFLICT(username, role) DO NOTHING`, [username, role]);
}

export async function removeRole(username, role) {
    await run(`DELETE FROM user_roles WHERE username = ? AND role = ?`, [username, role]);
}

export async function hasRole(username, role) {
    const row = await get(`SELECT 1 FROM user_roles WHERE username = ? AND role = ?`, [username, role]);
    return !!row;
}

export async function getUserRoles(username) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT role FROM user_roles WHERE username = ?`, [username], (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(r => r.role));
        });
    });
}
