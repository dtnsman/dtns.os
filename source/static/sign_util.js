// globalThis.window = globalThis

const crypto = require('crypto')
// const eccryptoJS =  require('eccrypto-js')
// window.eccryptoJS = eccryptoJS
// const bs58 = require(`bs58`);
// window.bs58 = bs58
// const BigNumber = require('bignumber.js');
// window.BigNumber = BigNumber

// require('./key_util_eccryptojs')

window.sign_util = {}
sign_util.getInnerMsgSign = getInnerMsgSign
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

sign_util.getTURNCredentialsPWD = getTURNCredentialsPWD
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
sign_util.encryptSomethingInfo = encryptSomethingInfo
async function encryptSomethingInfo(infoStr,public_key='')
{
    let pubkey =key_util.bs58Decode( public_key)
    if(typeof Buffer!='undefined') pubkey = Buffer.from(pubkey)
    const encrypted = await eccryptoJS.encrypt(pubkey, eccryptoJS.utf8ToBuffer(infoStr))
    console.log(encrypted)
    let buff = new Uint8Array(encrypted.iv.length+encrypted.ephemPublicKey.length+encrypted.mac.length+encrypted.ciphertext.length)
    buff.set(encrypted.iv,0);
    buff.set(encrypted.ephemPublicKey,encrypted.iv.length);
    buff.set(encrypted.mac,encrypted.ephemPublicKey.length+encrypted.iv.length)
    buff.set(encrypted.ciphertext,encrypted.mac.length+encrypted.ephemPublicKey.length+encrypted.iv.length)
    // let buff = Array.concat([encrypted.iv,encrypted.ephemPublicKey,encrypted.mac,encrypted.ciphertext])
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
sign_util.decryptSomethingInfo = decryptSomethingInfo
async function decryptSomethingInfo(enmsg,private_key='')
{
    console.log('enmsg:'+enmsg,typeof enmsg,private_key)
    let enmsgBuff =  key_util.bs58Decode(enmsg) 
    let encrypted = {iv:enmsgBuff.slice(0,16),ephemPublicKey:enmsgBuff.slice(16,16+65),mac:enmsgBuff.slice(16+65,16+65+32),ciphertext:enmsgBuff.slice(16+65+32,enmsgBuff.length)}
    let prikey =key_util.bs58Decode( private_key)
    if(typeof Buffer!='undefined'){
        prikey = Buffer.from(prikey)
        encrypted.ephemPublicKey = Buffer.from( encrypted.ephemPublicKey )
    } 
    const decrypted = await eccryptoJS.decrypt(prikey , encrypted)
    let deMsg = eccryptoJS.bufferToUtf8(decrypted)
    console.log('deMsg:'+deMsg,deMsg.length)
    return deMsg
}

window.sign_util.newTXID = newTXID
function newTXID()
{
    let randomID = key_util.newPrivateKey()
    if(randomID) return 'txid_'+ randomID.substring(0,16)
    return null
}

window.sign_util.toTXJSONString = toTXJSONString
function toTXJSONString(TXINFO)
{
    let {txid,token_x,token_y,opcode,opval,token_state,token_height,pre_txid,extra_data,timestamp_i}=TXINFO;
    let TXINFO_JSON = {txid:""+txid,token_x:""+token_x,token_y:""+token_y,opcode:""+opcode,opval:""+opval,extra_data:""+extra_data,timestamp_i:""+timestamp_i};

    if(TXINFO.hasOwnProperty("token_state"))
    {
        TXINFO_JSON.token_state = ""+TXINFO.token_state
    }
    if(TXINFO.hasOwnProperty('token_height'))
    {
        TXINFO_JSON.token_height = TXINFO.token_height
    }
    if(TXINFO.hasOwnProperty('public_key'))
    {
        TXINFO_JSON.public_key = TXINFO.public_key
    }
    if(TXINFO.pre_txid)
    {
        TXINFO_JSON.pre_txid = TXINFO.pre_txid
    }

    return JSON.stringify(TXINFO_JSON);
}

sign_util.getWeb3keyAes256 = getWeb3keyAes256
function getWeb3keyAes256()
{
    let iv = eccryptoJS.randomBytes(16)  //salt  盐，需要一致才能解密。
    let aeskey = eccryptoJS.randomBytes(32)
    let buff = new Uint8Array(aeskey.length+iv.length)
    buff.set(aeskey,0);buff.set(iv,aeskey.length)
    let webkey = key_util.bs58Encode(buff)
    return webkey
}
sign_util.decodeWeb3keyAes256Str = decodeWeb3keyAes256Str
function decodeWeb3keyAes256Str(keyStr)
{
    let buff = key_util.bs58Decode(keyStr)
    if(buff.length != 32+16) return null
    let iv = buff.slice(32,buff.length)   //salt  盐，需要一致才能解密。
    let aeskey = buff.slice(0,32)
    return {iv,aeskey}
}

sign_util.importSecretKey = importSecretKey
function importSecretKey(rawKey) {
    return window.crypto.subtle.importKey(
      "raw",
      rawKey,
      "AES-CBC",
      true,
      ["encrypt", "decrypt"]
    );
  }
sign_util.encryptMessage = encryptMessage
async function encryptMessage(key,iv,text,isTextFlag = true) {
    let begin = new Date().getTime()
    let message = text
    let enc = new TextEncoder();
    let encoded = isTextFlag ? enc.encode(message) : message
    console.log('encryptMessage-encoded:',encoded)
    let buffer = null
    if(typeof Buffer =='undefined')
    {
        let ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-CBC",
                iv
            },
            key,
            encoded
        );
        buffer = ciphertext // new Uint8Array(ciphertext, 0, 5);
        
    }
    else{
        const decipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        buffer = decipher.update(encoded)
        let finalBuff = decipher.final()
        buffer = Buffer.concat([buffer,finalBuff])
    }
    // The iv must never be reused with a given key.
    // iv = window.crypto.getRandomValues(new Uint8Array(16));
    console.log('used-time:'+(new Date().getTime()-begin))
    // return buffer
    return isTextFlag ? key_util.bs58Encode(new Uint8Array(buffer)) :new Uint8Array(buffer)
  }

  /*
  Fetch the ciphertext and decrypt it.
  Write the decrypted message into the "Decrypted" box.
  */
 sign_util.decryptMessage = decryptMessage
  async function decryptMessage(key,iv,ciphertext,isTextFlag=true) {
    // console.log('into decryptMessage:',key,iv,ciphertext,isTextFlag)
    let en1 = null;
    if(isTextFlag)
    {
        try{
            en1 = key_util.bs58Decode( ciphertext)
        }catch(ex){
            console.log('decryptMessage-bs58Decode-ciphertext-exception:'+ex,ciphertext)
            en1 = ciphertext
        }
    }else{
        en1 = ciphertext
    }
    try{
        // console.log('en1:',en1)
        let begin = Date.now()
        let decrypted = null
        if(typeof Buffer =='undefined')
        {
            decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-CBC",
                iv
            },
            key,
            en1
            );
        }else{
            const cipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            decrypted = cipher.update(en1);
            let buffer = cipher.final()
            decrypted = Buffer.concat([decrypted,buffer])
        }

        if(isTextFlag){
            let dec = new TextDecoder();
            let textContent = dec.decode(decrypted);
            // console.log('decryptMessage-text:'+textContent)
            console.log('used-time:'+(new Date().getTime()-begin))
            return textContent
        }else
        {
            return new Uint8Array(decrypted)
        }
    }catch(ex)
    {
        console.log('into decryptMessage-ex:'+ex)
        return null
    }
  }

