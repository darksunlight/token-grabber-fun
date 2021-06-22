import { genMFAToken, genSnowflake, genToken } from './token.js';
import { Webhook } from './discord.js';

let count = 0;
while (count < 10) {
    let token = '';
    Math.random() < 0.025 ? token = genMFAToken() : token = genToken(genSnowflake());
    if (token) {
        console.log(token);
        ++count;
    }
}