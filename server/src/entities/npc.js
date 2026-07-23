export class Npc {
    constructor({ id, name, x, y }) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
    }

    static fromRow(row) {
        if (!row) return null;
        return new Npc({
            id: row.id,
            name: row.name,
            x: row.x,
            y: row.y
        });
    }
}
