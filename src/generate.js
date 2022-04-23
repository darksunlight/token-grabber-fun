import { genMFAToken, genSnowflake, genToken } from './token.js';
function generate(suppliedCount) {
    let count = 0;
    while (count < (suppliedCount > 100 ? 100 : suppliedCount)) {
        let token = '';
        Math.random() < 0.025 ? token = genMFAToken() : token = genToken(genSnowflake());
        if (token) {
            console.log(token);
            ++count;
        }
    }
}
export { generate };