const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')

const TABLE_NAME = 'tags'

router.get('/list', async function (req, res) {
    try
    {
        const data = await utility.knex(TABLE_NAME).select(['id', 'name', 'count']).where('uid', req.user.uid)
        if (data) {
            res.send(new ResponseSuccess(data))
        } else {
            res.send(new ResponseError('', `查询错误`))
        }
    }
    catch(err) {
        console.error(err)
        res.send(new ResponseError(null, 'fatal error'))
    }
})

router.post('/add', async function(req, res) {
    try
    {
        let timeNow = utility.dateFormatter(new Date())
        const id = await utility.knex(TABLE_NAME).insert(req.body.map(name => ({uid: req.user.uid, name, date_create: timeNow}))).returning('id')
        res.send(new ResponseSuccess(id.map(i => i.id)))
    }
    catch(err) {
        console.error(err)
        res.send(new ResponseError(null, 'fatal error'))
    }
})

router.delete('/del', async function (res, req,) {
    try
    {
        await utility.knex(TABLE_NAME).del().where('id', req.query.id)
        await utility.knex('diary_tags').del().where('tag_id', req.query.id)
    }
    catch(err) {
        console.error(err)
        res.send(new ResponseError(null, 'fatal error'))
    }
})

module.exports = router