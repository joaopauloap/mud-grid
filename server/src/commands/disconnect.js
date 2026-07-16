import { hasRole } from "../game/index.js";
import { getAuthenticatedPlayer } from "./utils.js";

export const command = {
    name: "desconectar",
    aliases: ["/desconectar"],
    async execute(player, input) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        const args = input.trim().split(/\s+/);
        if (args.length !== 2) {
            player.socket.write(`\nUso: /desconectar <usuario>\r\n\n`);
            return;
        }

        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, args[1]);
        if (!targetPlayer) {
            player.socket.write(`\nUsuário '${args[1]}' não encontrado ou não está conectado.\r\n\n`);
            return;
        }

        targetPlayer.socket.write(`\n[Sistema]: Você foi desconectado.\r\n\n`);
        targetPlayer.socket.end();
        player.socket.write(`\nUsuário '${args[1]}' desconectado.\r\n\n`);
    }
};
