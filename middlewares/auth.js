const jwt = require('jsonwebtoken')
const ResponseError = require('../response/ResponseError')
const { getJwtSecretKey } = require("../config/cryptoUtils")

// 验证用户是否有权限
function verifyAuthorization(req, res, next) {
    let token = req.get('Diary-Token') || req.query.token
    let uid = parseInt(req.get('Diary-Uid') || req.query.uid)

    if (!token)
    {
        res.status(401).send(new ResponseError('no token', '无权操作'))
        return
    }

    if (!uid)
    {
        res.status(401).send(new ResponseError('程序已升级，请关闭所有相关窗口，再重新访问该网站', 'error'))
        return
    }

    try
    {
        let key = getJwtSecretKey()
        let payload = jwt.verify(token, key, {'ignoreExpiration': true})
        if (payload.uid != uid)
        {
            res.status(401).send(new ResponseError('user id wrong', 'error'))
            return
        }
        if (payload.exp*1000 < new Date().getTime())
        {
            if (payload.ip != req.ip)
            {
                res.status(401).send(new ResponseError('expired session', 'error'))
                return
            }

            delete payload.iat
            delete payload.exp
            token = jwt.sign(payload, key, {'expiresIn': '1d'})
            res.set('X-Refreshed-Token', token)
        }
        req.user = payload
        next()
    }
    catch(e)
    {
        console.error(e)
        res.status(401).send(new ResponseError('authorization error', 'error'))
    }
}

module.exports = {
    verifyAuthorization,
}
