const utility = require('./utility')

async function checkMigration()
{
    let exists = await utility.knex.schema.hasTable('tags')
    if(!exists)
    {
        await utility.createTagsTables()
    }
}

module.exports = {
    checkMigration
}