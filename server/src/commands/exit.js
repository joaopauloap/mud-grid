export const command = {
    name: "sair",
    aliases: ["/sair", "/exit", "/quit"],
    async execute(player) {
        player.socket.end();
    }
};
