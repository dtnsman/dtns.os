/**
 * Created by evan on 2017/7/13.
 * http请求
 */


const rp = require('request-promise');

exports.httpPost = httpPost;
exports.httpGet = httpGet;


async function httpPost(apiUrl, postData, cnt = 0) {
    let res = null;
    let flag = true;

    await rp.post({ url: apiUrl, form: postData, timeout: 3000 })
        .then((body) => {
            res = JSON.parse(body);
        }).catch((err) => {
            flag = false;
            res = err;
        })
    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = '请求失败' + cnt + '次，url:' + apiUrl + ',err:' + res;
        console.log(err_msg);
        global.ErrorLog.write(err_msg);

        await sleep(500);
        res = await httpPost(apiUrl, postData, cnt);
    }
    return res;
}

async function httpGet(apiUrl, cnt = 0) {
    let res = null;
    let flag = true;

    await rp.get(apiUrl)
        .then((body) => {
            res = JSON.parse(body);
        }).catch((err) => {
            flag = false;
            res = err;
        })
    if (!flag && cnt < 3) {
        //请求失败后会再发送请求,最多请求3次
        cnt++;
        let err_msg = '请求失败' + cnt + '次，url:' + apiUrl + ',err:' + res;
        console.log(err_msg);
        global.ErrorLog.write(err_msg);

        await sleep(500);
        res = await httpGet(apiUrl, cnt);
    }
    return res;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
