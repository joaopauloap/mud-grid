import { handleWhoCommand } from "./who.js";
import { handleWhereCommand } from "./where.js";
import { handleLookCommand } from "./look.js";
import { handleTakeCommand } from "./take.js";
import { handleDropCommand } from "./drop.js";
import { handleInventoryCommand } from "./inventory.js";
import { handleCreateCommand } from "./create.js";
import { handleInspectCommand } from "./inspect.js";
import { handleDestroyCommand } from "./destroy.js";
import { handleDisconnectCommand } from "./disconnect.js";
import { handleRolesCommand, handleRoleCommand } from "./roles.js";
import { handleMoveCommand } from "./move.js";
import { handleTransferCommand } from "./transfer.js";

export async function handleCommand(player, input, broadcast) {
    if (input === "/quem") {
        await handleWhoCommand(player);
        return;
    }

    if (input === "/onde") {
        await handleWhereCommand(player);
        return;
    }

    if (input === "/ver") {
        await handleLookCommand(player);
        return;
    }

    if (input.startsWith("/pegar ")) {
        await handleTakeCommand(player, input);
        return;
    }

    if (input.startsWith("/soltar ")) {
        await handleDropCommand(player, input);
        return;
    }

    if (input === "/inventario" || input === "/inv" || input === "/i") {
        await handleInventoryCommand(player);
        return;
    }

    if (input.startsWith("/criar")) {
        await handleCreateCommand(player, input);
        return;
    }

    if (input.startsWith("/inspecionar")) {
        await handleInspectCommand(player);
        return;
    }

    if (input.startsWith("/destruir")) {
        await handleDestroyCommand(player, input);
        return;
    }

    if (input.startsWith("/desconectar")) {
        await handleDisconnectCommand(player, input);
        return;
    }

    if (input.startsWith("/roles")) {
        await handleRolesCommand(player, input);
        return;
    }

    if (input.startsWith("/role ")) {
        await handleRoleCommand(player, input);
        return;
    }

    if (input.startsWith("/transferir")) {
        await handleTransferCommand(player, input);
        return;
    }

    const moved = await handleMoveCommand(player, input);
    if (moved) {
        return;
    }

    if (input === "/sair") {
        player.socket.end();
        return;
    }

    broadcast(`${player.name}: ${input}\n`);
}
