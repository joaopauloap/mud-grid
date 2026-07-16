export const command = {
    name: "quem",
    aliases: ["/quem"],
    async execute(player) {
        const names = [...player.serverPlayers.values()]
            .filter(p => p.authenticated)
            .map(p => p.name)
            .join("\n-");

        player.socket.write(`\nConectados na Grade: \n-${names}\r\n\n`);
    }
};
