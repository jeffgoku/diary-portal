const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')


router.get('/', (req, res) => {
    // let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 日记起点
    utility.knex('diaries').select().where('uid', req.user.uid).andWhere('category','bill').orderBy('date', 'asc')
        .then(billDiaryList => {
            utility.updateUserLastLoginTime(req.user.uid)
            let billResponse = []

            billDiaryList.forEach(diary => {
                // decode unicode
                billResponse.push(utility.processBillOfDay(diary, []))
            })
            res.send(new ResponseSuccess(billResponse, '请求成功'))
        })
        .catch(err => {
            console.log(err);
            res.send(new ResponseError(null, 'fatal error'))
        })
})


router.get('/sorted', async (req, res) => {
    if (!req.query.years){
        res.send(new ResponseError('', '未选择年份'))
        return
    }
    let stream = utility.knex('diaries').select('*', utility.knex.raw(`${utility.ym_func} as month_id`))
        .whereIn(utility.knex.raw(utility.y_func), req.query.years.split(','))
        .andWhere('category','bill')
        .andWhere('uid', req.user.uid)
        .orderBy('date', 'desc').stream()

    let daysData = []
    let monthSum = 0
    let monthSumIncome = 0
    let monthSumOutput = 0
    let food = {
        breakfast: 0, // 早餐
        launch: 0, // 午餐
        dinner: 0 // 晚饭
    }

    let responseData = [];

    // 用一次循环处理完所有需要在循环中处理的事：合总额、map DayArray
    let keywords = req.query.keyword ? req.query.keyword.split(' ') : []
    try
    {
        let curYearMonth = null;
        for await (const item of stream)
        {
            if (curYearMonth == null)
            {
                curYearMonth = item.month_id;
            }
            if(item.month_id != curYearMonth)
            {
                if(daysData.length > 0)
                {
                    responseData.push({
                        id: daysData[0].id,
                        month_id: curYearMonth,
                        month: curYearMonth.substr(4),
                        count: daysData.length,
                        days: daysData,
                        sum: utility.formatMoney(monthSum),
                        sumIncome: utility.formatMoney(monthSumIncome),
                        sumOutput: utility.formatMoney(monthSumOutput),
                        food: {
                            breakfast: utility.formatMoney(food.breakfast),
                            launch: utility.formatMoney(food.launch),
                            dinner: utility.formatMoney(food.dinner),
                            sum: utility.formatMoney(food.breakfast + food.launch + food.dinner)
                        }
                    })
                    daysData = [];
                    monthSum = 0;
                    monthSumIncome = 0;
                    monthSumOutput = 0;
                    food = {
                        breakfast: 0,
                        launch: 0,
                        dinner: 0,
                    }
                }
                curYearMonth = item.month_id
            }
            let processedDayData = utility.processBillOfDay(item, keywords)
            // 当内容 items 的数量大于 0 时
            if (processedDayData.items.length > 0){
                daysData.push(processedDayData)
                monthSum = monthSum + processedDayData.sum
                monthSumIncome = monthSumIncome + processedDayData.sumIncome
                monthSumOutput = monthSumOutput + processedDayData.sumOutput
                food.breakfast = food.breakfast + processedDayData.items.filter(item => /早[餐饭点]/ig.test(item.item)).reduce((a,b) => a.price || 0 + b.price || 0, 0)
                food.launch = food.launch + processedDayData.items.filter(item => /午[餐饭点]/ig.test(item.item)).reduce((a,b) => a.price || 0 + b.price || 0, 0)
                food.dinner = food.dinner + processedDayData.items.filter(item => /晚[餐饭点]/ig.test(item.item)).reduce((a,b) => a.price || 0 + b.price || 0, 0)
            }
        }

        if(daysData.length > 0)
        {
            responseData.push({
                id: daysData[0].id,
                month_id: curYearMonth,
                month: curYearMonth.substr(4),
                count: daysData.length,
                days: daysData,
                sum: utility.formatMoney(monthSum),
                sumIncome: utility.formatMoney(monthSumIncome),
                sumOutput: utility.formatMoney(monthSumOutput),
                food: {
                    breakfast: utility.formatMoney(food.breakfast),
                    launch: utility.formatMoney(food.launch),
                    dinner: utility.formatMoney(food.dinner),
                    sum: utility.formatMoney(food.breakfast + food.launch + food.dinner)
                }
            })
        }

        res.send(new ResponseSuccess(responseData))
    }
    catch(err) {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    }
})



