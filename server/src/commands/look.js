import { getPresentEntitiesText } from "../game/locationManager.js";
import { lookLocation } from "../map/index.js";

export async function handleLookCommand(player) {
    if (!player.location) {
        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
        return;
    }

    const locationText = lookLocation(player.location);
    const othersText = await getPresentEntitiesText(player);
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
}

export const command = {
    name: "ver",
    aliases: ["/ver", "/look"],
    async execute(player) {
        await handleLookCommand(player);
    }
};
