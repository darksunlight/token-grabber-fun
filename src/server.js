import express from 'express';
import Mustache from 'mustache';
import fs from 'fs';
import fetch from 'node-fetch';
import ipaddr from 'ipaddr.js';
import { sequelize as db, Models } from './database.js';
import { send as sendWebhook, parseWebhookUrl } from './webhook.js';

const server = express();
const version = '1';
const statuses = ['Queued for analysis', 'Pending review', 'Analysed', 'Webhook(s) active', 'Rejected'];
const levels_ucd = ['Default', 'Blacklisted', 'Whitelisted', 'Elevated'];

class ApiError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ApiError';
    }
}

const getIp = req => {
    return req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
};

const isInternalIp = req => {
    return ['::1', '127.0.0.1'].includes(getIp(req));
};

const hasAccessLevel = async (req, level) => {
    const accessControlRecord = await Models.AccessControl.findByPk(getIp(req));
    if (!accessControlRecord) return false;
    if (accessControlRecord.get('level') === level) return true;
    return false;
};

const isElevated = async req => {
    return await hasAccessLevel(req, 3);
};

const checkBlacklistedIp = async (req, res, next) => {
    if ((await hasAccessLevel(req, 1)) && !isInternalIp(req)) {
        return res.status(403).send('Your IP has been blacklisted.');
    }
    next();
};

const checkElevatedIp = async (req, res, next) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    next();
}

/**
 * 
 * @param {String} template 
 * @param {Object} view 
 * @returns 
 */
const renderTemplate = (template, view) => {
    if (!view) view = {};
    return Mustache.render(fs.readFileSync(`./templates/${template}.html`, 'utf-8'), Object.assign({ version: version }, view));
};

const http403 = async res => {
    return res.status(403).send(renderTemplate('403'));
};

const http404 = async (res, type, returnto, where) => {
    if (!type) type = 'page with the requested URL';
    if (!returnto) returnto = '/dashboard';
    if (!where) where = 'Dashboard';
    return res.status(404).send(renderTemplate('404', {
        type: type,
        returnto: returnto,
        where: where,
    }));
}

const pad = count => {
    return '    '.repeat(count);
};

server.use(checkBlacklistedIp);
server.use('/internal*', checkElevatedIp);
server.use(express.urlencoded({ extended: true }));

server.get('/', (req, res) => {
    res.send(renderTemplate('index', { developer: 'darksunlight' }));
});

server.get('/dashboard', async (req, res) => {
    const elevated = await isElevated(req);
    const messages = await Models.Statistics.findByPk('messages');
    if (!messages) {
        res.status(500);
        return res.send('Something went wrong: the database is not set up properly. This might be because the databse is still being set up. Please come back later.');
    }
    const webhooks = (await Models.Webhook.findAndCountAll()).count;
    const channels = (await Models.Channel.findAndCountAll()).count;
    const guilds = (await Models.Guild.findAndCountAll()).count;
    const samples = (await Models.Sample.findAndCountAll()).count;
    res.send(renderTemplate('dashboard', {
        count: {
            message: messages.get('value'),
            webhook: webhooks,
            channel: channels,
            guild: guilds,
            samples: samples,
        },
        elevatedContent: elevated ? `\n${pad(4)}<p><a href="/internal">Internal</a></p>\n` : null,
    }));
});

server.get('/samples/add', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send(renderTemplate('add-sample', {
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
        selectedDefault: 'selected ',
    }));
});

server.post('/samples/add', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    let id;
    try {
        const sample = await Models.Sample.create({
            hash: req.body.hash,
            filename: req.body.filename,
            description: req.body.desc,
            status: parseInt(req.body.status),
        });
        id = sample.get('id');
    } catch (e) {
        return res.send(renderTemplate('add-sample', {
            action: 'Add',
            action_lc: 'add',
            actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
            alert: `\n${pad(5)}Failed to add sample: ${e.name}: ${e.message}\n${pad(4)}`,
            alertClass: 'danger',
            selectedDefault: 'selected ',
        }));
    }
    res.send(renderTemplate('add-sample', {
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
        alert: `\n${pad(5)}Sample added successfully. <a href="/samples/view/${id}">Click to view</a>\n${pad(4)}`,
        alertClass: 'success',
        selectedDefault: 'selected ',
    }));
});

server.get('/samples/upload', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send(renderTemplate('upload-sample', { selectedDefault: 'selected ' }));
});

