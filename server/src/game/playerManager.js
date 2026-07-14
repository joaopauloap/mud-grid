export const players = new Map();

export function createPlayer(socket, id) {
  return {
    id,
    socket,
    name: `Jogador${id}`,
    authenticated: false,
    stage: 'awaiting_username',
    pendingUsername: null,
    inputBuffer: "",
    serverPlayers: players
  };
}
