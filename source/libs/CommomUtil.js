/**
 * Created by Evan on 2018/3/16.
 * 常用函数封装
 */
const crypto = require('crypto');

const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

module.exports = {
    isEmpty: function(str) {
        if (str == null || str == undefined || str == "" || str.length == 0) {
            return true;
        }
        return false;
    },
    md5: function(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    },
    randomBytes: function(num) {
        let buf = crypto.randomBytes(num);
        let token = buf.toString('hex').substring(0, num);
        return token;
    },
    getUserIP: function(req) {
        let ip = req.headers['x-forwarded-for'] || req.ip ||
            req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress || '';
        if (ip != undefined && ip != null && ip.split(',').length > 0) {
            ip = ip.split(',')[0];
        }

        // console.log("ip1:"+ip);
        if (ip != undefined && ip != null) {
            if (ip.lastIndexOf(":") > 0 && ip.lastIndexOf(":") < ip.length) {
                ip = ip.substring(ip.lastIndexOf(":") + 1, ip.length);
            }
        } else {
            ip = "";
        }
        // console.log("ip2:"+ip);
        return ip;
    },
    ipv4Check: function(ip) {
        if (ip == null)
            return false;
        if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))
            return false;
        let strArr = ip.split("."); //分割成数字数组
        for (let i = 0, len = strArr.length; i < len; i++) {
            let v = parseInt(strArr[i]);
            if (v < 0 || v > 255)
                return false;
        }
        return true;
    },
    //获取参数
    getReqData: function(ctx) {
        let reqData = {};
        Object.assign(reqData, ctx.query, ctx.request.body, ctx.params);
        return reqData;
    },
    isNumber: function(num) {
        return !this.isEmpty(num) && !isNaN(num);
    },
    getRandomSession: function(length) {
        length = length || 25;
        let session = '';
        for (let x = 0; x < length; x++) {
            let i = Math.floor(Math.random() * chars.length);
            session += chars.charAt(i);
        }
        return session;
    },
    getTxId: function() {
        let now = new Date();
        let txId = now.format('yyyyMMddhhmmssSSS');
        // console.log(txId);
        let n = 12;
        while (n--) {
            txId += parseInt(Math.random() * 10);
        }
        return txId;
    },
    getSalt: function(length) {
        length = length || 8;
        let salt = '';
        for (let x = 0; x < length; x++) {
            let i = Math.floor(Math.random() * chars.length);
            salt += chars.charAt(i);
        }
        return salt;
    },
    //检测输入，只能是中文、英文、数字
    checkInput: function(s) {
        let reg = /^(\w|[\u4E00-\u9FA5]|\+|\-|\*)*$/;
        return !!s.match(reg);
    }
};
