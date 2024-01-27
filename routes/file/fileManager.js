const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')
const multer = require('multer')
const {adminCount} = require("../../config/configProject");

const fs = require('fs')

const TABLE_NAME = 'file_manager' // 数据库名
const TEMP_FOLDER = 'temp' // 临时文件存放文件夹
const DEST_FOLDER = 'upload' // 临时文件存放文件夹
const uploadLocal = multer({dest: TEMP_FOLDER}) // 文件存储在服务器的什么位置

router.post('/upload', uploadLocal.single('file'), async (req, res, next) => {
    let timeNow = utility.dateToString(new Date())
    let id;

    let fileOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
    const destPath = `${DEST_FOLDER}/${fileOriginalName}`

    try
    {
        id = await utility.knex(TABLE_NAME).insert({
            path:destPath,
            name_original: fileOriginalName,
            description: req.body.note,
            date_create: timeNow,
            type: req.file.mimetype,
            size: req.file.size,
            uid: req.user.uid
        }).returning('id');
    }
    catch(e)
    {
        console.error(e)
        res.send(new ResponseSuccess('', 'error'))
        return;
    }

    if (typeof id[0] == 'number') { // mysql
        id = id[0];
    }
    else
    {
        id = id[0].id;
    }
    fs.rename(
        req.file.path,
        destPath,
        err => {
            if (err) {
                utility.knex(TABLE_NAME).del().where('id', id).catch(e => {
                    console.error(e);
                });
                if(fs.existsSync(req.file.path))
                {
                    fs.rmSync(req.file.path);
                }
                console.error(err)
                res.send(new ResponseError('', 'upload failed!'))
            } else {
                res.send(new ResponseSuccess('', '上传成功'))
            }
        })
})

router.post('/modify', (req, res, next) => {
    utility.knex(TABLE_NAME).update('description', req.body.description).where('id', req.body.fileId).andWhere('uid', req.user.uid)
        .then(count => {
            if (count > 0) {
                utility.updateUserLastLoginTime(req.user.uid)
                res.send(new ResponseSuccess('', '修改成功'))
            } else {
                res.send(new ResponseError('', '修改失败'))
            }
        })
        .catch(err => {
            console.error(err);
            res.send(new ResponseError(err.message,'error'))
        })
})

// TODO: 用事务处理
router.delete('/delete', (req, res, next) => {
    utility.knex(TABLE_NAME).del().where('id', req.body.fileId).andWhere('uid', req.user.uid).returning('path')
        .then(delFile => {
            if (delFile.length > 0) {
                delFile = delFile[0];
                utility.updateUserLastLoginTime(req.user.uid)
                fs.rm(delFile.path, {force: true}, errDeleteFile => {
                    if (errDeleteFile){
                        console.error(errDeleteFile)
                        res.send(new ResponseError('', '删除失败'))
                    } else {
                        res.send(new ResponseSuccess('', '删除成功'))
                    }
                })
            } else {
                res.send(new ResponseError('', '删除失败'))
            }
        })
        .catch(err => {
            console.error(err)
            res.send(new ResponseError('','error'))
        })
})

router.get('/list', (req, res, next) => {
    let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 文件记录起点
    let query = utility.knex(TABLE_NAME).select().where('uid', req.user.uid).offset(startPoint).limit(req.query.pageSize);

    query.then(data => {
        utility.updateUserLastLoginTime(req.user.uid)
        res.send(new ResponseSuccess(data, '请求成功'))
    })
    .catch(err => {
        console.error(err)
        res.send(new ResponseError(err.message, 'error'))
    })
})

module.exports = router
