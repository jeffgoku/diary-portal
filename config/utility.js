const configDatabase = require('./configDatabase')
const configProject = require('./configProject')


let ym_func, y_func, m_func;
let db_type;

switch(configDatabase.client)
{
    case 'mysql':
        ym_func = `date_format(date, '%Y%m')`;
        y_func = `date_format(date, '%Y')`;
        m_func = `date_format(date, '%m')`;
        db_type = 'mysql';
        break;
    case 'better-sqlite3':
    case 'sqlite3':
        ym_func = `strftime('%Y%m', date)`
        y_func = `strftime('%Y', date)`
        m_func = `strftime('%m', date)`
        db_type = 'sqlite3'
        break;
    case 'pg':
        ym_func = `to_char(date, 'YYYYMM')`
        y_func = `extract(year from date)`
        m_func = `extract(month from date)`
        db_type = 'postgresql'
        break;
    default:
        throw new Error(`not supported database type "${configDatabase.client}", for now only support sqlite3, postgresql and mysql`);
}

const knex = require('knex')({
    ...configDatabase,
});


async function createDB() {
    if (db_type == 'sqlite3')
        return;

    let connection = Object.assign({}, configDatabase.connection);
    const dbName = connection.database;
    delete(connection.database)

    const k = require('knex')({
        client: configDatabase.client,
        connection
    });

    try
    {
        switch(db_type)
        {
            case 'mysql':
                await k.raw(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
                break;
            case 'postgresql':
                let res = await k.raw(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`)
                if (res.length == 0)
                    await k.raw(`CREATE DATABASE ${dbName}`);
                break;
            default:
                throw new Error('not supported database type, for now only support sqlite3, postgresql and mysql');
        }
    }
    finally
    {
        k.destroy()
    }
}

async function createTables(knex) {
    const isMySql = db_type == 'mysql';
    try
    {
        await knex.schema.dropTableIfExists('diaries');
        await knex.schema.dropTableIfExists('file_manager');
        await knex.schema.dropTableIfExists('invitations');
        await knex.schema.dropTableIfExists('users');
        await knex.schema.dropTableIfExists('user_group');
        await knex.schema.dropTableIfExists('diary_category');

        await knex.schema.createTable('diary_category', function (table) {
            table.tinyint('sort_id').defaultTo(null);
            table.string('name_en', 50).notNull().comment('类别英文名').primary();
            table.string('name', 50).notNull().comment('类别名');
            table.smallint('count').notNull().comment("类别日记数量");
            table.string('color',10).notNull().defaultTo('#cccccc').comment('类别颜色');
            table.datetime('date_init').notNull();

            if(isMySql)
                table.engine('InnoDB');
        });

        await knex.schema.createTable(`user_group`, function (table) {
            table.primary().increments('id').comment("group ID");
            table.string('name').notNull().comment("group name");
            table.string('description');

            if(isMySql)
                table.engine('InnoDB');
        });

        await knex.schema.createTable(`users`, function (table) {
            table.increments('uid');
            table.string('email', 50).notNull();
            table.string('nickname',20).notNull().comment('昵称');
            table.string('username',20).notNull().comment('用户名');
            table.string('password',100).notNull().comment('密码');
            table.datetime('register_time').notNull().comment('注册时间');
            table.datetime('last_visit_time').notNull().comment('最后访问时间');
            table.string('comment',255).nullable().defaultTo(null).comment('注释');
            table.string('wx',255).nullable().defaultTo('').comment('微信二维码');
            table.string('phone',20).nullable().defaultTo(null).comment('手机号');
            table.string('homepage',100).nullable().defaultTo(null).comment('个人主页');
            table.smallint('group_id').index().references('id').inTable('user_group').notNull().defaultTo(2).comment('用户组别ID');
            table.smallint('count_diary').defaultTo(0).comment('数量 - 日记');
            table.smallint('sync_count').defaultTo(0).comment('同步次数');
            table.string('avatar',255).defaultTo(null).comment('avatar图片地址');
            table.string('city',255).defaultTo(null).comment('城市');
            table.string('geolocation', 255).defaultTo(null).comment('经纬度');

            if(isMySql)
            {
                table.primary(['uid', 'email']);
                table.engine('InnoDB');
            }
            else
            {
                table.primary(['uid']);
            }
        });

        await knex.schema.createTable(`file_manager`, function (table) {
            table.primary().increments('id').comment("hash");
            table.string('name_original').notNull().comment("原文件名");
            table.string('path').comment('文件路径');
            table.string('description').comment('描述');
            table.datetime('date_create').notNull().comment('创建时间');
            table.string('type').notNull().defaultTo('image').comment('image, file');
            table.integer('uid').notNull().references('uid').inTable('users').comment('uid');
            table.integer('size').notNull().comment('file size');

            if(isMySql)
                table.engine('InnoDB');
        });


        await knex.schema.createTable(`invitations`, function (table) {
            table.string('id', 36).comment("ID");
            table.datetime('date_create').notNull().comment('创建时间');
            table.datetime('date_register').notNull().comment('注册时间');
            table.integer('binding_uid').index().references('uid').inTable('users').onDelete('restrict').onUpdate('restrict').comment("group name");
            table.primary(['id']);

            if(isMySql)
                table.engine('InnoDB');
        });


        await knex.schema.createTable(`diaries`, function (table) {
            table.primary().increments('id').comment("ID");
            table.datetime('date').notNull().comment('日记日期');
            table.string('title').notNull().comment('标题');
            table.text('content','longtext').notNull().comment('内容');
            table.smallint('temperature').defaultTo(-273).comment('室内温度');
            table.smallint('temperature_outside').defaultTo(-273).comment('室外温度');
            table.enu('weather', ['sunny','cloudy','overcast','sprinkle','rain','thunderstorm','fog','snow','tornado','smog','sandstorm'], {use_native:true, enumName:'weather'})
                .defaultTo('sunny').comment('天气');
            table.string('category', 30).index().defaultTo('life').notNull().references('name_en').inTable('diary_category').onDelete('restrict').onUpdate('restrict').comment('类别');
            table.datetime('date_create').notNull().comment('创建日期');
            table.datetime('date_modify').notNull().comment('编辑日期');
            table.integer('uid').notNull().comment('用户ID');
            table.smallint('is_public',1).notNull().defaultTo(0).comment('是否共享');
            table.smallint('is_markdown',1).notNull().defaultTo(0).comment('是否为markdown');

            if(isMySql)
                table.engine('InnoDB');
        });
    }
    catch(err)
    {
        console.log('-- 2. fail: create table diaries, users')
        throw '失败：新建 tables: users, diaries，\ninfo: \n' + err.message
    }
    console.log('-- 2. success: create table diaries, users')
    return '成功：新建 tables: users, diaries'
}

async function createInitData(knex) {
    await knex('diary_category').insert([
        { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
        { sort_id: 3,  name_en: 'bigevent',  name:'大事', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
        { sort_id: 10, name_en: 'bill',      name:'账单', count:0, color:'#8bc34a', date_init:'2022-05-23 21:23:02'},
        { sort_id: 8,  name_en: 'film',      name:'电影', count:0, color:'#FF2D70', date_init:'2022-03-23 21:23:02'},
        { sort_id: 7,  name_en: 'game',      name:'游戏', count:0, color:'#5AC8FA', date_init:'2022-03-23 21:23:02'},
        { sort_id: 1,  name_en: 'life',      name:'生活', count:0, color:'#FF9500', date_init:'2022-03-23 21:23:02'},
        { sort_id: 11, name_en: 'memo',      name:'备忘', count:0, color:'#BABABA', date_init:'2022-10-31 17:16:15'},
        { sort_id: 12, name_en: 'play',      name:'剧本', count:0, color:'#00AAFF', date_init:'2022-12-29 08:44:21'},
        { sort_id: 13, name_en: 'sentiment', name:'情感', count:0, color:'#00C975', date_init:'2023-01-16 15:21:12'},
        { sort_id: 4,  name_en: 'sport',     name:'运动', count:0, color:'#FFCC00', date_init:'2022-03-23 21:23:02'},
        { sort_id: 2,  name_en: 'study',     name:'学习', count:0, color:'#4CD964', date_init:'2022-03-23 21:23:02'},
        { sort_id: 4,  name_en: 'todo',      name:'待办', count:0, color:'#24C5FF', date_init:'2023-12-12 10:17:35'},
        { sort_id: 5,  name_en: 'week',      name:'周报', count:0, color:'#5856D6', date_init:'2022-03-23 21:23:02'},
        { sort_id: 6,  name_en: 'work',      name:'工作', count:0, color:'#007AFF', date_init:'2022-03-23 21:23:02'},
    ]);

    const groups = [
        {id:1, name:'admin', 'description': '管理员'},
        {id:2, name:'user',  'description': '普通成员'},
    ];

    await knex('user_group').insert(groups);
}


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
    createDB, createTables, createInitData,
    dateFormatter, updateUserLastLoginTime,
    unicodeEncode, unicodeDecode,
    verifyAuthorization,
    // Bill
    processBillOfDay, formatMoney,
    ym_func, y_func, m_func, db_type
}
