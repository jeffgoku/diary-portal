let fs = require('node:fs');
let process = require('node:process');

const configName = 'config/configDB';

let configFile;
switch(process.env.NODE_ENVIRONMENT)
{
    case 'debug':
        configFile = `${configName}.debug.json`;
        break;
    case 'production':
    default:
        configFile = `${configName}.production.json`;
        break;
}

if(!fs.existsSync(configFile))
{
    configFile = `${configName}.json`;
}

if(!fs.existsSync(configFile))
{
    console.log('no config file for database');
    process.exit(1);
}

let configData = fs.readFileSync(configFile, 'utf8');

config = JSON.parse(configData);

module.exports = config;
