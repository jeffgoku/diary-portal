const configDatabase = require('./configDatabase')
const configProject = require('./configProject')

const client = 'mysql'
const knex = require('knex')({
    client: client,
    connection: {
        ...configDatabase,
    }
});

const ym_func = client == 'mysql' ? `date_format(date, '%Y%m')`: `strftime('%Y%m', date)`
const y_func = client == 'mysql' ? `date_format(date, '%Y')`: `strftime('%Y', date)`
const m_func = client == 'mysql' ? `date_format(date, '%m')`: `strftime('%m', date)`

// 验证用户是否有权限
function verifyAuthorization(req){
    let token = req.get('Diary-Token') || req.query.token
    let uid = req.get('Diary-Uid')
    return new Promise((resolve, reject) => {
        if (!token){
            reject ('无 token')
        } else if (!uid){
            reject ('程序已升级，请关闭所有相关窗口，再重新访问该网站')
        } else {
            knex('users').select().where('password', token).andWhere('uid', uid)
                .then(userInfo => {
                    if (userInfo?.length > 0){
                        resolve(userInfo[0]) // 如果查询成功，返回 用户id
                    } else {
                        reject('身份验证失败：查无此人')
                    }
                })
                .catch(err => {
                    reject('mysql: 获取身份信息错误')
                })
        }
    });
}

// 格式化时间，输出字符串
function dateFormatter(date, formatString) {
    formatString = formatString || 'yyyy-MM-dd hh:mm:ss'
    let dateRegArray = {
        "M+": date.getMonth() + 1,                      // 月份
        "d+": date.getDate(),                           // 日
        "h+": date.getHours(),                          // 小时
        "m+": date.getMinutes(),                        // 分
        "s+": date.getSeconds(),                        // 秒
        "q+": Math.floor((date.getMonth() + 3) / 3), // 季度
        "S": date.getMilliseconds()                     // 毫秒
    }
    if (/(y+)/.test(formatString)) {
        formatString = formatString.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length))
    }
    for (const section in dateRegArray) {
        if (new RegExp("(" + section + ")").test(formatString)) {
            formatString = formatString.replace(RegExp.$1, (RegExp.$1.length === 1) ? (dateRegArray[section]) : (("00" + dateRegArray[section]).substr(("" + dateRegArray[section]).length)))
        }
    }
    return formatString
}

// unicode -> text
function unicodeEncode(str){
    if(!str)return '';
    if(typeof str !== 'string') return str
    let text = escape(str);
    text = text.replaceAll(/(%u[ed][0-9a-f]{3})/ig, (source, replacement) => {
        console.log('source: ',source)
        return source.replace('%', '\\\\')
    })
    return unescape(text);
}

// text -> unicode
function  unicodeDecode(str)
{
    let text = escape(str);
    text = text.replaceAll(/(%5Cu[ed][0-9a-f]{3})/ig, source=>{
        return source.replace('%5C', '%')
    })
    return unescape(text);
}

async function updateUserLastLoginTime(uid){
    let timeNow = dateFormatter(new Date())
    try
    {
        await knex('users').update({last_visit_time: timeNow}).where('uid', uid)
        // console.log(`--- 成功：记录用户最后操作时间 ${timeNow} ${uid}`)
    }
    catch(e)
    {
        console.log(`--- 失败：记录用户最后操作时间 ${timeNow} uid = ${uid}, err = ${e}`)
    }
}


// 处理账单文本内容，转成格式化的账单数据
function processBillOfDay(diaryObj, filterKeywords = []){
    let str = diaryObj.content.replace(/ +/g, ' ') // 替换掉所有多个空格的间隔，改为一个空格
    let reg = filterKeywords.length > 0 ? new RegExp(`.*(${filterKeywords.join('|')}).*`, 'ig') : null;
    let strArray =
        str
            .split('\n')
            .filter(item => {
                if(item.trim().length <= 0)
                    return false

                return reg == null || reg.test(item);
            })

    let response = {
        id: diaryObj.id,
        month_id: diaryObj.month_id,
        date: diaryObj.date,
        items: [],
        sum: 0,
        sumIncome: 0,
        sumOutput: 0
    }
    strArray.forEach(item => {
        let itemInfos = item.split(' ')
        let price = Number(itemInfos[1]) || 0 // 避免账单填写出错的情况
        if (price < 0) {
            response.sumOutput += price
        } else {
            response.sumIncome += price
        }
        response.sum += price

        response.items.push({
            item: itemInfos[0],
            price: price
        })
    })

    response.sumOutput = formatMoney(response.sumOutput)
    response.sumIncome = formatMoney(response.sumIncome)
    response.sum = formatMoney(response.sum)

    return response
}

function formatMoney(number){
    return Number(number.toFixed(2))
}


module.exports = {
    knex,
    dateFormatter, updateUserLastLoginTime,
    unicodeEncode, unicodeDecode,
    verifyAuthorization,
    // Bill
    processBillOfDay, formatMoney,
    ym_func, y_func, m_func,
}