router.get('/keys', async (req, res) => {
    let yearStart = new Date().getFullYear() - 5; // last five years
    let BillKeyMap = new Map()

    let stream = utility.knex('diaries').select('*', utility.knex.raw(`${utility.ym_func} as month_id, ${utility.m_func} as month`))
        .where(utility.knex.raw(utility.y_func), '>=', yearStart)
        .andWhere('category','bill')
        .andWhere('uid', req.user.uid)
        .orderBy('date', 'desc').stream();

    try
    {
        for await (const item of stream)
        {
            let processedDayData = utility.processBillOfDay(item, [])
            // 当内容 items 的数量大于 0 时
            if (processedDayData.items.length > 0){
                processedDayData.items.forEach(billItem => {
                    if (BillKeyMap.has(billItem.item)){ // 如果已存在账单项
                        let count = BillKeyMap.get(billItem.item)
                        BillKeyMap.set(billItem.item, count + 1)
                    } else {
                        BillKeyMap.set(billItem.item, 1) // 初始化为1
                    }
                })
            }
        }

        let billKeyArray = []
        BillKeyMap.forEach((value,key,map) => {
            if (BillKeyMap.get(key) >= 1){
                billKeyArray.push({
                    item: key,
                    value: value,
                })
            }
        })
        billKeyArray.sort((a,b) => b.value - a.value)
        res.send(new ResponseSuccess(billKeyArray))
    }
    catch(err)
    {
        console.log(err);
        res.send(new ResponseError(null, 'fatal error'))
    }
})

router.get('/day-sum', (req, res) => {
    utility.knex('diaries').select('content', 'date').where('category', 'bill').andWhere('uid', req.user.uid)
        .then(billData => {
            let finalData = billData.map(item => {
                let originalData = utility.processBillOfDay(item)
                delete originalData.items
                delete originalData.sum
                return originalData
            })
            res.send(new ResponseSuccess(finalData, '获取成功'))
        })
})


router.get('/month-sum', (req, res) => {

    let yearNow = new Date().getFullYear()
    let yearStart = 2018
    let years = []
    for (let i=yearStart; i<=yearNow; i++){
        years.push(i)
    }
    utility.knex('diaries').select('*', utility.knex.raw(`${utility.ym_func} as month_id, ${utility.m_func} as month`))
            .whereIn(utility.knex.raw(utility.y_func), years)
            .andWhere('category','bill')
            .andWhere('uid', req.user.uid)
            .orderBy('date', 'desc')
            .then(days => {
                let responseData = []

                let daysData = []
                let monthSum = 0
                let monthSumIncome = 0
                let monthSumOutput = 0

                let curYearMonth = days[0].month_id;


                // 用一次循环处理完所有需要在循环中处理的事：合总额、map DayArray
                let keywords = req.query.keyword ? req.query.keyword.split(' ') : []
                days.forEach(item => {
                    if (curYearMonth != item.month_id)
                    {
                        if(daysData.length > 0)
                        {
                            responseData.push({
                                id: daysData[0].id,
                                month_id: daysData[0].month_id,
                                month: daysData[0].month,
                                count: daysData.length,
                                sum: utility.formatMoney(monthSum),
                                sumIncome: utility.formatMoney(monthSumIncome),
                                sumOutput: utility.formatMoney(monthSumOutput),
                            })
                            daysData = [];
                            monthSum = 0;
                            monthSumIncome = 0;
                            monthSumOutput = 0;
                        }
                        curYearMonth = item.mont_id;
                    }
                    let processedDayData = utility.processBillOfDay(item, keywords)
                    // 当内容 items 的数量大于 0 时
                    if (processedDayData.items.length > 0){
                        daysData.push(processedDayData)
                        monthSum = monthSum + processedDayData.sum
                        monthSumIncome = monthSumIncome + processedDayData.sumIncome
                        monthSumOutput = monthSumOutput + processedDayData.sumOutput
                    }
                })

                if(daysData.length > 0)
                {
                    responseData.push({
                        id: daysData[0].id,
                        month_id: daysData[0].month_id,
                        month: daysData[0].month,
                        count: daysData.length,
                        sum: utility.formatMoney(monthSum),
                        sumIncome: utility.formatMoney(monthSumIncome),
                        sumOutput: utility.formatMoney(monthSumOutput),
                    })
                }


                res.send(new ResponseSuccess(responseData))
            })
            .catch(err => {
                console.error(err)
                res.send(new ResponseError(null, 'fatal'))
            })
})


module.exports = router
