const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')


router.get('/', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            // let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 日记起点
            utility.knex('diaries').select().where('uid', userInfo.uid).andWhere('category','bill').orderBy('date', 'asc')
                .then(billDiaryList => {
                    utility.updateUserLastLoginTime(userInfo.uid)
                    let billResponse = []

                    billDiaryList.forEach(diary => {
                        // decode unicode
                        billResponse.push(utility.processBillOfDay(diary, []))
                    })
                    res.send(new ResponseSuccess(billResponse, '请求成功'))
                })
                .catch(err => {
                    res.send(new ResponseError(err, err.message))
                })
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})


router.get('/sorted', (req, res, next) => {
    if (!req.query.years){
        res.send(new ResponseError('', '未选择年份'))
        return
    }
    utility
        .verifyAuthorization(req)
        .then(async userInfo => {
            let stream = utility.knex('diaries').select('*', utility.knex.raw(`date_format(date,'%Y%m') as month_id,date_format(date,'%m') as month`))
                .whereIn(utility.knex.raw('year(date)'), req.query.years.split(','))
                .andWhere('category','bill')
                .andWhere('uid', userInfo.uid)
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
                let curMonth = null;
                for await (const item of stream)
                {
                    if (curMonth == null)
                    {
                        curMonth = item.month_id;
                    }
                    if(item.month_id != curMonth)
                    {
                        if(daysData.length > 0)
                        {
                            responseData.push({
                                id: daysData[0].id,
                                month_id: curMonth,
                                month: daysData[0].month,
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
                        curMonth = item.month_id
                    }
                    let processedDayData = utility.processBillOfDay(item, keywords)
                    // 当内容 items 的数量大于 0 时
                    if (processedDayData.items.length > 0){
                        daysData.push(processedDayData)
                        monthSum = monthSum + processedDayData.sum
                        monthSumIncome = monthSumIncome + processedDayData.sumIncome
                        monthSumOutput = monthSumOutput + processedDayData.sumOutput
                        food.breakfast = food.breakfast + processedDayData.items.filter(item => item.item.indexOf('早餐') > -1).reduce((a,b) => a.price || 0 + b.price || 0, 0)
                        food.launch = food.launch + processedDayData.items.filter(item => item.item.indexOf('午餐') > -1).reduce((a,b) => a.price || 0 + b.price || 0, 0)
                        food.dinner = food.dinner + processedDayData.items.filter(item => item.item.indexOf('晚餐') > -1).reduce((a,b) => a.price || 0 + b.price || 0, 0)
                    }
                }

                if(daysData.length > 0)
                {
                    responseData.push({
                        id: daysData[0].id,
                        month_id: curMonth,
                        month: daysData[0].month,
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
                res.send(new ResponseError(err, err.message))
            }
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})



router.get('/keys', (req, res, next) => {
    let yearStart = new Date().getFullYear() - 5; // last five years
    utility
        .verifyAuthorization(req)
        .then(async userInfo => {
            let BillKeyMap = new Map()

            let stream = utility.knex('diaries').select('*', utility.knex.raw(`date_format(date,'%Y%m') as month_id,date_format(date,'%m') as month`))
                .where(utility.knex.raw('year(date)'), '>=', yearStart)
                .andWhere('category','bill')
                .andWhere('uid', userInfo.uid)
                .orderBy('date', 'desc').stream();

            try
            {
                let responseData = []
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
                res.send(new ResponseError(err, err.message))
            }
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})

router.get('/day-sum', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex('diaries').select('content', 'date').where('category', 'bill').andWhere('uid', userInfo.uid)
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
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})


router.get('/month-sum', (req, res, next) => {

    let yearNow = new Date().getFullYear()
    let yearStart = 2018
    let years = []
    for (let i=yearStart; i<=yearNow; i++){
        years.push(i)
    }

    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex('diaries').select('*', utility.knex.raw(`date_format(date,'%Y%m') as month_id,date_format(date,'%m') as month`))
                .whereIn(utility.knex.raw('year(date)'), years)
                .andWhere('category','bill')
                .andWhere('uid', userInfo.uid)
                .orderBy('date', 'desc')
                .then(days => {
                    let responseData = []

                    let daysData = []
                    let monthSum = 0
                    let monthSumIncome = 0
                    let monthSumOutput = 0

                    let curMonth = days[0].month_id;


                    // 用一次循环处理完所有需要在循环中处理的事：合总额、map DayArray
                    let keywords = req.query.keyword ? req.query.keyword.split(' ') : []
                    days.forEach(item => {
                        if (curMonth != item.month_id)
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
                            curMonth = item.mont_id;
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
                    res.send(new ResponseError(err, err.message))
                })
        })
        .catch(errInfo => {
            res.send(new ResponseError('', errInfo))
        })
})


module.exports = router