server.get('/samples/view/:id', async (req, res) => {
    const sample = await Models.Sample.findByPk(req.params.id);
    const elevated = await isElevated(req);
    if (!sample) {
        return http404(res, 'sample with the requested ID', '/samples/list', 'Samples');
    }
    res.send(renderTemplate('view-sample', {
        id: req.params.id,
        filenames: sample.get('filename') ? sample.get('filename').split(',').map(filename => {return { filename: filename }}) : '',
        hash: sample.get('hash'),
        desc: sample.get('description'),
        status: statuses[sample.get('status')],
        webhookId: sample.get('webhookId'),
        elevatedContent: elevated ? `\n${pad(4)}<p><a href="/samples/edit/${req.params.id}">edit</a>&nbsp;<a href="/samples/delete/${req.params.id}">delete</a></p>` : '',
    }));
});

server.get('/samples/delete/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const sample = await Models.Sample.findByPk(req.params.id);
    if (!sample) {
        return http404(res, 'sample with the requested ID', '/samples/list', 'Samples');
    }
    res.send(renderTemplate('delete-sample', { id: req.params.id }));
});

server.post('/samples/delete/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const sampleRows = await Models.Sample.destroy({ where: { id: req.params.id } });;
    if (!sampleRows) {
        return http404(res, 'sample with the requested ID', '/samples/list', 'Samples');
    }
    res.send(`Sample with ID ${req.params.id} has been deleted successfully.`);
});

server.get('/samples/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const sample = await Models.Sample.findByPk(req.params.id);
    if (!sample) {
        return http404(res, 'sample with the requested ID', '/samples/list', 'Samples');
    }
    const eview = {
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `Use the following form to edit the sample with ID <b>${req.params.id}</b>.`,
        desc: sample.get('description'),
        filename: sample.get('filename'),
        hash: ` disabled value="${sample.get('hash')}"`,
        up_sample: `\n${pad(5)}<li class="breadcrumb-item"><a href="/samples/view/${req.params.id}">Sample ${req.params.id}</a></li>`,
    };
    eview[`selected${sample.get('status')}`] = `selected `;
    res.send(renderTemplate('add-sample', eview));
});

server.post('/samples/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const sample = await Models.Sample.findByPk(req.params.id);
    if (!sample) {
        return http404(res, 'sample with the requested ID', '/samples/list', 'Samples');
    }
    try {
        await Models.Sample.update({
            filename: req.body.filename,
            description: req.body.desc,
            status: parseInt(req.body.status),
        }, { where: { id: req.params.id } });
    } catch (e) {
        const eview = {
            id: ` ${req.params.id}`,
            action: 'Edit',
            action_lc: `edit/${req.params.id}`,
            actionDesc: `return to <a href="/samples/view/${req.params.id}">view</a>`,
            alert: `\n${pad(5)}Failed to edit sample: ${e.name}\n${pad(4)}`,
            alertClass: 'danger',
            desc: sample.get('description'),
            filename: sample.get('filename'),
            hash: ` disabled value="${sample.get('hash')}"`,
            up_sample: `\n${pad(5)}<li class="breadcrumb-item"><a href="/samples/view/${req.params.id}">Sample ${req.params.id}</a></li>`,
        };
        return res.send(renderTemplate('add-sample', eview));
    }
    const eview = {
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `Use the following form to edit the sample with ID <b>${req.params.id}</b>.`,
        alert: `\n${pad(5)}Sample edited successfully. <a href="/samples/view/${req.params.id}">Click to view</a>\n                `,
        alertClass: 'success',
        desc: req.body.desc,
        filename: req.body.filename,
        hash: ` disabled value="${sample.get('hash')}"`,
        up_sample: `\n${pad(5)}<li class="breadcrumb-item"><a href="/samples/view/${req.params.id}">Sample ${req.params.id}</a></li>`,
    };
    eview[`selected${req.body.status}`] = `selected `;
    res.send(renderTemplate('add-sample', eview));
});

server.get('/samples/list', async (req, res) => {
    const actions = ['view'];
    const elevated = await isElevated(req);
    if (elevated) actions.push('edit', 'delete');
    const sampleList = await Models.Sample.findAll({ attributes: ['id', 'description', 'status'] });
    res.send(renderTemplate('list-samples', {
        elevatedContent: elevated ? `\n${pad(4)}<p><a href="/samples/add">add sample</a></p>` : '',
        actions: actions.map(action => {return { action: action }}),
        samples: sampleList.map(sample => {return { id: sample.id, description: sample.description ? sample.description.substring(0, 15).concat(sample.description.length > 15 ? '...' : '') : '', status: statuses[sample.status] }}),
    }));
});

