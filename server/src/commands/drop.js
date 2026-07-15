import { savePlayerLocation } from "../auth/index.js";
import { dropObjectToLocation, saveLocationData } from "../map/index.js";

export async function handleDropCommand(player, input) {
    if (!player.location) {
        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
        return;
    }

    const query = input.slice(8).trim();
    if (!query) {
        player.socket.write(`\nUso: /soltar <objeto>\r\n\n`);
        return;
    }

    player.inventory = player.inventory || [];
    const index = player.inventory.findIndex(obj => {
        const keyword = obj.keyword ? obj.keyword.toLowerCase() : "";
        const name = obj.name ? obj.name.toLowerCase() : "";
        return keyword === query.toLowerCase() || name === query.toLowerCase();
    });

    if (index === -1) {
        player.socket.write(`\nVocê não tem '${query}' no inventário.\r\n\n`);
        return;
    }

    const [item] = player.inventory.splice(index, 1);
    dropObjectToLocation(player.location, item);

    try {
        await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
        await saveLocationData(player.location);
        player.socket.write(`\nVocê soltou: ${item.name}.\r\n\n`);
    } catch (err) {
        player.socket.write(`\nErro ao soltar o item: ${err.message}\r\n\n`);
    }
}
