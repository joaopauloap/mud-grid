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

const worldLocationDescription = new Map([
    ["0,0", {
        city: "Grade",
        place: "Portal da Grade",
        environment: "Plataforma do portal",
        description: "Você está na plataforma do portal da Grade, cercada por colunas brilhantes e painéis de energia.",
        objects: [
            { id: "moeda", name: "Moeda", type: "item", description: "Uma moeda escura contendo a inscrição 'C.L.U' em neon vermelho" },
        ]
    }],
    ["0,-1", {
        city: "Grade",
        place: "Corredor Antigo",
        environment: "Corredor sombrio",
        description: "Você está em um corredor sombrio com inscrições antigas nas paredes de metal.",
        objects: [
            { id: "tocha", name: "Tocha", type: "item", description: "Uma tocha apagada presa à parede." }
        ]
    }],
    [["1,0"].join(","), {
        city: "Grade",
        place: "Ponte dos Arestos",
        environment: "Ponte suspensa",
        description: "Você vê uma ponte suspendida sobre um fosso de energia azul.",
        objects: [
            { id: "corrente", name: "Corrente", type: "furniture", description: "Uma corrente pesada presa às laterais da ponte." }
        ]
    }],
    [["-1,0"].join(","), {
        city: "Grade",
        place: "Câmara de Cristal",
        environment: "Câmara silenciosa",
        description: "Você vê uma câmara silenciosa com cristais pulsando levemente.",
        objects: []
    }],
    [["0,1"].join(","), {
        city: "Grade",
        place: "Salão do Núcleo",
        environment: "Salão com parapeitos",
        description: "Você vê um salão com parapeitos e janelas que mostram as luzes do núcleo.",
        objects: [
            { id: "cadeira", name: "Cadeira", type: "furniture", description: "Uma cadeira de madeira antiga." }
        ]
    }],
    [["1,-1"].join(","), {
        city: "Grade",
        place: "Escadaria Espiral",
        environment: "Escadaria em espiral",
        description: "Você vê uma escadaria em espiral que sobe em direção a um domo de vidro.",
        objects: []
    }],
    [["-1,-1"].join(","), {
        city: "Grade",
        place: "Jardim Bioluminescente",
        environment: "Jardim interno",
        description: "Você vê um jardim interno com plantas bioluminescentes.",
        objects: [
            { id: "planta", name: "Planta Bioluminescente", type: "flora", description: "Uma planta que emite luz fraca." }
        ]
    }],
    [["1,1"].join(","), {
        city: "Grade",
        place: "Laboratório Abandonado",
        environment: "Laboratório",
        description: "Você vê um laboratório abandonado com mesas cobertas por artefatos.",
        objects: [
            { id: "frasco", name: "Frasco Quebrado", type: "item", description: "Um frasco de vidro quebrado com líquidos secos." }
        ]
    }],
    [["-1,1"].join(","), {
        city: "Grade",
        place: "Depósito",
        environment: "Depósito",
        description: "Você vê um depósito cheio de caixas retorcidas e caminhos estreitos.",
        objects: [
            { id: "caixa", name: "Caixa Estranha", type: "container", description: "Uma caixa de metal fechada com um cadeado." }
        ]
    }]
]);

const defaultSeed = Array.from(worldLocationDescription.entries()).map(([k, data]) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y, city: data.city, place: data.place, environment: data.environment, description: data.description, objects: data.objects };
});

export async function initWorld() {
    const rows = await getAllWorldDescriptions();
    if (!rows || rows.length === 0) {
        await seedWorld(defaultSeed);
        return;
    }

    worldLocationDescription.clear();
    for (const r of rows) {
        worldLocationDescription.set(`${r.x},${r.y}`, {
            city: r.city,
            place: r.place,
            environment: r.environment,
            description: r.description,
            objects: r.objects || []
        });
    }
}

export function getLocationData(location) {
    const key = `${location.x},${location.y}`;
    return worldLocationDescription.get(key) || null;
}

export async function saveLocationData(location) {
    const key = `${location.x},${location.y}`;
    const data = worldLocationDescription.get(key);
    if (!data) {
        throw new Error("Local desconhecido, não é possível salvar dados do local.");
    }
    await seedWorld([{ x: location.x, y: location.y, city: data.city, place: data.place, environment: data.environment, description: data.description, objects: data.objects || [] }]);
}

export function takeObjectFromLocation(location, query) {
    const data = getLocationData(location);
    if (!data || !data.objects) return null;

    const index = data.objects.findIndex(obj => obj.id.toLowerCase() === query.toLowerCase() || obj.name.toLowerCase() === query.toLowerCase());
    if (index === -1) return null;

    return data.objects.splice(index, 1)[0];
}

export function dropObjectToLocation(location, object) {
    const data = getLocationData(location);
    if (!data) return null;
    data.objects.push(object);
    return data;
}

export function addObjectToLocation(location, object) {
    const data = getLocationData(location);
    if (!data) {
        throw new Error("Local desconhecido, não é possível adicionar objeto.");
    }
    data.objects = data.objects || [];
    data.objects.push(object);
    return data;
}

export function findObjectLocationById(objectId) {
    for (const [key, data] of worldLocationDescription.entries()) {
        const object = (data.objects || []).find(obj => obj.id.toLowerCase() === objectId.toLowerCase());
        if (object) {
            const [x, y] = key.split(",").map(Number);
            return { object, location: { x, y } };
        }
    }
    return null;
}

export function moveObjectToLocation(objectId, destination) {
    const source = findObjectLocationById(objectId);
    if (!source) return null;
    const object = source.object;
    const sourceLocation = source.location;

    const sourceData = getLocationData(sourceLocation);
    if (!sourceData) return null;

    const index = sourceData.objects.findIndex(obj => obj.id.toLowerCase() === objectId.toLowerCase());
    if (index === -1) return null;

    const [item] = sourceData.objects.splice(index, 1);
    const destData = getLocationData(destination);
    if (!destData) return null;
    destData.objects = destData.objects || [];
    destData.objects.push(item);
    return item;
}

export function getCoordinates(location) {
    return `(${location.x}, ${location.y})`;
}

export function describeLocation(location) {
    const key = `${location.x},${location.y}`;
    const data = worldLocationDescription.get(key);
    if (!data) {
        return `uma área desconhecida da Grade.`;
    }

    return `Coordenadas:${getCoordinates(location)}}\nCidade: ${data.city}\nLocal: ${data.place}\nAmbiente: ${data.environment}\r\n${data.description}\r\n${data.objects.length > 0 ? `\r\nHá no local: ` + data.objects.map(obj => obj.name).join(", ") : ""}`;
}

export function lookLocation(location) {
    const key = `${location.x},${location.y}`;
    const data = worldLocationDescription.get(key);
    if (!data) {
        return `uma área desconhecida da Grade.`;
    }

    return `${data.description}\r\n${data.objects.length > 0 ? `\r\nHá no local: ` + data.objects.map(obj => obj.name).join(", ") : ""}`;
}

export function movePosition(location, directionKey) {
    const direction = directions[directionKey];
    if (!direction) return location;
    return {
        x: location.x + direction.dx,
        y: location.y + direction.dy
    };
}

export { worldLocationDescription as descriptions };
