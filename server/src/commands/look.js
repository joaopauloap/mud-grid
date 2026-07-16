import { playersAtLocation } from "../game/locationManager.js";
import { lookLocation } from "../map/index.js";

export async function handleLookCommand(player) {
    if (!player.location) {
        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
        return;
    }

    const locationText = lookLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
}

export const command = {
    name: "ver",
    aliases: ["/ver"],
    async execute(player) {
        await handleLookCommand(player);
    }
};
