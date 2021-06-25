import express from 'express';
import Mustache from 'mustache';
import fs from 'fs';
import { sequelize as db, Models } from './database.js';

const server = express();
const version = '1';
const statuses = ['Queued for analysis', 'Pending review', 'Analysed', 'Webhook(s) active', 'Rejected'];

const ip = req => {
    return req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
};

const isInternalIp = req => {
    return ['::1', '127.0.0.1'].includes(ip(req));
};

async function isElevated(req) {
    const accessControlRecord = await Models.AccessControl.findOne({ where: { ip: ip(req) } });
    if (!accessControlRecord) return false;
    if (accessControlRecord.get('level') === 3) return true;
    return false;
}

server.use(express.urlencoded({ extended: true }));

server.get('/', (req, res) => {
    res.send(Mustache.render(fs.readFileSync('./templates/index.html', 'utf-8'), {
        version: version,
        developer: 'darksunlight',
    })); // will fix later
});

server.get('/dashboard', async (req, res) => {
    const messages = await Models.Statistics.findOne({ where: { key: 'messages' } });
    if (!messages) {
        res.status(500);
        return res.send('something went wrong: database is not set up properly');
    }
    const webhooks = (await Models.Webhook.findAndCountAll()).count;
    const channels = (await Models.Channel.findAndCountAll()).count;
    const guilds = (await Models.Guild.findAndCountAll()).count;
    const samples = (await Models.Sample.findAndCountAll()).count;
    res.send(Mustache.render(fs.readFileSync('./templates/dashboard.html', 'utf-8'), {
        version: version,
        count: {
            message: messages.get('value'),
            webhook: webhooks,
            channel: channels,
            guild: guilds,
            samples: samples,
        }
    }));
});

server.get('/samples/add', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send({ code: 403, desc: 'You are not authorised to view this page.'});
    }
    res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), {
        version: version,
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
        alertDisplay: 'none',
        selectedDefault: 'selected ',
    }));
});

server.post('/samples/add', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send({ code: 403, desc: 'You are not authorised to view this page.'});
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
        return res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), {
            version: version,
            action: 'Add',
            action_lc: 'add',
            actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
            alert: `\n                    Failed to add sample: ${e.name}\n                `,
            alertClass: ' alert-danger',
            alertDisplay: 'inherit',
            selectedDefault: 'selected ',
        }));
    }
    res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), {
        version: version,
        action: 'Add',
        action_lc: 'add',
        actionDesc: 'Use the following form to add a sample manually. Or alternatively, <a href="/samples/upload">upload a sample</a>.',
        alert: `\n                    Sample added successfully. <a href="/samples/view/${id}">Click to view</a>\n                `,
        alertClass: ' alert-success',
        alertDisplay: 'inherit',
        selectedDefault: 'selected ',
    }));
});

server.get('/samples/view/:id', async (req, res) => {
    const sample = await Models.Sample.findOne({ where: { id: req.params.id } });
    if (!sample) {
        res.status(404);
        return res.send('No sample with the requested ID exists.');
    }
    res.send(Mustache.render(fs.readFileSync('./templates/view-sample.html', 'utf-8'), {
        version: version,
        id: req.params.id,
        filename: sample.get('filename'),
        hash: sample.get('hash'),
        desc: sample.get('description'),
        status: statuses[sample.get('status')],
    }));
});

server.get('/samples/delete/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send('You are not authorised to view this page.');
    }
    const sample = await Models.Sample.findOne({ where: { id: req.params.id } });
    if (!sample) {
        res.status(404);
        return res.send('No sample with the requested ID exists.');
    }
    res.send(Mustache.render(fs.readFileSync('./templates/delete-sample.html', 'utf-8'), {
        version: version,
        id: req.params.id,
    }));
});

server.get('/samples/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send('You are not authorised to view this page.');
    }
    const sample = await Models.Sample.findOne({ where: { id: req.params.id } });
    if (!sample) {
        res.status(404);
        return res.send('No sample with the requested ID exists.');
    }
    const eview = {
        version: version,
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `return to <a href="/samples/view/${req.params.id}">view</a>`,
        alertDisplay: 'none',
        desc: sample.get('description'),
        filename: sample.get('filename'),
        hash: ` disabled value="${sample.get('hash')}"`,
    };
    eview[`selected${sample.get('status')}`] = `selected `;
    res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), eview));
});

server.post('/samples/edit/:id', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send('You are not authorised to view this page.');
    }
    const sample = await Models.Sample.findOne({ where: { id: req.params.id } });
    if (!sample) {
        res.status(404);
        return res.send('No sample with the requested ID exists.');
    }
    try {
        const sample = await Models.Sample.update({
            filename: req.body.filename,
            description: req.body.desc,
            status: parseInt(req.body.status),
        }, { where: { id: req.params.id } });
    } catch (e) {
        const eview = {
            version: version,
            id: ` ${req.params.id}`,
            action: 'Edit',
            action_lc: `edit/${req.params.id}`,
            actionDesc: `return to <a href="/samples/view/${req.params.id}">view</a>`,
            alert: `\n                    Failed to edit sample: ${e.name}\n                `,
            alertClass: ' alert-danger',
            alertDisplay: 'inherit',
            desc: sample.get('description'),
            filename: sample.get('filename'),
            hash: ` disabled value="${sample.get('hash')}"`,
        };
        return res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), eview));
    }
    const eview = {
        version: version,
        id: ` ${req.params.id}`,
        action: 'Edit',
        action_lc: `edit/${req.params.id}`,
        actionDesc: `return to <a href="/samples/view/${req.params.id}">view</a>`,
        alert: `\n                    Sample edited successfully. <a href="/samples/view/${req.params.id}">Click to view</a>\n                `,
        alertClass: ' alert-success',
        alertDisplay: 'inherit',
        desc: req.body.desc,
        filename: req.body.filename,
        hash: ` disabled value="${sample.get('hash')}"`,
    };
    eview[`selected${req.body.status}`] = `selected `;
    res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), eview));
});

server.get('/api/internal', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send({ code: 403, desc: 'You are not authorised to view this page.'});
    }
    res.send('h');
});

server.get('/api/internal/elevate-ip/:ip', async (req, res) => {
    if (!isInternalIp(req)) {
        res.status(403);
        return res.send('no u');
    }
    const ipRow = await Models.AccessControl.findOne({ where: { ip: req.params.ip } });
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
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    res.send(ip);
});

function start() {
    server.listen(3001, () => {
        console.log(`server listening on port 3001`);
    });
}

export { start };