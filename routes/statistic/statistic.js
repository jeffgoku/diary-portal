const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require("../../response/ResponseSuccess");
const ResponseError = require("../../response/ResponseError");
const configProject = require("../../config/configProject")

// 统计数据，后台用的
router.get('/', (req, res, next) => {
    let query;
    if (req.user.group_id == 1) {
        query = utility.knex().select(utility.knex("diaries").select().count().as('count_diary')
            , utility.knex('users').select().count().as('count_user')
            , utility.knex('diary_category').select().count().as('count_category')
            , utility.knex('diaries').select().count().where('category', 'bill').as('count_bill')
        )
    } else {
        query = utility.knex().select(utility.knex("diaries").select().where('uid', req.user.uid).count().as('count_diary')
            , utility.knex('users').select().where('uid', req.user.uid).count().as('count_user')
            , utility.knex('diary_category').select().count().as('count_category')
            , utility.knex('diaries').select().count().where('uid', req.user.uid).andWhere('category', 'bill').as('count_bill')
        )
    }
    query.then(data => {
            res.send(new ResponseSuccess(data[0]))
        })
        .catch(errInfo => {
            console.log(errInfo);
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

// 日记类别数据
router.get('/category', (req, res, next) => {
    // 1. get categories list
    utility.knex('diary_category').select().orderBy('sort_id')
        .then(categoryListData => {
            if (categoryListData) {
                // categoryListData = [{"id": 1, "name_en": "life", "name": "生活", "count": 0, "color": "#FF9500", "date_init": "2022-03-23T13:23:02.000Z"}]
                let tempArray = categoryListData.map(item => {
                    return `count(case when category='${item.name_en}' then 1 end) as ${item.name_en}`
                })

                let select = `${tempArray.join(', ')}, count(case when is_public='1' then 1 end) as shared, count(*) as amount`;

                utility.knex('diaries').select(utility.knex.raw(select)).where('uid', req.user.uid)
                    .then(data => {
                        res.send(new ResponseSuccess(data[0]))
                    })
                    .catch(errInfo => {
                        console.log(errInfo);
                        res.send(new ResponseError(errInfo.message, 'error'))
                    })
            } else {
                res.send(new ResponseError('', '类别列表查询出错'))
            }
        })
        .catch(errInfo => {
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

// 年份月份数据
router.get('/year', (req, res, next) => {
     let query = utility.knex('diaries').select(utility.knex.raw(`${utility.ym_func} as ym, count(*) as count`))
         .where('uid', req.user.uid).groupBy('ym').orderBy('ym')

     //console.log(query.toString())

     query
         .then(months => {
             let response = []
             let yearData = []
             if (months.length == 0)
             {
                 res.send(new ResponseSuccess([]));
                 return;
             }
             let curYear = months[0].ym.substr(0, 4)
             months.forEach(month => {
                 let year = month.ym.substr(0,4)
                 if(curYear != year)
                 {
                     if(yearData.length > 0)
                     {
                         response.push({
                             year: curYear,
                             count: yearData.map(item => item.count).reduce((a, b) => a + b),
                             months: yearData
                         })
                         yearData = []
                     }
                     curYear = year
                 }
                 month.id = month.ym;
                 month.month = month.ym.substr(4)

                 delete(month.ym);
                 yearData.push(month);
             })
             if(yearData.length > 0)
             {
                 response.push({
                     year: curYear,
                     count: yearData.map(item => item.count).reduce((a, b) => a + b),
                     months: yearData
                 })
             }
             res.send(new ResponseSuccess(response))
         })
         .catch(err => {
            console.log(err);
            res.send(new ResponseError(err.message, 'error'))
         })
})

// 用户统计信息
router.get('/users', (req, res, next) => {
    utility.knex('users').select('uid','last_visit_time', 'nickname', 'register_time', 'count_diary', 'sync_count')
        .where('count_diary', '>', 5).orWhere('sync_count', '>=', 5)
        .then(data => {
            res.send(new ResponseSuccess(data))
        })
        .catch(err => {
            console.log(err);
            res.send(new ResponseError(err.message, 'error'))
        })
})

// 气温统计
router.get('/weather', (req, res, next) => {
    utility.knex('diaries').select('temperature','temperature_outside', 'date').where('category', 'life').andWhere('uid', req.user.uid)
        .then(weatherData => {
            res.send(new ResponseSuccess(weatherData, '请求成功'))
        })
        .catch(err => {
            console.log(err)
            res.send(new ResponseError(err.message, '数据库请求错误'))
        })
})

module.exports = router
