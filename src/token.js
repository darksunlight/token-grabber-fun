import { getRandomInt, ntob, randomB64, CONST } from './util.js';

function genMFAToken() {
    const token = `mfa.${randomB64(96).substr(1, 84)}`;
    if (!token.match(CONST.MFA_REGEX)) return null;
    return token;
}

function genSnowflake() {
    const time = getRandomInt(0, Date.now() - CONST.EPOCH);
    const parts = [time, getRandomInt(0, 31), getRandomInt(0, 31), getRandomInt(0, 4095)].map(part => part.toString(2));
    parts[0] = parts[0].padStart(42, '0');
    parts[1] = parts[1].padStart(5, '0');
    parts[2] = parts[2].padStart(5, '0');
    parts[3] = parts[3].padStart(12, '0');
    const num = BigInt('0b' + parts.join(''));
    return [time, num.toString()];
}

/**
 * 
 * @param {number[]}
 * @returns 
 */
function genToken([minTime, snowflake]) {
    const time = Math.round(getRandomInt(minTime + CONST.EPOCH, Date.now()) / 1000);
    const hmac = randomB64(32).substr(1, 27);
    const parts = [Buffer.from(snowflake.toString()).toString('base64'), ntob(time), hmac];
    if (!parts.join('.').match(CONST.REGEX)) parts[0] = parts[0].replace(/=/, 'xyzXYZ23'[Math.floor(Math.random()*8)]);
    if (0.45 < Math.random() < 0.55) parts[0] = parts[0].replace(/w$/, 'xyzXYZ23o'[Math.floor(Math.random()*9)]);
    parts[1] = parts[1].replace('X', 'XY'[Math.floor(Math.random()*2)]);
    if (!parts.join('.').match(CONST.REGEX)) return null;
    return parts.join('.');
}

export { genSnowflake, genToken, genMFAToken };