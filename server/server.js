import net from "net";
import * as auth from "./auth.js";

const PORT = 4000;

const players = new Map();

let nextId = 1;


function broadcast(message) {
    for (const player of players.values()) {
        player.socket.write(message);
    }
}

function sendLine(socket, text) {
    socket.write(text + "\n");
}

function sendPrompt(socket) {
    socket.write("> ");
}

async function sendWelcome(player) {
    const motd = await auth.getGameParam("motd") || "";
    player.socket.write(`\n${motd}\n\n`);
}


function handleCommand(player, input) {
    if (input.startsWith("/nome ")) {
        const oldName = player.name;
        player.name = input
            .substring(6)
            .trim();

        broadcast(`${oldName} agora se chama ${player.name}\n`);

        return;
    }

    if (input === "/quem") {
        const names = [...players.values()]
            .filter(p => p.authenticated)
            .map(p => p.name)
            .join(", ");

        player.socket.write(`\nConectados agora: \n-${names}\n`);

        return;
    }

    if (input === "/sair") {
        player.socket.end();
        return;
    }

    // CHAT NORMAL
    broadcast(
        `${player.name}: ${input}\n`
    );

}


await auth.init();

const server = net.createServer(socket => {

    const id = nextId++;

    const player = {
        id,
        socket,
        name: `Jogador${id}`,
        authenticated: false
    };

    players.set(id, player);

    socket.setEncoding("utf8");

    sendLine(socket, `[Guardião]: Identifique-se, programa!`);
    sendPrompt(socket);
    // state for stepwise login/registration
    player.stage = 'awaiting_username';
    player.pendingUsername = null;

    socket.on("data", async data => {
        const input = data.trim();
        if (!input) return;

        // If not authenticated, use stepwise username -> password flow
        if (!player.authenticated) {
            try {
                // Awaiting username
                if (player.stage === 'awaiting_username') {
                    const username = input;
                    player.pendingUsername = username;
                    const exists = await auth.userExists(username);
                    if (exists) {
                        player.stage = 'awaiting_password_login';
                        sendLine(socket, `[Guardião]: Ah, um usuário...`);
                        sendLine(socket, `[Guardião]: Qual sua senha então, usuário?`);
                        sendPrompt(socket);
                    } else {
                        player.stage = 'awaiting_username_confirmation';
                        sendLine(socket, `[Guardião]: Seu identificador é '${username}'? (s/n)`);
                        sendPrompt(socket);
                    }
                    return;
                }

                if (player.stage === 'awaiting_username_confirmation') {
                    const answer = input.toLowerCase();
                    if (answer === 's' || answer === 'sim') {
                        player.stage = 'awaiting_password_register';
                        sendLine(socket, `[Guardião]: Programas errantes sem disco de identificação estão sujeitos ao desafio da Grade!`);
                        sendLine(socket, `[Guardião]: Deverá provar que pode desempenhar suas funções básicas, programa.`);
                        sendLine(socket, `[Guardião]: Caso se classifique, será reintegrado ao sistema da Grade e receberá uma nova função. Do contrário, ou caso se recuse a obedecer, será submetido a destruição imediata.`);
                        sendLine(socket, `Informe uma senha.`);
                        sendPrompt(socket);
                    } else {
                        player.stage = 'awaiting_username';
                        player.pendingUsername = null;
                        sendLine(socket, `[Guardião]: Identifique-se, programa!`);
                        sendPrompt(socket);
                    }
                    return;
                }

                // Awaiting password for login
                if (player.stage === 'awaiting_password_login') {
                    const password = input;
                    const ok = await auth.authenticate(player.pendingUsername, password);
                    if (!ok) {
                        sendLine(socket, 'Acesso negado.');
                        sendLine(socket, `[Guardião]: Identifique-se, programa!`);
                        sendPrompt(socket);
                        player.stage = 'awaiting_username';
                        player.pendingUsername = null;
                        return;
                    }

                    player.authenticated = true;
                    player.name = player.pendingUsername;

                    await sendWelcome(player);
                    broadcast(`[Sistema]: ${player.name} entrou na Grade.\n`);
                    return;
                }

                // Awaiting password for registration
                if (player.stage === 'awaiting_password_register') {
                    const password = input;
                    try {
                        await auth.createUser(player.pendingUsername, password);
                        player.authenticated = true;
                        player.name = player.pendingUsername;

                        await sendWelcome(player);
                        broadcast(`${player.name} entrou na Grade.\n`);
                    } catch (err) {
                        sendLine(socket, `Erro ao registrar: ${err.message}`);
                        sendLine(socket, 'Digite seu nome de usuário:');
                        sendPrompt(socket);
                        player.stage = 'awaiting_username';
                        player.pendingUsername = null;
                    }
                    return;
                }
            } catch (err) {
                socket.write(`Erro: ${err.message}\n`);
            }

            return;
        }

        // Authenticated: handle normal commands
        handleCommand(player, input);

    });

    socket.on("close", () => {
        players.delete(id);
        if (player.authenticated) {
            broadcast(`${player.name} saiu da Grade.\n`);
        }
    });

    socket.on("error", () => {
        players.delete(id);
    });

});

server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Porta ${PORT} em uso. Pare o outro processo ou altere a porta.`);
        process.exit(1);
    } else {
        console.error(err);
    }
});

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});