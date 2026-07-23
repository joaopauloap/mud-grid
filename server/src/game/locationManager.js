import * as auth from "./index.js";
import { getNpcsByLocation } from "./index.js";

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

/**
 * Retorna o texto descritivo de quem está presente no mesmo local do jogador
 * (outros jogadores + NPCs).
 * Ex: "Também estão aqui: joao, [NPC]Guarda"
 * Ex: "Você está sozinho neste local."
 */
export async function getPresentEntitiesText(player) {
    if (!player.location) return "";

    const others = playersAtLocation(player.location, player.serverPlayers)
        .filter(p => p.id !== player.id)
        .map(p => p.name);

    const npcsHere = await getNpcsByLocation(player.location.x, player.location.y);
    const npcNames = npcsHere.map(npc => `[NPC]${npc.name}`);

    const allPresent = [...others, ...npcNames];
    return allPresent.length > 0
        ? `Também estão aqui: ${allPresent.join(", ")}`
        : "Você está sozinho neste local.";
}