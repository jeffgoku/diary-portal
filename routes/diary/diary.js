const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')

router.get('/list', (req, res) => {
    let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 日记起点

    let query = utility.knex('diaries').select('diaries.*').where('uid', req.user.uid)

    // keywords
    if (req.query.keywords){
        let keywords = JSON.parse(req.query.keywords).map(item => utility.unicodeEncode(item))
        if (keywords.length > 0){
            for(const keyword of keywords)
            {
                if(keyword.length == 0)
                {
                    continue;
                }
                query = query.andWhere(builder => {
                    builder.whereLike('title', `%${keyword}%`).orWhereLike('content', `%${keyword}%`)
                });
            }
        }
    }

    // categories
    if (req.query.categories){
        let categories = JSON.parse(req.query.categories)
        if (categories.length > 0) {
            query = query.andWhere(builder => {
                builder.whereIn('category', categories)
            })
        }
    }

    // share
    if (req.query.filterShared === '1'){
        query = query.andWhere('is_public', 1)
    }

    // date range
    if (req.query.dateFilter){
        let year = req.query.dateFilter.substring(0,4)
        let month = req.query.dateFilter.substring(4,6)
        query = query.andWhereRaw(`${utility.y_func}='${year}' AND ${utility.m_func}='${month}'`)
    }

    if (req.query.tag) {
        query.join('diary_tags', 'diaries.id', 'diary_tags.diary_id').where('diary_tags.tag_id', parseInt(req.query.tag))
    }

    query.orderBy('date', 'desc').offset(startPoint).limit(req.query.pageSize)

    //console.log(query.toString())

    query.then(data => {
        utility.updateUserLastLoginTime(req.user.uid)
        data.forEach(diary => {
            // decode unicode
            diary.title = utility.unicodeDecode(diary.title)
            diary.content = utility.unicodeDecode(diary.content)
            // 处理账单数据
            if (diary.category === 'bill'){
                diary.billData = utility.processBillOfDay(diary, [])
            }
        })
        res.send(new ResponseSuccess(data, '请求成功'))
    })
    .catch(err => {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    })
})

router.get('/export', (req, res) => {
    utility.knex('diaries').where('uid', req.user.uid)
        .then(data => {
            utility.updateUserLastLoginTime(req.user.uid)
            data.forEach(diary => {
                // decode unicode
                diary.title = utility.unicodeDecode(diary.title)
                diary.content = utility.unicodeDecode(diary.content)
                // 处理账单数据
                if (diary.category === 'bill'){
                    diary.billData = utility.processBillOfDay(diary, [])
                }
            })
            res.send(new ResponseSuccess(data, '请求成功'))
        })
        .catch(err => {
            console.log(err);
            res.send(new ResponseError(null, 'fatal error'))
        })
})



router.get('/temperature', (req, res) => {
    let query = utility.knex('diaries').select('date', 'temperature', 'temperature_outside')
        .where('uid', req.user.uid).andWhere('category','life')
        .orderBy('date', 'desc').limit(100)

    // date range
    if (req.query.dateFilter){
        let year = req.query.dateFilter.substring(0,4)
        let month = req.query.dateFilter.substring(4,6)
        query = query.andWhereRaw(`YEAR(date)='${year}' AND MONTH(date)='${month}`)
    }
    query.then(data => {
        utility.updateUserLastLoginTime(req.user.uid)
        data.forEach(diary => {
            // decode unicode
            diary.title = utility.unicodeDecode(diary.title)
            diary.content = utility.unicodeDecode(diary.content)
        })
        res.send(new ResponseSuccess(data, '请求成功'))
    })
    .catch(err => {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    })
})

router.get('/detail', (req, res) => {
    // 1. 先查询出日记结果
    utility.knex('diaries').select().where('id', req.query.diaryId)
        .then(dataDiary => {
            if (dataDiary.length == 0)
            {
                res.send(new ResponseError('no diary for id', 'error'))
                return;
            }
            dataDiary = dataDiary[0]
            // decode unicode
            dataDiary.title = utility.unicodeDecode(dataDiary.title)
            dataDiary.content = utility.unicodeDecode(dataDiary.content)

            // 2. 判断是否为共享日记
            if (dataDiary.is_public === 1){
                // 2.1 如果是，直接返回结果，不需要判断任何东西
                let diaryOwnerId = dataDiary.uid
                utility.knex('users').select().where('uid', diaryOwnerId)
                    .then(userData => {
                        userData = userData[0]
                        dataDiary.nickname = userData.nickname
                        dataDiary.username = userData.username
                        res.send(new ResponseSuccess(dataDiary))
                    })
            } else {
                // 2.2 如果不是，需要判断：当前 email 和 token 是否吻合
                // 3. 判断日记是否属于当前请求用户
                if (req.user.uid === dataDiary.uid){
                    // 记录最后访问时间
                    utility.updateUserLastLoginTime(req.user.uid)
                    res.send(new ResponseSuccess(dataDiary))
                } else {
                    // console.log(`uid = ${req.user.uid}, diary uid = ${dataDiary.uid}`)
                    res.send(new ResponseError('','无权查看该日记：请求用户 ID 与日记归属不匹配'))
                }
            }
        })
        .catch(err => {
            console.log(err);
            res.send(new ResponseError(null,'fatal error'))
        })
})

