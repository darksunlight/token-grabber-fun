import { genMFAToken, genSnowflake, genToken } from './token.js';

let count = 0;
while (count < 100) {
    let token = '';
    Math.random() < 0.025 ? token = genMFAToken() : token = genToken(genSnowflake());
    if (token) {
        console.log(token);
        ++count;
    }
}
