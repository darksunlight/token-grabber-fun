import { WebhookClient } from 'discord.js';

/**
 * 
 * @param {String} id 
 * @param {String} token 
 * @param {String} content
 */
function send(id, token, content) {
    const client = new WebhookClient(id, token);
    client.send(content);
}

/**
 * 
 * @param {String|String[]} webhook 
 */
 function parseWebhookUrl(webhook) {
    let id = '';
    let token = '';

    if (Array.isArray(webhook) && webhook.length >= 2) {
        id = webhook[0].match(/\d+/) ? webhook[0] : null;
        token = webhook[1].match(/[\w-]{68}/) ? webhook[1] : null;
    } else if (Array.isArray(webhook) && webhook.length < 2) {
        id = null;
        token = null;
    } else if (typeof webhook === 'string') {
        const matches = webhook.match(/\/(\d+)\/([\w-]{68})$/);
        id = matches[1].match(/\d+/) ? matches[1] : null;
        token = matches[2].match(/[\w-]{68}/) ? matches[2] : null;
    }
    return [id, token];
}

/**
 * 
 * @param {String|String[]} webhook 
 * @param {String[]} apps 
 * @param {String[]} tokens 
 * @param {Boolean} ping 
 */
function sendFormatted(webhook, apps, tokens, ping) {
    const [id, token] = parseWebhookUrl(webhook);
    if (id && token) {
        let message = '';
        if (ping) message += '@everyone';
        apps.forEach(app => {
            message += `\n**${app}**\n\`\`\`\n`;
            if (Math.random() < 0.05) message += 'No tokens found.\n';
            else message += `${tokens[Math.floor(Math.random()*tokens.length)]}\n`;
            message += '```';
        });
        send(id, token, message);
    } else {
        throw new Error('Invalid webhook URL provided');
    }

}

/**
 * @typedef {Object} FormatData
 * @property {String} [ping]
 * @property {String|String[]} [app]
 * @property {String|String[]} [token]
 */
/**
 * 
 * @param {String} format 
 * @param {FormatData} data 
 */
function formatToText(format, data) {
    format = format.replace(/{{ping}}/g, data.ping);
    format = format.replace(/{{app}}/g, data.app);
    format = format.replace(/{{app1}}/g, data.app[0]).replace(/{{app2}}/g, data.app[1]);
    format = format.replace(/{{token}}/g, data.token);
    format = format.replace(/{{token1}}/g, data.token[0]).replace(/{{token2}}/g, data.token[1]);
}

export { send, formatToText };