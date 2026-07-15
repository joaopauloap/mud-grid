import { playersAtLocation } from "../game/locationManager.js";
import { descriptions, saveLocationData, addObjectToLocation } from "../map/index.js";
import { hasRole, createWorldObject, savePlayerLocation } from "../game/index.js";
import { getAuthenticatedPlayer, parseCommandArgs } from "./utils.js";

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

export async function handleCreateCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return;
    }

    const tokens = parseCommandArgs(input.slice("/criar".length).trim());
    if (tokens.length < 4) {
        player.socket.write(`\nUso: /criar <tipo> <keyword> <nome> <descrição> [coordenada|usuario]\r\n\n`);
        return;
    }

    const [type, keyword, name, description, dest] = tokens;

    try {
        if (!dest) {
            // Caso não seja informado nem coordenada nem nome do jogador, deve criar no local do jogador que executou o comando.
            if (!player.location) {
                player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
                return;
            }

            const created = await createWorldObject({ keyword, type, name, description, x: player.location.x, y: player.location.y });
            const locationData = ensureLocationData(player.location);
            locationData.objects.push({
                id: created.id,
                keyword: created.keyword,
                type: created.type,
                name: created.name,
                description: created.description
            });

            await saveLocationData(player.location);

            player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado aqui.\r\n\n`);

            const presentPlayers = playersAtLocation(player.location, player.serverPlayers)
                .filter(p => p.id !== player.id);
            for (const other of presentPlayers) {
                other.socket.write(`\n[Sistema]: O objeto '${created.name}' foi criado neste local.\r\n\n`);
            }
        } else {
            const coordinate = parseCoordinate(dest);
            if (coordinate) {
                // Se for coordenada, deve criar o objeto nesse local.
                const created = await createWorldObject({ keyword, type, name, description, x: coordinate.x, y: coordinate.y });
                const locationData = ensureLocationData(coordinate);
                locationData.objects.push({
                    id: created.id,
                    keyword: created.keyword,
                    type: created.type,
                    name: created.name,
                    description: created.description
                });

                await saveLocationData(coordinate);

                player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado no local (${coordinate.x}, ${coordinate.y}).\r\n\n`);

                const presentPlayers = playersAtLocation(coordinate, player.serverPlayers)
                    .filter(p => p.id !== player.id);
                for (const other of presentPlayers) {
                    other.socket.write(`\n[Sistema]: O objeto '${created.name}' foi criado neste local.\r\n\n`);
                }
            } else {
                // Se for nome de jogador, deve criar o objeto no inventário do jogador.
                const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, dest)
                    || [...player.serverPlayers.values()].find(p => p.name && p.name.toLowerCase() === dest.toLowerCase());

                if (!targetPlayer) {
                    player.socket.write(`\nDestino '${dest}' inválido. Use uma coordenada válida ou o nome de um jogador conectado.\r\n\n`);
                    return;
                }

                const created = await createWorldObject({ keyword, type, name, description, x: null, y: null });
                targetPlayer.inventory = targetPlayer.inventory || [];
                targetPlayer.inventory.push({
                    id: created.id,
                    keyword: created.keyword,
                    type: created.type,
                    name: created.name,
                    description: created.description
                });

                await savePlayerLocation(targetPlayer.name, { x: targetPlayer.location?.x ?? 0, y: targetPlayer.location?.y ?? 0, inventory: targetPlayer.inventory });

                player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado no inventário do jogador '${targetPlayer.name}'.\r\n\n`);
                targetPlayer.socket.write(`\n[Sistema]: '${created.name}' foi adicionado em seu inventário.\r\n\n`);
            }
        }
    } catch (err) {
        player.socket.write(`\nErro ao criar objeto: ${err.message}\r\n\n`);
    }
}
