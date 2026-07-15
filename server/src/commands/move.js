import { directions, movePosition, describeLocation } from "../map/index.js";
import { savePlayerLocation } from "../auth/index.js";
import { playersAtLocation } from "../game/locationManager.js";

const directionAliases = {
    "/n": "n",
    "/norte": "n",
    "/ne": "ne",
    "/nordeste": "ne",
    "/e": "e",
    "/leste": "e",
    "/se": "se",
    "/sudeste": "se",
    "/s": "s",
    "/sul": "s",
    "/sw": "sw",
    "/sudoeste": "sw",
    "/w": "w",
    "/oeste": "w",
    "/nw": "nw",
    "/noroeste": "nw"
};

export async function handleMoveCommand(player, input) {
    const directionKey = directionAliases[input.toLowerCase()];
    if (!directionKey) {
        return false;
    }

    if (!player.location) {
        player.socket.write(`\nPosição desconhecida.\r\n\n`);
        return true;
    }

    player.location = movePosition(player.location, directionKey);
    try {
        await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory || [] });
    } catch (err) {
        player.socket.write(`\nNão foi possível salvar sua posição agora.\r\n\n`);
    }

    const label = directions[directionKey]?.label || directionKey.toUpperCase();
    player.socket.write(`\nVocê se move para ${label}.`);

    const locationText = describeLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
    return true;
}