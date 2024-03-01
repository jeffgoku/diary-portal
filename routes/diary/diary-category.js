const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')

const TABLE_NAME = 'diary_category' // 表名
const DATA_NAME = '日记类别'          // 操作的数据名

router.get('/list', async (req, res) => {
    // query.name_en
    try
    {
        const data = await utility.knex(TABLE_NAME).select().orderBy('sort_id', 'asc')
        if (data) { // 没有记录时会返回  undefined
            res.send(new ResponseSuccess(data))
        } else {
            res.send(new ResponseError('', `${DATA_NAME}查询错误`))
        }
    }
    catch(err) {
        console.error(err)
        res.send(new ResponseError(null, 'fatal error'))
    }
})

router.post('/add', (req, res) => {
    checkCategoryExist(req.body.name_en)
        .then(dataCategoryExistanceArray => {
            // email 记录是否已经存在
            if (dataCategoryExistanceArray.length > 0){
                return res.send(new ResponseError('', `${DATA_NAME}已存在`))
            } else {
                if (req.user.group_id == 1){
                    let timeNow = utility.dateFormatter(new Date())
                    utility.knex(TABLE_NAME).insert({name:req.body.name, name_en: req.body.name_en, color: req.body.color, sort_id: req.body.sort_id, date_init: timeNow}).returning('id')
                        .then(id => {
                            if (typeof id[0] == 'number')
                            {
                                id = id[0]
                            }
                            else
                            {
                                id = id[0].id
                            }
                            utility.updateUserLastLoginTime(userInfo.uid)
                            res.send(new ResponseSuccess({id: id}, '添加成功')) // 添加成功之后，返回添加后的日记 id
                        })
                        .catch(err => {
                            console.error(err)
                            res.send(new ResponseError(null, `fatal error`))
                        })
                } else {
                    res.send(new ResponseError('', '无权操作'))
                }
            }
        })

})
router.put('/modify', (req, res) => {
    if (req.user.group_id == 1 ){
        utility.knex(TABLE_NAME).update({name:req.body.name, count: req.body.count, color: req.body.color, sort_id: req.body.sort_id }).where('name_en', req.body_name_en).returning('id')
            .then(ids => {
                // ids should be an array of {id:modified_id}
                if (ids?.length > 0) { // 没有记录时会返回  undefined
                    utility.updateUserLastLoginTime(userInfo.uid)
                    res.send(new ResponseSuccess(ids[0], '修改成功')) // 添加成功之后，返回添加后的日记类别 id
                } else {
                    res.send(new ResponseError('', `${DATA_NAME}操作错误`))
                }
            })
            .catch(err => {
                console.error(err)
                res.send(new ResponseError(null, `fatal error`))
            })
    } else {
        res.send(new ResponseError('', '无权操作'))
    }
})
router.delete('/delete', (req, res) => {
    if (req.user.group_id == 1 ) {
        utility.knex(TABLE_NAME).del().where('name_en', req.body.name_en).returning('id')
            .then(ids => {
                if (ids?.length > 0) { // 没有记录时会返回  undefined
                    utility.updateUserLastLoginTime(userInfo.uid)
                    res.send(new ResponseSuccess(ids[0], '删除成功')) // 添加成功之后，返回添加后的日记类别 id
                } else {
                    res.send(new ResponseError('', '日记类别删除失败'))
                }
            })
            .catch(err => {
                console.error(err)
                res.send(new ResponseError(null, 'fatal error'))
            })
    } else {
        res.send(new ResponseError('', '无权操作'))
    }
})

// 检查类别是否存在
function checkCategoryExist(categoryName){
    return utility.knex(TABLE_NAME).where('name_en', categoryName).limit(1);
}


module.exports = router
