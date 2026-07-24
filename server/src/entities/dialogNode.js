export class DialogNode {
    constructor({ id, tree_id, parent_id, trigger, npc_response, npc_hint, sort_order, flags, condition_type, condition_value, action_commands }) {
        this.id = id;
        this.treeId = tree_id;
        this.parentId = parent_id;
        this.trigger = trigger;
        this.npcResponse = npc_response;
        this.npcHint = npc_hint;
        this.sortOrder = sort_order || 0;
        this.flags = flags || '';
        this.conditionType = condition_type;
        this.conditionValue = condition_value;
        this.actionCommands = action_commands || '[]';
    }

    /** Retorna o array de ações parseado */
    getActions() {
        try {
            return JSON.parse(this.actionCommands);
        } catch {
            return [];
        }
    }

    hasFlag(flag) {
        return this.flags.split(',').map(f => f.trim()).includes(flag);
    }

    static fromRow(row) {
        if (!row) return null;
        return new DialogNode({
            id: row.id,
            tree_id: row.tree_id,
            parent_id: row.parent_id,
            trigger: row.trigger,
            npc_response: row.npc_response,
            npc_hint: row.npc_hint,
            sort_order: row.sort_order,
            flags: row.flags,
            condition_type: row.condition_type,
            condition_value: row.condition_value,
            action_commands: row.action_commands
        });
    }
}
