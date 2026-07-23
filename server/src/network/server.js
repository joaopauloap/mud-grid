import net from "net";
import * as game from "../game/index.js";
import { handleAuthLine } from "../auth/auth.js";
import { handleCommand } from "../commands/index.js";
import { createPlayer, players } from "../game/playerManager.js";
import { loadPlayerLocation, playersAtLocation } from "../game/locationManager.js";
import { initWorld } from "../map/index.js";
import { normalizeInput, write, sendLine, sendPrompt } from "./protocol.js";

const PORT = 999;
let nextId = 1;

function broadcast(message) {
    for (const player of players.values()) {
        if (player.authenticated) {
            write(player.socket, message);
        }
    }
}

function disconnectExistingUser(username, currentId) {
    for (const existing of players.values()) {
        if (existing.id !== currentId && existing.authenticated && existing.name === username) {
            write(existing.socket, `\n[Sistema]: Sua sessão foi encerrada por novo login.\n`);
            const leftName = existing.name;
            existing.authenticated = false;
            broadcast(`[Sistema]: ${leftName} saiu da Grade.\n`);
            existing.socket.end();
            return;
        }
    }
}

async function sendWelcome(player) {
    const motd = await game.getGameParam("motd") || "";
    write(player.socket, `\r\n${motd}\r\n`);
}

/**
 * Tenta processar diálogo com NPC quando o jogador envia uma mensagem
 * que não é um comando. Ex: "oi adam" -> busca NPC "adam" na mesma sala.
 */
async function handleNpcDialog(player, input) {
    if (!player.location) return false;

    const normalized = input.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    // Procura por padrões como: saudação + nome_do_npc, ou só o nome_do_npc
    for (let i = 0; i < words.length; i++) {
        const possibleNpcName = words[i];

        // Verifica se a palavra atual parece ser o nome de um NPC
        if (possibleNpcName.length < 2) continue;

        const npc = await game.getNpcByName(possibleNpcName);
        if (!npc) continue;

        // Verifica se o NPC está na mesma localização do jogador
        if (npc.x !== player.location.x || npc.y !== player.location.y) continue;

        // Procura resposta com base no texto completo que o jogador disse
        const response = await game.findNpcResponse(npc.id, input);

        // Broadcast para todos os jogadores no mesmo local
        const nearbyPlayers = playersAtLocation(player.location, player.serverPlayers);

        if (response) {
            const msg = `\n[NPC] ${npc.name}: ${response}\r\n\n`;
            for (const p of nearbyPlayers) {
                if (p.socket) p.socket.write(msg);
            }
        } else {
            const dialogs = await game.getAllNpcDialogs(npc.id);
            let msg;
            if (dialogs.length === 0) {
                msg = `\n[NPC] ${npc.name} não parece querer conversar agora.\r\n\n`;
            } else {
                msg = `\n[NPC] ${npc.name} não entendeu o que você disse.\r\n\n`;
            }
            for (const p of nearbyPlayers) {
                if (p.socket) p.socket.write(msg);
            }
        }
        return true;
    }

    return false;
}

async function processLine(player, input) {
    if (!player.authenticated) return;

    // Se começar com '/', é comando
    if (input.trim().startsWith("/")) {
        await handleCommand(player, input, broadcast);
        return;
    }

    // Tenta processar como diálogo com NPC
    const npcHandled = await handleNpcDialog(player, input);
    if (npcHandled) return;

    // Caso contrário, envia como mensagem no chat (broadcast)
    // (mas o handleCommand já faz isso para mensagens sem '/')
    // Mantendo compatibilidade: chama handleCommand que faz o broadcast de mensagens normais
    await handleCommand(player, input, broadcast);
}

export async function startServer() {
    await game.init();
    await initWorld();

    const server = net.createServer(socket => {
        const id = nextId++;
        const player = createPlayer(socket, id);
        players.set(id, player);

        sendLine(socket, `[Guardião]: Identifique-se, programa!`);
        sendPrompt(socket);

        socket.on("data", async data => {
            const text = normalizeInput(data);
            if (!text) return;

            player.inputBuffer += text;

            let newlineIndex;
            while ((newlineIndex = player.inputBuffer.indexOf("\n")) !== -1) {
                const rawLine = player.inputBuffer.slice(0, newlineIndex);
                player.inputBuffer = player.inputBuffer.slice(newlineIndex + 1);

                const input = rawLine.trim();
                if (!input) continue;

                if (!player.authenticated) {
                    try {
                        await handleAuthLine(player, input, {
                            sendLine,
                            sendPrompt,
                            disconnectExistingUser,
                            sendWelcome: async pl => await sendWelcome(pl),
                            broadcast,
                            loadPlayerLocation
                        });
                        continue;
                    } catch (err) {
                        write(socket, `Erro: ${err.message}\n`);
                        continue;
                    }
                }

                await processLine(player, input);
            }
        });

        socket.on("close", () => {
            players.delete(id);
            if (player.authenticated) {
                broadcast(`[Sistema]: ${player.name} saiu da Grade.\n`);
            }
        });

        socket.on("error", () => {
            players.delete(id);
        });
    });

    server.on('error', err => {
        if (err && err.code === 'EADDRINUSE') {
            console.error(`Porta ${PORT} em uso. Pare o outro processo ou altere a porta.`);
            process.exit(1);
        }

        console.error(err);
    });

    server.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}
