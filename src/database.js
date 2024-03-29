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
class AccessControl extends Model {}

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
    filename: {
        type: DataTypes.TEXT,
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
    timestamps: false,
});

Sample.belongsToMany(Webhook, { through: SampleWebhooks });
Webhook.belongsToMany(Sample, { through: SampleWebhooks });

Channel.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
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
    },
    public: {
        type: DataTypes.BOOLEAN,
    },
    name: {
        type: DataTypes.TEXT,
    },
    description: {
        type: DataTypes.TEXT,
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
    type: {
        type: DataTypes.INTEGER, // 0 - plaintext / 1 - embed
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
    timestamps: false,
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

AccessControl.init({
    ip: {
        type: DataTypes.STRING(45),
        primaryKey: true,
        unique: true,
    },
    range: {
        type: DataTypes.SMALLINT,
        validate: {
            max: 128,
            min: 0,
        },
    },
    level: {
        type: DataTypes.INTEGER, // 0 - default / 1 - blacklisted / 2 - whitelisted / 3 - elevated
        defaultValue: 0,
    },
}, {
    sequelize,
    modelName: 'accessControl',
});

if(!(await Statistics.findOne({ where: { key: 'messages' } }))){
    await Statistics.create({
        key: 'messages',
        value: 0,
    });
}

const Models = { AccessControl, Channel, Format, Guild, Sample, Statistics, Webhook };

export { sequelize, Models };