server.get('/webhooks/list', async (req, res) => {
    const actions = ['view'];
    const elevated = await isElevated(req);
    if (elevated) actions.push('edit', 'delete');
    const webhookList = await Models.Webhook.findAll({ attributes: ['id', 'token', 'active'] });
    res.send(renderTemplate('list-webhooks', {
        elevatedContent: elevated ? `\n${pad(4)}<p><a href="/webhooks/add">add webhook</a></p>` : '',
        actions: actions.map(action => {return { action: action }}),
        webhooks: webhookList.map(webhook => {return { id: webhook.id, token: webhook.token.substring(0, 4).concat('...'), active: webhook.active }}),
    }));
});

server.get('/webhooks/add', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send(renderTemplate('add-webhook', {
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a webhook manually.',
        selectedDefault: 'selected ',
    }));
});

server.post('/webhooks/add', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    let active;
    if (typeof req.body.active === 'undefined') active = false;
    else if (req.body.active === 'on') active = true;
    else active = false;
    const [id, token] = parseWebhookUrl(req.body.url);

    try {
        const webhook = await Models.Webhook.findByPk(id);
        if (!!webhook) throw new Error('The webhook with the specified ID already exists.');
        if (!id || !token) throw new Error('Supplied URL is not a valid Discord webhook URL.');
        const data = await (await fetch(`https://discord.com/api/v9/webhooks/${id}/${token}`)).json();
        if (!!data.code && data.code === 10015) throw new ApiError('Unknown Webhook');
        if (!data.channel_id || !data.guild_id) throw new ApiError('Discord API response is malformed or lacks essential information.');
        console.log(data);
        const guild = await Models.Guild.findByPk(data.guild_id);
        if (!guild) {
            await Models.Guild.create({
                id: data.guild_id,
            });
        }
        console.log('done guild');

        const channel = await Models.Channel.findByPk(data.channel_id);
        if (!channel) {
            await Models.Channel.create({
                id: data.channel_id,
                guildId: data.guild_id,
            });
        }
        console.log('done channel');
        
        await Models.Webhook.create({
            id: id,
            token: token,
            active: active,
            channelId: data.channel_id,
            guildId: data.guild_id,
        });
    } catch (e) {
        return res.send(renderTemplate('add-webhook', {
            action: 'Add',
            action_lc: 'add',
            actionDesc: 'Use the following form to add a webhook manually.',
            alert: `\n${pad(5)}Failed to add webhook: ${e.name}: ${e.message}\n${pad(4)}`,
            alertClass: 'danger',
        }));
    }
    res.send(renderTemplate('add-webhook', {
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a webhook manually.',
        alert: `\n${pad(5)}Webhook added successfully. <a href="/webhooks/view/${id}">Click to view</a>`,
        alertClass: 'success',
    }));
});

server.get('/webhooks/view/:id', async (req, res) => {
    const webhook = await Models.Webhook.findByPk(req.params.id);
    const elevated = await isElevated(req);
    if (!webhook) {
        return http404(res, 'webhook with the requested ID', '/webhooks/list', 'Webhooks');
    }
    const censored_token = webhook.token.substr(0, 4).concat('?'.repeat(64));
    res.send(renderTemplate('view-webhook', {
        id: req.params.id,
        token: elevated ? webhook.token : censored_token,
        censored_token: censored_token,
        elevated: elevated,
        active: webhook.active,
        channel_id: webhook.channelId,
        guild_id: webhook.guildId,
    }));
});

server.get('/webhooks/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const webhook = await Models.Webhook.findByPk(req.params.id);
    if (!webhook) {
        return http404(res, 'webhook with the requested ID', '/webhooks/list', 'Webhooks');
    }
    const eview = {
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `Use the following form to edit the webhook with ID <b>${req.params.id}</b>.`,
        active: webhook.active,
        checked: webhook.active ? ' checked' : '',
        up_webhook: `\n${pad(5)}<li class="breadcrumb-item"><a href="/webhooks/view/${req.params.id}">Webhook ${req.params.id}</a></li>`,
        url: `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`,
    };
    res.send(renderTemplate('edit-webhook', eview));
});