router.post('/add', (req, res) => {
    // 1. 验证用户信息是否正确
    let parsedTitle = utility.unicodeEncode(req.body.title) // !
    parsedTitle = parsedTitle.replaceAll(`'`, `''`)
    let parsedContent = utility.unicodeEncode(req.body.content) || ''
    parsedContent = parsedContent.replaceAll(`'`, `''`)
    let timeNow = utility.dateFormatter(new Date())

    let newDiary = {
        title: parsedTitle,
        content: parsedContent,
        category: req.body.category,
        weather: req.body.weather,
        temperature: req.body.temperature || 18,
        temperature_outside: req.body.temperature_outside || 18,
        date_create: timeNow,
        date_modify: timeNow,
        date: req.body.date,
        uid: req.user.uid,
        is_public: req.body.is_public||0,
        is_markdown: req.body.is_markdown || 0,
        is_encrypted: req.body.is_encrypted || 0,
    }

    utility.knex.transaction(async (tx) => {
        let id = await tx.insert(newDiary).into('diaries').returning('id')
        if (typeof id[0] == 'number')
        {
            id = id[0]
        }
        else
        {
            id = id[0].id
        }

        if (req.body.tags.length > 0) {
            let timeNow = utility.dateFormatter(new Date())
            await tx.insert(req.body.tags.map(tid=>{
                return {diary_id: id, tag_id: tid, date_create: timeNow}
            })).into('diary_tags')

            await tx.table('tags').increment('count', 1).whereIn('id', req.body.tags)
        }

        await tx.table('users').increment('count_diary', 1).where('uid', req.user.uid)

        return id
    })
    .then(id => {
        utility.updateUserLastLoginTime(req.user.uid)

        newDiary.id = id
        let ret = {id}
        if(req.body.category == 'bill')
        {
            ret.billData = utility.processBillOfDay(newDiary, [])
        }
        res.send(new ResponseSuccess(ret, '添加成功')) // 添加成功之后，返回添加后的日记 id
    })
    .catch(err => {
        console.log(err)
        res.send(new ResponseError(null, 'fatal error'))
    })
})

router.put('/modify', (req, res) => {
    let parsedTitle = utility.unicodeEncode(req.body.title) // !
    parsedTitle = parsedTitle.replaceAll(`'`, `''`)
    let parsedContent = utility.unicodeEncode(req.body.content) || ''
    parsedContent = parsedContent.replaceAll(`'`, `''`)
    let timeNow = utility.dateFormatter(new Date())

    let diary = {
        date_modify: timeNow,
        date: req.body.date,
        category: req.body.category,
        title: parsedTitle,
        content: parsedContent,
        weather: req.body.weather,
        temperature: req.body.temperature,
        temperature_outside: req.body.temperature_outside,
        is_public: req.body.is_public,
        is_markdown: req.body.is_markdown,
        is_encrypted: req.body.is_encrypted,
    }

    utility.knex.transaction(async tx => {
        await tx.update(diary).table('diaries').where('id', req.body.id).andWhere('uid', req.user.uid)

        if (req.body.new_tags?.length > 0) {
            let timeNow = utility.dateFormatter(new Date())
            await tx.table('diary_tags').insert(req.body.new_tags.map(t => ({diary_id: req.body.id, tag_id: t, date_create: timeNow})))
            await tx.table('tags').increment('count', 1).whereIn('id', req.body.new_tags)
        }
        if (req.body.del_tags?.length > 0) {
            await tx.table('diary_tags').del().where('diary_id', req.body.id).whereIn('tag_id', req.body.del_tags)
            await tx.table('tags').decrement('count', 1).whereIn('id', req.body.del_tags)
        }

        let ret = ''
        if(diary.category == 'bill')
        {
            diary.id = req.body.id
            ret = utility.processBillOfDay(diary, [])
        }
        utility.updateUserLastLoginTime(req.user.uid)
        res.send(new ResponseSuccess(ret, '修改成功'))
    })
    .catch(err => {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    })
})

router.delete('/delete', (req, res) => {
    utility.knex.transaction(async tx => {
        let affectedRows = await tx.del().table('diaries').where('id', req.body.diaryId).andWhere('uid', req.user.uid)
        if (affectedRows > 0) {
            await tx.table('users').decrement('count_diary', 1).where('uid', req.user.uid)
            await tx.table('diary_tags').del().where('diary_id', req.body.diaryId)
        }

        return affectedRows
    })
    .then(affectedRows => {
        utility.updateUserLastLoginTime(req.user.uid)
        if (affectedRows > 0) {
            res.send(new ResponseSuccess('', '删除成功'))
        } else {
            res.send(new ResponseError('', '删除失败'))
        }
    })
    .catch(err => {
        console.log(err)
        res.send(new ResponseError(null,'fatal error'))
    })
})

router.post('/clear', async (req, res) => {
    if (req.user.email === 'test@163.com'){
        res.send(new ResponseError('', '演示帐户不允许执行此操作'))
        return
    }
    try{
        let affectedRows = await utility.knex('diaries').del().where('uid', req.user.uid)
        utility.updateUserLastLoginTime(req.user.uid)
        res.send(new ResponseSuccess({affectedRows}, `清空成功：${affectedRows} 条日记`))
    }
    catch(err) {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    }
})


router.get('/tags', async (req, res) => {
    try
    {
        // const tags = await utility.knex('tags').select(['id', 'name']).join('diary_tags', 'diary_tags.tag_id', 'tags.id').where('diary_tags.diary_id', req.query.diaryId)
        const tags = await utility.knex('diary_tags').select(utility.knex.raw('tag_id as id')).where('diary_id', req.query.diaryId)
        res.send(new ResponseSuccess(tags.map(t => t.id)))
    }
    catch(err)
    {
        console.error(err)
        res.send(new ResponseError(null, 'fatal error'))
    }
})

module.exports = router
