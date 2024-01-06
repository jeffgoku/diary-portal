const express = require('express')
const configProject = require('../../config/configProject')
const utility = require("../../config/utility");
const ResponseSuccess = require("../../response/ResponseSuccess");
const ResponseError = require("../../response/ResponseError");
const router = express.Router()
const crypto = require('crypto')


const TABLE_NAME = 'invitations'
router.get('/list', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let query;
            if (userInfo.email === configProject.adminCount ) { //
                query = utility.knex(TABLE_NAME).select().whereNull('binding_uid').orderBy('date_create', 'desc')
            } else {
                query = utility.knex(TABLE_NAME).select().whereNull('binding_uid').andWhere('is_shared', 0).orderBy('date_create', 'desc')
            }
            query
                .then(data => {
                    utility.updateUserLastLoginTime(userInfo.uid)
                    res.send(new ResponseSuccess(data, '请求成功'))
                })
                .catch(err => {
                    res.send(new ResponseError(err, err.message))
                })
        })
        .catch(verified => {
            let sqlArray = []
            // 获取未分享的可用邀请码
            utility.knex(TABLE_NAME).whereNull('binding_uid').andWhere('is_shared', 0).orderBy('date_create', 'desc')
                .then(data => {
                    res.send(new ResponseSuccess(data, '请求成功'))
                })
                .catch(err => {
                    res.send(new ResponseError(err, err.message))
                })
        })
})

router.post('/generate', (req, res, next) => {
    utility.verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.email === configProject.adminCount){ // admin
                let timeNow = utility.dateFormatter(new Date())
                crypto.randomBytes(12, (err, buffer) => {
                    let key = buffer.toString('base64')
                    utility.knex(TABLE_NAME).insert({date_create: timeNow, id: key})
                        .then(data => {
                            res.send(new ResponseSuccess(key, '邀请码生成成功'))
                        })
                        .catch(err => {
                            res.send(new ResponseError(err, '邀请码生成失败'))
                        })
                })
            } else {
                res.send(new ResponseError('', '无权限操作'))
            }
        })
        .catch(err => {
            res.send(new ResponseError(err, err))
        })
})

// 标记邀请码为已分享状态
router.post('/mark-shared', (req, res, next) => {
    utility.verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.email === configProject.adminCount){ // admin
                utility.knex(TABLE_NAME).update({'is_shared': 1}).where('id', req.body.id)
                    .then(data => {
                        res.send(new ResponseSuccess('', '邀请码标记成功'))
                    })
                    .catch(err => {
                        res.send(new ResponseError(err, '邀请码标记失败'))
                    })
            } else {
                res.send(new ResponseError('', '无权限操作'))
            }
        })
        .catch(err => {
            res.send(new ResponseError(err, err))
        })
})

router.delete('/delete', (req, res, next) => {
    if (!req.query.id){
        res.send(new ResponseError('', '参数错误，缺少 id'))
        return
    }
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.email === configProject.adminCount){
                utility.knex(TABLE_NAME).del().where('id', req.query.id)
                    .then(data => {
                        if (data.affectedRows > 0) {
                            utility.updateUserLastLoginTime(req.body.email)
                            res.send(new ResponseSuccess('', '删除成功'))
                        } else {
                            res.send(new ResponseError('', '删除失败'))
                        }
                    })
                    .catch(err => {
                        res.send(new ResponseError(err,))
                    })
            } else {
                res.send(new ResponseError('', '无权操作'))
            }
        })
        .catch(err => {
            res.send(new ResponseError(err, '无权操作'))
        })
})


module.exports = router
