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
}
