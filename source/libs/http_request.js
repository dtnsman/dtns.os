/**
 * Created by evan on 2017/7/13.
 * http请求
 */


const rp = require('request-promise');
const request = require('request');
// const error_log = require('../libs/error_log');

exports.http_post = http_post;


// async function http_post(api_url, post_data) {
//     let res = null;
//     let flag = true;
//     console.log("post_data:"+JSON.stringify(post_data))
//
//     await new Promise((resolve,reject)=>{
//         request.post({
//             // url:"http://node.opencom.user.c1.forklist.dtns/chain/opcode?token=user_265XTrtWAMvoiNdR&opcode=assert&begin=0&len=1&appid=1001&secret_key=Jcv78NmxiO",
//             url:api_url,
//             json: true,
//             timeout:3000,
//             form:post_data,
//             // multipart:
//             //     [ { 'content-type': 'application/json'
//             //         ,  body: JSON.stringify(post_data)
//             //     }
//             //         , { body: 'I am an attachment' }
//             //     ]
//             // formData:post_data,
//             // body: post_data
//             // formData: post_data
//         }, function(error, response, body) {
//             if(error)
//             {
//                 console.log("body:"+body) // 请求成功的处理逻辑
//                 reject(error)
//                 return ;
//             }
//             if (!error && response.statusCode == 200) {
//                 console.log(JSON.stringify(body)) // 请求成功的处理逻辑
//                 resolve(body)
//             }
//         });
//     }).then(function(data)
//     {
//         flag  = true;
//         res = data;
//     }).catch(function(err){
//         console.log("error:"+err)
//         flag = false;
//         res = null;
//     });
//
//     return res;
// }

async function http_post(api_url, post_data, cnt = 0) {
    let res = null;
    let flag = true;

    await rp.post({ url: api_url, form: post_data, timeout: 3000 })
        .then((body) => {
            res = JSON.parse(body);
        }).catch((err) => {
            flag = false;
            res = err;
        })
    if (!flag && cnt < 0) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        if (api_url != 'http://api.dtns.top/ibuger_service/c/check_user_session.jsp' && api_url.indexOf('baidu') < 0) {
            let err_msg = '请求失败' + cnt + '次，url:' + api_url + ',err:' + res;
            console.log(err_msg);
            global.error_log.write(err_msg);
        }
        await sleep(500);
        res = await http_post(api_url, post_data, cnt);
    }
    return res;
}

module.exports.http_get = http_get
async function http_get(api_url, data, cnt = 0) {
    let res = null;
    let flag = true;

    console.log('rp.get:',rp.get)
    var options = {
        uri:api_url,
        qs:data,
        headers: {
            'User-Agent': 'Request-Promise'
        },
        strictSSL:false,
        // json: true // Automatically parses the JSON string in the response
    };
     
    await rp(options)//.get({ url: api_url, form: data, timeout: 3000 })
        .then((body) => {
            console.log('body:',body)
            res = JSON.parse(body);
        }).catch((err) => {
            console.log('http_get-exception:'+err,err)
            flag = false;
            res = err;
        })
    return res;
}



exports.http_post_block = http_post_block
async function http_post_block(api_url, post_data, cnt = 0) {
    let res = null;
    let flag = true;

    await rp.post({ url: api_url, form: post_data, timeout: 300000 })
        .then((body) => {
            res = JSON.parse(body);
        }).catch((err) => {
            flag = false;
            res = err;
        })
        if (!flag && cnt < 0) {
            //请求失败后会再发送请求,最多请求3次
            cnt++;
            if (api_url != 'http://api.dtns.top/ibuger_service/c/check_user_session.jsp' && api_url.indexOf('baidu') < 0) {
                let err_msg = '请求失败' + cnt + '次，url:' + api_url + ',err:' + res;
                console.log(err_msg);
                global.error_log.write(err_msg);
            }
        await sleep(500);
            res = await http_post_block(api_url, post_data, cnt);
        }
    return res;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
