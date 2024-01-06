const express = require('express')
const router = express.Router()
const utility = require('../config/utility')
const ResponseSuccess = require("../response/ResponseSuccess");
const ResponseError = require("../response/ResponseError");
const { stat, writeFile } = require("fs");

const LOCK_FILE_NAME = 'DATABASE_LOCK'

router.get('/', (req, res, next) => {

    stat(LOCK_FILE_NAME, ((err, stats) => {
        if (err){
            // 如果没有该文件，说明数据库没有初始化过
            let tempConfigDatabase = {}
            Object.assign(tempConfigDatabase, configDatabase)
            delete tempConfigDatabase.database
            const sqlCreation = 'CREATE DATABASE IF NOT EXISTS diary'
            utility.knex.raw(sqlCreation)
                .then(res => {
                    console.log('- 1. success: create db diary')
                    createTables()
                        .then(msg => {

                            writeFile(LOCK_FILE_NAME, 'Database has been locked, file add in ' + utility.dateFormatter(new Date()),err => {
                                if (err){
                                    res.send('初始化失败')
                                } else {
                                    res.send(
                                        '数据库初始化成功：<br>' +
                                        '数据库名： diary<br>' +
                                        '创建 6 张表：users、user_group、diaries、diary_category、qrs、invitations <br>' +
                                        '已创建数据库锁定文件： ' + LOCK_FILE_NAME
                                    )
                                }
                            })

                        })
                        .catch(msg => {
                            res.send(msg)
                        })
                })
                .catch(err => {
                    console.log('- 1. fail : create db fails, \nwith err info: \n' + err.message)
                    res.send(new ResponseError(err, err.message))
                });
        } else {
            // 如果已经初始化过了
            res.send('该数据库已被初始化过，如果想重新初始化，请先删除项目中 <b>DATABASE_LOCK</b> 文件')
        }
    }))
})

