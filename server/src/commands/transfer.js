import { descriptions, getLocationData, saveLocationData, lookLocation } from "../map/index.js";
import { savePlayerLocation, hasRole, getWorldObjectById, updateWorldObjectLocation } from "../game/index.js";
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

export async function handleTransferCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return true;
    }

    const args = parseCommandArgs(input.slice("/transf".length).trim());
    if (args.length < 3) {
        player.socket.write(`\nUso: /transf <item|player> <id|nome> <coordenada|usuario>\r\n\n`);
        return true;
    }

    const [targetKindArg, targetValue, destinationValue] = args;
    const targetKind = targetKindArg.toLowerCase();

    if (targetKind === "player" || targetKind === "jogador" || targetKind === "p") {
        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, targetValue)
            || [...player.serverPlayers.values()].find(p => String(p.id) === String(targetValue));

        if (!targetPlayer) {
            player.socket.write(`\nJogador '${targetValue}' não encontrado ou não está conectado.\r\n\n`);
            return true;
        }

        const destination = parseCoordinate(destinationValue);
        if (!destination) {
            player.socket.write(`\nCoordenada inválida. Use algo como (3,4).\r\n\n`);
            return true;
        }

        try {
            const { oldLocation } = await GameService.transferPlayer(targetPlayer, destination);
            player.socket.write(`\nJogador '${targetPlayer.name}' movido para (${destination.x}, ${destination.y}).\r\n\n`);
            targetPlayer.socket.write(`\n[Sistema]: Você foi movido.\r\n\n`);
            
            // Exibe a descrição do novo local (efeito do comando /ver)
            const locationText = lookLocation(destination);
            const others = playersAtLocation(destination, player.serverPlayers)
                .filter(p => p.id !== targetPlayer.id)
                .map(p => p.name);

            const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
            targetPlayer.socket.write(`\n${locationText}\n${othersText}\r\n\n`);

            // Notifica os jogadores no local de origem
            if (oldLocation) {
                const sourcePlayers = playersAtLocation(oldLocation, player.serverPlayers)
                    .filter(p => p.id !== targetPlayer.id);
                for (const other of sourcePlayers) {
                    other.socket.write(`\n[Sistema]: O jogador '${targetPlayer.name}' foi transferido deste local.\r\n\n`);
                }
            }

            // Notifica os jogadores no local de destino
            const destinationPlayers = playersAtLocation(destination, player.serverPlayers)
                .filter(p => p.id !== targetPlayer.id);
            for (const other of destinationPlayers) {
                other.socket.write(`\n[Sistema]: O jogador '${targetPlayer.name}' foi transferido para este local.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao mover jogador: ${err.message}\r\n\n`);
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
    name: "transf",
    aliases: ["/transf", "/transferir"],
    async execute(player, input) {
        await handleTransferCommand(player, input);
    }
};
