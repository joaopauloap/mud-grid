export function parseCommandArgs(text) {
    const regex = /"([^"]*)"|'([^']*)'|([^\s"]+)/g;
    const args = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        args.push(match[1] || match[2] || match[3]);
    }

    return args;
}

export function getPlayerByName(serverPlayers, username) {
    if (!username) return null;
    const normalized = username.toLowerCase();
    return [...serverPlayers.values()].find(player => player.name && player.name.toLowerCase() === normalized);
}

export function getAuthenticatedPlayer(serverPlayers, username) {
    const player = getPlayerByName(serverPlayers, username);
    return player && player.authenticated ? player : null;
}

export const delay = ms => new Promise(res => setTimeout(res, ms));
