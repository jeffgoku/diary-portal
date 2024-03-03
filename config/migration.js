const utility = require('./utility')

async function checkMigration()
{
    await utility.createTagsTables()
}

module.exports = {
    checkMigration
}