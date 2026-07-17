import { getAllWorldObjects, getAllUsers } from "../game/index.js";
import { getAuthenticatedPlayer } from "./utils.js";

export const command = {
    name: "inspecionar",
    aliases: ["/inspecionar", "/inspect", "/insp"],
    roles: ["admin"],
    async execute(player, input) {
        const parts = input.trim().split(/\s+/);
        if (parts.length < 3) {
            player.socket.write(`\nUso: /inspecionar <usuario|item> <nome-usuario|id|keyword>\r\n\n`);
            return;
        }

        const type = parts[1].toLowerCase();
        const identifier = parts[2];

        try {
            if (type === "user" || type === "player" || type === "usuario" || type === "jogador") {
                // Tenta achar o player conectado (em tempo real/memória)
                let targetPlayer = getAuthenticatedPlayer(player.serverPlayers, identifier)
                    || [...player.serverPlayers.values()].find(p => p.name && p.name.toLowerCase() === identifier.toLowerCase() && p.authenticated);

                let userId, userName, x, y, invText, status;

                if (targetPlayer) {
                    status = "Online";
                    userId = targetPlayer.id;
                    userName = targetPlayer.name;
                    x = targetPlayer.location ? targetPlayer.location.x : "N/A";
                    y = targetPlayer.location ? targetPlayer.location.y : "N/A";

                    const inv = targetPlayer.inventory || [];
                    invText = inv.length > 0
                        ? inv.map(item => `- [ID: ${item.id}] ${item.name} (${item.keyword}): ${item.description || "sem descrição"}`).join("\r\n")
                        : "Inventário vazio.";
                } else {
                    // Busca no banco de dados por todos os usuários cadastrados (inclusive offline)
                    const users = await getAllUsers();
                    const numericId = Number(identifier);
                    let dbUser;

                    if (!Number.isNaN(numericId) && String(numericId) === identifier) {
                        // Busca por ID numérico
                        dbUser = users.find(u => u.id === numericId);
                    } else {
                        // Busca por nome de usuário
                        dbUser = users.find(u => u.username && u.username.toLowerCase() === identifier.toLowerCase());
                    }

                    if (!dbUser) {
                        player.socket.write(`\nUsuário '${identifier}' não encontrado.\r\n\n`);
                        return;
                    }

                    status = "Offline";
                    userId = dbUser.id;
                    userName = dbUser.username;
                    x = dbUser.x !== null ? dbUser.x : 0;
                    y = dbUser.y !== null ? dbUser.y : 0;

                    let inv = [];
                    try {
                        inv = dbUser.inventory ? JSON.parse(dbUser.inventory) : [];
                    } catch (e) {
                        inv = [];
                    }

                    invText = inv.length > 0
                        ? inv.map(item => `- [ID: ${item.id}] ${item.name} (${item.keyword}): ${item.description || "sem descrição"}`).join("\r\n")
                        : "Inventário vazio.";
                }

                player.socket.write(`\nInformações do Usuário (${status}):\r\nID: ${userId}\r\nNome: ${userName}\r\nCoordenadas: (${x}, ${y})\r\n\r\nInventário:\r\n${invText}\r\n\n`);
            } else if (type === "item" || type === "objeto" || type === "obj") {
                const objects = await getAllWorldObjects();
                const users = await getAllUsers();
                const numericId = Number(identifier);

                if (!Number.isNaN(numericId) && String(numericId) === identifier) {
                    // Busca por ID do item
                    const item = objects.find(obj => obj.id === numericId);

                    if (!item) {
                        player.socket.write(`\nObjeto com ID ${numericId} não encontrado no banco de dados.\r\n\n`);
                        return;
                    }

                    // Verifica se o objeto está no mundo ou com algum jogador
                    let locationDetails = "";
                    if (item.x !== null && item.y !== null) {
                        locationDetails = `Coordenadas no mundo: (${item.x}, ${item.y})`;
                    } else if (item.player_id !== null) {
                        // Tenta localizar o usuário no banco ou memória para exibir as coordenadas dele
                        const ownerDb = users.find(u => u.id === item.player_id);
                        const ownerOnline = [...player.serverPlayers.values()].find(p => p.id === item.player_id && p.authenticated);

                        let ownerName = ownerDb ? ownerDb.username : (ownerOnline ? ownerOnline.name : "Desconhecido");
                        let ownerX = "N/A", ownerY = "N/A";

                        if (ownerOnline && ownerOnline.location) {
                            ownerX = ownerOnline.location.x;
                            ownerY = ownerOnline.location.y;
                        } else if (ownerDb) {
                            ownerX = ownerDb.x !== null ? ownerDb.x : 0;
                            ownerY = ownerDb.y !== null ? ownerDb.y : 0;
                        }

                        locationDetails = `No inventário do jogador '${ownerName}' (Player ID: ${item.player_id}) nas coordenadas: (${ownerX}, ${ownerY})`;
                    } else {
                        locationDetails = `Localização desconhecida (x, y, e player_id são nulos)`;
                    }

                    player.socket.write(`\nInformações do Item:\r\nID: ${item.id}\r\nKeyword: ${item.keyword}\r\nTipo: ${item.type}\r\nNome: ${item.name}\r\nDescrição: ${item.description || "sem descrição"}\r\nLocalização: ${locationDetails}\r\n\n`);
                } else {
                    // Busca por Keyword
                    const matchedItems = objects.filter(obj => obj.keyword && obj.keyword.toLowerCase() === identifier.toLowerCase());

                    if (matchedItems.length === 0) {
                        player.socket.write(`\nNenhum objeto encontrado com a keyword '${identifier}'.\r\n\n`);
                        return;
                    }

                    const listRows = matchedItems.map(item => {
                        let locationDetails = "";
                        if (item.x !== null && item.y !== null) {
                            locationDetails = `No mundo em: (${item.x}, ${item.y})`;
                        } else if (item.player_id !== null) {

                            const ownerDb = users.find(u => u.id === item.player_id);
                            const ownerOnline = [...player.serverPlayers.values()].find(p => p.id === item.player_id && p.authenticated);

                            let ownerName = ownerDb ? ownerDb.username : (ownerOnline ? ownerOnline.name : "Desconhecido");
                            let ownerX = "N/A", ownerY = "N/A";

                            if (ownerOnline && ownerOnline.location) {
                                ownerX = ownerOnline.location.x;
                                ownerY = ownerOnline.location.y;
                            } else if (ownerDb) {
                                ownerX = ownerDb.x !== null ? ownerDb.x : 0;
                                ownerY = ownerDb.y !== null ? ownerDb.y : 0;
                            }

                            locationDetails = `Inventário de '${ownerName}' (Player ID: ${item.player_id}) nas coordenadas: (${ownerX}, ${ownerY})`;
                        } else {
                            locationDetails = `Desconhecida`;
                        }
                        return `- [ID: ${item.id}] Nome: ${item.name} | Local: ${locationDetails}`;
                    }).join("\r\n");

                    player.socket.write(`\nObjetos encontrados com keyword '${identifier}':\r\n${listRows}\r\n\n`);
                }
            } else {
                player.socket.write(`\nTipo de inspeção inválido. Use 'user' ou 'item'.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao inspecionar: ${err.message}\r\n\n`);
        }
    }
};
