import { directions, movePosition, formatCoordinates, formatLocationMessage } from "../map/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { savePlayerLocation } from "../auth/index.js";

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
    "/o": "w",
    "/oeste": "w",
    "/nw": "nw",
    "/noroeste": "nw"
};

export async function handleCommand(player, input, broadcast) {
    if (input === "/quem") {
        const names = [...player.serverPlayers.values()]
            .filter(p => p.authenticated)
            .map(p => p.name)
            .join("\n-");

        player.socket.write(`\nConectados na Grade: \n-${names}\r\n`);
        return;
    }

    if (input === "/ver") {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n`);
            return;
        }

        const locationText = formatLocationMessage(player.location);
        const others = playersAtLocation(player.location, player.serverPlayers)
            .filter(p => p.id !== player.id)
            .map(p => p.name);

        const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
        player.socket.write(`\n${locationText}\n${othersText}\r\n`);
        return;
    }

    const directionKey = directionAliases[input.toLowerCase()];
    if (directionKey) {
        await movePlayer(player, directionKey);
        return;
    }

    if (input === "/sair") {
        player.socket.end();
        return;
    }

    broadcast(`${player.name}: ${input}\n`);
}

async function movePlayer(player, directionKey) {
    if (!player.location) {
        player.socket.write(`\nPosição desconhecida.\r\n`);
        return;
    }

    player.location = movePosition(player.location, directionKey);
    try {
        await savePlayerLocation(player.name, player.location);
    } catch (err) {
        player.socket.write(`\nNão foi possível salvar sua posição agora.\r\n`);
    }

    const label = directions[directionKey]?.label || directionKey.toUpperCase();
    player.socket.write(`\nVocê se move para ${label}.`);

    const locationText = formatLocationMessage(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n`);
}
