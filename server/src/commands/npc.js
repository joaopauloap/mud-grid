import { createNpc, deleteNpc, getAllNpcs, getNpcByName, getNpcById, setNpcDialog } from "../game/index.js";
import { parseCommandArgs } from "./utils.js";

function parseCoordinate(value) {
    if (!value) return null;
    const match = value.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

export const command = {
    name: "npc",
    aliases: ["/npc"],
    roles: ["admin"],
    async execute(player, input) {
        const args = input.trim().split(/\s+/);
        if (args.length < 2) {
            player.socket.write(`\nUso: /npc <create|delete|list> [parâmetros]\r\n`);
            player.socket.write(`  /npc create <nome> [x,y]\r\n`);
            player.socket.write(`  /npc delete <id|nome>\r\n`);
            player.socket.write(`  /npc dialog <id|nome> <trigger> <resposta>\r\n`);
            player.socket.write(`  /npc list\r\n\n`);
            return;
        }

        const action = args[1].toLowerCase();

        try {
            if (action === "create") {
                // /npc create <nome> [x,y]
                const tokens = parseCommandArgs(input.slice(input.indexOf(args[1]) + args[1].length).trim());
                if (tokens.length < 1) {
                    player.socket.write(`\nUso: /npc create <nome> [x,y]\r\n\n`);
                    return;
                }

                const name = tokens[0];
                const coordStr = tokens[1];

                let x, y;
                if (coordStr) {
                    const coord = parseCoordinate(coordStr);
                    if (!coord) {
                        player.socket.write(`\nCoordenada inválida: '${coordStr}'. Use o formato: x,y\r\n\n`);
                        return;
                    }
                    x = coord.x;
                    y = coord.y;
                } else {
                    // Usa a coordenada do admin
                    if (!player.location) {
                        player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
                        return;
                    }
                    x = player.location.x;
                    y = player.location.y;
                }

                const npc = await createNpc({ name, x, y });
                player.socket.write(`\nNPC '${npc.name}' criado no local (${npc.x}, ${npc.y}) com ID ${npc.id}.\r\n\n`);

            } else if (action === "delete") {
                // /npc delete <id|nome>
                if (args.length < 3) {
                    player.socket.write(`\nUso: /npc delete <id|nome>\r\n\n`);
                    return;
                }

                const identifier = args[2];
                const numericId = Number(identifier);
                let npc;

                if (!Number.isNaN(numericId) && String(numericId) === identifier) {
                    npc = await getNpcById(numericId);
                } else {
                    npc = await getNpcByName(identifier);
                }

                if (!npc) {
                    player.socket.write(`\nNPC '${identifier}' não encontrado.\r\n\n`);
                    return;
                }

                const deleted = await deleteNpc(npc.id);
                if (!deleted) {
                    player.socket.write(`\nErro ao deletar NPC.\r\n\n`);
                    return;
                }

                player.socket.write(`\nNPC '${deleted.name}' (ID: ${deleted.id}) deletado.\r\n\n`);

            } else if (action === "dialog") {
                // /npc dialog <id|nome> <trigger> <resposta>
                if (args.length < 4) {
                    player.socket.write(`\nUso: /npc dialog <id|nome> <trigger> <resposta>\r\n\n`);
                    return;
                }

                const npcIdentifier = args[2];
                const trigger = args[3].toLowerCase();

                // Extrai a resposta a partir do texto após o trigger
                const cmdPrefix = input.slice(0, input.indexOf("dialog") + 6);
                const afterDialog = input.slice(cmdPrefix.length).trim();
                const afterNpcId = afterDialog.slice(afterDialog.indexOf(npcIdentifier) + npcIdentifier.length).trim();
                const afterTrigger = afterNpcId.slice(afterNpcId.indexOf(trigger) + trigger.length).trim();
                const response = afterTrigger;

                if (!response) {
                    player.socket.write(`\nUso: /npc dialog <id|nome> <trigger> <resposta>\r\n\n`);
                    return;
                }

                const numericId = Number(npcIdentifier);
                let npc;

                if (!Number.isNaN(numericId) && String(numericId) === npcIdentifier) {
                    npc = await getNpcById(numericId);
                } else {
                    npc = await getNpcByName(npcIdentifier);
                }

                if (!npc) {
                    player.socket.write(`\nNPC '${npcIdentifier}' não encontrado.\r\n\n`);
                    return;
                }

                await setNpcDialog(npc.id, trigger, response);
                player.socket.write(`\nDiálogo configurado: NPC '${npc.name}' [trigger: '${trigger}'] -> "${response}"\r\n\n`);

            } else if (action === "list") {
                const npcs = await getAllNpcs();
                if (npcs.length === 0) {
                    player.socket.write(`\nNenhum NPC cadastrado.\r\n\n`);
                    return;
                }

                const rows = npcs.map(npc =>
                    `- [ID: ${npc.id}] ${npc.name} | Local: (${npc.x}, ${npc.y})`
                ).join("\r\n");

                player.socket.write(`\nNPCs cadastrados:\r\n${rows}\r\n\n`);

            } else {
                player.socket.write(`\nAção inválida: '${action}'. Use 'create', 'delete', 'dialog' ou 'list'.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\nErro no comando NPC: ${err.message}\r\n\n`);
        }
    }
};
