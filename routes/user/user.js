const express = require('express')
const configProject = require('../../config/configProject')
const utility = require("../../config/utility");
const ResponseSuccess = require("../../response/ResponseSuccess");
const ResponseError = require("../../response/ResponseError");
const router = express.Router()

const { verifyAuthorization } = require('../../middlewares/auth')
const cryptoUtils = require('../../config/cryptoUtils')

const jwt = require('jsonwebtoken')


/* GET users listing. */
router.post('/register', (req, res) => {
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
                console.error(err)
                res.send(new ResponseError(null, 'fatal error'))
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
                let encryptPassword = cryptoUtils.hashPassword(req.body.password)
                // 注册的用户默认为普通用户
                utility.knex('users').insert({
                        email:req.body.email,
                        nickname:req.body.nickname||'',
                        username: req.body.username ||'',
                        password: encryptPassword.toString('base64'),
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
                                console.error(err);
                                res.send(new ResponseError(null, 'fatal error'))
                            })
                    })
                    .catch(err => {
                        console.error(err)
                        res.send(new ResponseError(null, 'fatal error'))
                    })
            }
        })
        .catch(errEmailExist => {
            console.error(errEmailExist)
            res.send(new ResponseError(null, 'fatal error'))
        })
}

// 检查用户名或邮箱是否存在
function checkEmailOrUserNameExist(email, nickname){
    return utility.knex('users').select().where('email', email).orWhere('nickname', nickname).limit(1)
}

router.post('/list', (req, res) => {
})

router.get('/detail', (req, res) => {
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
                            res.send(new ResponseSuccess(data))
                        } else {
                            res.send(new ResponseError('','当前用户无权查看该 QR ：请求用户 ID 与 QR 归属不匹配'))
                        }
                    })
                    .catch(errInfo => {
                        console.error(errInfo)
                        res.send(new ResponseError(null, 'fatal error'))
                    })
            }
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
})


router.get('/avatar', verifyAuthorization, (req, res) => {
    utility.knex('users').select('avatar').where('email', req.query.email)
        .then(data => {
            res.send(new ResponseSuccess(data))
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
})


// 设置用户资料：昵称，avatar，手机号
router.put('/set-profile', (req, res) => {
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


router.put('/modify', verifyAuthorization, (req, res) => {
    if (req.user.group_id == 1 || req.user.uid == req.body.uid) {
        operateUserInfo(req, res)
    } else {
        res.send(new ResponseError('', '你无权操作该用户信息'))
    }
})

function operateUserInfo(req, res){
    utility.knex('users').update({email:req.body.email, nickname: req.body.nickname, username: req.body.username, comment: req.body.comment||'',
            wx:req.body.wx||'', phone: req.body.phone||'', homepage:req.body.homepage||'', gaode:req.body.gaode||'', group_id:req.body.group_id}).where('uid', req.body.uid)
        .then(data => {
            utility.updateUserLastLoginTime(req.body.uid)
            res.send(new ResponseSuccess(data, '修改成功'))
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
}

router.delete('/delete', verifyAuthorization, (req, res) => {
    if (req.user.group_id == 1) {
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
                console.error(err)
                res.send(new ResponseError(null,'fatal error'))
            })
    } else {
        res.send(new ResponseError('', '无权操作'))
    }
})

router.post('/login', (req, res) => {
    utility.knex('users').select().where('email', req.body.email).limit(1)
        .then(data => {
            if (data.length > 0) {
                let user = data[0]

                if(cryptoUtils.comparePassword(req.body.password, user.password))
                {
                    utility.updateUserLastLoginTime(user.uid)
                    let token = jwt.sign({uid: user.uid, ip: req.ip, group_id: user.group_id, email: user.email}, cryptoUtils.getJwtSecretKey(), {expiresIn: '1d'})
                    let ret = {nickname: user.nickname,
                        uid: user.uid,
                        email: user.email,
                        phone: user.phone,
                        avatar: user.avatar,
                        token,
                        group_id: user.group_id,
                        city: user.city,
                        geolocation: user.geolocation
                    }
                    res.send(new ResponseSuccess(ret, '登录成功'))
                }
                else
                {
                    res.send(new ResponseError('','用户名或密码错误'))
                }
            } else {
                res.send(new ResponseError('', '无此用户'))
            }
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
})

// 修改密码
router.put('/change-password', verifyAuthorization,  (req, res) => {
    if (!req.body.password){
        res.send(new ResponseError('', '参数错误：password 未定义'))
        return
    }

    if (req.user.email === 'test@163.com'){
        res.send(new ResponseError('', '演示帐户密码不允许修改'))
        return
    }
    let encryptedPassword = cryptoUtils.hashPassword(req.body.password)
    utility.knex('users').update('password', encryptedPassword).where('uid', req.user.uid)
        .then(_count => {
            utility.updateUserLastLoginTime(req.user.uid)
            res.send(new ResponseSuccess('', '修改密码成功'))
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError(null, 'fatal error'))
        })
})

// 注销帐号
router.delete('/destroy-account', verifyAuthorization, (req, res) => {
    // 演示帐户时不允许执行注销操作
    if (req.user.email === 'test@163.com'){
        res.send(new ResponseError('', '演示帐户不允许执行此操作'))
        return
    }
    utility.knex.transaction(async trx => {
        let uid = req.user.uid
        await trx.del().table('diaries').where('uid', uid)
        await trx.del().table('invitations').where('uid', uid)
        await trx.del().table('users').where('uid', uid)
    })
    .then(() => {
        res.send(new ResponseSuccess('', '事务执行成功'))
    })
    .catch(err => {
        console.error(err);
        res.send(new ResponseError(null, 'fatal error'))
    })
})

module.exports = router
