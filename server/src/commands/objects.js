import { getAllWorldObjects, getAllUsers } from "../game/index.js";

export const command = {
    name: "objetos",
    aliases: ["/objetos", "/objects"],
    roles: ["admin"],
    async execute(player) {
        try {
            const objects = await getAllWorldObjects();
            const users = await getAllUsers();

            if (objects.length === 0) {
                player.socket.write(`\nNenhum objeto encontrado no sistema.\r\n\n`);
                return;
            }

            const rows = objects.map(item => {
                let locationDetails = "";
                if (item.x !== null && item.y !== null) {
                    locationDetails = `Mundo (${item.x}, ${item.y})`;
                } else if (item.player_id !== null) {
                    const ownerDb = users.find(u => u.id === item.player_id);
                    const ownerOnline = [...player.serverPlayers.values()].find(p => p.id === item.player_id && p.authenticated);
                    
                    let ownerName = ownerDb ? ownerDb.username : (ownerOnline ? ownerOnline.name : "Desconhecido");
                    locationDetails = `Inventário de '${ownerName}' (ID: ${item.player_id})`;
                } else {
                    locationDetails = `Desconhecida`;
                }

                return `- [ID: ${item.id}] Nome: ${item.name} (${item.keyword}) | Tipo: ${item.type} | Local: ${locationDetails}`;
            }).join("\r\n");

            player.socket.write(`\nObjetos cadastrados na Grade:\r\n${rows}\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao listar objetos: ${err.message}\r\n\n`);
        }
    }
};
