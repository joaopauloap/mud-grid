import { GameService } from "../services/gameService.js";

export const command = {
    name: "soltar",
    aliases: ["/soltar"],
    async execute(player, input) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const query = input.slice("/soltar".length).trim();
        if (!query) {
            player.socket.write(`\nUso: /soltar <objeto>\r\n\n`);
            return;
        }

        player.inventory = player.inventory || [];
        const item = player.inventory.find(obj => {
            const keyword = obj.keyword ? obj.keyword.toLowerCase() : "";
            const name = obj.name ? obj.name.toLowerCase() : "";
            return keyword === query.toLowerCase() || name === query.toLowerCase();
        });

        if (!item) {
            player.socket.write(`\nVocê não tem '${query}' no inventário.\r\n\n`);
            return;
        }

        try {
            await GameService.dropItem(player, item);
            player.socket.write(`\nVocê soltou: ${item.name}.\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao soltar o item: ${err.message}\r\n\n`);
        }
    }
};
