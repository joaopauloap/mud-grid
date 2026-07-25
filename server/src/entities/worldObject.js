export class WorldObject {
    constructor({ id, keyword, type, name, description, x, y, pickupPermission, dropPermission }) {
        this.id = id;
        this.keyword = keyword;
        this.type = type;
        this.name = name;
        this.description = description;
        this.x = x;
        this.y = y;
        this.pickupPermission = pickupPermission || 'all';
        this.dropPermission = dropPermission || 'all';
    }

    static fromRow(row) {
        if (!row) return null;
        return new WorldObject({
            id: row.id,
            keyword: row.keyword,
            type: row.type,
            name: row.name,
            description: row.description,
            x: row.x,
            y: row.y,
            pickupPermission: row.pickup_permission || 'all',
            dropPermission: row.drop_permission || 'all'
        });
    }
}

/**
 * Verifica se um jogador pode pegar um item.
 * Permissões: 'all' (qualquer um), 'none' (ninguém), ou array de nomes de jogadores.
 */
export function canPickup(playerName, item) {
    if (!item.pickupPermission || item.pickupPermission === 'all') return true;
    if (item.pickupPermission === 'none') return false;
    try {
        const allowed = JSON.parse(item.pickupPermission);
        return allowed.includes(playerName);
    } catch { return false; }
}

/**
 * Verifica se um jogador pode soltar um item.
 * Permissões: 'all' (qualquer um), 'none' (ninguém), ou array de nomes de jogadores.
 */
export function canDrop(playerName, item) {
    if (!item.dropPermission || item.dropPermission === 'all') return true;
    if (item.dropPermission === 'none') return false;
    try {
        const allowed = JSON.parse(item.dropPermission);
        return allowed.includes(playerName);
    } catch { return false; }
}
