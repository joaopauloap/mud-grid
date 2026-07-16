import { run, get, all } from "../database/db.js";
import { WorldObject } from "../entities/worldObject.js";

export class WorldRepository {
    static async getGameParam(key) {
        const row = await get(`SELECT value FROM game_params WHERE key = ?`, [key]);
        return row ? row.value : null;
    }

    static async getAllWorldDescriptions() {
        const rows = await all(`SELECT x, y, city, place, environment, description FROM world_places`);
        return (rows || []).map(r => ({
            x: r.x,
            y: r.y,
            city: r.city,
            place: r.place,
            environment: r.environment,
            description: r.description
        }));
    }

    static async getWorldCount() {
        const row = await get(`SELECT COUNT(*) as cnt FROM world_places`);
        return row ? row.cnt : 0;
    }

    static async seedWorld(rows) {
        for (const r of rows) {
            await run(`INSERT INTO world_places (x, y, city, place, environment, description) VALUES (?, ?, ?, ?, ?, ?)
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

    static async saveWorldDescription(location) {
        await run(`INSERT INTO world_places (x, y, city, place, environment, description) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(x,y) DO UPDATE SET city = excluded.city, place = excluded.place, environment = excluded.environment, description = excluded.description`, [
            location.x,
            location.y,
            location.city,
            location.place,
            location.environment,
            location.description
        ]);
    }

    static async createWorldObject(object) {
        const result = await run(`INSERT INTO world_objects (keyword, type, name, description, x, y) VALUES (?, ?, ?, ?, ?, ?)`, [
            object.keyword,
            object.type,
            object.name,
            object.description,
            object.x,
            object.y
        ]);
        return new WorldObject({
            id: result.lastID,
            keyword: object.keyword,
            type: object.type,
            name: object.name,
            description: object.description,
            x: object.x,
            y: object.y
        });
    }

    static async getAllWorldObjects() {
        const rows = await all(`SELECT id, keyword, type, name, description, x, y FROM world_objects`);
        return (rows || []).map(row => WorldObject.fromRow(row));
    }

    static async getWorldObjectsByLocation(x, y) {
        const rows = await all(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE x = ? AND y = ?`, [x, y]);
        return (rows || []).map(row => WorldObject.fromRow(row));
    }

    static async getWorldObjectById(id) {
        const row = await get(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE id = ?`, [id]);
        return WorldObject.fromRow(row);
    }

    static async updateWorldObjectLocation(id, x, y) {
        await run(`UPDATE world_objects SET x = ?, y = ? WHERE id = ?`, [x, y, id]);
        return await WorldRepository.getWorldObjectById(id);
    }

    static async seedWorldObjects(objects) {
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

    static async getWorldObjectCount() {
        const row = await get(`SELECT COUNT(*) as cnt FROM world_objects`);
        return row ? row.cnt : 0;
    }

    static async deleteWorldObjectById(id) {
        await run(`DELETE FROM world_objects WHERE id = ?`, [id]);
    }

    static async getWorldObjectsByKeyword(keyword) {
        const rows = await all(`SELECT id, keyword, type, name, description, x, y FROM world_objects WHERE keyword = ?`, [keyword]);
        return (rows || []).map(row => WorldObject.fromRow(row));
    }
}
