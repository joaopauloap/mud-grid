import { directions, lookLocation } from "../map/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { GameService } from "../services/gameService.js";

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

    try {
        await GameService.movePlayer(player, directionKey);
    } catch (err) {
        player.socket.write(`\nNão foi possível salvar sua posição agora: ${err.message}\r\n\n`);
        return true;
    }

    const label = directions[directionKey]?.label || directionKey.toUpperCase();
    player.socket.write(`\nVocê se move para ${label}.\r\n`);

    const locationText = lookLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
    return true;
}

export const command = {
    name: "mover",
    aliases: Object.keys(directionAliases),
    async execute(player, input) {
        await handleMoveCommand(player, input);
    }
};