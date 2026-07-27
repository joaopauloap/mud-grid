import { getAuthenticatedPlayer } from "./utils.js";

export const command = {
    name: "desconectar",
    aliases: ["/desconectar", "/dc", "/disconnect"],
    roles: ["admin"],
    async execute(player, input) {
        const args = input.trim().split(/\s+/);

        // /desconectar all → desconecta todos exceto o admin
        if (args.length === 2 && args[1].toLowerCase() === "all") {
            let count = 0;
            for (const p of player.serverPlayers.values()) {
                if (p.id !== player.id && p.authenticated) {
                    p.socket.write(`\n[Sistema]: Você foi desconectado por um administrador.\r\n\n`);
                    p.socket.end();
                    count++;
                }
            }
            player.socket.write(`\n${count} jogador(es) desconectado(s).\r\n\n`);
            return;
        }

        if (args.length !== 2) {
            player.socket.write(`\nUso: /desconectar <usuario|all>\r\n\n`);
            return;
        }

        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, args[1]);
        if (!targetPlayer) {
            player.socket.write(`\'${args[1]}' não encontrado ou não está conectado.\r\n\n`);
            return;
        }

        targetPlayer.socket.write(`\n[Sistema]: Você foi desconectado.\r\n\n`);
        targetPlayer.socket.end();
        player.socket.write(`\'${args[1]}' desconectado.\r\n\n`);
    }
};
