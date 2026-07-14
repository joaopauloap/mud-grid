import * as auth from "../auth/index.js";

export function attachLocation(player) {
  if (!player.location) {
    player.location = { x: 0, y: 0 };
  }
}

export async function loadPlayerLocation(player) {
  const row = await auth.getLocation(player.name);
  if (row) {
    player.location = { x: row.x, y: row.y };
  } else {
    player.location = { x: 0, y: 0 };
  }
}

export function playersAtLocation(location, players) {
  return [...players.values()].filter(p => p.authenticated && p.location && p.location.x === location.x && p.location.y === location.y);
}