import { startServer } from "./src/network/server.js";

const forceReseed = process.argv.includes('--reseed');
await startServer(forceReseed);