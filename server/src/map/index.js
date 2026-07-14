import { getAllWorldDescriptions, seedWorld } from "../auth/index.js";

export const directions = {
  n: { dx: 0, dy: -1, label: "Norte" },
  ne: { dx: 1, dy: -1, label: "Nordeste" },
  e: { dx: 1, dy: 0, label: "Leste" },
  se: { dx: 1, dy: 1, label: "Sudeste" },
  s: { dx: 0, dy: 1, label: "Sul" },
  sw: { dx: -1, dy: 1, label: "Sudoeste" },
  w: { dx: -1, dy: 0, label: "Oeste" },
  nw: { dx: -1, dy: -1, label: "Noroeste" }
};

const defaultWorldDescriptions = new Map([
  ["0,0", "na praça central da Grade, cercada por colunas brilhantes e painéis de energia."],
  ["0,-1", "um corredor sombrio com inscrições antigas nas paredes de metal."],
  [["1,0"].join(","), "uma ponte suspendida sobre um fosso de energia azul."],
  [["-1,0"].join(","), "uma câmara silenciosa com cristais pulsando levemente."],
  [["0,1"].join(","), "um salão com parapeitos e janelas que mostram as luzes do núcleo."],
  [["1,-1"].join(","), "uma escadaria em espiral que sobe em direção a um domo de vidro."],
  [["-1,-1"].join(","), "um jardim interno com plantas bioluminescentes."],
  [["1,1"].join(","), "um laboratório abandonado com mesas cobertas por artefatos."],
  [["-1,1"].join(","), "um depósito cheio de caixas retorcidas e caminhos estreitos."]
]);

const defaultSeed = Array.from(defaultWorldDescriptions.entries()).map(([k, desc]) => {
  const [x, y] = k.split(",").map(Number);
  return { x, y, description: desc };
});

export async function initWorld() {
  const rows = await getAllWorldDescriptions();
  if (!rows || rows.length === 0) {
    await seedWorld(defaultSeed);
    return;
  }

  defaultWorldDescriptions.clear();
  for (const r of rows) {
    defaultWorldDescriptions.set(`${r.x},${r.y}`, r.description);
  }
}

export function formatCoordinates(location) {
  return `(${location.x}, ${location.y})`;
}

export function describeLocation(location) {
  const key = `${location.x},${location.y}`;
  return defaultWorldDescriptions.get(key) || `Você está em uma área desconhecida da Grade.`;
}

export function movePosition(location, directionKey) {
  const direction = directions[directionKey];
  if (!direction) return location;
  return {
    x: location.x + direction.dx,
    y: location.y + direction.dy
  };
}

export function formatLocationMessage(location) {
  return `Você está em ${formatCoordinates(location)}: ${describeLocation(location)}`;
}

export { defaultWorldDescriptions as descriptions };
