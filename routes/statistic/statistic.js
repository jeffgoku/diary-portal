const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require("../../response/ResponseSuccess");
const ResponseError = require("../../response/ResponseError");
const configProject = require("../../config/configProject")

// 统计数据，后台用的
router.get('/', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let query;
            if (userInfo.group_id === 1) {
                query = utility.knex().select(utility.knex("diaries").select().count().as('count_diary')
                    , utility.knex('users').select().count().as('count_user')
                    , utility.knex('diary_category').select().count().as('count_category')
                    , utility.knex('diaries').select().count().where('category', 'bill').as('count_bill')
                )
            } else {
                query = utility.knex().select(utility.knex("diaries").select().where('uid', userInfo.uid).count().as('count_diary')
                    , utility.knex('users').select().where('uid', userInfo.uid).count().as('count_user')
                    , utility.knex('diary_category').select().count().as('count_category')
                    , utility.knex('diaries').select().count().where('uid', userInfo.uid).andWhere('category', 'bill').as('count_bill')
                )
            }
            query.then(data => {
                    res.send(new ResponseSuccess(data))
                })
                .catch(err => {
                    res.send(new ResponseError('', err.message))
                })
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})

// 日记类别数据
router.get('/category', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            // 1. get categories list
            utility.knex('diary_category').select().orderBy('sort_id')
                .then(categoryListData => {
                    if (categoryListData) {
                        // categoryListData = [{"id": 1, "name_en": "life", "name": "生活", "count": 0, "color": "#FF9500", "date_init": "2022-03-23T13:23:02.000Z"}]
                        let tempArray = categoryListData.map(item => {
                            return `count(case when category='${item.name_en}' then 1 end) as ${item.name_en}`
                        })

                        let select = `${tempArray.join(', ')}, count(case when is_public='1' then 1 end) as shared, count(*) as amount`;

                        utility.knex('diaries').select(utility.knex.raw(select)).where('uid', userInfo.uid)
                            .then(data => {
                                res.send(new ResponseSuccess(data))
                            })
                            .catch(err => {
                                res.send(new ResponseError(err))
                            })
                    } else {
                        res.send(new ResponseError('', '类别列表查询出错'))
                    }
                })
                .catch(err => {
                    res.send(new ResponseError(err,))
                })
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})

// 年份月份数据
router.get('/year', (req, res, next) => {
    /*
    utility
     .verifyAuthorization(req)
     .then(userinfo => {
         let yearnow = new date().getfullyear()
         let sqlrequests = []
         for (let year = 1991; year <= yearnow; year++) {
             let sqlarray = []
             sqlarray.push(`
             select
             date_format(date,'%y%m') as id,
             date_format(date,'%m') as month,
             count(*) as 'count'
             from diaries
             where year(date) = ${year}
             and uid = ${userinfo.uid}
             group by month
             order by month desc
     `)
             sqlrequests.push(utility.getdatafromdb('diary', sqlarray))
         }
         // 这里有个异步运算的弊端，所有结果返回之后，我需要重新给他们排序，因为他们的返回顺序是不定的。难搞哦
         promise.all(sqlrequests)
             .then(values => {
                 let response = []
                 values.foreach(data => {
                     if (data.length > 0) { // 只统计有数据的年份
                         response.push({
                             year: data[0].id.substring(0, 4),
                             count: data.map(item => item.count).reduce((a, b) => a + b),
                             months: data
                         })
                     }
                 })
                 response.sort((a, b) => a.year > b.year ? 1 : -1)
                 res.send(new ResponseSuccess(response))
             })
             .catch(err => {
                 res.send(new ResponseError(err, err.message))
             })
     })
     .catch(errinfo => {
         res.send(new ResponseError('', errinfo))
     })
     */

    res.send(new ResponseSuccess([{year:'2023', count:0, months:[]}]))
})

// 用户统计信息
router.get('/users', (req, res, next) => {
    utility
    .verifyAuthorization(req)
    .then(userInfo => {
        utility.knex('users').select('uid','last_visit_time', 'nickname', 'register_time', 'count_diary', 'count_dict', 'count_map_route', 'sync_count')
            .where('count_diary', '>', 5).orWhere('sync_count', '>=', 5)
            .then(data => {
                res.send(new ResponseSuccess(data))
            })
            .catch(err => {
                res.send(new ResponseError(err, err.message))
            })
    })
    .catch(errInfo => {
        res.send(new ResponseError('', errInfo))
    })
})

// 气温统计
router.get('/weather', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex('diaries').select('temperature','temperature_outside', 'date').where('category', 'life').andWhere('uid', userInfo.uid)
                .then(weatherData => {
                    res.send(new ResponseSuccess(weatherData, '请求成功'))
                })
                .catch(err => {
                    res.send(new ResponseError(err, '数据库请求错误'))
                })
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })

})

module.exports = router
