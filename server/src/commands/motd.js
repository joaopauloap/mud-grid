import { getGameParam } from "../game/index.js";

export async function handleMotdCommand(player) {
    try {
        const motd = await getGameParam("motd") || "Nenhuma mensagem do dia.";
        player.socket.write(`\n${motd}\r\n\n`);
    } catch (err) {
        player.socket.write(`\nErro ao recuperar o MOTD: ${err.message}\r\n\n`);
    }
}

export const command = {
    name: "motd",
    aliases: ["/motd"],
    async execute(player) {
        await handleMotdCommand(player);
    }
};
