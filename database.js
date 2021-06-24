import Sequelize from 'sequelize';
const sequelize = new Sequelize('database', null, null, {
	dialect: 'sqlite',
	logging: false,
	storage: './database.sqlite',
});

const Model = Sequelize.Model;
const DataTypes = Sequelize.DataTypes;

class Sample extends Model {}
class Webhook extends Model {}
class SampleWebhooks extends Model {}
class Channel extends Model {}
class Guild extends Model {}
class Format extends Model {}
class WebhookFormats extends Model {}
class Statistics extends Model {}

Sample.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
	hash: {
		type: DataTypes.STRING(64),
		unique: true,
	},
	description: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.INTEGER,
    }
}, {
    sequelize,
    modelName: 'sample',
});

Webhook.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        validate: {
            is: ['\d+'],
        },
    },
    token: {
        type: DataTypes.TEXT,
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
}, {
    sequelize,
    modelName: 'webhook',
});

SampleWebhooks.init({
    sampleId: {
        type: DataTypes.INTEGER,
        references: {
            model: Sample,
            key: 'id',
        },
    },
    webhookId: {
        type: DataTypes.STRING,
        references: {
            model: Webhook,
            key: 'id',
        },
    },
}, {
    sequelize,
    modelName: 'sampleWebhooks',
});

Sample.belongsToMany(Webhook, { through: SampleWebhooks });
Webhook.belongsToMany(Sample, { through: SampleWebhooks });

Channel.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
        validate: {
            is: ['\d+'],
        },
    },
}, {
    sequelize,
    modelName: 'channel',
});

Channel.hasMany(Webhook, { as: 'webhooks' });
Webhook.belongsTo(Channel, {
    foreignKey: 'channelId',
    as: 'channel',
});

Guild.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
        validate: {
            is: ['\d+'],
        },
    },
}, {
    sequelize,
    modelName: 'guild',
});

Guild.hasMany(Webhook, { as: 'webhooks' });
Webhook.belongsTo(Guild, {
    foreignKey: 'guildId',
    as: 'guild',
});

Guild.hasMany(Channel, { as: 'channels' });
Channel.belongsTo(Guild, {
    foreignKey: 'guildId',
    as: 'guild',
});

Format.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    value: {
        type: DataTypes.TEXT,
    },
}, {
    sequelize,
    modelName: 'format',
});

WebhookFormats.init({
    webhookId: {
        type: DataTypes.STRING,
        references: {
            model: Webhook,
            key: 'id',
        },
    },
    formatId: {
        type: DataTypes.INTEGER,
        references: {
            model: Format,
            key: 'id',
        },
    },
}, {
    sequelize,
    modelName: 'format',
});

Format.belongsToMany(Webhook, { through: WebhookFormats });
Webhook.belongsToMany(Format, { through: WebhookFormats });

Statistics.init({
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
    },
    value: {
        type: DataTypes.INTEGER,
    },
    text: {
        type: DataTypes.TEXT,
    },
}, {
    sequelize,
    modelName: 'statistics',
});

const Models = { Channel, Format, Guild, Sample, Statistics, Webhook };

export { sequelize, Models };