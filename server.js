import express from 'express';
import Mustache from 'mustache';
import fs from 'fs';
import { sequelize as db, Models } from './database.js';

const server = express();
const version = '1';

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

server.get('/', (req, res) => {
    res.send(Mustache.render(fs.readFileSync('./templates/index.html', 'utf-8'), {
        version: version,
        developer: 'darksunlight',
    })); // will fix later
});

server.get('/dashboard', async (req, res) => {
    const messages = await Models.Statistics.findOne({ where: { key: 'messages' } });
    if (!messages) return res.send('please finish setting up MSHARP first');
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
    res.send(Mustache.render(fs.readFileSync('./templates/add-sample.html', 'utf-8'), {
        version: version,
    }));
});

server.get('/samples/view/:id', async (req, res) => {
    const sample = await Models.Sample.findOne({ where: { id: req.params.id } });
    if (!sample) {
        res.status(404);
        return res.send('No sample with the requested ID exists.');
    }
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

server.get('/setup', async (req, res) => {
    if (!(await isElevated(req))) {
        res.status(403);
        return res.send('You are not authorised to view this page.');
    }
    const messages = await Models.Statistics.findOne({ where: { key: 'messages' } });
    if (!!messages) {
        res.status(410);
        return res.send('410 Gone');
    }
    await Models.Statistics.create({
        key: 'messages',
        value: 0,
    });
    res.send('h');
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