sign_util.hashVal = hashVal;
async function hashVal(msg,hashName = 'SHA-256')
{
    return key_util.bs58Encode(  (await eccryptoJS.sha256(eccryptoJS.utf8ToBuffer(msg))))
    // return bs58Encode(Buffer.from(msg_hash));
}
async function test()
{
    console.time()
    const privateKey = key_util.newPrivateKey()
    const public_key = key_util.getPublicKey(privateKey)
    let str = '我是认证11111111111111111112znvS6gVBoYKB6R5JEAf3eZEKNsKrCVtHzmyZubNovXxF6TbDHuLDBFCuvbmtjTtvYJKT6NRduViS4X7KiPSu5jJyWh185wAhAUPBC7pFDCJdHGu2tdcqrGb8WSpmiXjHzoVmnDsW53yLCLEb1jySPMBsp9xp7uspC32Hhoz5w67e86ratFFfKz5SPP39hgqADrQej'
    let enMsg = await encryptSomethingInfo(str,public_key)//'18675516875|'+Date.now(),public_key)
    console.log('enMsg:'+enMsg,enMsg.length)
    let deMsg = await decryptSomethingInfo(enMsg,privateKey)
    console.log('deMsg:',deMsg,deMsg.length)
    console.timeEnd()


    let keyStr = getWeb3keyAes256()
    console.log('keyStr',keyStr,keyStr.length)
    console.log('keyStr-web3key-hash:'+await hashVal(keyStr))
    let {iv,aeskey} = decodeWeb3keyAes256Str(keyStr)
    console.log('iv:',iv,'aeskey:',aeskey)

    // console.log('import-key:',await importSecretKey(aeskey))
    let en1 = await encryptMessage(typeof Buffer == 'undefined' ? await importSecretKey(aeskey) :aeskey,iv,str)
    console.log('en1:',en1.length,new Uint8Array(en1),en1)//,btoa((new Uint8Array(en1))))
    let text = await decryptMessage(typeof Buffer == 'undefined' ? await importSecretKey(aeskey) :aeskey,iv,en1)
    console.log('text:',text)



}

// test()

// const encrypted = await eccryptoJS.encrypt(public_key, msg);//keyPair.publicKey
// console.log('encrypted',encrypted,JSON.stringify(encrypted),JSON.parse(JSON.stringify(encrypted)))
// const decrypted = await eccryptoJS.decrypt(keyPair.privateKey, encrypted);

// var xpwd = getTURNCredentials('user1','Bkj46bOLbCaC2wmmWEOSLndQtxs')//'YjXverJx231vJPok')
// console.log('xpwd',xpwd)

