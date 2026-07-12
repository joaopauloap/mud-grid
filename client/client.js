import net from "net";
import readline from "readline";

const HOST = "localhost";
const PORT = 4000;


const socket = net.createConnection(
    {
        host: HOST,
        port: PORT
    },
    () => {
        console.log("Conectado ao mundo.\n");
    }
);


socket.setEncoding("utf8");


// Mensagens vindas do servidor
socket.on("data", data => {

    process.stdout.write(data);

});


socket.on("close", () => {

    console.log("\nDesconectado do servidor.");

    process.exit();

});


socket.on("error", err => {

    console.log(
        "Erro:",
        err.message
    );

    process.exit();

});


// Entrada do jogador
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


// envia cada linha digitada
rl.on("line", line => {

    socket.write(line + "\n");

});


// evita que CTRL+C mate tudo de forma feia
process.on("SIGINT", () => {

    socket.end();

    process.exit();

});