import { reseed } from "../game/index.js";
import { initWorld } from "../map/index.js";

export const command = {
    name: "reseed",
    aliases: ["/reseed", "/reset"],
    roles: ["admin"],
    async execute(player) {
        try {
            player.socket.write(`\nRefazendo seed de lugares e NPCs...\r\n`);

            await reseed();
            await initWorld();

            player.socket.write(`\r✓ Seed refeito com sucesso! Lugares e NPCs recarregados dos arquivos JSON.\r\n\n`);
        } catch (err) {
            player.socket.write(`\nErro ao refazer seed: ${err.message}\r\n\n`);
            console.error(`[reseed] Erro: ${err.message}`);
        }
    }
};
