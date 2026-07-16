import { run, get, all } from "../database/db.js";

export class RoleRepository {
    static async createRole(name) {
        await run(`INSERT INTO roles (name) VALUES (?) ON CONFLICT(name) DO NOTHING`, [name]);
    }

    static async getAllRoles() {
        const rows = await all(`SELECT name FROM roles`);
        return (rows || []).map(r => r.name);
    }

    static async deleteRole(name) {
        await run(`DELETE FROM user_roles WHERE role = ?`, [name]);
        await run(`DELETE FROM roles WHERE name = ?`, [name]);
    }

    static async seedRoles(names) {
        for (const n of names) {
            await RoleRepository.createRole(n);
        }
    }

    static async assignRole(username, role) {
        await RoleRepository.createRole(role);
        await run(`INSERT INTO user_roles (username, role) VALUES (?, ?)
        ON CONFLICT(username, role) DO NOTHING`, [username, role]);
    }

    static async removeRole(username, role) {
        await run(`DELETE FROM user_roles WHERE username = ? AND role = ?`, [username, role]);
    }

    static async hasRole(username, role) {
        const row = await get(`SELECT 1 FROM user_roles WHERE username = ? AND role = ?`, [username, role]);
        return !!row;
    }

    static async getUserRoles(username) {
        const rows = await all(`SELECT role FROM user_roles WHERE username = ?`, [username]);
        return (rows || []).map(r => r.role);
    }
}
