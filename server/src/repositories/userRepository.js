import { run, get, all } from "../database/db.js";

export class UserRepository {
    static async userExists(username) {
        const row = await get(`SELECT id FROM users WHERE username = ?`, [username]);
        return !!row;
    }

    static async getUser(username) {
        return await get(`SELECT id, username, password_hash, salt, x, y, inventory FROM users WHERE username = ?`, [username]);
    }

    static async createUserRow(username, passwordHash, salt) {
        await run(`INSERT INTO users (username, password_hash, salt, x, y, inventory) VALUES (?, ?, ?, 0, 0, ?)`, [
            username, 
            passwordHash, 
            salt,
            JSON.stringify([{ id: 'caneta', name: 'Caneta', type: 'item', description: 'Uma caneta simples de tinta azul.' }])
        ]);
    }

    static async getLocation(username) {
        const row = await get(`SELECT x, y, inventory FROM users WHERE username = ?`, [username]);
        if (!row) return null;
        return {
            x: row.x !== null ? row.x : 0,
            y: row.y !== null ? row.y : 0,
            inventory: row.inventory ? JSON.parse(row.inventory) : []
        };
    }

    static async savePlayerLocation(username, location) {
        await run(`UPDATE users SET x = ?, y = ?, inventory = ? WHERE username = ?`, [
            location.x, 
            location.y, 
            JSON.stringify(location.inventory || []),
            username
        ]);
    }

    static async getAllUsers() {
        return await all(`SELECT id, username, x, y, inventory FROM users`);
    }
}
