/**
 * Created by Evan on 2017/7/13.
 * 本地错误日志
 */
const errorLog = require('../config').errorLogfile;

exports.write = function(errmsg) {
    if (typeof errmsg != 'string') {
        errmsg = JSON.stringify(errmsg);
    }
    let now = new Date();
    let time = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
    errorLog.write(time + '\r\n' + errmsg + '\r\n');
};
