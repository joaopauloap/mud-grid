import { getAuthenticatedPlayer } from "./utils.js";

export const command = {
    name: "msg",
    aliases: ["/msg", "/tell", "/pm"],
    async execute(player, input) {
        const parts = input.trim().split(/\s+/);
        if (parts.length < 3) {
            player.socket.write(`\nUso: /msg <usuario> <mensagem>\r\n\n`);
            return;
        }

        const targetName = parts[1];
        
        // Reconstrói a mensagem juntando todos os argumentos após o nome do destinatário
        const firstSpaceIndex = input.indexOf(targetName);
        const msgContent = input.slice(firstSpaceIndex + targetName.length).trim();

        if (!msgContent) {
            player.socket.write(`\nUso: /msg <usuario> <mensagem>\r\n\n`);
            return;
        }

        const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, targetName)
            || [...player.serverPlayers.values()].find(p => p.name && p.name.toLowerCase() === targetName.toLowerCase() && p.authenticated);

        if (!targetPlayer) {
            player.socket.write(`\nUsuário '${targetName}' não encontrado ou não está conectado.\r\n\n`);
            return;
        }

        if (targetPlayer.id === player.id) {
            player.socket.write(`\nVocê não pode enviar mensagens privadas para você mesmo.\r\n\n`);
            return;
        }

        // Envia para o destinatário
        targetPlayer.socket.write(`\n[Mensagem Privada de ${player.name}]: ${msgContent}\r\n\n`);
        
        // Envia a confirmação para o remetente
        player.socket.write(`\n[Mensagem Privada para ${targetPlayer.name}]: ${msgContent}\r\n\n`);
    }
};
