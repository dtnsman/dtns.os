const crypto =  require('crypto')
const eccryptoJS =  require('eccrypto-js')
const key_util = require('./key_util')

module.exports.getInnerMsgSign = getInnerMsgSign
function getInnerMsgSign(msg, secret)
{
    let hmac =crypto.createHmac('sha256',secret)
    // let msg =time + "\n" + secret
   //  msg = '1678370466498'+ "\n" + secret
    hmac.setEncoding('base64');
    hmac.write(msg);
    hmac.end() ;
    let sign = hmac .read();
    return sign
}

module.exports.getTURNCredentialsPWD = getTURNCredentialsPWD
function getTURNCredentialsPWD(name, secret,timeout = 60*60*24*30)//1个月  60*60*24*365*100 100years(内部使用)
{
    var unixTimeStamp = parseInt(Date.now()/1000) + timeout,
        username = [unixTimeStamp, name].join(':'),password,
        hmac = crypto.createHmac('sha1',secret)// Buffer.from( secret));
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end() ;
    password = hmac .read();
    return {
        username: username,
        password: password
    }
}

/**
 * 使用ecc-publicKey加密
 * @param {*} infoStr 
 * @param {*} public_key 
 * @returns 
 */
module.exports.encryptSomethingInfo = encryptSomethingInfo
async function encryptSomethingInfo(infoStr,public_key='')
{
    const encrypted = await eccryptoJS.encrypt( Buffer.from( key_util.bs58Decode( public_key)), eccryptoJS.utf8ToBuffer(infoStr))
    console.log(encrypted)
    let buff = Buffer.concat([encrypted.iv,encrypted.ephemPublicKey,encrypted.mac,encrypted.ciphertext])
    console.log('lens:',encrypted.iv.length,encrypted.ephemPublicKey.length,encrypted.mac.length,encrypted.ciphertext.length)
    let enmsg = key_util.bs58Encode(buff)
    console.log('enmsg:',enmsg,enmsg.length)
    return enmsg
}
/**
 * 使用ecc-privateKey解密
 * @param {*} enmsg 
 * @param {*} private_key 
 * @returns 
 */
module.exports.decryptSomethingInfo = decryptSomethingInfo
async function decryptSomethingInfo(enmsg,private_key='')
{
    console.log('enmsg:'+enmsg,typeof enmsg,private_key)
    let enmsgBuff = Buffer.from( key_util.bs58Decode(enmsg) )
    let encrypted = {iv:enmsgBuff.slice(0,16),ephemPublicKey:enmsgBuff.slice(16,16+65),mac:enmsgBuff.slice(16+65,16+65+32),ciphertext:enmsgBuff.slice(16+65+32,enmsgBuff.length)}
    const decrypted = await eccryptoJS.decrypt(Buffer.from( key_util.bs58Decode(private_key) ), encrypted)
    let deMsg = eccryptoJS.bufferToUtf8(decrypted)
    console.log('deMsg:'+deMsg,deMsg.length)
    return deMsg
}

async function test()
{
    console.time()
    const privateKey = key_util.newPrivateKey()
    const public_key = key_util.getPublicKey(privateKey)
    let enMsg = await encryptSomethingInfo('2znvS6gVBoYKB6R5JEAf3eZEKNsKrCVtHzmyZubNovXxF6TbDHuLDBFCuvbmtjTtvYJKT6NRduViS4X7KiPSu5jJyWh185wAhAUPBC7pFDCJdHGu2tdcqrGb8WSpmiXjHzoVmnDsW53yLCLEb1jySPMBsp9xp7uspC32Hhoz5w67e86ratFFfKz5SPP39hgqADrQej',public_key)//'18675516875|'+Date.now(),public_key)
    console.log('enMsg:'+enMsg,enMsg.length)
    let deMsg = await decryptSomethingInfo(enMsg,privateKey)
    console.log('deMsg:',deMsg,deMsg.length)
    console.timeEnd()
}

// test()

// const encrypted = await eccryptoJS.encrypt(public_key, msg);//keyPair.publicKey
// console.log('encrypted',encrypted,JSON.stringify(encrypted),JSON.parse(JSON.stringify(encrypted)))
// const decrypted = await eccryptoJS.decrypt(keyPair.privateKey, encrypted);

// var xpwd = getTURNCredentials('user1','Bkj46bOLbCaC2wmmWEOSLndQtxs')//'YjXverJx231vJPok')
// console.log('xpwd',xpwd)

