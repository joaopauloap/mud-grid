import { directions, movePosition, getCoordinates, describeLocation, lookLocation, takeObjectFromLocation, dropObjectToLocation, saveLocationData, addObjectToLocation, findObjectLocationById, moveObjectToLocation } from "../map/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { savePlayerLocation, assignRole, removeRole, getUserRoles, hasRole, createRole, getAllRoles, deleteRole } from "../auth/index.js";

const directionAliases = {
    "/n": "n",
    "/norte": "n",
    "/ne": "ne",
    "/nordeste": "ne",
    "/e": "e",
    "/leste": "e",
    "/se": "se",
    "/sudeste": "se",
    "/s": "s",
    "/sul": "s",
    "/sw": "sw",
    "/sudoeste": "sw",
    "/w": "w",
    "/oeste": "w",
    "/nw": "nw",
    "/noroeste": "nw"
};

export async function handleCommand(player, input, broadcast) {
    if (input === "/quem") {
        const names = [...player.serverPlayers.values()]
            .filter(p => p.authenticated)
            .map(p => p.name)
            .join("\n-");

        player.socket.write(`\nConectados na Grade: \n-${names}\r\n`);
        return;
    }

    if (input === "/onde") {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n`);
            return;
        }

        const locationText = describeLocation(player.location);
        const others = playersAtLocation(player.location, player.serverPlayers)
            .filter(p => p.id !== player.id)
            .map(p => p.name);

        const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
        player.socket.write(`\n${locationText}\n${othersText}\r\n`);
        return;
    }

    if (input === "/ver") {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n`);
            return;
        }

        const locationText = lookLocation(player.location);
        const others = playersAtLocation(player.location, player.serverPlayers)
            .filter(p => p.id !== player.id)
            .map(p => p.name);

        const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
        player.socket.write(`\n${locationText}\n${othersText}\r\n`);
        return;
    }

    if (input.startsWith("/pegar ")) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n`);
            return;
        }

        const query = input.slice(7).trim();
        if (!query) {
            player.socket.write(`\nUso: /pegar <objeto>\r\n`);
            return;
        }

        const item = takeObjectFromLocation(player.location, query);
        if (!item) {
            player.socket.write(`\nNão há '${query}' aqui.\r\n`);
            return;
        }

        player.inventory = player.inventory || [];
        player.inventory.push(item);

        try {
            await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
            await saveLocationData(player.location);
            player.socket.write(`\nVocê pegou: ${item.name}.\r\n`);
        } catch (err) {
            player.socket.write(`\nErro ao pegar o item: ${err.message}\r\n`);
        }
        return;
    }

    if (input.startsWith("/soltar ")) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n`);
            return;
        }

        const query = input.slice(8).trim();
        if (!query) {
            player.socket.write(`\nUso: /soltar <objeto>\r\n`);
            return;
        }

        player.inventory = player.inventory || [];
        const index = player.inventory.findIndex(obj => obj.id.toLowerCase() === query.toLowerCase() || obj.name.toLowerCase() === query.toLowerCase());
        if (index === -1) {
            player.socket.write(`\nVocê não tem '${query}' no inventário.\r\n`);
            return;
        }

        const [item] = player.inventory.splice(index, 1);
        dropObjectToLocation(player.location, item);

        try {
            await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
            await saveLocationData(player.location);
            player.socket.write(`\nVocê soltou: ${item.name}.\r\n`);
        } catch (err) {
            player.socket.write(`\nErro ao soltar o item: ${err.message}\r\n`);
        }
        return;
    }

    if (input === "/inventario" || input === "/inv" || input === "/i") {
        player.inventory = player.inventory || [];
        if (player.inventory.length === 0) {
            player.socket.write(`\nSeu inventário está vazio.\r\n`);
            return;
        }

        const list = player.inventory.map(item => `- ${item.name}: ${item.description || "sem descrição"}`).join("\r\n\n");
        player.socket.write(`\nSeu inventário:\n${list}\r\n`);
        return;
    }

    if (input.startsWith("/criarobj")) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n`);
            return;
        }

        const tokens = parseCommandArgs(input.slice("/criarobj".length).trim());
        if (tokens.length < 4 || tokens.length > 5) {
            player.socket.write(`\nUso: /criarobj <id> <tipo> <nome> <descrição> [destino]\r\n`);
            return;
        }

        const [id, type, name, description, target] = tokens;
        if (findObjectLocationById(id)) {
            player.socket.write(`\nJá existe um objeto com id '${id}'. Use um id único.\r\n`);
            return;
        }

        let targetLocation = player.location;
        let targetUser = null;
        const coordMatch = target ? target.match(/^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/) : null;

        if (target) {
            if (coordMatch) {
                const [, x, y] = coordMatch;
                targetLocation = { x: Number(x), y: Number(y) };
            } else {
                targetUser = target;
            }
        }

        if (targetUser) {
            const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === targetUser && p.authenticated);
            if (!targetPlayer || !targetPlayer.location) {
                player.socket.write(`\nUsuário '${targetUser}' não encontrado ou sem localização carregada.\r\n`);
                return;
            }
            targetLocation = targetPlayer.location;
        }

        if (!targetLocation) {
            player.socket.write(`\nSua posição atual não está disponível.\r\n`);
            return;
        }

        const object = { id, name, type, description };
        addObjectToLocation(targetLocation, object);

        try {
            await saveLocationData(targetLocation);

            player.socket.write(`\nObjeto '${name}' criado em (${targetLocation.x}, ${targetLocation.y}).\r\n`);

            if (targetUser) {
                const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === targetUser && p.authenticated);
                if (targetPlayer) {
                    targetPlayer.socket.write(`\n[Sistema] O item '${name}' foi adicionado ao seu inventário.\r\n`);
                }
            } else {
                const presentPlayers = playersAtLocation(targetLocation, player.serverPlayers)
                    .filter(p => p.id !== player.id);
                for (const other of presentPlayers) {
                    other.socket.write(`\n[Sistema] Um item '${name}' aparece aqui.\r\n`);
                }
            }
        } catch (err) {
            player.socket.write(`\nErro ao criar objeto: ${err.message}\r\n`);
        }
        return;
    }

    if (input.startsWith("/transferobj")) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n`);
            return;
        }

        const args = parseCommandArgs(input.slice("/transferobj".length).trim());
        if (args.length < 2 || args.length > 3) {
            player.socket.write(`\nUso: /transferobj <id> <x> <y> | /transferobj <id> <usuario>\r\n`);
            return;
        }

        const [objectId, ...destination] = args;
        const findResult = findObjectLocationById(objectId);
        if (!findResult) {
            player.socket.write(`\nObjeto com id '${objectId}' não encontrado.\r\n`);
            return;
        }

        let targetLocation = null;
        let destinationText = "";

        if (destination.length === 1) {
            const username = destination[0];
            const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === username && p.authenticated);
            if (!targetPlayer || !targetPlayer.location) {
                player.socket.write(`\nUsuário '${username}' não encontrado ou sem localização carregada.\r\n`);
                return;
            }
            targetLocation = targetPlayer.location;
            destinationText = `para ${username}`;
        } else if (destination.length === 2) {
            const [xText, yText] = destination;
            if (Number.isNaN(Number(xText)) || Number.isNaN(Number(yText))) {
                player.socket.write(`\nUso: /transferobj <id> <x> <y> | /transferobj <id> <usuario>\r\n`);
                return;
            }
            targetLocation = { x: Number(xText), y: Number(yText) };
            destinationText = `para (${targetLocation.x}, ${targetLocation.y})`;
        }

        if (!targetLocation) {
            player.socket.write(`\nDestino inválido.\r\n`);
            return;
        }

        const moved = moveObjectToLocation(objectId, targetLocation);
        if (!moved) {
            player.socket.write(`\nFalha ao mover o objeto.\r\n`);
            return;
        }

        try {
            await saveLocationData(findResult.location);
            if (findResult.location.x !== targetLocation.x || findResult.location.y !== targetLocation.y) {
                await saveLocationData(targetLocation);
            }
            player.socket.write(`\nObjeto '${findResult.object.name}' transferido ${destinationText}.\r\n`);
        } catch (err) {
            player.socket.write(`\nErro ao salvar transferência: ${err.message}\r\n`);
        }
        return;
    }

    // roles subcommands
    if (input.startsWith("/roles")) {
        const parts = input.split(/\s+/);
        // /roles list  -> list all roles (admin only)
        if (parts[1] === 'list' || parts[1] === 'all') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n`);
                return;
            }
            try {
                const roles = await getAllRoles();
                player.socket.write(`\nRoles existentes: ${roles.join(', ')}\r\n`);
            } catch (err) {
                player.socket.write(`\nErro ao listar roles: ${err.message}\r\n`);
            }
            return;
        }

        // /roles create <role> (admin)
        if (parts[1] === 'create') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n`);
                return;
            }
            const role = parts[2];
            if (!role) {
                player.socket.write(`\nUso: /roles create <role>\r\n`);
                return;
            }
            try {
                await createRole(role);
                player.socket.write(`\nRole '${role}' criada.\r\n`);
            } catch (err) {
                player.socket.write(`\nErro ao criar role: ${err.message}\r\n`);
            }
            return;
        }

        // /roles delete <role> (admin)
        if (parts[1] === 'delete') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n`);
                return;
            }
            const role = parts[2];
            if (!role) {
                player.socket.write(`\nUso: /roles delete <role>\r\n`);
                return;
            }
            try {
                await deleteRole(role);
                player.socket.write(`\nRole '${role}' removida.\r\n`);
            } catch (err) {
                player.socket.write(`\nErro ao remover role: ${err.message}\r\n`);
            }
            return;
        }

        // default: /roles [username] -> list roles for user
        const target = parts[1] || player.name;
        try {
            const roles = await getUserRoles(target);
            const text = roles.length > 0 ? `Roles de ${target}: ${roles.join(", ")}` : `${target} não tem roles.`;
            player.socket.write(`\n${text}\r\n`);
        } catch (err) {
            player.socket.write(`\nErro ao buscar roles: ${err.message}\r\n`);
        }
        return;
    }

    // role management: /role add|remove <username> <role> (admin only)
    if (input.startsWith("/role ")) {
        const parts = input.split(/\s+/);
        if (parts.length < 4) {
            player.socket.write(`\nUso: /role add|remove <usuario> <role>\r\n`);
            return;
        }

        const action = parts[1].toLowerCase();
        const target = parts[2];
        const role = parts[3];

        // permission check: only admin
        const allowed = await hasRole(player.name, 'admin');
        if (!allowed) {
            player.socket.write(`\nPermissão negada.\r\n`);
            return;
        }

        try {
            if (action === 'add') {
                await createRole(role);
                await assignRole(target, role);
                player.socket.write(`\nRole '${role}' atribuída a ${target}.\r\n`);
            } else if (action === 'remove') {
                await removeRole(target, role);
                player.socket.write(`\nRole '${role}' removida de ${target}.\r\n`);
            } else {
                player.socket.write(`\nAção desconhecida. Use add ou remove.\r\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao gerenciar role: ${err.message}\r\n`);
        }

        return;
    }

    const directionKey = directionAliases[input.toLowerCase()];
    if (directionKey) {
        await movePlayer(player, directionKey);
        return;
    }

    if (input === "/sair") {
        player.socket.end();
        return;
    }

    broadcast(`${player.name}: ${input}\n`);
}

function parseCommandArgs(text) {
    const regex = /"([^"]*)"|'([^']*)'|([^\s"]+)/g;
    const args = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        args.push(match[1] || match[2] || match[3]);
    }

    return args;
}

async function movePlayer(player, directionKey) {
    if (!player.location) {
        player.socket.write(`\nPosição desconhecida.\r\n`);
        return;
    }

    player.location = movePosition(player.location, directionKey);
    try {
        await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory || [] });
    } catch (err) {
        player.socket.write(`\nNão foi possível salvar sua posição agora.\r\n`);
    }

    const label = directions[directionKey]?.label || directionKey.toUpperCase();
    player.socket.write(`\nVocê se move para ${label}.`);

    const locationText = describeLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n`);
}