async function createTables2() {
    const kenx = utility.knex;
    try
    {
        await knex.schema.dropTableIfExist('diary_category');
        await knex.schema.createTable('diary_category', function (table) {
            table.tinyint('sort_id').defaultTo(null);
            table.string('name_en', 50).notNull().comment('类别英文名').primary();
            table.string('name', 50).notNull().comment('类别名');
            table.smallint('count').notNull().comment("类别日记数量");
            table.string('color',10).notNull().defaultTo('#cccccc').comment('类别颜色');
            table.datetime('date_init').notNull();

            table.engine('InnoDB');
        });

        await knex('diary_category').insert([
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 3,  name_en: 'bigevent',  name:'大事', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 9,  name_en: 'article',   name:'文章', count:0, color:'#CC73E1', date_init:'2022-03-23 21:23:02'},
            { sort_id: 3,  name_en: 'bigevent',  name:'大事', count:0, color:'#FF3B30', date_init:'2022-03-23 21:23:02'},
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
        await knex.schema.dropTableIfExists('users');
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
            table.primary(['uid', 'email']);

            table.engine('InnoDB');
        });

        await knex.schema.dropTableIfExists('file_manager');
        await knex.schema.createTable(`file_manager`, function (table) {
            table.primary().increments('id').comment("hash");
            table.string('name_original').notNull().comment("原文件名");
            table.string('path').comment('文件路径');
            table.string('description').comment('描述');
            table.datetime('date_create').notNull().comment('创建时间');
            table.string('type').notNull().defaultTo('image').comment('image, file');
            table.integer('uid').notNull().references('uid').inTable('users').comment('uid');
            table.integer('size').notNull().comment('file size');

            table.engine('InnoDB');
        });

        await knex.schema.dropTableIfExists('user_group');
        await knex.schema.createTable(`user_group`, function (table) {
            table.primary().increments('id').comment("group ID");
            table.string('name').notNull().comment("group name");
            table.string('description');

            table.engine('InnoDB');
        });

        const groups = [
            {id:1, name:'admin', 'description': '管理员'},
            {id:2, name:'user', 'description': '普通成员'},
        ];

        await knex('user_group').insert(groups);


        await knex.schema.dropTableIfExists('invitations');
        await knex.schema.createTable(`invitations`, function (table) {
            table.primary().increments('id').comment("ID");
            table.datetime('date_create').notNull().comment('创建时间');
            table.datetime('date_register').notNull().comment('注册时间');
            table.integer('binding_uid').index().references('uid').inTable('users').onDelete('restrict').onUpdate('restrict').comment("group name");

            table.engine('InnoDB');
        });


        await knex.schema.dropTableIfExists('diaries');
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

/*
function createTables(){
    return new Promise((resolve, reject) => {
        let connection = mysql.createConnection(configDatabase)
        console.log(configDatabase)
        connection.connect()
        const sqlCreateTables = `
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

USE diary;

-- ----------------------------
-- Table structure for diary_category
-- ----------------------------
DROP TABLE IF EXISTS \`diary_category\`;
CREATE TABLE \`diary_category\`  (
  \`sort_id\` tinyint(1) NULL DEFAULT NULL,
  \`name_en\` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '类别英文名',
  \`name\` varchar(50) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL COMMENT '类别名',
  \`count\` int(6) NOT NULL DEFAULT 0 COMMENT '类别日记的数量',
  \`color\` char(10) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL DEFAULT '#cccccc' COMMENT '类别颜色',
  \`date_init\` datetime(0) NOT NULL,
  PRIMARY KEY (\`name_en\`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Records of diary_category
-- ----------------------------
INSERT INTO \`diary_category\` VALUES (9, 'article', '文章', 0, '#CC73E1', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (3, 'bigevent', '大事', 0, '#FF3B30', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (10, 'bill', '账单', 0, '#8bc34a', '2022-05-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (8, 'film', '电影', 0, '#FF2D70', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (7, 'game', '游戏', 0, '#5AC8FA', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (1, 'life', '生活', 0, '#FF9500', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (11, 'memo', '备忘', 0, '#BABABA', '2022-10-31 17:16:15');
INSERT INTO \`diary_category\` VALUES (12, 'play', '剧本', 0, '#00AAFF', '2022-12-29 08:44:21');
INSERT INTO \`diary_category\` VALUES (13, 'sentiment', '情感', 0, '#00C975', '2023-01-16 15:21:12');
INSERT INTO \`diary_category\` VALUES (4, 'sport', '运动', 0, '#FFCC00', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (2, 'study', '学习', 0, '#4CD964', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (4, 'todo', '待办', 0, '#24C5FF', '2023-12-12 10:17:35');
INSERT INTO \`diary_category\` VALUES (5, 'week', '周报', 0, '#5856D6', '2022-03-23 21:23:02');
INSERT INTO \`diary_category\` VALUES (6, 'work', '工作', 0, '#007AFF', '2022-03-23 21:23:02');


-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\`  (
  \`uid\` int(11) NOT NULL AUTO_INCREMENT,
  \`email\` varchar(50) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  \`nickname\` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '昵称',
  \`username\` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT '用户名',
  \`password\` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '密码',
  \`register_time\` datetime(0) NULL DEFAULT NULL COMMENT '注册时间',
  \`last_visit_time\` datetime(0) NULL DEFAULT NULL COMMENT '最后访问时间',
  \`comment\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '注释',
  \`wx\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT '' COMMENT '微信二维码',
  \`phone\` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '手机号',
  \`homepage\` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '个人主页',
  \`gaode\` varchar(250) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '高德组队邀请码',
  \`group_id\` int(11) NOT NULL DEFAULT 2 COMMENT '用户组别ID',
  \`count_diary\` int(8) NULL DEFAULT 0 COMMENT '数量 - 日记',
  \`count_dict\` int(8) NULL DEFAULT 0 COMMENT '数量 - 码表',
  \`count_qr\` int(8) NULL DEFAULT 0 COMMENT '数量 - 二维码',
  \`count_words\` int(8) NULL DEFAULT 0 COMMENT '数量 - 词条',
  \`count_map_route\` int(8) NULL DEFAULT 0 COMMENT '数量 - 路线规划',
  \`sync_count\` int(6) NULL DEFAULT 0 COMMENT '同步次数',
  \`avatar\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT 'avatar图片地址',
  \`city\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '城市',
  \`geolocation\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '经纬度',
  PRIMARY KEY (\`uid\`, \`email\`) USING BTREE,
  INDEX \`group_id\`(\`group_id\`) USING BTREE,
  INDEX \`uid\`(\`uid\`) USING BTREE,
  CONSTRAINT \`group_id\` FOREIGN KEY (\`group_id\`) REFERENCES \`user_group\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 0 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = Compact;


-- ----------------------------
-- Table structure for map_route
-- ----------------------------
DROP TABLE IF EXISTS \`map_route\`;
CREATE TABLE \`map_route\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) NOT NULL COMMENT '路线名称',
  \`area\` varchar(255) NOT NULL COMMENT '地址位置',
  \`road_type\` varchar(255) NOT NULL COMMENT '路面类型',
  \`seasons\` varchar(255) NOT NULL COMMENT '骑行季节',
  \`video_link\` varchar(255) DEFAULT NULL COMMENT '视频链接',
  \`paths\` longtext NOT NULL COMMENT '路线节点',
  \`note\` longtext DEFAULT NULL COMMENT '备注',
  \`date_init\` datetime DEFAULT NULL COMMENT '创建时间',
  \`date_modify\` datetime DEFAULT NULL COMMENT '编辑时间',
  \`thumb_up\` int(10) DEFAULT 0 COMMENT '点赞数',
  \`uid\` int(11) DEFAULT NULL COMMENT 'user',
  \`is_public\` int(1) NOT NULL DEFAULT 0 COMMENT '是否共享 0否 1是',
  \`policy\` int(1) DEFAULT NULL COMMENT '路线规划策略',
  PRIMARY KEY (\`id\`) USING BTREE,
  KEY \`map_uid\` (\`uid\`) USING BTREE,
  CONSTRAINT \`map_uid\` FOREIGN KEY (\`uid\`) REFERENCES \`users\` (\`uid\`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;


DROP TABLE IF EXISTS \`map_pointer\`;
CREATE TABLE \`map_pointer\` (
  \`id\` int(10) NOT NULL AUTO_INCREMENT COMMENT 'ID',
  \`name\` varchar(255) NOT NULL COMMENT '标题',
  \`pointers\` longtext NOT NULL COMMENT '地点信息数组数据',
  \`note\` longtext DEFAULT NULL COMMENT '简介',
  \`uid\` int(11) NOT NULL COMMENT '创建人',
  \`date_create\` datetime NOT NULL COMMENT '创建时间',
  \`date_modify\` datetime DEFAULT NULL COMMENT '编辑时间',
  \`area\` varchar(255) DEFAULT NULL COMMENT '地域',
  \`thumb_up\` int(10) DEFAULT NULL COMMENT '点赞数量',
  \`is_public\` int(1) NOT NULL DEFAULT 0 COMMENT '公开与否',
  \`visit_count\` int(9) DEFAULT NULL COMMENT '访问次数',
  PRIMARY KEY (\`id\`) USING BTREE,
  KEY \`userId\` (\`uid\`),
  CONSTRAINT \`userId\` FOREIGN KEY (\`uid\`) REFERENCES \`users\` (\`uid\`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;


-- ----------------------------
-- Table structure for file_manager
-- ----------------------------
DROP TABLE IF EXISTS \`file_manager\`;
CREATE TABLE \`file_manager\` (
  \`id\` int(100) NOT NULL AUTO_INCREMENT COMMENT 'hash',
  \`name_original\` varchar(255) NOT NULL COMMENT '原文件名',
  \`path\` varchar(255) DEFAULT NULL COMMENT '文件路径',
  \`description\` varchar(255) DEFAULT NULL COMMENT '描述',
  \`date_create\` datetime NOT NULL COMMENT '创建时间',
  \`type\` varchar(255) NOT NULL DEFAULT 'image' COMMENT 'image, file',
  \`uid\` int(11) NOT NULL COMMENT 'uid',
  \`size\` int(10) NOT NULL COMMENT '文件大小',
  PRIMARY KEY (\`id\`) USING BTREE,
  KEY \`uid link\` (\`uid\`),
  CONSTRAINT \`uid link\` FOREIGN KEY (\`uid\`) REFERENCES \`users\` (\`uid\`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;


-- ----------------------------
-- Table structure for user_group
-- ----------------------------
DROP TABLE IF EXISTS \`user_group\`;
CREATE TABLE \`user_group\`  (
  \`id\` int(11) NOT NULL AUTO_INCREMENT COMMENT '组别ID',
  \`name\` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT '组别名称',
  \`description\` varchar(255) CHARACTER SET utf8 COLLATE utf8_bin NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 0 CHARACTER SET utf8 COLLATE utf8_general_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Records of user_group
-- ----------------------------
INSERT INTO \`user_group\` VALUES (1, 'admin', '管理员');
INSERT INTO \`user_group\` VALUES (2, 'user', '普通成员');


-- ----------------------------
-- Table structure for invitations
-- ----------------------------
DROP TABLE IF EXISTS \`invitations\`;
CREATE TABLE \`invitations\`  (
  \`id\` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'hash',
  \`date_create\` datetime(0) NOT NULL COMMENT '创建时间',
  \`date_register\` datetime(0) NULL DEFAULT NULL COMMENT '注册时间',
  \`binding_uid\` int(255) NULL DEFAULT NULL COMMENT '注册绑定的用户',
  PRIMARY KEY (\`id\`) USING BTREE,
  INDEX \`bind_uid\`(\`binding_uid\`) USING BTREE,
  CONSTRAINT \`bind_uid\` FOREIGN KEY (\`binding_uid\`) REFERENCES \`users\` (\`uid\`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Dynamic;


-- ----------------------------
-- Table structure for diaries
-- ----------------------------
DROP TABLE IF EXISTS \`diaries\`;
CREATE TABLE \`diaries\`  (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`date\` datetime(0) NOT NULL COMMENT '日记日期',
  \`title\` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '标题',
  \`content\` longtext CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL COMMENT '内容',
  \`temperature\` int(3) NULL DEFAULT -273 COMMENT '室内温度',
  \`temperature_outside\` int(3) NULL DEFAULT -273 COMMENT '室外温度',
  \`weather\` enum('sunny','cloudy','overcast','sprinkle','rain','thunderstorm','fog','snow','tornado','smog','sandstorm') CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT 'sunny' COMMENT '天气',
  \`category\` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL DEFAULT 'life' COMMENT '类别',
  \`date_create\` datetime(0) NOT NULL COMMENT '创建日期',
  \`date_modify\` datetime(0) NULL DEFAULT NULL COMMENT '编辑日期',
  \`uid\` int(11) NOT NULL COMMENT '用户id',
  \`is_public\` int(1) NOT NULL DEFAULT 0 COMMENT '是否共享',
  \`is_markdown\` int(1) NOT NULL DEFAULT 0 COMMENT '是否为 Markdown',
  PRIMARY KEY (\`id\`) USING BTREE,
  INDEX \`category_link\`(\`category\`) USING BTREE,
  CONSTRAINT \`category_link\` FOREIGN KEY (\`category\`) REFERENCES \`diary_category\` (\`name_en\`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for qrs
-- ----------------------------
DROP TABLE IF EXISTS \`qrs\`;
CREATE TABLE \`qrs\`  (
  \`hash\` varchar(200) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NOT NULL COMMENT 'hash',
  \`is_public\` int(11) NOT NULL DEFAULT 0 COMMENT '是否启用',
  \`message\` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '挪车说明',
  \`description\` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '简介',
  \`is_show_phone\` int(11) NOT NULL DEFAULT 0 COMMENT '手机号 - 显示开关',
  \`is_show_car\` int(11) NOT NULL DEFAULT 0 COMMENT '车辆 - 显示开关',
  \`car_name\` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '车辆标题',
  \`car_plate\` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '车牌号',
  \`car_desc\` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_bin NULL DEFAULT NULL COMMENT '车辆描述',
  \`wx_code_img\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '微信二维码图片地址',
  \`is_show_wx\` int(11) NOT NULL DEFAULT 0 COMMENT '微信二维码 - 显示开关',
  \`is_show_homepage\` int(11) NOT NULL DEFAULT 0 COMMENT '个人主页 - 显示开关',
  \`is_show_gaode\` int(11) NOT NULL DEFAULT 0 COMMENT '高德组队邀请码 - 显示开关',
  \`date_modify\` datetime(0) NULL DEFAULT NULL COMMENT '最后编辑日期',
  \`date_init\` datetime(0) NULL DEFAULT NULL COMMENT '注册时间',
  \`visit_count\` int(11) NOT NULL DEFAULT 0 COMMENT '被访问次数',
  \`uid\` int(6) NOT NULL COMMENT '所属用户 uid',
  \`imgs\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '图片地址',
  \`car_type\` int(2) NOT NULL DEFAULT 0 COMMENT '车辆类型： 0汽车，1摩托车',
  PRIMARY KEY (\`hash\`) USING BTREE,
  INDEX \`username\`(\`uid\`) USING BTREE,
  CONSTRAINT \`code_ibfk_1\` FOREIGN KEY (\`uid\`) REFERENCES \`users\` (\`uid\`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = Compact;


-- ----------------------------
-- Table structure for wubi_dict
-- ----------------------------
DROP TABLE IF EXISTS \`wubi_dict\`;
CREATE TABLE \`wubi_dict\`  (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`title\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '码表名',
  \`content\` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL COMMENT '码表内容',
  \`content_size\` int(6) NULL DEFAULT 0 COMMENT '码表内容字数',
  \`word_count\` int(6) NULL DEFAULT 0 COMMENT '码表内容的词条数',
  \`date_init\` datetime(0) NOT NULL COMMENT '首次上传时间',
  \`date_update\` datetime(0) NULL DEFAULT NULL COMMENT '最后同步时间',
  \`comment\` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NULL DEFAULT NULL COMMENT '注释',
  \`uid\` int(11) NULL DEFAULT NULL COMMENT '所属用户',
  PRIMARY KEY (\`id\`, \`title\`) USING BTREE,
  INDEX \`uid\`(\`uid\`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 0 CHARACTER SET = utf8mb3 COLLATE = utf8mb3_general_ci ROW_FORMAT = Compact;


SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for thumbs_up
-- ----------------------------
DROP TABLE IF EXISTS \`thumbs_up\`;
CREATE TABLE \`thumbs_up\` (
  \`name\` varchar(50) NOT NULL,
  \`count\` int(11) NOT NULL DEFAULT 0 COMMENT '点赞数',
  \`description\` varchar(255) DEFAULT NULL COMMENT '说明',
  \`link_address\` varchar(100) DEFAULT NULL COMMENT '部署地址',
  \`date_init\` datetime NOT NULL COMMENT '添加地址',
  PRIMARY KEY (\`name\`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci ROW_FORMAT=DYNAMIC;


-- ----------------------------
-- Table structure for image_qiniu
-- ----------------------------
DROP TABLE IF EXISTS \`image_qiniu\`;
CREATE TABLE \`image_qiniu\` (
  \`id\` varchar(100) NOT NULL COMMENT 'hash',
  \`description\` varchar(255) DEFAULT NULL COMMENT '描述',
  \`date_create\` datetime NOT NULL COMMENT '创建时间',
  \`type\` varchar(255) NOT NULL DEFAULT 'image' COMMENT 'image, file',
  \`bucket\` varchar(255) NOT NULL COMMENT 'Bucket name',
  \`base_url\` varchar(255) NOT NULL COMMENT 'base url',
  PRIMARY KEY (\`id\`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;


SET FOREIGN_KEY_CHECKS = 1;
`
        connection.query(sqlCreateTables, [], function (err, result) {
            console.log('result: ', result)
            if (err){
                console.log('-- 2. fail: create table diaries, users')
                reject('失败：新建 tables: users, diaries，\ninfo: \n' + err.message)
            } else {
                console.log('-- 2. success: create table diaries, users')
                resolve('成功：新建 tables: users, diaries')
            }
        })
        connection.end()
    })
}
*/

module.exports = router
