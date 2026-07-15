import net from "net";
import * as game from "../game/index.js";
import { handleAuthLine } from "../auth/auth.js";
import { handleCommand } from "../commands/index.js";
import { createPlayer, players } from "../game/playerManager.js";
import { loadPlayerLocation } from "../game/locationManager.js";
import { initWorld } from "../map/index.js";
import { normalizeInput, write, sendLine, sendPrompt } from "./protocol.js";

const PORT = 4000;
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

function processLine(player, input) {
    if (!player.authenticated) return;
    handleCommand(player, input, broadcast);
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
