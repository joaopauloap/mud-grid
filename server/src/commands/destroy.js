import { hasRole, getWorldObjectById, deleteWorldObjectById } from "../game/index.js";
import { playersAtLocation } from "../game/locationManager.js";
import { saveLocationData, removeObjectFromLocationById } from "../map/index.js";

export async function handleDestroyCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return;
    }

    const args = input.trim().split(/\s+/);
    if (args.length !== 2) {
        player.socket.write(`\nUso: /destruir <id>\r\n\n`);
        return;
    }

    const id = Number(args[1]);
    if (Number.isNaN(id)) {
        player.socket.write(`\nID inválido. Use um número.\r\n\n`);
        return;
    }

    const object = await getWorldObjectById(id);
    if (!object) {
        player.socket.write(`\nObjeto com id ${id} não encontrado.\r\n\n`);
        return;
    }

    const targetLocation = { x: object.x, y: object.y };
    removeObjectFromLocationById(targetLocation, id);

    try {
        await deleteWorldObjectById(id);
        await saveLocationData(targetLocation);

        player.socket.write(`\nObjeto '${object.name}' (id ${id}) destruído.\r\n\n`);

        const presentPlayers = playersAtLocation(targetLocation, player.serverPlayers)
            .filter(p => p.id !== player.id);
        for (const other of presentPlayers) {
            other.socket.write(`\n[Sistema]: O objeto '${object.name}' foi destruído neste local.\r\n\n`);
        }
    } catch (err) {
        player.socket.write(`\nErro ao destruir objeto: ${err.message}\r\n\n`);
    }
}
