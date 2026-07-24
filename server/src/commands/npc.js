import {
    createNpc, deleteNpc, getAllNpcs, getNpcByName, getNpcById,
    createDialogTree, getDialogTreeByNpcId, deleteDialogTreeByNpcId,
    addDialogNode, getDialogTreeNodes, getDialogRootNodes,
    getDialogChildNodes, getDialogNodeById,
    updateDialogNodeTrigger, updateDialogNodeResponse,
    updateDialogNodeHint, updateDialogNodeFlags,
    updateDialogNodeCondition, updateDialogNodeActions,
    deleteDialogNode,
    findDialogNodeByTrigger, getDialogTreeAsText
} from "../game/index.js";
import { parseCommandArgs } from "./utils.js";

function parseCoordinate(value) {
    if (!value) return null;
    const match = value.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

/**
 * Resolve um NPC por ID ou nome.
 */
async function resolveNpc(identifier) {
    const numericId = Number(identifier);
    if (!Number.isNaN(numericId) && String(numericId) === identifier) {
        return await getNpcById(numericId);
    }
    return await getNpcByName(identifier);
}

// ========================= TREE SUBCOMMAND =========================

async function handleTree(player, input, args) {
    // /npc tree <npcId|nome> <action> [params...]
    if (args.length < 3) {
        printTreeUsage(player);
        return;
    }

    const npcIdentifier = args[2];
    const npc = await resolveNpc(npcIdentifier);
    if (!npc) {
        player.socket.write(`\r\nNPC '${npcIdentifier}' não encontrado.\r\n\n`);
        return;
    }

    if (args.length < 4) {
        printTreeUsage(player);
        return;
    }

    const treeAction = args[3].toLowerCase();

    try {
        switch (treeAction) {
            case 'create':
                await treeCreate(player, npc, input, args);
                break;
            case 'delete':
                await treeDelete(player, npc);
                break;
            case 'root':
                await treeAddRoot(player, npc, input, args);
                break;
            case 'add':
                await treeAddChild(player, npc, input, args);
                break;
            case 'edit':
                await treeEdit(player, npc, input, args);
                break;
            case 'hint':
                await treeHint(player, npc, input, args);
                break;
            case 'flag':
                await treeFlag(player, npc, input, args);
                break;
            case 'unflag':
                await treeUnflag(player, npc, input, args);
                break;
            case 'cond':
                await treeCond(player, npc, input, args);
                break;
            case 'nocond':
                await treeNoCond(player, npc, input, args);
                break;
            case 'del':
                await treeDelNode(player, npc, input, args);
                break;
            case 'show':
                await treeShow(player, npc);
                break;
            case 'action':
                await treeAction(player, npc, input, args);
                break;
            default:
                player.socket.write(`\r\nAção de árvore inválida: '${treeAction}'\r\n`);
                printTreeUsage(player);
        }
    } catch (err) {
        player.socket.write(`\r\nErro no comando tree: ${err.message}\r\n\n`);
    }
}

function printTreeUsage(player) {
    player.socket.write(`\r\nUso - /npc tree <npc>:\r\n`);
    player.socket.write(`  create <nomeArvore>               Cria árvore de diálogo para o NPC\r\n`);
    player.socket.write(`  delete                             Deleta a árvore inteira\r\n`);
    player.socket.write(`  root <trigger> <resposta> [hint]   Adiciona nó raiz (entrada do diálogo)\r\n`);
    player.socket.write(`  add <parentId> <trigger> <resp> [hint]  Adiciona nó filho\r\n`);
    player.socket.write(`  edit <nodeId> <trigger|response> <valor>  Edita nó\r\n`);
    player.socket.write(`  hint <nodeId> [texto]              Define hint (dicas p/ jogador)\r\n`);
    player.socket.write(`  flag <nodeId> <flag>               Adiciona flag (greeting, goodbye, quest_start)\r\n`);
    player.socket.write(`  unflag <nodeId> <flag>             Remove flag\r\n`);
    player.socket.write(`  cond <nodeId> <tipo> <valor>       Define condição (has_item, has_role, quest_flag)\r\n`);
    player.socket.write(`  nocond <nodeId>                    Remove condição\r\n`);
    player.socket.write(`  action <nodeId> clear              Remove todas as ações do nó\r\n`);
    player.socket.write(`  action <nodeId> give_item <kw> [nome] [desc]  Dá item ao jogador\r\n`);
    player.socket.write(`  action <nodeId> remove_item <kw>    Remove item do jogador\r\n`);
    player.socket.write(`  action <nodeId> teleport <x> <y>    Teleporta o jogador\r\n`);
    player.socket.write(`  action <nodeId> broadcast <msg>     Envia mensagem pública\r\n`);
    player.socket.write(`  del <nodeId>                       Deleta nó e seus filhos\r\n`);
    player.socket.write(`  show                               Exibe a árvore completa\r\n\n`);
}

// Extrai o resto da string após um token específico nos argumentos
function extractAfter(input, token, skipCount = 1) {
    let idx = -1;
    for (let i = 0; i < skipCount; i++) {
        idx = input.indexOf(token, idx + 1);
        if (idx === -1) return '';
    }
    return input.slice(idx + token.length).trim();
}

// ---- Tree action handlers ----

async function treeCreate(player, npc, input, args) {
    if (args.length < 5) {
        player.socket.write(`\r\nUso: /npc tree <npc> create <nomeDaArvore>\r\n\n`);
        return;
    }
    const name = args.slice(4).join(' ');

    const existing = await getDialogTreeByNpcId(npc.id);
    if (existing) {
        player.socket.write(`\r\nNPC '${npc.name}' já possui uma árvore de diálogo (ID: ${existing.id}). Delete-a primeiro.\r\n\n`);
        return;
    }
    const tree = await createDialogTree(npc.id, name);
    player.socket.write(`\r\nÁrvore de diálogo '${tree.name}' criada para NPC '${npc.name}' (tree ID: ${tree.id}).\r\n\n`);
}

async function treeDelete(player, npc) {
    const tree = await getDialogTreeByNpcId(npc.id);
    if (!tree) {
        player.socket.write(`\r\nNPC '${npc.name}' não possui árvore de diálogo.\r\n\n`);
        return;
    }
    await deleteDialogTreeByNpcId(npc.id);
    player.socket.write(`\r\nÁrvore de diálogo do NPC '${npc.name}' deletada.\r\n\n`);
}

async function treeAddRoot(player, npc, input, args) {
    // /npc tree <npc> root <trigger> <resposta> [hint]
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 6) {
        player.socket.write(`\r\nUso: /npc tree <npc> root <trigger> <resposta> [hint]\r\n`);
        player.socket.write(`  O trigger deve ser uma palavra de saudação (oi, ola, hi, hello, etc.)\r\n\n`);
        return;
    }

    const trigger = args[4].toLowerCase();
    // Resposta = args[5...] (pode conter espaços)
    const responseRaw = args.slice(5).join(' ');

    let response = responseRaw;
    let hint = null;

    // Extrai hint no formato: "texto [hint]" ou "texto dica: hint"
    const bracketHint = responseRaw.match(/^(.+?)\s*\[(.+?)\]\s*$/);
    const dicaHint = responseRaw.match(/^(.+?)\s+(?:dica|hint|dicas|hints):\s*(.+)$/i);

    if (bracketHint) {
        response = bracketHint[1].trim();
        hint = bracketHint[2].trim();
    } else if (dicaHint) {
        response = dicaHint[1].trim();
        hint = dicaHint[2].trim();
    }

    const node = await addDialogNode(tree.id, null, trigger, response, { hint, flags: 'greeting' });
    player.socket.write(`\r\nNó raiz adicionado: [${node.id}] trigger="${node.trigger}" → "${node.npcResponse}"`);
    if (node.npcHint) player.socket.write(` [hint: ${node.npcHint}]`);
    player.socket.write(`\r\n\n`);
}

