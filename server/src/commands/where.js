import { playersAtLocation } from "../game/locationManager.js";
import { describeLocation } from "../map/index.js";

export async function handleWhereCommand(player) {
    if (!player.location) {
        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
        return;
    }

    const locationText = describeLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
}
