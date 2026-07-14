import sqlite3 from "sqlite3";
import crypto from "crypto";

const DB_FILE = "users.db";

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

  await run(`CREATE TABLE IF NOT EXISTS world_descriptions (
    x INTEGER,
    y INTEGER,
    description TEXT,
    PRIMARY KEY(x,y)
  )`);

  const motd = await get(`SELECT value FROM game_params WHERE key = ?`, ["motd"]);
  if (!motd) {
    await run(`INSERT INTO game_params (key, value) VALUES (?, ?)`, [
      "motd",
      "..."
    ]);
  }
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
  const row = await get(`SELECT x, y FROM player_locations WHERE username = ?`, [username]);
  return row;
}

export async function savePlayerLocation(username, location) {
  await run(`INSERT INTO player_locations (username, x, y) VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET x = excluded.x, y = excluded.y`, [username, location.x, location.y]);
}

export async function getAllWorldDescriptions() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT x, y, description FROM world_descriptions`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function getWorldCount() {
  const row = await get(`SELECT COUNT(*) as cnt FROM world_descriptions`);
  return row ? row.cnt : 0;
}

export async function seedWorld(rows) {
  for (const r of rows) {
    await run(`INSERT INTO world_descriptions (x, y, description) VALUES (?, ?, ?)
      ON CONFLICT(x,y) DO UPDATE SET description = excluded.description`, [r.x, r.y, r.description]);
  }
}

export async function saveWorldDescription(x, y, description) {
  await run(`INSERT INTO world_descriptions (x, y, description) VALUES (?, ?, ?)
    ON CONFLICT(x,y) DO UPDATE SET description = excluded.description`, [x, y, description]);
}
