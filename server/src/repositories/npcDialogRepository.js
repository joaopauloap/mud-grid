import { run, get, all } from "../database/db.js";

export class NpcDialogRepository {
    /**
     * Cria ou atualiza uma resposta de diálogo para um NPC.
     * @param {number} npcId - ID do NPC
     * @param {string} trigger - Palavra-chave que dispara a resposta (ex: "oi", "tchau", "missao")
     * @param {string} response - Texto da resposta do NPC
     */
    static async setDialog(npcId, trigger, response) {
        await run(
            `INSERT INTO npc_dialogs (npc_id, trigger, response) VALUES (?, ?, ?)
             ON CONFLICT(npc_id, trigger) DO UPDATE SET response = excluded.response`,
            [npcId, trigger.toLowerCase(), response]
        );
    }

    /**
     * Obtém a resposta de diálogo para um NPC dado um trigger.
     */
    static async getDialog(npcId, trigger) {
        const row = await get(
            `SELECT response FROM npc_dialogs WHERE npc_id = ? AND trigger = ?`,
            [npcId, trigger.toLowerCase()]
        );
        return row ? row.response : null;
    }

    /**
     * Obtém todos os diálogos de um NPC.
     */
    static async getAllDialogs(npcId) {
        return await all(
            `SELECT trigger, response FROM npc_dialogs WHERE npc_id = ?`,
            [npcId]
        );
    }

    /**
     * Remove um diálogo específico.
     */
    static async deleteDialog(npcId, trigger) {
        await run(
            `DELETE FROM npc_dialogs WHERE npc_id = ? AND trigger = ?`,
            [npcId, trigger.toLowerCase()]
        );
    }

    /**
     * Busca por diálogo verificando se o texto do jogador contém algum trigger.
     * Retorna a primeira resposta encontrada.
     */
    static async findResponse(npcId, playerText) {
        const normalized = playerText.toLowerCase().trim();
        const dialogs = await all(
            `SELECT trigger, response FROM npc_dialogs WHERE npc_id = ?`,
            [npcId]
        );

        // Procura o trigger mais longo que aparece no texto do jogador
        // (para evitar que "oi" dentro de "oicia" seja acionado incorretamente)
        const sorted = (dialogs || []).sort((a, b) => b.trigger.length - a.trigger.length);
        
        // Para cada trigger, verifica se o texto do jogador contém a palavra como token separado
        const words = normalized.split(/\s+/);
        for (const d of sorted) {
            for (const word of words) {
                if (word === d.trigger) {
                    return d.response;
                }
            }
        }
        return null;
    }
}
