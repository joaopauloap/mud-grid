import { directions, movePosition, getCoordinates, describeLocation, lookLocation, takeObjectFromLocation, dropObjectToLocation, saveLocationData, addObjectToLocation, removeObjectFromLocationById } from "../map/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { savePlayerLocation, assignRole, removeRole, getUserRoles, hasRole, createRole, getAllRoles, deleteRole, createWorldObject, getAllWorldObjects, getWorldObjectById, updateWorldObjectLocation, deleteWorldObjectById } from "../auth/index.js";

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

        player.socket.write(`\nConectados na Grade: \n-${names}\r\n\n`);
        return;
    }

    if (input === "/onde") {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const locationText = describeLocation(player.location);
        const others = playersAtLocation(player.location, player.serverPlayers)
            .filter(p => p.id !== player.id)
            .map(p => p.name);

        const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
        player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
        return;
    }

    if (input === "/ver") {
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
        return;
    }

    if (input.startsWith("/pegar ")) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const query = input.slice(7).trim();
        if (!query) {
            player.socket.write(`\nUso: /pegar <objeto>\r\n\n`);
            return;
        }

        const item = takeObjectFromLocation(player.location, query);
        if (!item) {
            player.socket.write(`\nNão há '${query}' aqui.\r\n\n`);
            return;
        }

        player.inventory = player.inventory || [];
        player.inventory.push(item);

        try {
            await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
            await saveLocationData(player.location);
            player.socket.write(`\nVocê pegou: ${item.name}.\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao pegar o item: ${err.message}\r\n\n`);
        }
        return;
    }

    if (input.startsWith("/soltar ")) {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }

        const query = input.slice(8).trim();
        if (!query) {
            player.socket.write(`\nUso: /soltar <objeto>\r\n\n`);
            return;
        }

        player.inventory = player.inventory || [];
        const index = player.inventory.findIndex(obj => {
            const keyword = obj.keyword ? obj.keyword.toLowerCase() : "";
            const name = obj.name ? obj.name.toLowerCase() : "";
            return keyword === query.toLowerCase() || name === query.toLowerCase();
        });
        if (index === -1) {
            player.socket.write(`\nVocê não tem '${query}' no inventário.\r\n\n`);
            return;
        }

        const [item] = player.inventory.splice(index, 1);
        dropObjectToLocation(player.location, item);

        try {
            await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory });
            await saveLocationData(player.location);
            player.socket.write(`\nVocê soltou: ${item.name}.\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao soltar o item: ${err.message}\r\n\n`);
        }
        return;
    }

    if (input === "/inventario" || input === "/inv" || input === "/i") {
        player.inventory = player.inventory || [];
        if (player.inventory.length === 0) {
            player.socket.write(`\nSeu inventário está vazio.\r\n\n`);
            return;
        }

        const list = player.inventory.map(item => `- ${item.name}: ${item.description || "sem descrição"}`).join("\r\n\n");
        player.socket.write(`\nSeu inventário:\n${list}\r\n\n`);
        return;
    }

    if (input.startsWith("/criar")) {
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
            const possiblePlayer = [...player.serverPlayers.values()]
                .find(p => p.name && p.name.toLowerCase() === destinationValue.toLowerCase());

            description = rest.slice(0, -1).join(" ");

            if (destinationMatch) {
                const [, x, y] = destinationMatch;
                targetLocation = { x: Number(x), y: Number(y) };
            } else if (possiblePlayer) {
                if (!possiblePlayer.authenticated) {
                    player.socket.write(`\nUsuário '${destinationValue}' não está conectado.\r\n\n`);
                    return;
                }
                targetUser = possiblePlayer.name;
            } else {
                player.socket.write(`\nDestino '${destinationValue}' inválido. Use um usuário conectado ou coordenadas (x,y).\r\n\n`);
                return;
            }
        }

        if (targetUser) {
            const targetPlayer = [...player.serverPlayers.values()]
                .find(p => p.authenticated && p.name.toLowerCase() === targetUser.toLowerCase());
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
                const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === targetUser && p.authenticated);
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
        return;
    }

    if (input.startsWith("/inspecionar")) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        try {
            const objects = await getAllWorldObjects();
            if (objects.length === 0) {
                player.socket.write(`\nNenhum objeto encontrado na tabela.\r\n\n`);
                return;
            }

            const rows = objects.map(obj => `id=${obj.id}, keyword=${obj.keyword}, type=${obj.type}, name=${obj.name}, description=${obj.description}, x=${obj.x}, y=${obj.y}`).join(`\r\n\n`);
            player.socket.write(`\nObjetos no banco:\r\n${rows}\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao inspecionar objetos: ${err.message}\r\n\n`);
        }
        return;
    }

    if (input.startsWith("/destruir")) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        const args = parseCommandArgs(input.slice("/destruir".length).trim());
        if (args.length !== 1) {
            player.socket.write(`\nUso: /destruir <id>\r\n\n`);
            return;
        }

        const id = Number(args[0]);
        if (Number.isNaN(id)) {
            player.socket.write(`\nID inválido. Use um número.\r\n\n`);
            return;
        }

        const object = await getWorldObjectById(id);
        if (!object) {
            player.socket.write(`\nObjeto com id ${id} não encontrado.\r\n\n`);
            return;
        }

        const targetLocation = { x: object.x, y: object.y };
        removeObjectFromLocationById(targetLocation, id);

        try {
            await deleteWorldObjectById(id);
            await saveLocationData(targetLocation);

            player.socket.write(`\nObjeto '${object.name}' (id ${id}) destruído.\r\n\n`);

            const presentPlayers = playersAtLocation(targetLocation, player.serverPlayers)
                .filter(p => p.id !== player.id);
            for (const other of presentPlayers) {
                other.socket.write(`\n[Sistema] O objeto '${object.name}' foi destruído neste local.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao destruir objeto: ${err.message}\r\n\n`);
        }
        return;
    }

    if (input.startsWith("/desconectar")) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        const args = parseCommandArgs(input.slice("/desconectar".length).trim());
        if (args.length !== 1) {
            player.socket.write(`\nUso: /desconectar <usuario>\r\n\n`);
            return;
        }

        const username = args[0];
        const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === username && p.authenticated);
        if (!targetPlayer) {
            player.socket.write(`\nUsuário '${username}' não encontrado ou não está conectado.\r\n\n`);
            return;
        }

        targetPlayer.socket.write(`\n[Sistema] Você foi desconectado.\r\n\n`);
        targetPlayer.socket.end();
        player.socket.write(`\nUsuário '${username}' desconectado.\r\n\n`);
        return;
    }

    // roles subcommands
    if (input.startsWith("/roles")) {
        const parts = input.split(/\s+/);
        // /roles list  -> list all roles (admin only)
        if (parts[1] === 'list' || parts[1] === 'all') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n\n`);
                return;
            }
            try {
                const roles = await getAllRoles();
                player.socket.write(`\nRoles existentes: ${roles.join(', ')}\r\n\n`);
            } catch (err) {
                player.socket.write(`\nErro ao listar roles: ${err.message}\r\n\n`);
            }
            return;
        }

        // /roles create <role> (admin)
        if (parts[1] === 'create') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n\n`);
                return;
            }
            const role = parts[2];
            if (!role) {
                player.socket.write(`\nUso: /roles create <role>\r\n\n`);
                return;
            }
            try {
                await createRole(role);
                player.socket.write(`\nRole '${role}' criada.\r\n\n`);
            } catch (err) {
                player.socket.write(`\nErro ao criar role: ${err.message}\r\n\n`);
            }
            return;
        }

        // /roles delete <role> (admin)
        if (parts[1] === 'delete') {
            const isAdmin = await hasRole(player.name, 'admin');
            if (!isAdmin) {
                player.socket.write(`\nPermissão negada.\r\n\n`);
                return;
            }
            const role = parts[2];
            if (!role) {
                player.socket.write(`\nUso: /roles delete <role>\r\n\n`);
                return;
            }
            try {
                await deleteRole(role);
                player.socket.write(`\nRole '${role}' removida.\r\n\n`);
            } catch (err) {
                player.socket.write(`\nErro ao remover role: ${err.message}\r\n\n`);
            }
            return;
        }

        // default: /roles [username] -> list roles for user
        const target = parts[1] || player.name;
        try {
            const roles = await getUserRoles(target);
            const text = roles.length > 0 ? `Roles de ${target}: ${roles.join(", ")}` : `${target} não tem roles.`;
            player.socket.write(`\n${text}\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao buscar roles: ${err.message}\r\n\n`);
        }
        return;
    }

    // role management: /role add|remove <username> <role> (admin only)
    if (input.startsWith("/role ")) {
        const parts = input.split(/\s+/);
        if (parts.length < 4) {
            player.socket.write(`\nUso: /role add|remove <usuario> <role>\r\n\n`);
            return;
        }

        const action = parts[1].toLowerCase();
        const target = parts[2];
        const role = parts[3];

        // permission check: only admin
        const allowed = await hasRole(player.name, 'admin');
        if (!allowed) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        try {
            if (action === 'add') {
                await createRole(role);
                await assignRole(target, role);
                player.socket.write(`\nRole '${role}' atribuída a ${target}.\r\n\n`);

                const targetPlayer = [...player.serverPlayers.values()].find(p => p.name === target && p.authenticated);
                if (targetPlayer) {
                    targetPlayer.socket.write(`\n[Sistema] Você recebeu a role '${role}'.\r\n\n`);
                }
            } else if (action === 'remove') {
                await removeRole(target, role);
                player.socket.write(`\nRole '${role}' removida de ${target}.\r\n\n`);
            } else {
                player.socket.write(`\nAção desconhecida. Use add ou remove.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro ao gerenciar role: ${err.message}\r\n\n`);
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
        player.socket.write(`\nPosição desconhecida.\r\n\n`);
        return;
    }

    player.location = movePosition(player.location, directionKey);
    try {
        await savePlayerLocation(player.name, { x: player.location.x, y: player.location.y, inventory: player.inventory || [] });
    } catch (err) {
        player.socket.write(`\nNão foi possível salvar sua posição agora.\r\n\n`);
    }

    const label = directions[directionKey]?.label || directionKey.toUpperCase();
    player.socket.write(`\nVocê se move para ${label}.`);

    const locationText = describeLocation(player.location);
    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const othersText = others.length > 0 ? `Também estão aqui: ${others.join(", ")}` : "Você está sozinho neste local.";
    player.socket.write(`\n${locationText}\n${othersText}\r\n\n`);
}
