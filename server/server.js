import net from "net";

const PORT = 4000;

const players = new Map();

let nextId = 1;


function broadcast(message) {

    for (const player of players.values()) {

        player.socket.write(message);

    }

}


function sendWelcome(player) {

    player.socket.write(`
================================
   Bem-vindo ao Mundo
================================

Seu nome é ${player.name}

Comandos:
 /nome Nome
 /quem
 /sair

Digite qualquer coisa para conversar.

`);

}


function handleCommand(player, input) {

    if (input.startsWith("/nome ")) {

        const oldName = player.name;

        player.name = input
            .substring(6)
            .trim();


        broadcast(
            `${oldName} agora se chama ${player.name}\n`
        );

        return;
    }


    if (input === "/quem") {

        const names = [...players.values()]
            .map(p => p.name)
            .join(", ");


        player.socket.write(
            `Jogadores online: ${names}\n`
        );

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



const server = net.createServer(socket => {

    const id = nextId++;


    const player = {

        id,

        socket,

        name: `Jogador${id}`

    };


    players.set(id, player);


    socket.setEncoding("utf8");


    sendWelcome(player);


    broadcast(
        `${player.name} entrou no mundo.\n`
    );



    socket.on("data", data => {

        const input = data.trim();


        if (!input)
            return;


        handleCommand(
            player,
            input
        );

    });



    socket.on("close", () => {

        players.delete(id);


        broadcast(
            `${player.name} saiu do mundo.\n`
        );

    });



    socket.on("error", () => {

        players.delete(id);

    });


});



server.listen(PORT, () => {

    console.log(
        `Servidor rodando na porta ${PORT}`
    );

});