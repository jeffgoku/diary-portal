const { createTagsTables, knex, dateFormatter } = require('./utility')

async function createMigrationTable()
{
    let exists = await knex.schema.hasTable('migration')
    if (!exists)
    {
        await knex.schema.createTable('migration', function (table) {
            table.primary().increments('id')
            table.datetime('date_create').notNullable().comment('date create time')
            table.datetime('last_migration_date').notNullable()
            table.integer('version')
        });

        let timeNow = dateFormatter(new Date())
        await knex.table('migration').insert({date_create: timeNow, version: 0})
        console.log('create migration table')
    }
    let version = await knex.table('migration').select('version').limit(1)
    if(version[0].version == 0)
    {
        await knex.schema.alterTable('diaries', table => {
            table.smallint('is_encrypted').defaultTo(0)
        })
        let timeNow = dateFormatter(new Date())
        await knex.table('migration').update({version: 1, last_migration_date: timeNow}).where('id', 1)
    }
}

async function checkMigration()
{
    await createTagsTables()
    await createMigrationTable()
}

module.exports = {
    checkMigration
}