export class Player {
    constructor(socket, id, playersMap) {
        this.id = id;
        this.socket = socket;
        this.name = `player${id}`;
        this.authenticated = false;
        this.stage = 'awaiting_username';
        this.pendingUsername = null;
        this.inputBuffer = "";
        this.serverPlayers = playersMap;
        this.location = null;
        this.inventory = [];
        // Estado de diálogo com NPC (árvore)
        // { npcId, npcName, nodeId, treeId }
        this.dialogState = null;
    }

    write(text) {
        if (this.socket && !this.socket.destroyed) {
            this.socket.write(text.replace(/\r?\n/g, "\r\n"));
        }
    }

    sendLine(text) {
        this.write(text + "\n");
    }

    sendPrompt() {
        this.write("> ");
    }

    addToInventory(item) {
        this.inventory = this.inventory || [];
        this.inventory.push(item);
    }

    removeFromInventory(query) {
        if (!this.inventory) return null;
        const normalized = query.toLowerCase();
        const index = this.inventory.findIndex(obj => {
            const keyword = obj.keyword ? obj.keyword.toLowerCase() : "";
            const name = obj.name ? obj.name.toLowerCase() : "";
            return keyword === normalized || name === normalized;
        });

        if (index === -1) return null;
        return this.inventory.splice(index, 1)[0];
    }

    // --- Diálogo com NPC ---

    /** Inicia ou retoma diálogo com um NPC */
    startDialog(npcId, npcName, nodeId, treeId) {
        this.dialogState = { npcId, npcName, nodeId, treeId };
    }

    /** Cancela o diálogo ativo */
    cancelDialog() {
        this.dialogState = null;
    }

    /** Retorna true se estiver em diálogo ativo com um NPC específico (ou qualquer, se npcId omitido) */
    isInDialog(npcId) {
        if (!this.dialogState) return false;
        if (npcId !== undefined) return this.dialogState.npcId === npcId;
        return true;
    }
}
