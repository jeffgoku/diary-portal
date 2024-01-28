const fs = require('node:fs')
const crypto = require('node:crypto')

let _jwtSecret;


function hashPassword(password) {
    let salt = crypto.randomBytes(16)
    const iterationCount = 10227
    let hashedPassword = crypto.pbkdf2Sync(password, salt, iterationCount, 32, 'sha256')

    let b = Buffer.allocUnsafe(1+1+4+16+hashedPassword.length)
    b.writeInt8(1, 0) // version
    b.writeInt8(salt.length, 1) // salt length
    b.writeInt32LE(iterationCount, 2) // iteration count
    salt.copy(b, 6) // salt
    hashedPassword.copy(b, 6+salt.length)

    return b
}

function comparePassword(password, hashedPassword) {
    if (typeof hashedPassword == 'string')
    {
        hashedPassword = Buffer.from(hashedPassword, 'base64')
    }

    //let ver = hashedPassword.readInt8(0)
    let saltLen = hashedPassword.readInt8(1)
    let iterationCount = hashedPassword.readInt32LE(2)
    let salt = hashedPassword.subarray(6, 6+saltLen)
    let hashed = hashedPassword.subarray(6+saltLen)

    let hp = crypto.pbkdf2Sync(password, salt, iterationCount, hashed.length, 'sha256')
    return crypto.timingSafeEqual(hashed, hp)
}

function getJwtSecretKey() {
    if (_jwtSecret)
    {
        return _jwtSecret;
    }
	if (fs.existsSync('secrets'))
    {
        _jwtSecret = fs.readFileSync('secrets')
    }
    else
    {
        _jwtSecret = crypto.randomBytes(16)
        fs.writeFileSync('secrets', _jwtSecret)
    }

    return _jwtSecret
}

module.exports = {
    hashPassword,
    comparePassword,
    
    getJwtSecretKey,
}
