import express from 'express';
import Mustache from 'mustache';
import fs from 'fs';
import { sequelize as db, Models } from './database.js';

const server = express();
const version = '1';

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

server.get('/setup', async (req, res) => {
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