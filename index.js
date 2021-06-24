import { genMFAToken, genSnowflake, genToken } from './token.js';
import { start as startServer } from './server.js';
import { sequelize, Models } from './database.js';

/* let count = 0;
while (count < 10) {
    let token = '';
    Math.random() < 0.025 ? token = genMFAToken() : token = genToken(genSnowflake());
    if (token) {
        console.log(token);
        ++count;
    }
}*/
for (const [k, v] of Object.entries(Models)) {
    console.log(`synchronising ${k}`);
    await v.sync();
}
console.log('starting server');
startServer();