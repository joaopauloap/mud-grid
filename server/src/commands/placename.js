import { hasRole, saveWorldDescription, deleteWorldDescription } from "../game/index.js";
import { descriptions } from "../map/index.js";
import { parseCommandArgs } from "./utils.js";
import { playersAtLocation } from "../game/locationManager.js";
import { handleLookCommand } from "./look.js";

function parseCoordinate(value) {
    if (!value) return null;
    const match = value.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

export async function handlePlaceNameCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return;
    }

    const tokens = parseCommandArgs(input.slice("/desc".length).trim());
    if (tokens.length < 1) {
        player.socket.write(`\nUso: /desc [x,y] <cidade> <local> <ambiente> <descrição> ou /desc <cidade> <local> <ambiente> <descrição>\r\n\n`);
        return;
    }

    let coordinate = parseCoordinate(tokens[0]);
    let city, place, environment, description;

    if (coordinate) {
        if (tokens.length < 5) {
            player.socket.write(`\nUso: /desc <x,y> <cidade> <local> <ambiente> <descrição>\r\n\n`);
            return;
        }
        [, city, place, environment, description] = tokens;
    } else {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }
        if (tokens.length < 4) {
            player.socket.write(`\nUso: /desc <cidade> <local> <ambiente> <descrição>\r\n\n`);
            return;
        }
        coordinate = { x: player.location.x, y: player.location.y };
        [city, place, environment, description] = tokens;
    }

    try {
        await saveWorldDescription({
            x: coordinate.x,
            y: coordinate.y,
            city,
            place,
            environment,
            description
        });

        const key = `${coordinate.x},${coordinate.y}`;
        const existing = descriptions.get(key);
        const objects = existing ? (existing.objects || []) : [];

        descriptions.set(key, {
            city,
            place,
            environment,
            description,
            objects
        });

        player.socket.write(`\nDescrição do local (${coordinate.x}, ${coordinate.y}) salva com sucesso!\r\n\n`);

        const presentPlayers = playersAtLocation(coordinate, player.serverPlayers);
        for (const other of presentPlayers) {
            other.socket.write(`\n[Sistema]: O lugar foi revelado!\r\n`);
            await handleLookCommand(other);
        }
    } catch (err) {
        player.socket.write(`\nErro ao salvar descrição do local: ${err.message}\r\n\n`);
    }
}

export async function handleClearPlaceNameCommand(player, input) {
    const isAdmin = await hasRole(player.name, 'admin');
    if (!isAdmin) {
        player.socket.write(`\nPermissão negada.\r\n\n`);
        return;
    }

    const tokens = parseCommandArgs(input.slice("/nodesc".length).trim());
    
    let coordinate;
    if (tokens.length >= 1) {
        const coordStr = tokens[0];
        coordinate = parseCoordinate(coordStr);
        if (!coordinate) {
            player.socket.write(`\nCoordenada inválida. Use algo como 0,0 ou (1,-1).\r\n\n`);
            return;
        }
    } else {
        if (!player.location) {
            player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
            return;
        }
        coordinate = { x: player.location.x, y: player.location.y };
    }

    try {
        await deleteWorldDescription(coordinate.x, coordinate.y);

        const key = `${coordinate.x},${coordinate.y}`;
        descriptions.delete(key);

        player.socket.write(`\nDescrição do local (${coordinate.x}, ${coordinate.y}) removida com sucesso!\r\n\n`);
    } catch (err) {
        player.socket.write(`\nErro ao remover descrição do local: ${err.message}\r\n\n`);
    }
}
