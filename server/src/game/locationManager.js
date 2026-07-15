import * as auth from "./index.js";

export function attachLocation(player) {
  if (!player.location) {
    player.location = { x: 0, y: 0 };
  }
}

export async function loadPlayerLocation(player) {
  const row = await auth.getLocation(player.name);
  if (row) {
    player.location = { x: row.x, y: row.y };
    player.inventory = row.inventory || [];
  } else {
    player.location = { x: 0, y: 0 };
    player.inventory = [];
  }
}

export function playersAtLocation(location, players) {
  return [...players.values()].filter(p => p.authenticated && p.location && p.location.x === location.x && p.location.y === location.y);
}