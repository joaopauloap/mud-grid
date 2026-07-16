export class WorldObject {
    constructor({ id, keyword, type, name, description, x, y }) {
        this.id = id;
        this.keyword = keyword;
        this.type = type;
        this.name = name;
        this.description = description;
        this.x = x;
        this.y = y;
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
            y: row.y
        });
    }
}
