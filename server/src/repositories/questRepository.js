import { db, run, get, all } from "../database/db.js";
import { PlayerQuest } from "../entities/quest.js";

export class QuestRepository {
    /**
     * Retorna todas as quests de um jogador.
     */
    static async getPlayerQuests(username) {
        const rows = await all(
            `SELECT * FROM player_quests WHERE username = ? ORDER BY started_at DESC`,
            [username.toLowerCase()]
        );
        return rows.map(PlayerQuest.fromRow);
    }

    /**
     * Retorna uma quest específica de um jogador.
     */
    static async getPlayerQuest(username, questName) {
        const row = await get(
            `SELECT * FROM player_quests WHERE username = ? AND quest_name = ?`,
            [username.toLowerCase(), questName.toLowerCase()]
        );
        return PlayerQuest.fromRow(row);
    }

    /**
     * Atribui uma quest a um jogador (status 'active').
     * Se já existir, não faz nada e retorna false.
     */
    static async assignQuest(username, questName) {
        const existing = await this.getPlayerQuest(username, questName);
        if (existing) return false;

        await run(
            `INSERT INTO player_quests (username, quest_name, status, progress, started_at)
             VALUES (?, ?, 'active', '{}', datetime('now', 'localtime'))`,
            [username.toLowerCase(), questName.toLowerCase()]
        );
        return true;
    }

    /**
     * Marca uma quest como 'completed'.
     */
    static async completeQuest(username, questName) {
        const pq = await this.getPlayerQuest(username, questName);
        if (!pq) return false;

        await run(
            `UPDATE player_quests SET status = 'completed', completed_at = datetime('now', 'localtime')
             WHERE id = ?`,
            [pq.id]
        );
        return true;
    }

    /**
     * Marca uma quest como 'failed'.
     */
    static async failQuest(username, questName) {
        const pq = await this.getPlayerQuest(username, questName);
        if (!pq) return false;

        await run(
            `UPDATE player_quests SET status = 'failed', completed_at = datetime('now', 'localtime')
             WHERE id = ?`,
            [pq.id]
        );
        return true;
    }

    /**
     * Remove uma quest do jogador.
     */
    static async removeQuest(username, questName) {
        const result = await run(
            `DELETE FROM player_quests WHERE username = ? AND quest_name = ?`,
            [username.toLowerCase(), questName.toLowerCase()]
        );
        return result.changes > 0;
    }

    /**
     * Atualiza o progresso (JSON) de uma quest.
     */
    static async updateQuestProgress(username, questName, progressJson) {
        const pq = await this.getPlayerQuest(username, questName);
        if (!pq) return false;

        await run(
            `UPDATE player_quests SET progress = ? WHERE id = ?`,
            [progressJson, pq.id]
        );
        return true;
    }

    /**
     * Retorna todas as quests ativas de um jogador.
     */
    static async getActiveQuests(username) {
        const rows = await all(
            `SELECT * FROM player_quests WHERE username = ? AND status = 'active' ORDER BY started_at DESC`,
            [username.toLowerCase()]
        );
        return rows.map(PlayerQuest.fromRow);
    }

    /**
     * Verifica se o jogador tem uma quest ativa.
     */
    static async hasActiveQuest(username, questName) {
        const row = await get(
            `SELECT id FROM player_quests WHERE username = ? AND quest_name = ? AND status = 'active'`,
            [username.toLowerCase(), questName.toLowerCase()]
        );
        return !!row;
    }

    /**
     * Verifica se o jogador completou uma quest.
     */
    static async hasCompletedQuest(username, questName) {
        const row = await get(
            `SELECT id FROM player_quests WHERE username = ? AND quest_name = ? AND status = 'completed'`,
            [username.toLowerCase(), questName.toLowerCase()]
        );
        return !!row;
    }
}
