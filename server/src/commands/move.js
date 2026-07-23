import { directions, lookLocation } from "../map/index.js";
import { getPresentEntitiesText, playersAtLocation } from "../game/locationManager.js";
import { GameService } from "../services/gameService.js";

const directionAliases = {
    "/n": "n",
    "/norte": "n",
    "/ne": "ne",
    "/nordeste": "ne",
    "/e": "e",
    "/leste": "e",
    "/l": "e",
    "/se": "se",
    "/sudeste": "se",
    "/s": "s",
    "/sul": "s",
    "/sw": "sw",
    "/sudoeste": "sw",
    "/w": "w",
    "/oeste": "w",
    "/o": "w",
    "/nw": "nw",
    "/noroeste": "nw",
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
    const othersText = await getPresentEntitiesText(player);
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