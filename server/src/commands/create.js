import { playersAtLocation } from "../game/locationManager.js";
import { GameService } from "../services/gameService.js";
import { getAuthenticatedPlayer, parseCommandArgs } from "./utils.js";

function parseCoordinate(value) {
    if (!value) return null;
    const match = value.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
    if (!match) return null;
    return { x: Number(match[1]), y: Number(match[2]) };
}

export const command = {
    name: "criar",
    aliases: ["/criar", "/create"],
    roles: ["admin"],
    async execute(player, input) {
        const tokens = parseCommandArgs(input.slice("/criar".length).trim());
        if (tokens.length < 4) {
            player.socket.write(`\nUso: /criar <tipo> <keyword> <nome> <descrição> [coordenada|usuario]\r\n\n`);
            return;
        }

        const [type, keyword, name, description, dest] = tokens;

        try {
            if (!dest) {
                // Caso não seja informado nem coordenada nem nome do jogador, deve criar no local do jogador que executou o comando.
                if (!player.location) {
                    player.socket.write(`\nSua posição ainda não foi carregada.\r\n\n`);
                    return;
                }

                const created = await GameService.createObject({
                    keyword,
                    type,
                    name,
                    description,
                    x: player.location.x,
                    y: player.location.y
                });

                player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado aqui.\r\n\n`);

                const presentPlayers = playersAtLocation(player.location, player.serverPlayers)
                    .filter(p => p.id !== player.id);
                for (const other of presentPlayers) {
                    other.socket.write(`\n[Sistema]: O objeto '${created.name}' foi criado neste local.\r\n\n`);
                }
            } else {
                const coordinate = parseCoordinate(dest);
                if (coordinate) {
                    // Se for coordenada, deve criar o objeto nesse local.
                    const created = await GameService.createObject({
                        keyword,
                        type,
                        name,
                        description,
                        x: coordinate.x,
                        y: coordinate.y
                    });

                    player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado no local (${coordinate.x}, ${coordinate.y}).\r\n\n`);

                    const presentPlayers = playersAtLocation(coordinate, player.serverPlayers)
                        .filter(p => p.id !== player.id);
                    for (const other of presentPlayers) {
                        other.socket.write(`\n[Sistema]: O objeto '${created.name}' foi criado neste local.\r\n\n`);
                    }
                } else {
                    // Se for nome de jogador, deve criar o objeto no inventário do jogador.
                    const targetPlayer = getAuthenticatedPlayer(player.serverPlayers, dest)
                        || [...player.serverPlayers.values()].find(p => p.name && p.name.toLowerCase() === dest.toLowerCase());

                    if (!targetPlayer) {
                        player.socket.write(`\nDestino '${dest}' inválido. Use uma coordenada válida ou o nome de um jogador conectado.\r\n\n`);
                        return;
                    }

                    const created = await GameService.createObject({
                        keyword,
                        type,
                        name,
                        description,
                        targetPlayer
                    });

                    player.socket.write(`\nObjeto '${created.name}' (ID: ${created.id}) criado no inventário do jogador '${targetPlayer.name}'.\r\n\n`);
                    targetPlayer.socket.write(`\n[Sistema]: '${created.name}' foi adicionado em seu inventário.\r\n\n`);
                }
            }
        } catch (err) {
            player.socket.write(`\nErro ao criar objeto: ${err.message}\r\n\n`);
        }
    }
};
