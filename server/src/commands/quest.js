import fs from "fs";
import path from "path";
import {
    getPlayerQuests, getPlayerQuest,
    assignQuest, completeQuest, failQuest, removeQuest,
    getActiveQuests, hasActiveQuest, hasCompletedQuest
} from "../game/index.js";

const QUESTS_DATA_DIR = path.resolve(process.cwd(), "data", "quests");

/**
 * Carrega a definição de todas as quests do JSON.
 */
function loadQuestDefinitions() {
    const filePath = path.join(QUESTS_DATA_DIR, "quests.json");
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/**
 * Encontra uma quest definition pelo nome.
 */
function findQuestDefinition(name) {
    const quests = loadQuestDefinitions();
    return quests.find(q => q.name.toLowerCase() === name.toLowerCase()) || null;
}

export const command = {
    name: "quest",
    aliases: ["/quest"],
    roles: ["admin"],
    async execute(player, input) {
        const args = input.split(/\s+/).slice(1); // remove o "quest" ou "/quest"

        if (args.length === 0) {
            printUsage(player);
            return;
        }

        const sub = args[0].toLowerCase();

        switch (sub) {
            case "give":
            case "assign":
                await handleGive(player, args);
                break;
            case "complete":
                await handleComplete(player, args);
                break;
            case "fail":
                await handleFail(player, args);
                break;
            case "remove":
                await handleRemove(player, args);
                break;
            case "list":
                await handleList(player, args);
                break;
            case "info":
                await handleInfo(player, args);
                break;
            case "defs":
                await handleDefs(player);
                break;
            default:
                printUsage(player);
        }
    }
};

function printUsage(player) {
    player.socket.write(`\r\nUso do comando quest:\r\n`);
    player.socket.write(`  quest give <player> <quest>       - Atribui uma quest\r\n`);
    player.socket.write(`  quest complete <player> <quest>   - Completa uma quest\r\n`);
    player.socket.write(`  quest fail <player> <quest>       - Marca quest como falha\r\n`);
    player.socket.write(`  quest remove <player> <quest>     - Remove quest do jogador\r\n`);
    player.socket.write(`  quest list [player]               - Lista quests do jogador\r\n`);
    player.socket.write(`  quest info <quest>                - Mostra detalhes de uma quest\r\n`);
    player.socket.write(`  quest defs                        - Lista todas as quests definidas\r\n\n`);
}

async function handleGive(player, args) {
    if (args.length < 3) {
        player.socket.write(`\r\nUso: quest give <player> <quest>\r\n\n`);
        return;
    }
    const targetPlayer = args[1].toLowerCase();
    const questName = args.slice(2).join(" ").toLowerCase();

    const def = findQuestDefinition(questName);
    if (!def) {
        player.socket.write(`\r\nQuest '${questName}' não encontrada nas definições.\r\n\n`);
        return;
    }

    const result = await assignQuest(targetPlayer, def.name);
    if (result) {
        player.socket.write(`\r\nQuest '${def.name}' atribuída a '${targetPlayer}'.\r\n\n`);
    } else {
        player.socket.write(`\r\nJogador '${targetPlayer}' já possui a quest '${def.name}'.\r\n\n`);
    }
}

async function handleComplete(player, args) {
    if (args.length < 3) {
        player.socket.write(`\r\nUso: quest complete <player> <quest>\r\n\n`);
        return;
    }
    const targetPlayer = args[1].toLowerCase();
    const questName = args.slice(2).join(" ").toLowerCase();

    const result = await completeQuest(targetPlayer, questName);
    if (result) {
        player.socket.write(`\r\nQuest '${questName}' completa para '${targetPlayer}'.\r\n\n`);
    } else {
        player.socket.write(`\r\nJogador '${targetPlayer}' não possui a quest '${questName}'.\r\n\n`);
    }
}

async function handleFail(player, args) {
    if (args.length < 3) {
        player.socket.write(`\r\nUso: quest fail <player> <quest>\r\n\n`);
        return;
    }
    const targetPlayer = args[1].toLowerCase();
    const questName = args.slice(2).join(" ").toLowerCase();

    const result = await failQuest(targetPlayer, questName);
    if (result) {
        player.socket.write(`\r\nQuest '${questName}' marcada como falha para '${targetPlayer}'.\r\n\n`);
    } else {
        player.socket.write(`\r\nJogador '${targetPlayer}' não possui a quest '${questName}'.\r\n\n`);
    }
}

async function handleRemove(player, args) {
    if (args.length < 3) {
        player.socket.write(`\r\nUso: quest remove <player> <quest>\r\n\n`);
        return;
    }
    const targetPlayer = args[1].toLowerCase();
    const questName = args.slice(2).join(" ").toLowerCase();

    const result = await removeQuest(targetPlayer, questName);
    if (result) {
        player.socket.write(`\r\nQuest '${questName}' removida de '${targetPlayer}'.\r\n\n`);
    } else {
        player.socket.write(`\r\nJogador '${targetPlayer}' não possui a quest '${questName}'.\r\n\n`);
    }
}

async function handleList(player, args) {
    const targetPlayer = args.length >= 2 ? args[1].toLowerCase() : player.name;

    const quests = await getPlayerQuests(targetPlayer);
    if (quests.length === 0) {
        player.socket.write(`\r\n'${targetPlayer}' não possui quests.\r\n\n`);
        return;
    }

    player.socket.write(`\r\nQuests de '${targetPlayer}':\r\n`);
    for (const q of quests) {
        const statusIcon = q.status === 'completed' ? '[OK]' : q.status === 'failed' ? '[FAIL]' : '[...]';
        player.socket.write(`  ${statusIcon} ${q.questName} (${q.status}) - iniciada: ${q.startedAt}\r\n`);
    }
    player.socket.write(`\n`);
}

async function handleInfo(player, args) {
    if (args.length < 2) {
        player.socket.write(`\r\nUso: quest info <quest>\r\n\n`);
        return;
    }
    const questName = args.slice(1).join(" ").toLowerCase();
    const def = findQuestDefinition(questName);
    if (!def) {
        player.socket.write(`\r\nQuest '${questName}' não encontrada nas definições.\r\n\n`);
        return;
    }

    player.socket.write(`\r\nQuest: ${def.title || def.name}\r\n`);
    player.socket.write(`  Nome interno: ${def.name}\r\n`);
    player.socket.write(`  Descrição: ${def.description}\r\n`);
    if (def.objectives) player.socket.write(`  Objetivos: ${def.objectives}\r\n`);
    if (def.requirements && def.requirements.length > 0) {
        player.socket.write(`  Requisitos: ${def.requirements.join(', ')}\r\n`);
    }
    player.socket.write(`\n`);
}

async function handleDefs(player) {
    const defs = loadQuestDefinitions();
    if (defs.length === 0) {
        player.socket.write(`\r\nNenhuma quest definida em data/quests/quests.json.\r\n\n`);
        return;
    }

    player.socket.write(`\r\nQuests definidas:\r\n`);
    for (const def of defs) {
        player.socket.write(`  - ${def.name}: ${def.title || def.description}\r\n`);
    }
    player.socket.write(`\n`);
}
