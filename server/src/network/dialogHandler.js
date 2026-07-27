import * as game from "../game/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { players } from "../game/playerManager.js";
import { GameService } from "../services/gameService.js";

/**
 * Palavras de saudação usadas para detectar início de diálogo.
 */
const GREETING_WORDS = ['oi', 'alo', 'ola', 'olá', 'ei', 'saudações', 'saudacoes', 'hey', 'hi', 'hello', 'greetings'];

/** Aguarda um número de milissegundos. */
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Palavras de despedida que encerram o diálogo.
 */
const GOODBYE_WORDS = ['tchau', 'xau', 'ciao', 'ate', 'até', 'adeus', 'bye', 'goodbye', 'farewell'];

/**
 * Verifica se o texto contém uma palavra de saudação.
 */
function hasGreetingWord(text) {
    const words = text.toLowerCase().split(/\s+/);
    return words.some(w => GREETING_WORDS.includes(w));
}

/**
 * Verifica se o texto contém uma palavra de despedida.
 */
function hasGoodbyeWord(text) {
    const words = text.toLowerCase().split(/\s+/);
    return words.some(w => GOODBYE_WORDS.includes(w));
}

/**
 * Encontra um NPC na mesma sala do jogador, buscando pelo nome
 * em qualquer palavra do texto (exceto palavras de saudação/despedida).
 */
async function findNpcInRoom(player, input) {
    if (!player.location) return null;
    const words = input.toLowerCase().split(/\s+/);
    const skipWords = new Set([...GREETING_WORDS, ...GOODBYE_WORDS]);

    for (const word of words) {
        if (skipWords.has(word)) continue;
        if (word.length < 2) continue;
        const npc = await game.getNpcByName(word);
        if (npc && npc.x === player.location.x && npc.y === player.location.y) {
            return npc;
        }
    }
    return null;
}

/**
 * Envia uma mensagem do NPC para todos os jogadores na mesma localização.
 * Se playerName for fornecido, a mensagem é formatada como "Fulano_NPC a Beltrano: texto".
 */
function broadcastNpcMessage(npcName, message, location, playersMap, playerName) {
    const nearbyPlayers = playersAtLocation(location, playersMap);
    const msg = playerName
        ? `\r\n[${npcName}_NPC a ${playerName}]: ${message}\r\n`
        : `\r\n${npcName}_NPC: ${message}\r\n`;
    for (const p of nearbyPlayers) {
        if (p.socket && !p.socket.destroyed) {
            p.socket.write(msg);
        }
    }
}

/**
 * Envia uma mensagem privada do NPC apenas para o jogador alvo.
 */
function sendPrivateNpcMessage(player, npcName, message) {
    if (player.socket && !player.socket.destroyed) {
        player.socket.write(`\r\n  *${npcName}_NPC ${message}*\r\n`);
    }
}

/**
 * Exibe a mensagem do jogador no chat de todos os jogadores na mesma sala.
 * Se npcName for fornecido, a mensagem é formatada como "jogador a npc: texto".
 * Deve ser chamada antes de broadcastNpcMessage para manter a ordem cronológica.
 */
function broadcastPlayerMessage(player, input, npcName) {
    const nearbyPlayers = playersAtLocation(player.location, player.serverPlayers);
    const msg = npcName
        ? `\r\n[${player.name} a ${npcName}_NPC]: ${input}\r\n`
        : `\r\n${player.name}: ${input}\r\n`;
    for (const p of nearbyPlayers) {
        if (p.socket && !p.socket.destroyed) {
            p.socket.write(msg);
        }
    }
}

/**
 * Avalia condições de um nó de diálogo para o jogador atual.
 * Retorna true se a condição for satisfeita (ou se não houver condição).
 */
async function evaluateCondition(player, node) {
    if (!node.conditionType) return true;

    switch (node.conditionType) {
        case 'has_item': {
            const inventory = player.inventory || [];
            const found = inventory.some(item => {
                const kw = (item.keyword || '').toLowerCase();
                const nm = (item.name || '').toLowerCase();
                return kw === node.conditionValue.toLowerCase() || nm === node.conditionValue.toLowerCase();
            });
            return found;
        }
        case 'has_role': {
            return await game.hasRole(player.name, node.conditionValue);
        }
        case 'quest_flag': {
            // TODO: Integrar com sistema de quests futuramente
            return false;
        }
        default:
            return true;
    }
}

