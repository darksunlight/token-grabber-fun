import { start as startServer } from './server.js';
import { generate as generateTokens } from './generate.js';
import { Models } from './database.js';

if (process.argv[2] === 'generate' || process.argv[2] === 'retrieve') {
    generateTokens(process.argv[3]);
    process.exit(0);
}
for (const [k, v] of Object.entries(Models)) {
    console.log(`synchronising ${k}`);
    await v.sync();
}
console.log('starting server');
startServer();