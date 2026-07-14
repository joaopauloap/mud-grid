import * as auth from "./index.js";

export async function initAuth() {
  await auth.init();
}

export async function handleAuthLine(player, input, callbacks) {
  const { sendLine, sendPrompt, disconnectExistingUser, sendWelcome, broadcast } = callbacks;

  if (player.stage === 'awaiting_username') {
    const username = input;
    player.pendingUsername = username;
    const exists = await auth.userExists(username);
    if (exists) {
      player.stage = 'awaiting_password_login';
      sendLine(player.socket, `[Guardião]: Um usuário...`);
      sendLine(player.socket, `[Guardião]: Qual sua senha então, usuário?`);
      sendPrompt(player.socket);
    } else {
      player.stage = 'awaiting_username_confirmation';
      sendLine(player.socket, `[Guardião]: Seu identificador é '${username}'? (s/n)`);
      sendPrompt(player.socket);
    }
    return;
  }

  if (player.stage === 'awaiting_username_confirmation') {
    const answer = input.toLowerCase();
    if (answer === 's' || answer === 'sim') {
      player.stage = 'awaiting_password_register';
      sendLine(player.socket, `[Guardião]: Programas errantes sem disco de identificação estão sujeitos ao desafio da Grade!`);
      sendLine(player.socket, `[Guardião]: Deverá provar que pode desempenhar suas funções básicas, programa.`);
      sendLine(player.socket, `[Guardião]: Caso se classifique, será reintegrado ao sistema da Grade e receberá uma nova função. Do contrário, ou caso se recuse a obedecer, será submetido a destruição imediata.`);
      sendLine(player.socket, `Informe uma senha.`);
      sendPrompt(player.socket);
    } else {
      player.stage = 'awaiting_username';
      player.pendingUsername = null;
      sendLine(player.socket, `[Guardião]: Identifique-se, programa!`);
      sendPrompt(player.socket);
    }
    return;
  }

  if (player.stage === 'awaiting_password_login') {
    const password = input;
    const ok = await auth.authenticate(player.pendingUsername, password);
    if (!ok) {
      sendLine(player.socket, 'Acesso negado.');
      sendLine(player.socket, `[Guardião]: Identifique-se, programa!`);
      sendPrompt(player.socket);
      player.stage = 'awaiting_username';
      player.pendingUsername = null;
      return;
    }

    disconnectExistingUser(player.pendingUsername, player.id);

    player.authenticated = true;
    player.name = player.pendingUsername;

    await sendWelcome(player);
    broadcast(`[Sistema]: ${player.name} entrou na Grade.\n`);
    return;
  }

  if (player.stage === 'awaiting_password_register') {
    const password = input;
    try {
      await auth.createUser(player.pendingUsername, password);
      player.authenticated = true;
      player.name = player.pendingUsername;

      await sendWelcome(player);
      broadcast(`${player.name} entrou na Grade.\n`);
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
