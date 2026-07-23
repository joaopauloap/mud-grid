import { run, get, all } from "../database/db.js";
import { Npc } from "../entities/npc.js";

export class NpcRepository {
    static async createNpc({ name, x, y }) {
        const result = await run(
            `INSERT INTO npcs (name, x, y) VALUES (?, ?, ?)`,
            [name, x, y]
        );
        return new Npc({
            id: result.lastID,
            name,
            x,
            y
        });
    }

    static async deleteNpc(id) {
        const npc = await NpcRepository.getNpcById(id);
        if (!npc) return null;
        await run(`DELETE FROM npcs WHERE id = ?`, [id]);
        await run(`DELETE FROM npc_dialogs WHERE npc_id = ?`, [id]);
        return npc;
    }

    static async getNpcById(id) {
        const row = await get(`SELECT id, name, x, y FROM npcs WHERE id = ?`, [id]);
        return Npc.fromRow(row);
    }

    static async getNpcByName(name) {
        const row = await get(`SELECT id, name, x, y FROM npcs WHERE LOWER(name) = LOWER(?)`, [name]);
        return Npc.fromRow(row);
    }

    static async getAllNpcs() {
        const rows = await all(`SELECT id, name, x, y FROM npcs`);
        return (rows || []).map(row => Npc.fromRow(row));
    }

    static async getNpcsByLocation(x, y) {
        const rows = await all(`SELECT id, name, x, y FROM npcs WHERE x = ? AND y = ?`, [x, y]);
        return (rows || []).map(row => Npc.fromRow(row));
    }

    static async updateNpcLocation(id, x, y) {
        await run(`UPDATE npcs SET x = ?, y = ? WHERE id = ?`, [x, y, id]);
        return await NpcRepository.getNpcById(id);
    }
}
