const express = require('express')
const configProject = require('../../config/configProject')
const utility = require("../../config/utility");
const ResponseSuccess = require("../../response/ResponseSuccess");
const ResponseError = require("../../response/ResponseError");
const router = express.Router()
const bcrypt = require('bcrypt')




/* GET users listing. */
router.post('/register', (req, res, next) => {
    // TODO: 验证传过来的数据库必填项
    if (req.body.invitationCode === configProject.invitation){ // 万能全局邀请码
        registerUser(req, res)
    } else {
        utility.knex('invitations').select().where('id', req.body.invitationCode)
            .then(result => {
                result = result[0];
                if (result){
                    if (result.binding_uid){
                        res.send(new ResponseError('', '邀请码已被使用'))
                    } else {
                        registerUser(req, res)
                    }
                } else {
                    res.send(new ResponseError('', '邀请码无效'))
                }
            })
            .catch(err => {
                res.send(new ResponseError(err, '数据库请求出错'))
            })
    }
})

function registerUser(req, res){
    checkEmailOrUserNameExist(req.body.email, req.body.nickname)
        .then(dataEmailExistArray => {
            // email 记录是否已经存在
            if (dataEmailExistArray.length > 0){
                return res.send(new ResponseError('', '邮箱或用户名已被注册'))
            } else {
                let timeNow = utility.dateFormatter(new Date())
                // 明文密码通过 bcrypt 加密，对比密码也是通过  bcrypt
                bcrypt.hash(req.body.password, 10, (err, encryptPassword) => {
                    // 注册的用户默认为普通用户
                    utility.knex('users').insert({
                            email:req.body.email,
                            nickname:req.body.nickname||'',
                            username: req.body.username ||'',
                            password: encryptPassword,
                            register_time: timeNow,
                            last_visit_time: timeNow,
                            comment: req.body.comment || '',
                            wx: req.body.wx||'',
                            phone: req.body.phone||'',
                            homepage: req.body.homepage||'',
                            count_diary: 0,
                            sync_count: 0,
                            group_id:2}).returning('uid')
                        .then( uid => {
                            if (typeof uid[0] == 'number')
                            {
                                uid = uid[0];
                            }
                            else
                            {
                                uid = uid[0].uid
                            }
                            utility.knex('invitations').update({binding_uid: uid, date_register: timeNow}).where('id', req.body.invitationCode)
                                .then(resInvitation => {
                                    res.send(new ResponseSuccess('', '注册成功'))
                                })
                                .catch(err => {
                                    console.log('update invitation err : ' + err);
                                    res.send(new ResponseError(err, '注册成功，邀请码信息更新失败'))
                                })
                        })
                        .catch(err => {
                            res.send(new ResponseError(err, '注册失败'))
                        })
                })

            }
        })
        .catch(errEmailExist => {
            console.log(errEmailExist)
            res.send(new ResponseError(errEmailExist, '查询出错'))
        })
}

// 检查用户名或邮箱是否存在
function checkEmailOrUserNameExist(email, nickname){
    return utility.knex('users').select().where('email', email).orWhere('nickname', nickname).limit(1)
}

router.post('/list', (req, res, next) => {
})

router.get('/detail', (req, res, next) => {
    utility.knex('qrs').select().where('hash', req.query.hash)
        .then(data => {
            // decode unicode
            data.message = utility.unicodeDecode(data.message)
            data.description = utility.unicodeDecode(data.description)

            // 2. 判断是否为共享 QR
            if (data.is_public === 1){
                // 2.1 如果是，直接返回结果，不需要判断任何东西
                res.send(new ResponseSuccess(data))
            } else {
                // 2.2 如果不是，需要判断：当前 email 和 token 是否吻合
                utility
                    .verifyAuthorization(req)
                    .then(userInfo => {
                        // 3. 判断 QR 是否属于当前请求用户
                        if (Number(userInfo.uid) === data.uid){
                            // 记录最后访问时间
                            utility.updateUserLastLoginTime(userInfo.uid)
                            /*                            // TODO:过滤可见信息 自己看，管理员看，其它用户看
                                                        if (data.is_show_wx){
                                                            data.wx = ''
                                                        }
                                                        if (data.is_show_car){
                                                            data.car = ''
                                                            data.car_desc = ''
                                                            data.car_plate = ''
                                                        }
                                                        if (data.is_show_gaode){
                                                            data.gaode = ''
                                                        }
                                                        if (data.is_show_homepage){
                                                            data.homepage = ''
                                                        }*/
                            res.send(new ResponseSuccess(data))
                        } else {
                            res.send(new ResponseError('','当前用户无权查看该 QR ：请求用户 ID 与 QR 归属不匹配'))
                        }
                    })
                    .catch(errInfo => {
                        res.send(new ResponseError('', errInfo))
                    })
            }
        })
        .catch(err => {
            res.send(new ResponseError(err, err.message))
        })
})


