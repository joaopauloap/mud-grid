import { rolesCommand, roleCommand } from "./roles.js";
import { descCommand, nodescCommand } from "./placename.js";
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
import { command as move } from "./move.js";
import { command as tp } from "./tp.js";
import { command as motd } from "./motd.js";
import { command as msg } from "./msg.js";
import { command as users } from "./users.js";
import { command as objects } from "./objects.js";
import { command as npc } from "./npc.js";
import { command as reseed } from "./reseed.js";
import { command as exit } from "./exit.js";
import { command as clear } from "./clear.js";
import { command as ajuda } from "./help.js";
import { command as quest } from "./quest.js";
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
register(users);
register(objects);
register(npc);
register(reseed);
register(exit);
register(clear);
register(ajuda);
register(quest);

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
