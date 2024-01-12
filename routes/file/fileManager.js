const express = require('express')
const router = express.Router()
const utility = require('../../config/utility')
const ResponseSuccess = require('../../response/ResponseSuccess')
const ResponseError = require('../../response/ResponseError')
const multer = require('multer')
const {adminCount} = require("../../config/configProject");
const fs = require('fs')

const DB_NAME = 'diary' // 数据库名
const TABLE_NAME = 'file_manager' // 数据库名
const TEMP_FOLDER = 'temp' // 临时文件存放文件夹
const DEST_FOLDER = 'upload' // 临时文件存放文件夹
const uploadLocal = multer({dest: TEMP_FOLDER}) // 文件存储在服务器的什么位置
const storage = multer.memoryStorage()

router.post('/upload', uploadLocal.single('file'), (req, res, next) => {
    let fileOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf-8');
    const destPath = `${DEST_FOLDER}/${fileOriginalName}`
    utility
        .verifyAuthorization(req)
        .then(async userInfo => {
            let timeNow = utility.dateToString(new Date())
            let id;
            try
            {
                id = await utility.knex(TABLE_NAME).insert({
                    path:destPath,
                    name_original: fileOriginalName,
                    description: req.body.note,
                    date_create: timeNow,
                    type: req.file.mimetype,
                    size: req.file.size,
                    uid: userInfo.uid
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
            fs.copyFile(
                req.file.path,
                `${destPath}`,
                fs.constants.COPYFILE_EXCL,
                copyFileError => {
                    if (copyFileError) {
                        console.error(copyFileError)
                        utility.knex(TABLE_NAME).del().where('id', id).then(count => {
                            fs.rm(req.file.path, deleteErr => {
                                console.log('delete temp file ' + req.file.path)
                            })
                            if (copyFileError.code === 'EEXIST'){
                                res.send(new ResponseError('', '文件已存在'))
                            } else {
                                res.send(new ResponseError(copyFileError.message, '上传失败'))
                            }
                        })
                    } else {
                        fs.rm(req.file.path, deleteErr => {
                            if (deleteErr) {
                                console.error(deleteErr);
                                utility.knex(TABLE_NAME).del().where('id', id).then(count => {})
                                res.send(new ResponseError(deleteErr.message, '服务器临时文件删除失败'))
                            } else {
                                res.send(new ResponseSuccess('', '上传成功'))
                            }
                        })
                    }
                })
        })
        .catch(errInfo => {
            console.error(errInfo)
            res.send(new ResponseError(errInfo, '无权操作'))
        })
})

router.post('/modify', (req, res, next) => {
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex(TABLE_NAME).update('description', req.body.description).where('id', req.body.fileId).andWhere('uid', userInfo.uid)
                .then(count => {
                    if (count > 0) {
                        utility.updateUserLastLoginTime(userInfo.uid)
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
        .catch(errInfo => {
            console.error(errInfo)
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

// TODO: 用事务处理
router.delete('/delete', (req, res, next) => {
    // 1. 验证用户信息是否正确
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            utility.knex(TABLE_NAME).del().where('id', req.body.fileId).andWhere('uid', userInfo.uid).returning('path')
                .then(delFile => {
                    if (delFile.length > 0) {
                        delFile = delFile[0];
                        utility.updateUserLastLoginTime(userInfo.uid)
                        fs.rm(`../${delFile.path}`, {force: true}, errDeleteFile => {
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
        .catch(errInfo => {
            console.error(errInfo)
            res.send(new ResponseError('', 'error'))
        })
})

router.get('/list', (req, res, next) => {
    utility
        .verifyAuthorization(req)
        .then(userInfo => {
            let startPoint = (req.query.pageNo - 1) * req.query.pageSize // 文件记录起点
            let query = utility.knex(TABLE_NAME).select().where('uid', userInfo.uid).offset(startPoint).limit(req.query.pageSize);

            query.then(data => {
                utility.updateUserLastLoginTime(userInfo.uid)
                res.send(new ResponseSuccess(data, '请求成功'))
            })
            .catch(err => {
                console.error(err)
                res.send(new ResponseError(err.message, 'error'))
            })
        })
        .catch(errInfo => {
            console.error(errInfo)
            res.send(new ResponseError(errInfo.message, 'error'))
        })
})

module.exports = router
