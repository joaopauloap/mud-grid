import { descriptions, getLocationData, saveLocationData, lookLocation } from "../map/index.js";
import { savePlayerLocation, getLocation, getWorldObjectById, updateWorldObjectLocation, getNpcById, getNpcByName, updateNpcLocation } from "../game/index.js";
import { getAuthenticatedPlayer, parseCommandArgs } from "./utils.js";
import { playersAtLocation } from "../game/locationManager.js";
import { GameService } from "../services/gameService.js";

function parseCoordinate(value) {
    if (!value) return null;
    const match = value.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

function ensureLocationData(location) {
    const key = `${location.x},${location.y}`;
    const existing = descriptions.get(key);
    if (existing) {
        return existing;
    }

    const data = {
        city: "Grade",
        place: "Local desconhecido",
        environment: "Área sem descrição",
        description: "Este local ainda não foi descrito.",
        objects: []
    };
    descriptions.set(key, data);
    return data;
}

function findObjectInWorld(query) {
    const normalized = String(query).trim().toLowerCase();
    for (const [key, data] of descriptions.entries()) {
        const object = (data.objects || []).find(item => {
            const keyword = item.keyword ? item.keyword.toLowerCase() : "";
            const name = item.name ? item.name.toLowerCase() : "";
            return keyword === normalized || name === normalized || String(item.id) === normalized;
        });

        if (object) {
            const [x, y] = key.split(",").map(Number);
            return { object, location: { x, y } };
        }
    }

    return null;
}

export async function handleTpCommand(player, input) {
    const args = parseCommandArgs(input.slice("/tp".length).trim());
    if (args.length < 3) {
        player.socket.write(`\nUso: /tp <item|player|npc> <id|nome> <coordenada|usuario>\r\n\n`);
        return true;
    }

    const [targetKindArg, targetValue, destinationValue] = args;
    const targetKind = targetKindArg.toLowerCase();

    if (targetKind === "player" || targetKind === "jogador" || targetKind === "p") {
        // Tenta encontrar jogador conectado
        let targetPlayer = getAuthenticatedPlayer(player.serverPlayers, targetValue)
            || [...player.serverPlayers.values()].find(p => String(p.id) === String(targetValue));

        // Se não estiver conectado, busca no banco de dados (jogador offline)
        if (!targetPlayer) {
            const userLocation = await getLocation(targetValue.toLowerCase());
            if (!userLocation) {
                player.socket.write(`\nJogador '${targetValue}' não encontrado.\r\n\n`);
                return true;
            }
            targetPlayer = {
                name: targetValue.toLowerCase(),
                location: { x: userLocation.x, y: userLocation.y },
                inventory: userLocation.inventory || [],
                socket: null
            };
        }

        const destination = parseCoordinate(destinationValue);
        if (!destination) {
            player.socket.write(`\nCoordenada inválida. Use algo como (3,4).\r\n\n`);
            return true;
        }

        const isOnline = targetPlayer.socket !== null;

        try {
            if (isOnline) {
                const { oldLocation } = await GameService.transferPlayer(targetPlayer, destination);
                player.socket.write(`\nJogador '${targetPlayer.name}' movido para (${destination.x}, ${destination.y}).\r\n\n`);

                if (targetPlayer.socket) {
                    targetPlayer.socket.write(`\n[Sistema]: Você foi movido.\r\n\n`);
                    const locationText = lookLocation(destination);
                    const { getPresentEntitiesText } = await import("../game/locationManager.js");
                    const othersText = await getPresentEntitiesText(targetPlayer);
                    targetPlayer.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
                }

                if (oldLocation) {
                    const sourcePlayers = playersAtLocation(oldLocation, player.serverPlayers)
                        .filter(p => p.id !== targetPlayer.id);
                    for (const other of sourcePlayers) {
                        other.socket.write(`\n[Sistema]: O jogador '${targetPlayer.name}' foi transferido deste local.\r\n\n`);
                    }
                }

                const destinationPlayers = playersAtLocation(destination, player.serverPlayers)
                    .filter(p => p.id !== targetPlayer.id);
                for (const other of destinationPlayers) {
                    other.socket.write(`\n[Sistema]: O jogador '${targetPlayer.name}' foi transferido para este local.\r\n\n`);
                }
            } else {
                await savePlayerLocation(targetPlayer.name, {
                    x: destination.x,
                    y: destination.y,
                    inventory: targetPlayer.inventory
                });
                player.socket.write(`\nJogador offline '${targetPlayer.name}' movido para (${destination.x}, ${destination.y}).\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao mover jogador: ${err.message}\r\n\n`);
        }
        return true;
    }

    if (targetKind === "npc") {
        const numericId = Number(targetValue);
        let npc;

        if (!Number.isNaN(numericId) && String(numericId) === targetValue) {
            npc = await getNpcById(numericId);
        } else {
            npc = await getNpcByName(targetValue);
        }

        if (!npc) {
            player.socket.write(`\nNPC '${targetValue}' não encontrado.\r\n\n`);
            return true;
        }

        const destination = parseCoordinate(destinationValue);
        if (!destination) {
            player.socket.write(`\nCoordenada inválida. Use algo como (3,4).\r\n\n`);
            return true;
        }

        try {
            await updateNpcLocation(npc.id, destination.x, destination.y);
            player.socket.write(`\nNPC '${npc.name}' movido de (${npc.x}, ${npc.y}) para (${destination.x}, ${destination.y}).\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao mover NPC: ${err.message}\r\n\n`);
        }
        return true;
    }

    if (targetKind === "item" || targetKind === "objeto" || targetKind === "obj") {
        const numericTarget = Number(targetValue);
        let resolved = null;

        if (!Number.isNaN(numericTarget) && String(numericTarget) === targetValue) {
            const objectRow = await getWorldObjectById(numericTarget);
            if (objectRow) {
                resolved = { object: objectRow, location: { x: objectRow.x, y: objectRow.y } };
            }
        }

        if (!resolved) {
            resolved = findObjectInWorld(targetValue);
        }

        if (!resolved || !resolved.object) {
            player.socket.write(`\nItem '${targetValue}' não encontrado.\r\n\n`);
            return true;
        }

        const coordinate = parseCoordinate(destinationValue);
        if (coordinate) {
            const sourceLocation = resolved.location || { x: resolved.object.x, y: resolved.object.y };
            
            try {
                await GameService.transferItemToLocation(resolved.object, sourceLocation, coordinate);
                player.socket.write(`\nItem '${resolved.object.name}' movido para (${coordinate.x}, ${coordinate.y}).\r\n\n`);

                const isDifferentLocation = !sourceLocation || sourceLocation.x !== coordinate.x || sourceLocation.y !== coordinate.y;
                // Notifica jogadores no local de origem
                if (sourceLocation && isDifferentLocation) {
                    const sourcePlayers = playersAtLocation(sourceLocation, player.serverPlayers);
                    for (const other of sourcePlayers) {
                        other.socket.write(`\n[Sistema]: O objeto '${resolved.object.name}' foi transferido deste local.\r\n\n`);
                    }
                }

                // Notifica jogadores no local de destino
                if (isDifferentLocation) {
                    const destinationPlayers = playersAtLocation(coordinate, player.serverPlayers);
                    for (const other of destinationPlayers) {
                        other.socket.write(`\n[Sistema]: O objeto '${resolved.object.name}' foi transferido para este local.\r\n\n`);
                    }
                }
            } catch (err) {
                player.socket.write(`\nErro ao mover item: ${err.message}\r\n\n`);
            }
            return true;
        }

        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, destinationValue)
            || [...player.serverPlayers.values()].find(p => String(p.id) === String(destinationValue));
        if (!targetPlayer) {
            player.socket.write(`\nDestino '${destinationValue}' inválido. Use uma coordenada ou um jogador conectado.\r\n\n`);
            return true;
        }

        const sourceLocation = resolved.location || { x: resolved.object.x, y: resolved.object.y };
        
        try {
            await GameService.transferItemToPlayer(resolved.object, sourceLocation, targetPlayer);
            player.socket.write(`\nItem '${resolved.object.name}' movido para o inventário de '${targetPlayer.name}'.\r\n\n`);
            targetPlayer.socket.write(`\n[Sistema]: Item '${resolved.object.name}' foi adicionado ao seu inventário.\r\n\n`);

            // Notifica jogadores no local de origem do item
            if (sourceLocation) {
                const sourcePlayers = playersAtLocation(sourceLocation, player.serverPlayers);
                for (const other of sourcePlayers) {
                    other.socket.write(`\n[Sistema]: O objeto '${resolved.object.name}' foi transferido deste local.\r\n\n`);
                }
            }
        } catch (err) {
            player.socket.write(`\nErro ao mover item para o inventário: ${err.message}\r\n\n`);
        }
        return true;
    }

    player.socket.write(`\nTipo inválido. Use item ou player.\r\n\n`);
    return true;
}

export const command = {
    name: "tp",
    aliases: ["/tp"],
    roles: ["admin"],
    async execute(player, input) {
        await handleTpCommand(player, input);
    }
};