server.post('/webhooks/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    const webhook = await Models.Webhook.findByPk(req.params.id);
    if (!webhook) {
        return http404(res, 'webhook with the requested ID', '/webhooks/list', 'Webhooks');
    }
    let active;
    if (typeof req.body.active === 'undefined') active = false;
    else if (req.body.active === 'on') active = true;
    else active = false;
    try {
        await Models.Webhook.update({
            active: active,
        }, { where: { id: req.params.id } });
    } catch (e) {
        const eview = {
            id: ` ${req.params.id}`,
            action: 'Edit',
            action_lc: `edit/${req.params.id}`,
            actionDesc: `return to <a href="/webhooks/view/${req.params.id}">view</a>`,
            alert: `\n${pad(5)}Failed to edit webhook: ${e.name}\n${pad(4)}`,
            alertClass: 'danger',
            checked: webhook.active ? ' checked' : '',
            up_webhook: `\n${pad(5)}<li class="breadcrumb-item"><a href="/webhooks/view/${req.params.id}">Webhook ${req.params.id}</a></li>`,
            url: `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`,
        };
        return res.send(renderTemplate('edit-webhook', eview));
    }
    const eview = {
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `Use the following form to edit the webhook with ID <b>${req.params.id}</b>.`,
        alert: `\n${pad(5)}Webhook edited successfully. <a href="/webhooks/view/${req.params.id}">Click to view</a>\n                `,
        alertClass: 'success',
        checked: active ? ' checked' : '',
        up_webhook: `\n${pad(5)}<li class="breadcrumb-item"><a href="/webhooks/view/${req.params.id}">Webhook ${req.params.id}</a></li>`,
        url: `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`,
    };
    res.send(renderTemplate('edit-webhook', eview));
});

server.get('/samples/view/:id/webhooks', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send('h');
});

server.get('/samples/edit/:id/webhooks/add', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send(renderTemplate('add-webhook-to-sample', {
        sid: req.params.id,
    }));
});

server.get('/guilds/list', async (req, res) => {
    if (!(await isElevated(req))) {
        return http403(res);
    }
    res.send('h');
});

server.get('/internal', async (req, res) => {
    res.send(renderTemplate('internal'));
});

server.get('/internal/ac/list', async (req, res) => {
    const ipList = await Models.AccessControl.findAll({ attributes: ['ip', 'level'] });
    res.send(renderTemplate('internal-ac-list-ip', { ips: ipList.map(ip => {return { ip: ip.ip, level: ip.level, level_text: levels_ucd[ip.level] }})} ));
});

server.get('/internal/ac/list/:level', async (req, res) => {
    const ipList = await Models.AccessControl.findAll({ attributes: ['ip'], where: { level: req.params.level } });
    res.send(renderTemplate('internal-ac-list-ip-w-level', {
        level: levels_ucd[req.params.level],
        ips: ipList.map(ip => {return { ip: ip.ip }}),
    }));
});

server.get('/internal/ac/change/:ip', async (req, res) => {
    const ip = await Models.AccessControl.findByPk(req.params.ip);
    const view = {
        ip: req.params.ip,
    };
    if (ip) {
        view[`selected${ip.level}`] = 'selected ';
    }
    const alertSelfIP = {
        alert: `\n${pad(5)}<b>Warning:</b> you are changing access level for your own IP address.\n${pad(4)}`,
        alertClass: 'warning',
    };
    if (getIp(req) === req.params.ip) Object.assign(view, alertSelfIP);
    res.send(renderTemplate('internal-ac-change', view));
});

server.post('/internal/ac/change', async (req, res) => {
    const ip = await Models.AccessControl.findByPk(req.body.ip);
    if (!ip) {
        await Models.AccessControl.create({
            ip: req.body.ip,
            level: req.body.level,
        });
    } else {
        await Models.AccessControl.update({
            level: req.body.level,
        }, { where: { ip: req.body.ip } });
    }
    res.send(renderTemplate('internal-ac-changed', {
        ip: req.body.ip,
        level_text: levels_ucd[req.body.level],
    }));
});

server.get('/api/internal', async (req, res) => {
    if (!(await isElevated(req))) {
        return res.status(403).send({ code: 403, desc: 'You are not authorised to view this page.'});
    }
    res.send('h');
});

server.get('/api/internal/elevate-ip/:ip', async (req, res) => {
    if (!isInternalIp(req)) {
        return res.status(403).send('no u');
    }
    const ipRow = await Models.AccessControl.findByPk(req.params.ip);
    if (!ipRow) {
        await Models.AccessControl.create({
            ip: req.params.ip,
            level: 3,
        });
    } else {
        await Models.AccessControl.update({
            level: 3,
        }, { where: { ip: req.params.ip } });
    }
    res.send(`successfully elevated ${req.params.ip}`);
});

server.get('/ip', (req, res) => {
    res.send(getIp(req));
});

server.get('/403', (req, res) => {
    http403(res);
});

function start() {
    server.listen(3001, () => {
        console.log(`server listening on port 3001`);
    });
}

export { start };