router.get('/avatar', (req, res, next) => {
    utility.knex('users').select('avatar').where('email', req.query.email)
        .then(data => {
            res.send(new ResponseSuccess(data))
        })
        .catch(err => {
            res.send(new ResponseError(err, err.message))
        })
})


router.post('/add', (req, res, next) => {
})


// 设置用户资料：昵称，avatar，手机号
router.put('/set-profile', (req, res, next) => {
    res.send(new ResponseError('not implement','not implement'))
    /*
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let avatar = req.body.avatar || ''
            let sqlArray = []
            sqlArray.push(`
                update users
                set users.nickname       = '${req.body.nickname}',
                    users.phone          = '${req.body.phone}',
                    users.avatar         = '${avatar}',
                    users.city           = '${req.body.city}',
                    users.geolocation    = '${req.body.geolocation}'
                    WHERE uid = '${userInfo.uid}'
            `)
            utility
                .getDataFromDB('diary', sqlArray, true)
                .then(data => {
                    utility.updateUserLastLoginTime(userInfo.uid)
                    utility
                        .verifyAuthorization(req)
                        .then(newUserInfo => {
                            res.send(new ResponseSuccess(newUserInfo, '修改成功'))
                        })
                })
                .catch(err => {
                    res.send(new ResponseError(err, '修改失败'))
                })
        })
        .catch(err => {
            res.send(new ResponseError(err, '无权操作'))
        })
        */
})


router.put('/modify', (req, res, next) => {

    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.group_id === 1) {
                operateUserInfo(req, res, userInfo)
            } else {
                if (userInfo.uid !== req.body.uid){
                    res.send(new ResponseError('', '你无权操作该用户信息'))
                } else {
                    operateUserInfo(req, res, userInfo)
                }
            }
        })
        .catch(err => {
            res.send(new ResponseError(err, '无权操作'))
        })
})

function operateUserInfo(req, res, userInfo){
    utility.knex('users').update({email:req.body.email, nickname: req.body.nickname, username: req.body.username, comment: req.body.comment||'',
            wx:req.body.wx||'', phone: req.body.phone||'', homepage:req.body.homepage||'', gaode:req.body.gaode||'', group_id:req.body.group_id}).where('uid', req.body.uid)
        .then(data => {
            utility.updateUserLastLoginTime(userInfo.uid)
            res.send(new ResponseSuccess(data, '修改成功'))
        })
        .catch(err => {
            res.send(new ResponseError(err, '修改失败'))
        })
}

router.delete('/delete', (req, res, next) => {
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.group_id === 1){
                utility.knex('users').del().where('uid', req.body.uid)
                    .then(affectedRows => {
                        if (affectedRows > 0) {
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

router.post('/login', (req, res, next) => {

    utility.knex('users').select().where('email', req.body.email).limit(1)
        .then(data => {
            data = data[0]
            if (data) {
                bcrypt.compare(req.body.password, data.password, function(err, isPasswordMatch) {
                    if (isPasswordMatch){
                        utility.updateUserLastLoginTime(data.uid)
                        res.send(new ResponseSuccess(data,'登录成功'))
                    } else {
                        console.log(data.password);
                        res.send(new ResponseError('','用户名或密码错误'))
                    }
                })
            } else {
                res.send(new ResponseError('', '无此用户'))
            }

        })
        .catch(err => {
            res.send(new ResponseError('', err.message))
        })
})

// 修改密码
router.put('/change-password', (req, res, next) => {
    if (!req.body.password){
        res.send(new ResponseError('', '参数错误：password 未定义'))
        return
    }

    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            if (userInfo.email === 'test@163.com'){
                res.send(new ResponseError('', '演示帐户密码不允许修改'))
                return
            }
            bcrypt.hash(req.body.password, 10, (err, encryptPasswordNew) => {
                utility.knex('users').update('password', encryptPasswordNew).where('email', userInfo.email)
                    .then(dataChangePassword => {
                        utility.updateUserLastLoginTime(userInfo.uid)
                        res.send(new ResponseSuccess('', '修改密码成功'))
                    })
                    .catch(errChangePassword => {
                        res.send(new ResponseError('', '修改密码失败'))
                    })
            })
        })
        .catch(err => {
            res.send(new ResponseError(err, '无权操作'))
        })

})

// 注销帐号
router.delete('/destroy-account', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            // 演示帐户时不允许执行注销操作
            if (userInfo.email === 'test@163.com'){
                res.send(new ResponseError('', '演示帐户不允许执行此操作'))
                return
            }
            utility.knex.transaction(async trx => {
                await trx.del().table('diaries').where('uid', userInfo.uid)
                await trx.del().table('invitations').where('uid', userInfo.uid)
                await trx.del().table('users').where('uid', userInfo.uid)
            })
            .then(() => {
                res.send(new ResponseSuccess('', '事务执行成功'))
            })
            .catch(err => {
                res.send(new ResponseError(err, 'transaction.commit: 事务执行失败，已回滚'))
            })
        })
        .catch(errInfo => {
            res.send(new ResponseError('null', errInfo))
        })
})

module.exports = router
