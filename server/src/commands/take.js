import { GameService } from "../services/gameService.js";
import { getLocationData } from "../map/index.js";

export const command = {
    name: "pegar",
    aliases: ["/pegar"],
    async execute(player, input) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const query = input.slice("/pegar".length).trim();
        if (!query) {
            player.socket.write(`\nUso: /pegar <objeto>\r\n\n`);
            return;
        }

        const data = getLocationData(player.location);
        if (!data || !data.objects) {
            player.socket.write(`\nNão há '${query}' aqui.\r\n\n`);
            return;
        }

        const item = data.objects.find(obj => 
            obj.keyword.toLowerCase() === query.toLowerCase() || 
            obj.name.toLowerCase() === query.toLowerCase()
        );

        if (!item) {
            player.socket.write(`\nNão há '${query}' aqui.\r\n\n`);
            return;
        }

        try {
            await GameService.transferItemToPlayer(item, player.location, player);
            player.socket.write(`\nVocê pegou: ${item.name}.\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao pegar o item: ${err.message}\r\n\n`);
        }
    }
};
