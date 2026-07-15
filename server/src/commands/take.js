import { savePlayerLocation } from "../auth/index.js";
import { saveLocationData, takeObjectFromLocation } from "../map/index.js";

export async function handleTakeCommand(player, input) {
    if (!player.location) {
        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
        return;
    }

    const query = input.slice(7).trim();
    if (!query) {
        player.socket.write(`\nUso: /pegar <objeto>\r\n\n`);
        return;
    }

    const item = takeObjectFromLocation(player.location, query);
    if (!item) {
        player.socket.write(`\nNão há '${query}' aqui.\r\n\n`);
        return;
    }

    player.inventory = player.inventory || [];
    player.inventory.push(item);

    try {
        await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
        await saveLocationData(player.location);
        player.socket.write(`\nVocê pegou: ${item.name}.\r\n\n`);
    } catch (err) {
        player.socket.write(`\nErro ao pegar o item: ${err.message}\r\n\n`);
    }
}
