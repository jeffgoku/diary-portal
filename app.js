const createError = require('http-errors')
const express = require('express')
const path = require('path')
const logger = require('morgan')
const cors = require('cors')

const { verifyAuthorization } = require('./middlewares/auth')
const utility = require('./config/utility')
const { unlinkSync } = require('node:fs')


const app = express()

// view engine setup
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

/*
app.use((req, res, next) => {
    console.log(req.method + ' ' + req.path)
    next()
    console.log('handle request ' + req.path + ' over!')
})
*/

app.use(logger('dev'))
app.use(express.json({limit: '50mb'}))
app.use(express.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public'), {index: false}))

app.use(cors({
    origin: /http:\/\/localhost/i,
    credentials: true,
}))


// 基础相关
let init                 = require('./routes/init')
let indexRouter          = require('./routes/index')
let usersRouter          = require('./routes/user/user')
app.use('/'           , indexRouter)
app.use('/init'       , init)
app.use('/user'       , usersRouter)

// 邀请码
let invitationRouter  = require('./routes/user/invitation')
app.use('/invitation' , verifyAuthorization, invitationRouter)

// 统计
let diaryStatisticRouter = require('./routes/statistic/statistic')
app.use('/statistic'  , verifyAuthorization, diaryStatisticRouter)


// 日记相关
let routerDiary          = require('./routes/diary/diary')
let routerDiaryCategory  = require('./routes/diary/diary-category')
let routerBankCard       = require('./routes/diary/bankCard')
let routerBill           = require('./routes/diary/bill')
app.use('/diary'          , verifyAuthorization, routerDiary)
app.use('/diary-category' , verifyAuthorization, routerDiaryCategory)
app.use('/bank-card'      , verifyAuthorization, routerBankCard)      // 银行卡列表
app.use('/bill'           , verifyAuthorization, routerBill)          // 账单


// 图片、文件操作
let routerFileManager = require('./routes/file/fileManager')
app.use('/file-manager', verifyAuthorization, routerFileManager)

/*
app.get('/sqliteDB', async (req, resp) => {
    await utility.toSqliteDB('tempDB.sqlite');

    resp.download('tempDB.sqlite', 'diary.sqlite', err => {
        if (err) {
            console.log(err);
        }
        console.log('download finished')
        unlinkSync('tempDB.sqlite');
    })
});
*/


// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

module.exports = app
