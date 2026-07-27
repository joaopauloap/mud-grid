import { hasRole } from "../game/index.js";

export const command = {
    name: "ajuda",
    aliases: ["/ajuda","/comandos", "/commands", "/help"],
    async execute(player) {
        const { commands } = await import("./index.js");
        const uniqueCommands = Array.from(new Set(commands.values()));
        const lines = [];

        for (const cmd of uniqueCommands) {
            if (cmd.roles && cmd.roles.length > 0) {
                let authorized = false;
                for (const role of cmd.roles) {
                    if (await hasRole(player.name, role)) {
                        authorized = true;
                        break;
                    }
                }
                if (!authorized) continue;
            }

            const aliasesText = cmd.aliases && cmd.aliases.length > 0
                ? ` (${cmd.aliases.join(", ")})`
                : "";
            lines.push(`- ${cmd.name}${aliasesText}`);
        }

        lines.sort();
        player.socket.write(`\nComandos disponíveis:\r\n${lines.join("\r\n")}\r\n\n`);
    }
};