async function treeAddChild(player, npc, input, args) {
    // /npc tree <npc> add <parentId> <trigger> <resposta> [hint]
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 7) {
        player.socket.write(`\r\nUso: /npc tree <npc> add <parentId> <trigger> <resposta> [hint]\r\n\n`);
        return;
    }

    const parentId = Number(args[4]);
    if (Number.isNaN(parentId)) {
        player.socket.write(`\r\nParent ID inválido: '${args[4]}'\r\n\n`);
        return;
    }

    const parentNode = await getDialogNodeById(parentId);
    if (!parentNode || parentNode.treeId !== tree.id) {
        player.socket.write(`\r\nNó pai ID ${parentId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    const trigger = args[5].toLowerCase();
    // Resposta = args[6...] (pode conter espaços)
    const responseRaw = args.slice(6).join(' ');

    if (!responseRaw) {
        player.socket.write(`\r\nForneça a resposta do NPC.\r\n\n`);
        return;
    }

    let response = responseRaw;
    let hint = null;

    const bracketHint = responseRaw.match(/^(.+?)\s*\[(.+?)\]\s*$/);
    const dicaHint = responseRaw.match(/^(.+?)\s+(?:dica|hint|dicas|hints):\s*(.+)$/i);

    if (bracketHint) {
        response = bracketHint[1].trim();
        hint = bracketHint[2].trim();
    } else if (dicaHint) {
        response = dicaHint[1].trim();
        hint = dicaHint[2].trim();
    }

    const node = await addDialogNode(tree.id, parentId, trigger, response, { hint });
    player.socket.write(`\r\nNó filho adicionado: [${node.id}] trigger="${node.trigger}" (pai: ${parentId}) → "${node.npcResponse}"`);
    if (node.npcHint) player.socket.write(` [hint: ${node.npcHint}]`);
    player.socket.write(`\r\n\n`);
}

async function treeEdit(player, npc, input, args) {
    // /npc tree <npc> edit <nodeId> <trigger|response> <novoValor>
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 7) {
        player.socket.write(`\r\nUso: /npc tree <npc> edit <nodeId> <trigger|response> <novoValor>\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const field = args[5].toLowerCase();
    if (field !== 'trigger' && field !== 'response') {
        player.socket.write(`\r\nCampo inválido: '${field}'. Use 'trigger' ou 'response'.\r\n\n`);
        return;
    }

    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    // Extrai o valor após o field name
    const afterField = extractAfter(input, field, 1);
    if (!afterField) {
        player.socket.write(`\r\nForneça o novo valor.\r\n\n`);
        return;
    }

    let updated;
    if (field === 'trigger') {
        updated = await updateDialogNodeTrigger(nodeId, afterField);
    } else {
        updated = await updateDialogNodeResponse(nodeId, afterField);
    }

    player.socket.write(`\r\nNó [${updated.id}] atualizado: ${field}="${field === 'trigger' ? updated.trigger : updated.npcResponse}"\r\n\n`);
}

async function treeHint(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 5) {
        player.socket.write(`\r\nUso: /npc tree <npc> hint <nodeId> [texto]\r\n`);
        player.socket.write(`  Use sem texto para remover o hint.\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    // Pega o texto após o nodeId
    const afterNodeId = extractAfter(input, String(nodeId), 1);
    const hint = afterNodeId || null;

    const updated = await updateDialogNodeHint(nodeId, hint);
    if (hint) {
        player.socket.write(`\r\nHint do nó [${nodeId}] definido: "${hint}"\r\n\n`);
    } else {
        player.socket.write(`\r\nHint do nó [${nodeId}] removido.\r\n\n`);
    }
}

async function treeFlag(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 6) {
        player.socket.write(`\r\nUso: /npc tree <npc> flag <nodeId> <flag>\r\n`);
        player.socket.write(`  Flags: greeting, goodbye, quest_start, quest_complete\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const flag = args[5].toLowerCase();
    const validFlags = ['greeting', 'goodbye', 'quest_start', 'quest_complete'];
    if (!validFlags.includes(flag)) {
        player.socket.write(`\r\nFlag inválida. Use: ${validFlags.join(', ')}\r\n\n`);
        return;
    }

    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    const currentFlags = node.flags ? node.flags.split(',').map(f => f.trim()).filter(Boolean) : [];
    if (!currentFlags.includes(flag)) {
        currentFlags.push(flag);
    }
    const updated = await updateDialogNodeFlags(nodeId, currentFlags.join(','));
    player.socket.write(`\r\nFlags do nó [${nodeId}]: ${updated.flags || '(nenhuma)'}\r\n\n`);
}

async function treeUnflag(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 6) {
        player.socket.write(`\r\nUso: /npc tree <npc> unflag <nodeId> <flag>\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const flag = args[5].toLowerCase();

    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    const currentFlags = node.flags ? node.flags.split(',').map(f => f.trim()).filter(Boolean) : [];
    const filtered = currentFlags.filter(f => f !== flag);
    const updated = await updateDialogNodeFlags(nodeId, filtered.join(','));
    player.socket.write(`\r\nFlags do nó [${nodeId}]: ${updated.flags || '(nenhuma)'}\r\n\n`);
}

async function treeCond(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 7) {
        player.socket.write(`\r\nUso: /npc tree <npc> cond <nodeId> <tipo> <valor>\r\n`);
        player.socket.write(`  Tipos: has_item, has_role, quest_flag\r\n`);
        player.socket.write(`  Ex: /npc tree guarda cond 5 has_item espada_perdida\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const condType = args[5].toLowerCase();
    const condValue = args[6];

    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    const updated = await updateDialogNodeCondition(nodeId, condType, condValue);
    player.socket.write(`\r\nCondição do nó [${nodeId}]: ${updated.conditionType}=${updated.conditionValue}\r\n\n`);
}

async function treeNoCond(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 5) {
        player.socket.write(`\r\nUso: /npc tree <npc> nocond <nodeId>\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    await updateDialogNodeCondition(nodeId, null, null);
    player.socket.write(`\r\nCondição do nó [${nodeId}] removida.\r\n\n`);
}

async function treeDelNode(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 5) {
        player.socket.write(`\r\nUso: /npc tree <npc> del <nodeId>\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    await deleteDialogNode(nodeId);
    player.socket.write(`\r\nNó [${nodeId}] e seus filhos foram deletados.\r\n\n`);
}

async function treeShow(player, npc) {
    const tree = await getDialogTreeByNpcId(npc.id);
    if (!tree) {
        player.socket.write(`\r\nNPC '${npc.name}' não possui árvore de diálogo.\r\n\n`);
        return;
    }

    const text = await getDialogTreeAsText(tree.id);
    player.socket.write(`\r\nÁrvore de diálogo: ${tree.name} (NPC: ${npc.name}, tree ID: ${tree.id})\r\n`);
    player.socket.write(`${text}\r\n\n`);
}

async function requireTree(player, npc) {
    const tree = await getDialogTreeByNpcId(npc.id);
    if (!tree) {
        player.socket.write(`\r\nNPC '${npc.name}' não possui árvore de diálogo. Crie uma com: /npc tree ${npc.name} create <nome>\r\n\n`);
        return null;
    }
    return tree;
}

/**
 * /npc tree <npc> action <nodeId> <subcomando> [params...]
 *
 * Subcomandos:
 *   clear                    → limpa todas as ações do nó
 *   give_item <kw> [nome] [descrição]  → adiciona ação de dar item
 *   remove_item <kw>         → adiciona ação de remover item
 *   teleport <x> <y>         → adiciona ação de teleportar
 *   broadcast <mensagem>     → adiciona ação de broadcast
 */
async function treeAction(player, npc, input, args) {
    const tree = await requireTree(player, npc);
    if (!tree) return;

    if (args.length < 5) {
        player.socket.write(`\r\nUso: /npc tree <npc> action <nodeId> <subcomando> [params]\r\n`);
        player.socket.write(`  Subcomandos: clear, give_item, remove_item, teleport, broadcast\r\n\n`);
        return;
    }

    const nodeId = Number(args[4]);
    const node = await getDialogNodeById(nodeId);
    if (!node || node.treeId !== tree.id) {
        player.socket.write(`\r\nNó ID ${nodeId} não encontrado nesta árvore.\r\n\n`);
        return;
    }

    if (args.length < 6) {
        player.socket.write(`\r\nInforme o subcomando: clear, give_item, remove_item, teleport, broadcast\r\n\n`);
        return;
    }

    const subCmd = args[5].toLowerCase();
    let currentActions = node.getActions();

    try {
        if (subCmd === 'clear') {
            await updateDialogNodeActions(nodeId, '[]');
            player.socket.write(`\r\nAções do nó [${nodeId}] removidas.\r\n\n`);
            return;
        }

        // Converte "true"/"false" strings para boolean ao dar parse nos actions do DB
        switch (subCmd) {
            case 'give_item': {
                if (args.length < 7) {
                    player.socket.write(`\r\nUso: action ${nodeId} give_item <keyword> [nome] [descrição]\r\n\n`);
                    return;
                }
                const keyword = args[6];
                const name = args[7] || keyword;
                const description = args.slice(8).join(' ') || '';
                currentActions.push({ type: 'give_item', keyword, name, description });
                break;
            }
            case 'remove_item': {
                if (args.length < 7) {
                    player.socket.write(`\r\nUso: action ${nodeId} remove_item <keyword>\r\n\n`);
                    return;
                }
                currentActions.push({ type: 'remove_item', keyword: args[6] });
                break;
            }
            case 'teleport': {
                if (args.length < 8) {
                    player.socket.write(`\r\nUso: action ${nodeId} teleport <x> <y>\r\n\n`);
                    return;
                }
                const x = parseInt(args[6], 10);
                const y = parseInt(args[7], 10);
                if (isNaN(x) || isNaN(y)) {
                    player.socket.write(`\r\nCoordenadas inválidas.\r\n\n`);
                    return;
                }
                currentActions.push({ type: 'teleport', x, y });
                break;
            }
            case 'broadcast': {
                const msg = args.slice(6).join(' ');
                if (!msg) {
                    player.socket.write(`\r\nUso: action ${nodeId} broadcast <mensagem>\r\n\n`);
                    return;
                }
                currentActions.push({ type: 'broadcast', message: msg });
                break;
            }
            default:
                player.socket.write(`\r\nSubcomando inválido: '${subCmd}'. Use: clear, give_item, remove_item, teleport, broadcast\r\n\n`);
                return;
        }

        const json = JSON.stringify(currentActions);
        await updateDialogNodeActions(nodeId, json);
        player.socket.write(`\r\nAções do nó [${nodeId}] atualizadas. Total: ${currentActions.length} ação(ns).\r\n`);
        for (const a of currentActions) {
            player.socket.write(`  - ${a.type}: ${JSON.stringify(a)}\r\n`);
        }
        player.socket.write(`\n`);
    } catch (err) {
        player.socket.write(`\r\nErro: ${err.message}\r\n\n`);
    }
}

export const command = {
    name: "npc",
    aliases: ["/npc"],
    roles: ["admin"],
    async execute(player, input) {
        const args = input.trim().split(/\s+/);
        if (args.length < 2) {
            player.socket.write(`\r\nUso:\r\n`);
            player.socket.write(`  /npc create <nome> [x,y]\r\n`);
            player.socket.write(`  /npc delete <id|nome>\r\n`);
            player.socket.write(`  /npc list\r\n`);
            player.socket.write(`  /npc tree <id|nome> ...     Gerencia árvore de diálogo\r\n\n`);
            return;
        }

        const action = args[1].toLowerCase();

        // Subcomando tree
        if (action === 'tree') {
            await handleTree(player, input, args);
            return;
        }

        try {
            if (action === "create") {
                // /npc create <nome> [x,y]
                const tokens = parseCommandArgs(input.slice(input.indexOf(args[1]) + args[1].length).trim());
                if (tokens.length < 1) {
                    player.socket.write(`\r\nUso: /npc create <nome> [x,y]\r\n\n`);
                    return;
                }

                const name = tokens[0];
                const coordStr = tokens[1];

                let x, y;
                if (coordStr) {
                    const coord = parseCoordinate(coordStr);
                    if (!coord) {
                        player.socket.write(`\r\nCoordenada inválida: '${coordStr}'. Use o formato: x,y\r\n\n`);
                        return;
                    }
                    x = coord.x;
                    y = coord.y;
                } else {
                    if (!player.location) {
                        player.socket.write(`\r\nSua posição ainda não foi carregada.\r\n\n`);
                        return;
                    }
                    x = player.location.x;
                    y = player.location.y;
                }

                const npc = await createNpc({ name, x, y });
                player.socket.write(`\r\nNPC '${npc.name}' criado no local (${npc.x}, ${npc.y}) com ID ${npc.id}.\r\n\n`);

            } else if (action === "delete") {
                if (args.length < 3) {
                    player.socket.write(`\r\nUso: /npc delete <id|nome>\r\n\n`);
                    return;
                }

                const npc = await resolveNpc(args[2]);
                if (!npc) {
                    player.socket.write(`\r\nNPC '${args[2]}' não encontrado.\r\n\n`);
                    return;
                }

                const deleted = await deleteNpc(npc.id);
                if (!deleted) {
                    player.socket.write(`\r\nErro ao deletar NPC.\r\n\n`);
                    return;
                }

                player.socket.write(`\r\nNPC '${deleted.name}' (ID: ${deleted.id}) deletado.\r\n\n`);

            } else if (action === "list") {
                const npcs = await getAllNpcs();
                if (npcs.length === 0) {
                    player.socket.write(`\r\nNenhum NPC cadastrado.\r\n\n`);
                    return;
                }

                const rows = npcs.map(npc => {
                    let line = `- [ID: ${npc.id}] ${npc.name} | Local: (${npc.x}, ${npc.y})`;
                    return line;
                }).join("\r\n");

                player.socket.write(`\r\nNPCs cadastrados:\r\n${rows}\r\n\n`);

            } else {
                player.socket.write(`\r\nAção inválida: '${action}'. Use 'create', 'delete', 'list' ou 'tree'.\r\n\n`);
            }
        } catch (err) {
            player.socket.write(`\r\nErro no comando NPC: ${err.message}\r\n\n`);
        }
    }
};
