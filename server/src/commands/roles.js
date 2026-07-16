import { createRole, deleteRole, getAllRoles, getUserRoles, hasRole, assignRole, removeRole } from "../game/index.js";
import { getAuthenticatedPlayer } from "./utils.js";

export async function handleRolesCommand(player, input) {
    const parts = input.split(/\s+/);

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

    const target = parts[1] || player.name;
    try {
        const roles = await getUserRoles(target);
        const text = roles.length > 0 ? `Roles de ${target}: ${roles.join(", ")}` : `${target} não tem roles.`;
        player.socket.write(`\n${text}\r\n\n`);
    } catch (err) {
        player.socket.write(`\nErro ao buscar roles: ${err.message}\r\n\n`);
    }
}

export async function handleRoleCommand(player, input) {
    const parts = input.split(/\s+/);
    if (parts.length < 4) {
        player.socket.write(`\nUso: /role add|remove <usuario> <role>\r\n\n`);
        return;
    }

    const action = parts[1].toLowerCase();
    const target = parts[2];
    const role = parts[3];

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

            const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, target);
            if (targetPlayer) {
                targetPlayer.socket.write(`\n[Sistema]: Você recebeu a role '${role}'.\r\n\n`);
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
}

export const rolesCommand = {
    name: "roles",
    aliases: ["/roles"],
    async execute(player, input) {
        await handleRolesCommand(player, input);
    }
};

export const roleCommand = {
    name: "role",
    aliases: ["/role"],
    async execute(player, input) {
        await handleRoleCommand(player, input);
    }
};
