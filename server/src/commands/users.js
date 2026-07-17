import { getAllUsers } from "../game/index.js";

export const command = {
    name: "usuarios",
    aliases: ["/usuarios", "/users"],
    roles: ["admin"],
    async execute(player) {
        try {
            const users = await getAllUsers();
            if (users.length === 0) {
                player.socket.write(`\nNenhum usuário encontrado no sistema.\r\n\n`);
                return;
            }

            const rows = users.map(u => {
                const isOnline = [...player.serverPlayers.values()].some(p => p.id === u.id && p.authenticated) ? "Online" : "Offline";
                const x = u.x !== null ? u.x : 0;
                const y = u.y !== null ? u.y : 0;
                return `- [ID: ${u.id}] Nome: ${u.username} | Posição: (${x}, ${y}) | Status: ${isOnline}`;
            }).join("\r\n");

            player.socket.write(`\nUsuários cadastrados na Grade:\r\n${rows}\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao listar usuários: ${err.message}\r\n\n`);
        }
    }
};
