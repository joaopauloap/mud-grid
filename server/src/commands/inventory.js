export const command = {
    name: "inventario",
    aliases: ["/inventario", "/inv", "/i"],
    async execute(player) {
        player.inventory = player.inventory || [];
        if (player.inventory.length === 0) {
            player.socket.write(`\nSeu inventário está vazio.\r\n\n`);
            return;
        }

        const list = player.inventory.map(item => `- ${item.name}: ${item.description || "sem descrição"}`).join("\r\n\n");
        player.socket.write(`\nSeu inventário:\n${list}\r\n\n`);
    }
};