/**
 * Tenta iniciar um diálogo em árvore com um NPC.
 * Detecta: saudação + nome do NPC estando na mesma sala.
 * Usa todos os nós raiz com flag "greeting" como entrada, avaliando condições
 * para escolher o mais específico (condição atendida > sem condição > condição não atendida).
 * O trigger do nó é ignorado para nós greeting — qualquer palavra de GREETING_WORDS o ativa.
 */
async function tryStartDialog(player, input) {
    if (!player.location) return false;

    const npc = await findNpcInRoom(player, input);
    if (!npc) return false;

    if (!hasGreetingWord(input)) return false;

    const tree = await game.getDialogTreeByNpcId(npc.id);
    if (!tree) return false;

    const rootNodes = await game.getDialogRootNodes(tree.id);
    if (rootNodes.length === 0) return false;

    // Filtra apenas nós raiz com flag "greeting"
    const greetingRoots = rootNodes.filter(r => r.hasFlag('greeting'));
    if (greetingRoots.length === 0) return false;

    // Seleciona o nó: condição atendida > sem condição > condição não atendida
    let matchedRoot = null;
    let fallbackRoot = null;
    for (const root of greetingRoots) {
        if (!root.conditionType) {
            fallbackRoot = root;
        } else if (await evaluateCondition(player, root)) {
            matchedRoot = root;
            break;
        }
    }
    if (!matchedRoot) matchedRoot = fallbackRoot;
    if (!matchedRoot) matchedRoot = greetingRoots[0];

    player.startDialog(npc.id, npc.name, matchedRoot.id, tree.id);

    // Exibe a mensagem do jogador antes da resposta do NPC
    broadcastPlayerMessage(player, input, npc.name);

    broadcastNpcMessage(npc.name, matchedRoot.npcResponse, player.location, player.serverPlayers, player.name);

    if (matchedRoot.npcHint) {
        broadcastNpcMessage(npc.name, `[Dicas: ${matchedRoot.npcHint}]`, player.location, player.serverPlayers, player.name);
    }

    // Executa ações configuradas no nó (give_item, teleport, etc.)
    await executeNodeActions(player, npc.name, player.location, matchedRoot);

    if (matchedRoot.hasFlag('goodbye')) {
        player.cancelDialog();
    }

    return true;
}

/**
 * Processa a continuidade de um diálogo ativo.
 * O jogador já está em diálogo com um NPC; tentamos avançar na árvore.
 */
async function continueDialog(player, input) {
    if (!player.isInDialog()) return false;
    const state = player.dialogState;

    const npc = await game.getNpcById(state.npcId);
    if (!npc || npc.x !== player.location.x || npc.y !== player.location.y) {
        player.cancelDialog();
        return false;
    }

    if (hasGoodbyeWord(input)) {
        broadcastPlayerMessage(player, input, state.npcName);
        broadcastNpcMessage(state.npcName, `Até mais, ${player.name}!`, player.location, player.serverPlayers, player.name);
        player.cancelDialog();
        return true;
    }

    const matched = await game.findDialogChildByTrigger(state.nodeId, input);
    if (!matched) {
        broadcastPlayerMessage(player, input, state.npcName);
        const children = await game.getDialogChildNodes(state.nodeId);
        if (children.length > 0) {
            const hints = children.map(c => c.trigger).join(', ');
            broadcastNpcMessage(state.npcName, `Não entendi. Tente: ${hints}`, player.location, player.serverPlayers, player.name);
        } else {
            broadcastNpcMessage(state.npcName, `Não tenho mais nada a dizer.`, player.location, player.serverPlayers, player.name);
        }
        return true;
    }

    const conditionMet = await evaluateCondition(player, matched);
    if (!conditionMet) {
        broadcastPlayerMessage(player, input, state.npcName);
        broadcastNpcMessage(state.npcName, `(Você ainda não atende aos requisitos para isso.)`, player.location, player.serverPlayers, player.name);
        return true;
    }

    player.startDialog(state.npcId, state.npcName, matched.id, state.treeId);

    // Exibe a mensagem do jogador antes da resposta do NPC
    broadcastPlayerMessage(player, input, state.npcName);

    broadcastNpcMessage(state.npcName, matched.npcResponse, player.location, player.serverPlayers, player.name);

    if (matched.npcHint) {
        broadcastNpcMessage(state.npcName, `[Dicas: ${matched.npcHint}]`, player.location, player.serverPlayers, player.name);
    }

    // Executa ações configuradas no nó (give_item, teleport, etc.)
    await executeNodeActions(player, state.npcName, player.location, matched);

    if (matched.hasFlag('goodbye')) {
        player.cancelDialog();
        return true;
    }

    const nextChildren = await game.getDialogChildNodes(matched.id);
    if (nextChildren.length === 0) {
        player.cancelDialog();
    }

    return true;
}

