import * as game from "../game/index.js";
import { handleCommand } from "../commands/index.js";
import { handleNpcDialog } from "./dialogHandler.js";
import { players } from "../game/playerManager.js";
import { write } from "./protocol.js";

/**
 * Envia uma mensagem para todos os jogadores autenticados.
 */
export function broadcast(message) {
    for (const player of players.values()) {
        if (player.authenticated) {
            write(player.socket, message);
        }
    }
}

/**
 * Desconecta sessão duplicada de um usuário que já está conectado.
 */
export function disconnectExistingUser(username, currentId) {
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

/**
 * Envia a mensagem de boas-vindas (MOTD) ao jogador.
 */
export async function sendWelcome(player) {
    const motd = await game.getGameParam("motd") || "";
    write(player.socket, `\r\n${motd}\r\n`);
}

/**
 * Processa uma linha de entrada do jogador autenticado.
 * Roteia entre comandos (/), diálogo com NPC e chat geral.
 */
export async function processLine(player, input) {
    if (!player.authenticated) return;

    // Se começar com '/', é comando → cancela qualquer diálogo ativo
    if (input.trim().startsWith("/")) {
        if (player.isInDialog()) {
            player.cancelDialog();
        }
        await handleCommand(player, input, broadcast);
        return;
    }

    // Tenta processar como diálogo com NPC (árvore de diálogos)
    const npcHandled = await handleNpcDialog(player, input);
    if (npcHandled) return;

    // Caso contrário, envia como mensagem no chat (broadcast)
    await handleCommand(player, input, broadcast);
}
