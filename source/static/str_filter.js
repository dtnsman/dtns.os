/**
 * Created by Disen on 2017/3/25 0025.
 * Update by Evan on 2017/9/13
 * 常用函数封装
 */
// var os = require('os');
// var process = require('child_process');
// const uuidv4 = require('uuid/v4');
// var crypto = require('crypto');

window.str_filter= {
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
    md5:function(str) {
        return hex_md5(str)
        // return crypto.createHash('md5').update(str).digest('hex');
        // const encoder = new TextEncoder()//将字符串转码为utf8编码的unit8Array
        // let a = await window.crypto.subtle.digest(
        // {
        //     name: 'md5'
        // },
        // new Uint8Array(encoder.encode(msg)))//[1,2,3,4,6,7,8,9,10]))

        // //console.log('a:',a)
        // const tx = new Uint8Array(a)//Secp256k1.uint256(new Uint8Array(a), 16)
        // let txStr = Secp256k1.uint256(tx, 16).toString(16)
        // return txStr
    },
    randomBytes: function(num) {
        // var buf = crypto.randomBytes(num);
        // var token = buf.toString('hex');
        const idBuf = eccryptoJS.randomBytes(num)// window.crypto.getRandomValues(new Uint8Array(num))//32
        // let idUint256Array = idBuf.toString('hex') // Secp256k1.uint256(idBuf, 16)
        let token = idBuf.toString('hex')// idUint256Array.toString(16)

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
    getIPAdress:function() {
        var interfaces = os.networkInterfaces();
        for (var devName in interfaces) {
            var iface = interfaces[devName];
            for (var i = 0; i < iface.length; i++) {
                var alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
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
        var t = data.getFullYear() + "-" + (data.getMonth() < 10 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1)) + "-" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate());
        t = t + " " + (data.getHours() < 10 ? '0' + data.getHours() : data.getHours()) + ':' + (data.getMinutes() < 10 ? '0' + data.getMinutes() : data.getMinutes()) + ':' + (data.getSeconds() < 10 ? '0' + data.getSeconds() : data.getSeconds());
        if (format == 'y-m') {
            t = data.getFullYear() + "-" + (data.getMonth() < 10 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1));
        }
        if (format == 'y-m-d') {
            t = data.getFullYear() + "-" + (data.getMonth() < 10 ? '0' + (data.getMonth() + 1) : (data.getMonth() + 1)) + "-" + (data.getDate() < 10 ? '0' + data.getDate() : data.getDate());
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
        return (""+tenStr).substring(0,length);
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
    },
    readFileMd5:async function(url){
        return new Promise((reslove) => {
            let md5sum = crypto.createHash('md5');
            let stream = fs.createReadStream(url);
            stream.on('data', function(chunk) {
                md5sum.update(chunk);
            });
            stream.on('end', function() {
                let fileMd5 = md5sum.digest('hex');
                reslove(fileMd5);
            })
        })
    },
    readFileSha256:async function(url){
        return new Promise((reslove) => {
            let md5sum = crypto.createHash('sha256');
            let stream = fs.createReadStream(url);
            stream.on('data', function(chunk) {
                md5sum.update(chunk);
            });
            stream.on('end', function() {
                let fileMd5 = md5sum.digest('hex');
                reslove(fileMd5);
            })
        })
    },
    //得到的是sha256（用于取代readFileSha256，与key_util主要用于text文本也不一样，这里直接使用Uint8Arra）
    hashVal:async function(msgUint8Array,hashName = 'SHA-256')
    {
        return  (await eccryptoJS.sha256(msgUint8Array)).toString('hex')
        // var msg_hash = crypto.createHash(hashName).update(msg).digest('hex');
        const encoder = new TextEncoder()//将字符串转码为utf8编码的unit8Array
        let a = await window.crypto.subtle.digest(
        {
            name: hashName//"SHA-256",
        },
        msgUint8Array) //new Uint8Array(msgUint8Array)// encoder.encode(msg)))//[1,2,3,4,6,7,8,9,10]))

        //console.log('a:',a)
        const tx = new Uint8Array(a)//Secp256k1.uint256(new Uint8Array(a), 16)
        let txStr = tx.toString('hex')// Secp256k1.uint256(tx, 16).toString(16)
        //let t = bs58.encode(tx)

        return msg_hash = txStr; //16进制表示
        // return bs58Encode(Buffer.from(msg_hash));
    }

};
