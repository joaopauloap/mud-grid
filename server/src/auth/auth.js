import * as game from "../game/index.js";
import { lookLocation } from "../map/index.js";
import { getPresentEntitiesText } from "../game/locationManager.js";
import { delay } from "../commands/utils.js";

export async function initAuth() {
    await game.init();
}

export async function handleAuthLine(player, input, callbacks) {
    const { sendLine, sendPrompt, disconnectExistingUser, sendWelcome, broadcast, loadPlayerLocation } = callbacks;

    if (player.stage === 'awaiting_username') {
        const username = input;
        player.pendingUsername = username.toLowerCase();
        const exists = await game.userExists(username.toLowerCase());
        if (exists) {
            player.stage = 'awaiting_password_login';
            sendLine(player.socket, `[Guard]: Um usuário da Grade...`);
            sendLine(player.socket, `[Guard]: Qual sua senha então, usuário?`);
            sendPrompt(player.socket);
        } else {
            player.stage = 'awaiting_username_confirmation';
            sendLine(player.socket, `[Guard]: Seu identificador é '${username}'? (s/n)`);
            sendPrompt(player.socket);
        }
        return;
    }

    if (player.stage === 'awaiting_username_confirmation') {
        const answer = input.toLowerCase();
        if (answer === 's' || answer === 'sim') {
            player.stage = 'awaiting_password_register';
            sendLine(player.socket, `[Guard]: Aguarde...`);
            await delay(2000);
            sendLine(player.socket, `[Guard]: Este identificador não consta na relação deste setor da Grade.`);
            await delay(2000);
            sendLine(player.socket, `[Guard]: Entregue-me seu disco, programa.`);
            await delay(3000);
            sendLine(player.socket, `[Guard]: ...`);
            await delay(3000);
            sendLine(player.socket, `[Guard]: Não possui disco?`);
            await delay(3000);
            sendLine(player.socket, `\r\n[Guard]: Programas errantes ou sem disco de identificação estão sujeitos ao desafio da Grade! Deverá provar a MasterControl que pode desempenhar suas diretivas corretamente, programa. Caso se classifique, será reintegrado ao sistema da Grade e receberá uma nova função. Do contrário, ou caso se recuse a obedecer, será submetido a destruição imediata.`);
            await delay(3000);
            sendLine(player.socket, `\r\nInforme uma senha:`);
            sendPrompt(player.socket);
        } else {
            player.stage = 'awaiting_username';
            player.pendingUsername = null;
            sendLine(player.socket, `[Guard]: Identifique-se, programa!`);
            sendPrompt(player.socket);
        }
        return;
    }

    if (player.stage === 'awaiting_password_login') {
        const password = input;
        const ok = await game.authenticate(player.pendingUsername, password);
        if (!ok) {
            sendLine(player.socket, 'Acesso negado.');
            sendLine(player.socket, `[Guard]: Identifique-se, programa!`);
            sendPrompt(player.socket);
            player.stage = 'awaiting_username';
            player.pendingUsername = null;
            return;
        }

        disconnectExistingUser(player.pendingUsername, player.id);
        await completeAuthentication(player, broadcast, loadPlayerLocation, sendWelcome, sendLine);
        return;
    }

    if (player.stage === 'awaiting_password_register') {
        const password = input;
        try {
            await game.createUser(player.pendingUsername, password);
            await completeAuthentication(player, broadcast, loadPlayerLocation, sendWelcome, sendLine);
            sendLine(player.socket, `[Guard]: Encontre CLU no setor 0-1 ao */norte* e requisite um novo 'Disco'.\r\n`);
        } catch (err) {
            sendLine(player.socket, `Erro ao registrar: ${err.message}`);
            sendLine(player.socket, 'Digite seu nome de usuário:');
            sendPrompt(player.socket);
            player.stage = 'awaiting_username';
            player.pendingUsername = null;
        }
        return;
    }
}

async function completeAuthentication(player, broadcast, loadPlayerLocation, sendWelcome, sendLine) {
    player.authenticated = true;
    player.name = player.pendingUsername.toLowerCase();
    broadcast(`[Sistema]: ${player.name} entrou na Grade.\r\n`);
    await loadPlayerLocation(player);
    await sendWelcome(player);
    await sendLocationStatus(player, sendLine);
}

async function sendLocationStatus(player, sendLine) {
    if (!player.location) {
        sendLine(player.socket, `\nSua posição ainda não foi carregada.\r\n`);
        return;
    }

    const locationText = lookLocation(player.location);
    const othersText = await getPresentEntitiesText(player);
    sendLine(player.socket, `\n${locationText}\n${othersText}\r\n`);
}
