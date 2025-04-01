/**
 * Created by  poplang
 * 初始化配置加载
 */

const pkg = require('./package.json');
const str_filter = require("./libs/str_filter")

// const c_setting = require('./setting/c.json')
// //遍历并设置
// for(key in c_setting)
// {
//     window[key] = c_setting[key]
// }

const config = {
    debug: true,
    host: '127.0.0.1',
    port: 8088,
    name: 'FORKList',
    redis_key:'FORKList_key:',
    version: pkg.version,
    file_temp:__dirname+'/'+window.file_temp,
    dtns_db_path:__dirname+'/'+window.dtns_db_path,//'/static/dtns/',
    hub_db_path:__dirname+'/'+window.hub_db_path,//'/static/lx/',
    log_path:__dirname+'/'+window.log_path,
}

const fs = require('fs');
const errorLogfile = fs.createWriteStream(config.log_path + str_filter.GetDateFormat('y-m-d')+'.log',
    { flags: 'a', encoding: null, mode: 0777 });

// const db_config = require('./db_config');
// const DB = require('./libs/DB');
// const db_cloud = new DB(db_config);


// const redis_config = require('./redis_config');
// const RedisClient = require('./libs/RedisClient');
// const user_redis = new RedisClient(redis_config);

const sqldb = new SQLDB()
sqldb.initDB({type:'buffer',buffer:null,dbtype:'sqljs'},null,//{type:'file',filepath:'rmb_test.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                        {type:'level',path:'user_cache',vtype:'json'})

const sqldb2 = new SQLDB()
sqldb2.initDB({type:'file',filepath: config.hub_db_path+'kmm.db',dbtype:'sqlite3'},null,//{type:'buffer',buffer:config.dbBuff,dbtype:'sqljs'},//{type:'file',filepath:'chat02G32Zmqgh8P_gsb.db',dbtype:'sqlite3'},//filepath:'db1.1.data',dbtype:'sqlite3'
                    {type:'sql',path:'leveldb_cache1',vtype:'json'})

module.exports.config = config;
module.exports.user_redis = sqldb;
window.user_redis = sqldb
window.kmmDb = sqldb2
module.exports.errorLogfile = errorLogfile;

