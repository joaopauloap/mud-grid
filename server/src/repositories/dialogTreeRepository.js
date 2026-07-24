import { run, get, all } from "../database/db.js";
import { DialogNode } from "../entities/dialogNode.js";

export class DialogTreeRepository {

    // ==================== TREE ====================

    static async createTree(npcId, name) {
        const result = await run(
            `INSERT INTO dialog_trees (npc_id, name) VALUES (?, ?)`,
            [npcId, name]
        );
        return { id: result.lastID, npcId, name };
    }

    static async getTreeByNpcId(npcId) {
        return await get(
            `SELECT id, npc_id, name FROM dialog_trees WHERE npc_id = ?`,
            [npcId]
        );
    }

    static async getTreeById(treeId) {
        return await get(
            `SELECT id, npc_id, name FROM dialog_trees WHERE id = ?`,
            [treeId]
        );
    }

    static async deleteTreeByNpcId(npcId) {
        await run(`DELETE FROM dialog_trees WHERE npc_id = ?`, [npcId]);
    }

    // ==================== NODES ====================

    /**
     * Adiciona um nó à árvore.
     * @param {number} treeId
     * @param {number|null} parentId - null para nó raiz
     * @param {string} trigger - palavra-chave que dispara o nó
     * @param {string} npcResponse - resposta do NPC
     * @param {object} opts - { hint, sortOrder, flags, conditionType, conditionValue }
     */
    static async addNode(treeId, parentId, trigger, npcResponse, opts = {}) {
        const {
            hint = null,
            sortOrder = 0,
            flags = '',
            conditionType = null,
            conditionValue = null
        } = opts;

        const result = await run(
            `INSERT INTO dialog_nodes (tree_id, parent_id, trigger, npc_response, npc_hint, sort_order, flags, condition_type, condition_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [treeId, parentId, trigger.toLowerCase(), npcResponse, hint, sortOrder, flags, conditionType, conditionValue]
        );
        return new DialogNode({
            id: result.lastID,
            tree_id: treeId,
            parent_id: parentId,
            trigger: trigger.toLowerCase(),
            npc_response: npcResponse,
            npc_hint: hint,
            sort_order: sortOrder,
            flags,
            condition_type: conditionType,
            condition_value: conditionValue
        });
    }

    /**
     * Obtém todos os nós de uma árvore.
     */
    static async getTreeNodes(treeId) {
        const rows = await all(
            `SELECT * FROM dialog_nodes WHERE tree_id = ? ORDER BY parent_id, sort_order`,
            [treeId]
        );
        return (rows || []).map(r => DialogNode.fromRow(r));
    }

    /**
     * Retorna os nós raiz da árvore (parent_id IS NULL).
     */
    static async getRootNodes(treeId) {
        const rows = await all(
            `SELECT * FROM dialog_nodes WHERE tree_id = ? AND parent_id IS NULL ORDER BY sort_order`,
            [treeId]
        );
        return (rows || []).map(r => DialogNode.fromRow(r));
    }

    /**
     * Retorna os filhos de um nó específico.
     */
    static async getChildNodes(nodeId) {
        const rows = await all(
            `SELECT * FROM dialog_nodes WHERE parent_id = ? ORDER BY sort_order`,
            [nodeId]
        );
        return (rows || []).map(r => DialogNode.fromRow(r));
    }

    /**
     * Busca um nó filho cujo trigger corresponda exatamente a uma palavra do texto do jogador.
     * Retorna o primeiro match.
     */
    static async findChildByTrigger(parentNodeId, playerText) {
        const normalized = playerText.toLowerCase().trim();
        const words = normalized.split(/\s+/);

        const children = await DialogTreeRepository.getChildNodes(parentNodeId);
        if (children.length === 0) return null;

        // Ordena triggers do mais longo para o mais curto (evita match parcial)
        children.sort((a, b) => b.trigger.length - a.trigger.length);

        for (const child of children) {
            for (const word of words) {
                if (word === child.trigger) {
                    return child;
                }
            }
        }
        return null;
    }

    /**
     * Obtém um nó por ID.
     */
    static async getNodeById(nodeId) {
        const row = await get(`SELECT * FROM dialog_nodes WHERE id = ?`, [nodeId]);
        return DialogNode.fromRow(row);
    }

    /**
     * Atualiza o trigger de um nó.
     */
    static async updateNodeTrigger(nodeId, newTrigger) {
        await run(`UPDATE dialog_nodes SET trigger = ? WHERE id = ?`, [newTrigger.toLowerCase(), nodeId]);
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Atualiza a resposta de um nó.
     */
    static async updateNodeResponse(nodeId, newResponse) {
        await run(`UPDATE dialog_nodes SET npc_response = ? WHERE id = ?`, [newResponse, nodeId]);
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Atualiza o hint de um nó.
     */
    static async updateNodeHint(nodeId, hint) {
        await run(`UPDATE dialog_nodes SET npc_hint = ? WHERE id = ?`, [hint, nodeId]);
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Atualiza as flags de um nó.
     */
    static async updateNodeFlags(nodeId, flags) {
        await run(`UPDATE dialog_nodes SET flags = ? WHERE id = ?`, [flags, nodeId]);
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Define condição em um nó.
     */
    static async updateNodeCondition(nodeId, conditionType, conditionValue) {
        await run(
            `UPDATE dialog_nodes SET condition_type = ?, condition_value = ? WHERE id = ?`,
            [conditionType || null, conditionValue || null, nodeId]
        );
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Define as ações de um nó (JSON array de comandos).
     * @param {number} nodeId
     * @param {string} actionCommandsJson - Ex: '[{"type":"give_item","keyword":"disco","name":"Disco"}]'
     */
    static async updateNodeActions(nodeId, actionCommandsJson) {
        await run(
            `UPDATE dialog_nodes SET action_commands = ? WHERE id = ?`,
            [actionCommandsJson, nodeId]
        );
        return await DialogTreeRepository.getNodeById(nodeId);
    }

    /**
     * Deleta um nó e seus filhos recursivamente.
     */
    static async deleteNode(nodeId) {
        // Deleta filhos recursivamente
        const children = await DialogTreeRepository.getChildNodes(nodeId);
        for (const child of children) {
            await DialogTreeRepository.deleteNode(child.id);
        }
        await run(`DELETE FROM dialog_nodes WHERE id = ?`, [nodeId]);
    }

    /**
     * Busca um nó pelo trigger dentro de uma árvore (para comandos admin).
     */
    static async findNodeByTrigger(treeId, trigger) {
        const row = await get(
            `SELECT * FROM dialog_nodes WHERE tree_id = ? AND trigger = ?`,
            [treeId, trigger.toLowerCase()]
        );
        return DialogNode.fromRow(row);
    }

    /**
     * Monta a árvore completa para exibição (comandos admin).
     */
    static async getTreeAsText(treeId) {
        const nodes = await DialogTreeRepository.getTreeNodes(treeId);
        if (nodes.length === 0) return "  (árvore vazia)";

        const nodeMap = new Map();
        const childrenMap = new Map(); // parentId -> [nodes]

        for (const n of nodes) {
            nodeMap.set(n.id, n);
            const pid = n.parentId || '__root__';
            if (!childrenMap.has(pid)) childrenMap.set(pid, []);
            childrenMap.get(pid).push(n);
        }

        const lines = [];
        function render(nodeId, indent) {
            const n = nodeMap.get(nodeId);
            if (!n) return;
            const flagsStr = n.flags ? ` [${n.flags}]` : '';
            const condStr = n.conditionType ? ` (if ${n.conditionType}=${n.conditionValue})` : '';
            const hintStr = n.npcHint ? ` → hints: ${n.npcHint}` : '';
            const actions = n.getActions();
            const actionStr = actions.length > 0 ? ` ⚡ações: ${actions.map(a => a.type).join(', ')}` : '';
            lines.push(`${indent}[${n.id}] "${n.trigger}"${flagsStr}${condStr}: "${n.npcResponse}"${hintStr}${actionStr}`);
            const kids = childrenMap.get(n.id) || [];
            for (const kid of kids) {
                render(kid.id, indent + '  ');
            }
        }

        const roots = childrenMap.get('__root__') || [];
        for (const root of roots) {
            render(root.id, '');
        }

        return lines.join('\r\n');
    }
}