/**
 * Executa as ações configuradas em um nó de diálogo após ele ser ativado.
 * Tipos de ação suportados:
 *   give_item   → adiciona item ao inventário do jogador
 *   remove_item → remove item do inventário do jogador
 *   teleport    → teletransporta o jogador para (x,y)
 *   set_flag    → (reservado para sistema de quests)
 *   broadcast   → envia mensagem para todos na mesma sala
 *   command     → executa um comando administrativo (ex: "create espada 0,0")
 *   delay       → aguarda N milissegundos antes da próxima ação
 */
async function executeNodeActions(player, npcName, location, node) {
    const actions = node.getActions();
    if (actions.length === 0) return;

    for (const action of actions) {
        try {
            // Delay opcional antes de executar a ação
            if (action.delay) {
                const ms = parseInt(action.delay, 10);
                if (!isNaN(ms) && ms > 0) {
                    await delay(ms);
                }
            }

            switch (action.type) {
                case 'give_item': {
                    const item = {
                        keyword: action.keyword,
                        name: action.name || action.keyword,
                        description: action.description || '',
                        pickupPermission: action.pickupPermission || 'all',
                        dropPermission: action.dropPermission || 'all'
                    };
                    player.addToInventory(item);
                    await game.savePlayerLocation(player.name, {
                        x: player.location.x,
                        y: player.location.y,
                        inventory: player.inventory
                    });
                    sendPrivateNpcMessage(player, npcName, `lhe entrega '${item.name}'`);
                    break;
                }
                case 'remove_item': {
                    const removed = player.removeFromInventory(action.keyword);
                    if (removed) {
                        await game.savePlayerLocation(player.name, {
                            x: player.location.x,
                            y: player.location.y,
                            inventory: player.inventory
                        });
                        sendPrivateNpcMessage(player, npcName, `lhe toma '${action.name}'`);
                    }
                    break;
                }
                case 'teleport': {
                    const destX = parseInt(action.x, 10);
                    const destY = parseInt(action.y, 10);
                    if (!isNaN(destX) && !isNaN(destY)) {
                        await GameService.transferPlayer(player, { x: destX, y: destY });
                    }
                    break;
                }
                case 'broadcast': {
                    broadcastNpcMessage(npcName, action.message, location, player.serverPlayers, player.name);
                    break;
                }
                case 'delay': {
                    const ms = parseInt(action.ms, 10);
                    if (!isNaN(ms) && ms > 0) {
                        await delay(ms);
                    }
                    break;
                }
                case 'command': {
                    // Executa um comando como se fosse digitado no console do servidor
                    // ou via sistema de comandos internos — por ora apenas log
                    console.log(`[Dialog Action] Comando: ${action.cmd}`);
                    break;
                }
            }
        } catch (err) {
            console.error(`[Dialog Action] Erro ao executar ação ${action.type}: ${err.message}`);
        }
    }
}

/**
 * Tenta processar diálogo com NPC usando o sistema de árvore.
 * Retorna true se o input foi tratado como diálogo.
 */
export async function handleNpcDialog(player, input) {
    if (!player.location) return false;

    if (player.isInDialog()) {
        return await continueDialog(player, input);
    }

    return await tryStartDialog(player, input);
}
