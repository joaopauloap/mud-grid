/**
 * Representa uma quest do jogador no banco de dados.
 */
export class PlayerQuest {
    constructor({ id, username, quest_name, status, progress, started_at, completed_at }) {
        this.id = id;
        this.username = username;
        this.questName = quest_name;
        this.status = status;          // 'active' | 'completed' | 'failed'
        this.progress = progress || '{}';
        this.startedAt = started_at;
        this.completedAt = completed_at;
    }

    /** Retorna o progresso como objeto. */
    getProgress() {
        try {
            return JSON.parse(this.progress);
        } catch {
            return {};
        }
    }

    /** Atualiza uma chave do progresso. */
    setProgressKey(key, value) {
        const p = this.getProgress();
        p[key] = value;
        this.progress = JSON.stringify(p);
    }

    static fromRow(row) {
        if (!row) return null;
        return new PlayerQuest({
            id: row.id,
            username: row.username,
            quest_name: row.quest_name,
            status: row.status,
            progress: row.progress,
            started_at: row.started_at,
            completed_at: row.completed_at
        });
    }
}
