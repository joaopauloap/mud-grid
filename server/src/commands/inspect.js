import { hasRole, getAllWorldObjects } from "../game/index.js";

export const command = {
    name: "inspecionar",
    aliases: ["/inspecionar"],
    async execute(player) {
        const isAdmin = await hasRole(player.name, 'admin');
        if (!isAdmin) {
            player.socket.write(`\nPermissão negada.\r\n\n`);
            return;
        }

        try {
            const objects = await getAllWorldObjects();
            if (objects.length === 0) {
                player.socket.write(`\nNenhum objeto encontrado na tabela.\r\n\n`);
                return;
            }

            const rows = objects.map(obj => `id=${obj.id}, keyword=${obj.keyword}, type=${obj.type}, name=${obj.name}, description=${obj.description}, x=${obj.x}, y=${obj.y}`).join(`\r\n\n`);
            player.socket.write(`\nObjetos no banco:\r\n${rows}\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao inspecionar objetos: ${err.message}\r\n\n`);
        }
    }
};
