import { playersAtLocation } from "../game/locationManager.js";
import { saveLocationData, addObjectToLocation } from "../map/index.js";
import { hasRole, createWorldObject } from "../auth/index.js";
import { getAuthenticatedPlayer, parseCommandArgs } from "./utils.js";

export async function handleCreateCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return;
    }

    const tokens = parseCommandArgs(input.slice("/criar".length).trim());
    if (tokens.length < 4) {
        player.socket.write(`\nUso: /criar <tipo> <keyword> <nome> <descrição> [destino]\r\n\n`);
        return;
    }

    const [type, keyword, name, ...rest] = tokens;
    if (rest.length === 0) {
        player.socket.write(`\nUso: /criar <tipo> <keyword> <nome> <descrição> [destino]\r\n\n`);
        return;
    }

    let targetLocation = player.location;
    let targetUser = null;
    let description = rest.join(" ");

    if (tokens.length > 4) {
        const destinationValue = rest[rest.length - 1];
        const destinationMatch = destinationValue.match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/);
        const possiblePlayer = getAuthenticatedPlayer(player.serverPlayers, destinationValue);

        description = rest.slice(0, -1).join(" ");

        if (destinationMatch) {
            const [, x, y] = destinationMatch;
            targetLocation = { x: Number(x), y: Number(y) };
        } else if (possiblePlayer) {
            targetUser = possiblePlayer.name;
        } else {
            player.socket.write(`\nDestino '${destinationValue}' inválido. Use um usuário conectado ou coordenadas (x,y).\r\n\n`);
            return;
        }
    }

    if (targetUser) {
        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, targetUser);
        if (!targetPlayer || !targetPlayer.location) {
            player.socket.write(`\nUsuário '${targetUser}' não encontrado ou sem localização carregada.\r\n\n`);
            return;
        }
        targetLocation = targetPlayer.location;
    }

    const created = await createWorldObject({
        keyword,
        type,
        name,
        description,
        x: targetLocation.x,
        y: targetLocation.y
    });

    addObjectToLocation(targetLocation, { id: created.id, keyword: created.keyword, type: created.type, name: created.name, description: created.description });

    try {
        await saveLocationData(targetLocation);
        player.socket.write(`\nObjeto '${name}' criado com id ${created.id} em (${targetLocation.x}, ${targetLocation.y}).\r\n\n`);

        if (targetUser) {
            const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, targetUser);
            if (targetPlayer) {
                targetPlayer.socket.write(`\n[Sistema] '${name}' foi adicionado ao seu inventário.\r\n\n`);
            }
        } else {
            const presentPlayers = playersAtLocation(targetLocation, player.serverPlayers)
                .filter(p => p.id !== player.id);
            for (const other of presentPlayers) {
                other.socket.write(`\n[Sistema] Um '${name}' aparece aqui.\r\n\n`);
            }
        }
    } catch (err) {
        player.socket.write(`\nErro ao criar objeto: ${err.message}\r\n\n`);
    }
}
