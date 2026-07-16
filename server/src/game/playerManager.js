import { Player } from "../entities/player.js";

export const players = new Map();

export function createPlayer(socket, id) {
  return new Player(socket, id, players);
}
