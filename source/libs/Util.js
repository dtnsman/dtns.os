/**
 * Created by Evan on 2018/3/20.
 * session 工具
 */

const CommomUtil = require('../libs/CommomUtil');
const HttpRequest = require('../libs/HttpRequest');

const db_user = require('../config').db_user;
const redis_user = require('../config').redis_user;



module.exports.checkTySession = checkTySession;
module.exports.setTySession = setTySession;
module.exports.getTySession = getTySession;


//检测ty_s_id
async function checkTySession(ty_id, ty_s_id) {
    if (CommomUtil.isEmpty(ty_id) || CommomUtil.isEmpty(ty_s_id)) {
        return false;
    }
    let str = await redis_user.get(ty_id + ',' + ty_s_id);
    if (!CommomUtil.isEmpty(str)) {
        return true;
    }
    let sql = 'select * from ty_session where ty_id="' + ty_id + '" and ty_s_id="' + ty_s_id + '"';
    let data = await db_user.queryOne(sql);
    if (data != null) {
        console.log('=======session sql get==========');
        redis_user.set(ty_id + ',' + ty_s_id, '1');
    }
    return data != null;
}


//存储ty_s_id
async function setTySession(ty_id, ty_s_id) {
    let sql = 'insert into ty_session (ty_id,ty_s_id) values("' + ty_id + '","' + ty_s_id + '")';
    let num = await db_user.queryNum(sql);
    if (num > 0) {
        redis_user.set(ty_id + ',' + ty_s_id, '1');
    }
}


//获取ty_s_id
async function getTySession(ty_id) {
    let ty_s_id = null;
    let sql = 'select * from ty_session where ty_id="' + ty_id + '" order by create_time desc limit 1';
    let data = await db_user.queryOne(sql);
    if (data != null) {
        ty_s_id = data['ty_s_id'];
        redis_user.set(ty_id + ',' + ty_s_id, '1');
    } else {
        ty_s_id = CommomUtil.getRandomSession(32);
        setTySession(ty_id, ty_s_id);
    }
    return ty_s_id;
}


