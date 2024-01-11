const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')

router.get('/list', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 日记起点

            let query = utility.knex('diaries').select().where('uid', userInfo.uid)

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
                        builder.where('category', categories[0])
                        for(let i = 1; i<categories.length; ++i)
                        {
                            builder.orWhere('category', categories[i])
                        }
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

            query.orderBy('date', 'desc').offset(startPoint).limit(req.query.pageSize)

            //console.log(query.toString())

            query.then(data => {
                utility.updateUserLastLoginTime(userInfo.uid)
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
                res.send(new ResponseError(err.message, 'error'))
            })
        })
        .catch(errInfo => {
            console.log(errInfo);
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

router.get('/export', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex('diaries').where('uid',userInfo.uid)
                .then(data => {
                    utility.updateUserLastLoginTime(userInfo.uid)
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
                    res.send(new ResponseError(err.message, 'error'))
                })
        })
        .catch(verified => {
            console.log(verrified);
            res.send(new ResponseError(verified.message, '无权查看日记列表：用户信息错误'))
        })
})



router.get('/temperature', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let query = utility.knex('diaries').select('date', 'temperature', 'temperature_outside')
                .where('uid', userInfo.uid).andWhere('category','life')
                .orderBy('date', 'desc').limit(100)

            // date range
            if (req.query.dateFilter){
                let year = req.query.dateFilter.substring(0,4)
                let month = req.query.dateFilter.substring(4,6)
                query = query.andWhereRaw(`YEAR(date)='${year}' AND MONTH(date)='${month}`)
            }
            query.then(data => {
                utility.updateUserLastLoginTime(userInfo.uid)
                data.forEach(diary => {
                    // decode unicode
                    diary.title = utility.unicodeDecode(diary.title)
                    diary.content = utility.unicodeDecode(diary.content)
                })
                res.send(new ResponseSuccess(data, '请求成功'))
            })
            .catch(err => {
                console.log(err);
                res.send(new ResponseError(err.message, 'error'))
            })
        })
        .catch(errInfo => {
            console.log(errInfo);
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

router.get('/detail', (req, res, next) => {
    // 1. 先查询出日记结果
    utility.knex('diaries').select().where('id', req.query.diaryId)
        .then(dataDiary => {
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
                utility
                    .verifyAuthorization(req)
                    .then(userInfo => {
                        // 3. 判断日记是否属于当前请求用户
                        if (Number(userInfo.uid) === dataDiary.uid){
                            // 记录最后访问时间
                            utility.updateUserLastLoginTime(userInfo.uid)
                            res.send(new ResponseSuccess(dataDiary))
                        } else {
                            // console.log(`uid = ${userInfo.uid}, diary uid = ${dataDiary.uid}`)
                            res.send(new ResponseError('','无权查看该日记：请求用户 ID 与日记归属不匹配'))
                        }
                    })
                    .catch(errInfo => {
                        console.log(errInfo);
                        res.send(new ResponseError(errInfo.message, 'error'))
                    })
            }
        })
        .catch(err => {
            console.log(err);
            res.send(new ResponseError(err.message,'error'))
        })
})

router.post('/add', (req, res, next) => {
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let parsedTitle = utility.unicodeEncode(req.body.title) // !
            parsedTitle = parsedTitle.replaceAll(`'`, `''`)
            let parsedContent = utility.unicodeEncode(req.body.content) || ''
            parsedContent = parsedContent.replaceAll(`'`, `''`)
            let timeNow = utility.dateFormatter(new Date())

            utility.knex('diaries').insert({title:parsedTitle, content: parsedContent, category: req.body.category, weather: req.body.weather, 
                    temperature: req.body.temperature || 18, temperature_outside: req.body.temperatureOutside || 18,
                    date_create: timeNow, date_modify: timeNow, date: req.body.date, uid: userInfo.uid, is_public: req.body.isPublic||0, is_markdown: req.body.isMarkdown || 0}).returning('id')
                .then(id => {
                    utility.knex('users').increment('count_diary', 1).where('uid', userInfo.uid).then(() => {})
                    utility.updateUserLastLoginTime(userInfo.uid)
                    if (typeof id[0] == 'number')
                    {
                        id = {id:id[0]}
                    }
                    else
                    {
                        id = id[0]
                    }
                    res.send(new ResponseSuccess(id, '添加成功')) // 添加成功之后，返回添加后的日记 id
                })
                .catch(err => {
                    console.log(err)
                    res.send(new ResponseError('error', '添加失败'))
                })
        })
        .catch(errInfo => {
            console.log(errInfo)
            res.send(new ResponseError('error', 'error'))
        })
})

router.put('/modify', (req, res, next) => {

    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let parsedTitle = utility.unicodeEncode(req.body.title) // !
            parsedTitle = parsedTitle.replaceAll(`'`, `''`)
            let parsedContent = utility.unicodeEncode(req.body.content) || ''
            parsedContent = parsedContent.replaceAll(`'`, `''`)
            let timeNow = utility.dateFormatter(new Date())
            utility.knex('diaries').update({date_modify: timeNow, date: req.body.date, category: req.body.category, title: parsedTitle, content: parsedContent, weather: req.body.weather,
                    temperature: req.body.temperature, temperature_outside: req.body.temperatureOutside, is_public: req.body.isPublic, is_markdown: req.body.isMarkdown})
                .where('id', req.body.id).andWhere('uid', userInfo.uid)
                .then(count => {
                    utility.updateUserLastLoginTime(userInfo.uid)
                    res.send(new ResponseSuccess('', '修改成功'))
                })
                .catch(err => {
                    console.log(err);
                    res.send(new ResponseError('error', '修改失败'))
                })
        })
        .catch(errInfo => {
            console.log(errInfo);
            res.send(new ResponseError('error', 'error'))
        })
})

router.delete('/delete', (req, res, next) => {
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex('diaries').del().where('id', req.body.diaryId).andWhere('uid', userInfo.uid)
                .then(affectedRows => {
                    if (affectedRows > 0) {
                        utility.knex('users').decrement('count_diary', 1).then(() => {})
                        utility.updateUserLastLoginTime(userInfo.uid)
                        res.send(new ResponseSuccess('', '删除成功'))
                    } else {
                        res.send(new ResponseError('', '删除失败'))
                    }
                })
                .catch(err => {
                    console.log(err)
                    res.send(new ResponseError('error','select user error'))
                })
        })
        .catch(errInfo => {
            console.log(errInfo)
            res.send(new ResponseError('', 'authorize user error'))
        })
})

router.post('/clear', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.email === 'test@163.com'){
                res.send(new ResponseError('', '演示帐户不允许执行此操作'))
                return
            }
            utility.knex('diaries').del().where('uid', userInfo.uid)
                .then(affectedRows => {
                    utility.updateUserLastLoginTime(userInfo.uid)
                    res.send(new ResponseSuccess({affectedRows}, `清空成功：${affectedRows} 条日记`))
                })
                .catch(err => {
                    console.log(err);
                    res.send(new ResponseError(err.message, 'error'))
                })
        })
        .catch(verified => {
            console.log(verified);
            res.send(new ResponseError(verified.message, '无权查看日记列表：用户信息错误'))
        })
})


module.exports = router
