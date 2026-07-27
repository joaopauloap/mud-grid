export const command = {
    name: "limpar",
    aliases: ["/limpar", "/clear", "/cls"],
    async execute(player) {
        player.socket.write("\x1B[2J\x1B[H");
    }
};
