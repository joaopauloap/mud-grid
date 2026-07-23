import { getPresentEntitiesText } from "../game/locationManager.js";
import { describeLocation } from "../map/index.js";
import { hasRole } from "../game/index.js";

export const command = {
    name: "onde",
    aliases: ["/onde", "/where"],
    async execute(player) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const isAdmin = await hasRole(player.name, 'admin');
        const isMod = await hasRole(player.name, 'mod');
        const hasMapItem = player.inventory && player.inventory.some(item => 
            item.keyword && item.keyword.toLowerCase() === 'mapa'
        );

        if (!isAdmin && !isMod && !hasMapItem) {
            player.socket.write(`\nVocê não possui um mapa para saber sua localização.\r\n\n`);
            return;
        }

        const locationText = describeLocation(player.location);
        const othersText = await getPresentEntitiesText(player);
        player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
    }
};
