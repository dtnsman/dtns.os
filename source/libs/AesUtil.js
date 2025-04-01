/**
 * Created by Evan on 2018/3/16.
 * AES加密解密
 */

const crypto = require("crypto");

const CommomUtil = require('../libs/CommomUtil');

const algorithm = {
    cbc: 'aes-128-cbc',
}


module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;

/**
 * aes-128-cbc对称加密
 * @param {String} data，加密的明文
 * @param {String} secretKey，密钥，16位字符串
 * @param {Buffer} iv，向量，16位字节数组
 * @return {String} 密文
 * @api public
 * @remark 密钥的生成规则：普通字符串，用UTF8转换成Buffer后，需要对此计算MD5，再转换成Buffer对象。
 */
function encrypt(data, secretKey, iv) {
    //取消secretKey的md5加密
    // secretKey = Buffer.from(secretKey, 'utf8');
    // secretKey = CommomUtil.md5(secretKey).substring(0,16);
    // secretKey = Buffer.from(secretKey, 'hex');
    let cipher = crypto.createCipheriv(algorithm.cbc, secretKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * aes-128-ecb对称解密
 * @param {String} data，解密的密文
 * @param {String} secretKey，密钥，16位字符串
 * @param {Buffer} iv，向量，16位字节数组
 * @return {String} 明文
 * @api public
 */
function decrypt(data, secretKey, iv) {
    //取消secretKey的md5加密
    // secretKey = Buffer.from(secretKey, 'utf8');
    // secretKey = CommomUtil.md5(secretKey);
    // secretKey = Buffer.from(secretKey, 'hex');
    let decipher = crypto.createDecipheriv(algorithm.cbc, secretKey, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}




// const passwd = 'OCverifiCode1111';
// const iv = Buffer.from('dc2z83mu0ubke4kt', 'utf8');
// let data = {
//     phone: 18148770939,
//     pwd: CommomUtil.md5('06050015'),
// }

// let str = encrypt(JSON.stringify(data), passwd, iv);
// console.log(str);


// const IMKEY = 'EWfiqAHeT9ylSoDh';
// const IMIV = Buffer.from('xBSJ1oh1BOjpQ353', 'utf8');

// let message='a0d65c15e20d13fd6876597d0b17cb4f1d900e43082ffbde65eacb7dc16380137a66382d5717269f65b1b48b1c49ffcbccdeec5732fbce6c388961765751776923ba50cbf4fb958ccd26c70a90a4c95cb90a737ade83daeed24ecaf7a30f2957c127e0213c3a7cceb7e7c69e5248a8ae';
// let str=  decrypt(message,IMKEY,IMIV);
// console.log(str);
