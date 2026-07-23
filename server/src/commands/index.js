import { command as who } from "./who.js";
import { command as where } from "./where.js";
import { command as look } from "./look.js";
import { command as take } from "./take.js";
import { command as drop } from "./drop.js";
import { command as inventory } from "./inventory.js";
import { command as create } from "./create.js";
import { command as inspect } from "./inspect.js";
import { command as destroy } from "./destroy.js";
import { command as disconnect } from "./disconnect.js";
import { rolesCommand, roleCommand } from "./roles.js";
import { command as move } from "./move.js";
import { command as tp } from "./tp.js";
import { command as motd } from "./motd.js";
import { descCommand, nodescCommand } from "./placename.js";
import { command as msg } from "./msg.js";
import { command as usuarios } from "./users.js";
import { command as objetos } from "./objects.js";
import { command as npc } from "./npc.js";
import { hasRole } from "../game/index.js";

// Mapa de comandos registrados
const commandMap = new Map();

function register(cmd) {
    if (!cmd || !cmd.name) return;
    commandMap.set(cmd.name.toLowerCase(), cmd);
    if (cmd.aliases) {
        for (const alias of cmd.aliases) {
            commandMap.set(alias.toLowerCase(), cmd);
        }
    }
}

// Registrar todos os comandos no inicializador
register(who);
register(where);
register(look);
register(take);
register(drop);
register(inventory);
register(create);
register(inspect);
register(destroy);
register(disconnect);
register(rolesCommand);
register(roleCommand);
register(move);
register(tp);
register(motd);
register(descCommand);
register(nodescCommand);
register(msg);
register(usuarios);
register(objetos);
register(npc);

// Comando especial para Sair
register({
    name: "sair",
    aliases: ["/sair", "/exit", "/quit"],
    async execute(player) {
        player.socket.end();
    }
});

// Comando especial para Limpar o Terminal usando sequências de escape ANSI
register({
    name: "limpar",
    aliases: ["/limpar", "/clear", "/cls"],
    async execute(player) {
        // Envia as sequências de escape ANSI para limpar a tela e mover o cursor para o topo
        player.socket.write("\x1B[2J\x1B[H");
    }
});

// Comando para listar todos os comandos dinamicamente
register({
    name: "comandos",
    aliases: ["/comandos", "/commands", "/ajuda", "/help"],
    async execute(player) {
        const uniqueCommands = Array.from(new Set(commandMap.values()));
        const lines = [];

        for (const cmd of uniqueCommands) {
            // Se o comando tiver restrição de roles, checar se o jogador possui alguma delas
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

        // Ordenar os comandos alfabeticamente para melhor visualização
        lines.sort();

        player.socket.write(`\nComandos disponíveis:\r\n${lines.join("\r\n")}\r\n\n`);
    }
});

export async function handleCommand(player, input, broadcast) {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Identificar o primeiro token (o verbo do comando, ex: /pegar, /criar, /norte)
    const parts = trimmed.split(/\s+/);
    const verb = parts[0].toLowerCase();

    // Buscar no mapa de comandos (pelo nome ou alias)
    const cmd = commandMap.get(verb);
    if (cmd) {
        if (cmd.roles && cmd.roles.length > 0) {
            let authorized = false;
            for (const r of cmd.roles) {
                if (await hasRole(player.name, r)) {
                    authorized = true;
                    break;
                }
            }
            if (!authorized) {
                player.socket.write(`\nPermissão negada.\r\n\n`);
                return;
            }
        }

        try {
            await cmd.execute(player, trimmed, broadcast);
        } catch (err) {
            player.socket.write(`\nErro ao executar comando: ${err.message}\r\n\n`);
        }
        return;
    }

    // Se começar com '/' mas não corresponder a nenhum comando conhecido
    if (trimmed.startsWith("/")) {
        player.socket.write(`\nComando desconhecido: ${parts[0]}\r\n\n`);
        return;
    }

    // Caso não seja comando (não comece com '/'), envia como mensagem no chat
    broadcast(`\r\n${player.name}: ${input}\r\n`);
}
export { commandMap as commands };
