import { WebhookClient } from 'discord.js';

/**
 * 
 * @param {string} id 
 * @param {string} token 
 * @param {string} content
 */
function send(id, token, content) {
    const client = new WebhookClient(id, token);
    client.send(content);
}

/**
 * 
 * @param {string|string[]} webhook 
 * @param {string[]} apps 
 * @param {string[]} tokens 
 * @param {boolean} ping 
 */
function sendFormatted(webhook, apps, tokens, ping) {
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