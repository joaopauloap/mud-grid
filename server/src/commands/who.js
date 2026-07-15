import { playersAtLocation } from "../game/locationManager.js";

export async function handleWhoCommand(player) {
    const names = [...player.serverPlayers.values()]
        .filter(p => p.authenticated)
        .map(p => p.name)
        .join("\n-");

    player.socket.write(`\nConectados na Grade: \n-${names}\r\n\n`);
}
