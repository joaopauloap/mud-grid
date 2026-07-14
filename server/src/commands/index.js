export function handleCommand(player, input, broadcast) {
  if (input === "/quem") {
    const names = [...player.serverPlayers.values()]
      .filter(p => p.authenticated)
      .map(p => p.name)
      .join("\n-");

    player.socket.write(`\nConectados na Grade: \n-${names}\r\n`);
    return;
  }

  if (input === "/sair") {
    player.socket.end();
    return;
  }

  broadcast(`${player.name}: ${input}\n`);
}