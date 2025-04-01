/**
 * Created by Disen on 2017/3/25 0025.
 * Update by Evan on 2017/9/13
 * 常用函数封装
 */
var os = require('os');
var process = require('child_process');
const uuidv4 = require('uuid/v4');
var crypto = require('crypto');
const xml2js = require('xml2js')

module.exports = {
    create_token_name_last: function(TOKEN_ROOT,name)
    {
        if(!name) return name;
        let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

        let len = name.length;
        if(len>0) return TOKEN_NAME+"_"+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)+name

        return name;
    },
    create_token_name_pre: function(TOKEN_ROOT,name)
    {
        if(!name) return name;
        let TOKEN_NAME = TOKEN_ROOT.split('_')[0]

        let len = name.length;
        if(len>0) return TOKEN_NAME+"_"+name+TOKEN_ROOT.substring((TOKEN_NAME+"_").length+len,TOKEN_ROOT.length)

        return name;
    },
    StrIsEmpty: function(str) {
        if (str == undefined || str == "" || str == null || str.length == 0) {
            return true;
        }
        return false;
    },
    md5: function(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    },
    randomBytes: function(num) {
        var buf = crypto.randomBytes(num);
        var token = buf.toString('hex');
        return token;
    },
    randomSafe: function(num) {
        console.log("os.platform:"+os.platform())
        if(os.platform()=="win32")
        {
            var buf = crypto.randomBytes(num);
            var token = buf.toString('hex');
            return token;

        }else{
            let result = process.execSync("head -n2 /dev/urandom|md5sum|head -c32")
            console.log("process.execSync-urandom:"+result)
            return result;
        }
    },
    GetUserIP: function(req) {
        // var ipAddress;
        // var forwardedIpsStr = req.header('x-forwarded-for');
        // if (forwardedIpsStr) {
        //     var forwardedIps = forwardedIpsStr.split(',');
        //     ipAddress = forwardedIps[0];
        // }
        // if (!ipAddress) {
        //     ipAddress = req.connection.remoteAddress;
        // }
        // return ipAddress;

        var ip = req.headers['x-forwarded-for'] || req.ip ||
            req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress || '';
        if(ip!=undefined && ip!=null && ip.split(',').length>0){
            ip = ip.split(',')[0]
        }

        // console.log("ip1:"+ip);
        if(ip!=undefined && ip!=null) {
            if(ip.lastIndexOf(":")>0 && ip.lastIndexOf(":")<ip.length) {
                ip = ip.substring(ip.lastIndexOf(":")+1,ip.length);
            }
        } else {
            ip = "";
        }
        // console.log("ip2:"+ip);
        return ip;
    },
    in_array: function(search, array) {
        for (var i in array) {
            if (array[i] == search) {
                return true;
            }
        }
        return false;
    },
    GetDateFormat: function(format, timestr) {
        var data = new Date();;
        if (timestr) {
            data = new Date(timestr * 1000);
        }
        var t = data.getFullYear() + "-" + (data.getMonth() < 9 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1)) + "-" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate());
        t = t + " " + (data.getHours() < 10 ? '0' + data.getHours() : data.getHours()) + ':' + (data.getMinutes() < 10 ? '0' + data.getMinutes() : data.getMinutes()) + ':' + (data.getSeconds() < 10 ? '0' + data.getSeconds() : data.getSeconds());
        if (format == 'y-m') {
            t = data.getFullYear() + "-" + (data.getMonth() < 9 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1));
        }
        if (format == 'y-m-d') {
            t = data.getFullYear() + "-" + (data.getMonth() < 9 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1)) + "-" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate());
        }
        return t;
    },
    GetDateTimeFormat: function(timestr) {
        var data = new Date();;
        if (timestr) {
            data = new Date(timestr * 1000);
        }
        let t = data.getFullYear() + "-" + (data.getMonth() < 9 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1))
            + "-" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate()) +
            " "+(data.getHours() < 10 ? '0' + data.getHours() : data.getHours()) +":"
            +(data.getMinutes() < 10 ? '0' + data.getMinutes() : data.getMinutes()) //+"."+data.getSeconds();

        return t;
    },
    GetTimeFormat: function() {
        //private SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMddHHmmss");
        var data = new Date();
        var t = data.getFullYear() +  (data.getMonth() < 9 ? '' + (data.getMonth() + 1) : (data.getMonth() + 1)) +
            "" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate()) +
            ""+data.getHours()+""+data.getMinutes()+""+data.getSeconds();
        return t;
    },
    randomNum(length) {
        if (length < 1) {
            return null;
        }
        var buf = crypto.randomBytes(length);
        var token = buf.toString('hex');

        var tenStr = parseInt(token,16);
        //console.log("randomNum:"+token+" ten:"+tenStr+" substring:"+(""+tenStr).substring(0,length-1))
        return (""+tenStr).substring(2,length);
    },
    credit_score_count: function(user_level) {
        var level_score = 0;
        if (user_level > 0) {
            if (user_level >= 1 && user_level <= 6) {
                level_score = (100 / 6) * user_level;
                if (user_level == 6) {
                    level_score = 100;
                }
                level_score = parseInt(level_score);
            }
            if (user_level >= 7 && user_level <= 10) {
                level_score = (100 / 4) * (user_level - 6) + 100;
                level_score = parseInt(level_score);
                if (user_level == 10) {
                    level_score = 200;
                }
            }
            if (user_level >= 11 && user_level <= 18) {
                level_score = (100 / 8) * (user_level - 10) + 200;
                level_score = parseInt(level_score);
                if (user_level == 18) {
                    level_score = 300;
                }
            }
        }
        return level_score;
    },
    ipv4_check: function(ip) {
        if (ip == null)
            return false;
        if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))
            return false;
        var str_arr = ip.split("."); //分割成数字数组
        for (var i = 0; i < str_arr.length; i++) {
            var v = parseInt(str_arr[i]);
            if (v < 0 || v > 255)
                return false;
        }
        return true;
    },
    //获取参数
    get_req_data: function(req) {
        var req_data = {};
        Object.assign(req_data, req.query, req.body, req.params);
        return req_data;
    },

    sleep:function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    hashVal:async function(msgUint8Array,hashName = 'SHA-256')
    {
        return  (await eccryptoJS.sha256(msgUint8Array)).toString('hex')
    },

    parseJSON:function(str){
        if(!str)
            return str;
        try{
            let json = JSON.parse(str);
            return json;
        }catch(error)
        {
            return str;
        }
    },getSign:function(str){
        console.log(str)
        let hash = crypto.createHash('md5').update(str,'utf8');
        return hash.digest('hex').toUpperCase();
    },
    json2xml:function(obj){
        let builder = new xml2js.Builder({
            headless:true,
            allowSurrogateChars: true,
            rootName:'xml',
            cdata:true
        });
        var xml = builder.buildObject(obj);
        return xml;
    },
    parseXml:function(xml){
        let {parseString} = xml2js;
        let res;
        parseString(xml,  {
            trim: true,
            explicitArray: false
        }, function (err, result) {
            res = result;
            if(err) return null;
        });
        return res;
    },
    get_nonce_str:function(len){
        let str = '';
        while(str.length < len){
            str +=  Math.random().toString(36).slice(2);
        }
        return str.slice(-len);
    },

};
