/**
 * 
 * @param {number} min 
 * @param {number} max 
 * @returns 
 */
function getRandomInt(min, max) { // stolen from MDN, don't judge
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 
 * @param {number} n 
 * @returns {string}
 */
function ntob(n) { // https://ru.stackoverflow.com/a/1200706, Alexy Ten, CC BY-SA 3.0
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n);
    return b.toString('base64')
        .slice(0, 6)
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * 
 * @param {number} len 
 * @returns 
 */
function randomB64(len) {
    let b64 = '';
    while (b64.length < len) {
       b64 += ntob(Math.ceil(Math.random() * 4294967295));
    }
    return b64;
}

function flakeToTime(snowflake) {
    return new Date(snowflake / 2**22 + 1420070400000);
}

const CONST = {
    'EPOCH': 1420070400000,
    'TOKEN_GEN_EPOCH': 1293840000,
    'REGEX': /[MNO][\w-]{23}\.[\w-]{6}\.[\w-]{27}/,
    'MFA_REGEX': /mfa\.[\w-]{84}/,
};

export { flakeToTime, getRandomInt, ntob, randomB64, CONST };