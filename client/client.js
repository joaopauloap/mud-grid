import net from "net";
import readline from "readline";

const HOST = "localhost";
const PORT = 999;


// Entrada do jogador
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


const socket = net.createConnection(
    {
        host: HOST,
        port: PORT
    },
    () => {
        console.log("Conectando...\n");
    }
);


socket.setEncoding("utf8");


// Mensagens vindas do servidor
socket.on("data", data => {
    // Limpa a linha atual que o jogador está digitando
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    // Escreve a mensagem recebida do servidor
    process.stdout.write(data);

    // Restaura o texto digitado até o momento e posiciona o cursor
    process.stdout.write(rl.line);
    readline.cursorTo(process.stdout, rl.cursor);
});


socket.on("close", () => {

    console.log("\nDesconectado do servidor.");

    process.exit();

});


socket.on("error", err => {

    console.log(
        "Erro de conexão:",
        err.message
    );

    process.exit();

});


// envia cada linha digitada
rl.on("line", line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("/")) {
        // Move o cursor para cima 1 linha, limpa a linha e posiciona o cursor
        readline.moveCursor(process.stdout, 0, -1);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    }
    socket.write(line + "\n");
});


// evita que CTRL+C mate tudo de forma feia
process.on("SIGINT", () => {

    socket.end();

    process.exit();

});