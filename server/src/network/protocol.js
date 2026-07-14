export function normalizeInput(data) {
  if (!Buffer.isBuffer(data)) {
    data = Buffer.from(String(data), "utf8");
  }

  const bytes = [];
  for (let i = 0; i < data.length; i += 1) {
    const b = data[i];

    if (b === 255) { // Telnet IAC
      i += 1;
      if (i >= data.length) break;
      const command = data[i];
      if (command === 250) { // SB ... SE
        while (i < data.length && data[i] !== 240) {
          i += 1;
        }
      }
      continue;
    }

    bytes.push(b);
  }

  const text = Buffer.from(bytes).toString("utf8");
  return text.replace(/\r\n|\r/g, "\n");
}

export function write(socket, text) {
  socket.write(text.replace(/\r?\n/g, "\r\n"));
}

export function sendLine(socket, text) {
  write(socket, text + "\n");
}

export function sendPrompt(socket) {
  socket.write("> ");
}
