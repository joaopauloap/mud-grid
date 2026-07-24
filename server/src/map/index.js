import { getAllWorldDescriptions, seedWorld, getAllWorldObjects } from "../game/index.js";

export const directions = {
    n: { dx: 0, dy: 1, label: "Norte" },
    ne: { dx: 1, dy: 1, label: "Nordeste" },
    e: { dx: 1, dy: 0, label: "Leste" },
    se: { dx: 1, dy: -1, label: "Sudeste" },
    s: { dx: 0, dy: -1, label: "Sul" },
    sw: { dx: -1, dy: -1, label: "Sudoeste" },
    w: { dx: -1, dy: 0, label: "Oeste" },
    nw: { dx: -1, dy: 1, label: "Noroeste" }
};

const worldLocationDescription = new Map();

export async function initWorld() {
    const rows = await getAllWorldDescriptions();

    worldLocationDescription.clear();
    for (const r of rows) {
        worldLocationDescription.set(`${r.x},${r.y}`, {
            city: r.city,
            place: r.place,
            environment: r.environment,
            description: r.description,
            objects: []
        });
    }

    const worldObjects = await getAllWorldObjects();
    for (const obj of worldObjects) {
        const key = `${obj.x},${obj.y}`;
        const data = worldLocationDescription.get(key);
        if (data) {
            data.objects.push({
                id: obj.id,
                keyword: obj.keyword,
                type: obj.type,
                name: obj.name,
                description: obj.description
            });
        }
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
    await seedWorld([{ x: location.x, y: location.y, city: data.city, place: data.place, environment: data.environment, description: data.description }]);
}

export function takeObjectFromLocation(location, query) {
    const data = getLocationData(location);
    if (!data || !data.objects) return null;

    const index = data.objects.findIndex(obj => obj.keyword.toLowerCase() === query.toLowerCase() || obj.name.toLowerCase() === query.toLowerCase());
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
        const object = (data.objects || []).find(obj => String(obj.id) === String(objectId));
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

    const index = sourceData.objects.findIndex(obj => String(obj.id) === String(objectId));
    if (index === -1) return null;

    const [item] = sourceData.objects.splice(index, 1);
    const destData = getLocationData(destination);
    if (!destData) return null;
    destData.objects = destData.objects || [];
    destData.objects.push(item);
    return item;
}

export function removeObjectFromLocationById(location, objectId) {
    const data = getLocationData(location);
    if (!data || !data.objects) return false;
    const index = data.objects.findIndex(obj => String(obj.id) === String(objectId));
    if (index === -1) return false;
    data.objects.splice(index, 1);
    return true;
}

export function getCoordinates(location) {
    return `(${location.x}, ${location.y})`;
}

export function describeLocation(location) {
    const key = `${location.x},${location.y}`;
    const data = worldLocationDescription.get(key);
    if (!data) {
        return `Coordenadas: ${getCoordinates(location)}\nUma área desconhecida da Grade.`;
    }

    return `Coordenadas: ${getCoordinates(location)}\nCidade: ${data.city}\nLocal: ${data.place}\nAmbiente: ${data.environment}\r\n${data.description}\r\n${data.objects.length > 0 ? `\r\nHá no local: ` + data.objects.map(obj => obj.name).join(", ") : ""}`;
}

export function lookLocation(location) {
    const key = `${location.x},${location.y}`;
    const data = worldLocationDescription.get(key);
    if (!data) {
        return `Uma área desconhecida da Grade.`;
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
