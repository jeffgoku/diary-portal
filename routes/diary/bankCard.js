const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')

router.get('/', (req, res, next) => {
    // 2. 查询出日记结果
    utility.knex('diaries').select().where('title', '我的银行卡列表').andWhere('uid', req.user.uid) // 固定 '银行卡列表' 为标题的日记作为存储银行卡列表
        .then(dataDiary => {
            if (dataDiary) {
                // decode unicode
                dataDiary.title = utility.unicodeDecode(dataDiary.title || '')
                dataDiary.content = utility.unicodeDecode(dataDiary.content || '')

                // 记录最后访问时间
                utility.updateUserLastLoginTime(req.user.uid)
                res.send(new ResponseSuccess(dataDiary.content))
            } else {
                res.send(new ResponseSuccess('', '未保存任何银行卡信息'))
            }
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
})


module.exports = router
