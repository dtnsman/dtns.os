/**
 * Created by poplang on 2023/1/3.
 */

// const { randomBytes } = require('crypto')
// const crypto = require('crypto');
// const secp256k1 = require('secp256k1')
// const bs58 = require(`bs58`);

/**
 * 使用bs58Encode编码
 * @type {bs58Encode}
 */
const key_util = {}
window.key_util = key_util

key_util.bs58Encode = bs58Encode;
function bs58Encode(msg)
{
    var MSG = bs58.encode(msg);
    return MSG;
}
/**
 * 使用bs58Decode解码
 * @type {bs58Decode}
 */
key_util.bs58Decode = bs58Decode;
function bs58Decode(msg)
{
    var MSG = bs58.decode(msg);
    return MSG;
}

/**
 * 使用hashName进行内容签名，得到hash值
 * @type {hashVal}
 */
key_util.hashVal = hashVal;
async function hashVal(msg,hashName = 'SHA-256')
{
    return  (await eccryptoJS.sha256(eccryptoJS.utf8ToBuffer(msg))).toString('hex')
    // return bs58Encode(Buffer.from(msg_hash));
}

/**
 * 生成新的private_key
 * @type {newPrivateKey}
 */
key_util.newPrivateKey = newPrivateKey;
function newPrivateKey()
{
    let keys = eccryptoJS.generateKeyPair()
    let prikey = bs58.encode(keys.privateKey)
    return prikey
}

/**
 * 生态新的publicKey
 * @type {getPublicKey}
 */
key_util.getPublicKey = getPublicKey;
function getPublicKey(privateKey){
    let privateKeyBuf = bs58Decode(privateKey)//bs58.encode( new Uint8Array((''+privateKey.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    if(typeof Buffer!='undefined') privateKeyBuf = Buffer.from(privateKeyBuf)
    let pubXStr = bs58.encode(eccryptoJS.getPublicCompressed(privateKeyBuf))// new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))
    return pubXStr
}

key_util.recoverPublickey = recoverPublickey;
async function recoverPublickey(sign,hash,num=0)
{
    let digest = eccryptoJS.hexToArray(hash) // Secp256k1.uint256(hash,16)
    let signArr = bs58.decode(sign)
    digest = typeof Buffer ? Buffer.from(digest) :digest
    signArr = typeof Buffer ? Buffer.from(signArr) :signArr
    let pubkey = bs58Encode( await eccryptoJS.recover(digest,signArr,true) )
    return pubkey
}

/**
 * 签名内容
 * @type {signMsg}
 */
key_util.signMsg = signMsg;
async function signMsg(msg,privKey){
    // console.log('signMsg-msg:',msg,'privKey:',privKey)
    let digest =  eccryptoJS.hexToArray(msg) 
    // console.log('digest:',digest)
    let prikey = bs58.decode(privKey) 
    // console.log('prikey:',prikey)
    if(typeof Buffer!='undefined'){
         prikey = Buffer.from(prikey)
         digest = Buffer.from(digest)
    }
    let sign =  await eccryptoJS.sign(prikey,digest,true) 
    let web3_sign=   bs58.encode(sign )
    return web3_sign
}

/**
 * 验证签名
 * @type {verifySignMsg}
 */
key_util.verifySignMsg = verifySignMsg;
async function verifySignMsg(msg, signature, pubKey)
{
    if(pubKey==null) return false
    // let pub_key = bs58Decode(pubKey)
    try{
        let sign    = bs58Decode(signature) 
        let msgOrigin=eccryptoJS.hexToArray(msg) 
        if(typeof Buffer!='undefined') msgOrigin = Buffer.from(msgOrigin)
        if(typeof Buffer!='undefined') sign = Buffer.from(sign)

        let recoverKey = await eccryptoJS.recover(msgOrigin,sign,true)
        recoverKey = bs58Encode(recoverKey)
        console.log('verifySignMsg:',recoverKey,pubKey)
        return recoverKey == pubKey
    }catch(ex)
    {
        console.log('verifySignMsg-exception:'+ex,ex,msg,signature,pubKey)
        return false
    }
    // console.log('verifySignMsg:',pub_key,sign,msgOrigin)
    // try{    
    //     await eccryptoJS.verify(pub_key,msgOrigin,sign)
    //     console.log('verifySignMsg is true')
    //     return true
    // }catch(ex){ 
    //     console.log('verifySignMsg - exception:'+ex)
    //     console.log('verifySignMsg is false')
    //     return false;
    // }
}

key_util.getHavedRecidSign = getHavedRecidSign;
function getHavedRecidSign(msg, signature, pubKey)
{
   //无法添加recv-id，也不影响，直接返回即可
   return signature
}

/**
 * 判断keys是否ok正确
 * @type {invalidateKeys}
 */
key_util.invalidateKeys = invalidateKeys;
function invalidateKeys(privateKey,publicKey)
{
    if(privateKey && publicKey ) {
        let pub_key ="";
        try {
            pub_key = getPublicKey(privateKey);
        }catch(err){
            console.log("invalidateKeys-error:"+err);
            return false;
        }

        if (pub_key.length <= 0 || ("" + pub_key) != publicKey)
            return false;
        else
            return true;
    }
    else{
        return false;
    }
}

/**
 * 检测签名和hash是否符合格式要求
 * @type {validateHashORSign}
 */
key_util.validateHashORSign = validateHashORSign
function validateHashORSign(hashOrSign)
{
    //2022-11-11新增（因为有了-recid）
   hashOrSign = (''+hashOrSign)
    if(hashOrSign && (""+hashOrSign).length>0)
    {
        let regExp = new RegExp("^[a-zA-Z0-9]+[a-zA-Z0-9]{8,256}$")
        //sub_token = sub_token.substring(0,3);

        //console.log("sub_token:"+sub_token)

        return regExp.test(""+hashOrSign);
    }
    return false;
}


async function test_keys(){

    let private_key = newPrivateKey();
    console.log("private_key:"+private_key+" length:"+private_key.length+" typeof="+(typeof private_key))

    pub_key = getPublicKey(private_key);
    console.log("pub_key:"+pub_key+" length:"+pub_key.length+" typeof="+(typeof pub_key))
    console.log("invalidateKeys:"+invalidateKeys(private_key,pub_key))
    
    // try{
    //     console.log("invalidateKeys:"+invalidateKeys("",""))
    //     console.log("invalidateKeys:"+invalidateKeys("1","2"))
    // }catch(err){
    //     console.log("invalidateKeys-err:"+err);
    // }

    var msg_text = "hello妹子你好啊，这是非常不错的字符啊"
    var msg_hash = await hashVal(msg_text);
    /*
    var msg_hash0 = hashVal(msg_text,"md5");
    console.log("msg_test:"+msg_text+"\nmsg_text.length:"+msg_text.length);
    console.log("msg_hash:"+msg_hash+" length:"+msg_hash.length)
    console.log("msg_hash0:"+msg_hash0+" length:"+msg_hash0.length)

    msg_hash_bs58 = bs58Encode(Buffer.from(msg_hash));
    msg_hash_str = bs58Decode(msg_hash_bs58);
    console.log("msg_hash_bs58:"+msg_hash_bs58+" length="+msg_hash_bs58.length+" typeof="+(typeof msg_hash_bs58))
    console.log("msg_hash_str:"+msg_hash_str+" length="+msg_hash_str.length+" typeof="+(typeof msg_hash_str))
    */

    console.log('msg_hash',msg_hash)
    sign =await signMsg(msg_hash,private_key)
    console.log("sign:"+sign+" length:"+sign.length)

    bverify = await verifySignMsg(msg_hash,sign,pub_key);
    console.log("bverify:"+bverify+" msg_hash:"+msg_hash+" sign:"+sign+" pub_key:"+pub_key)

}

// test_keys();


//test();

async function test() {
// or require('secp256k1/elliptic')
//   if you want to use pure js implementation in node
    var timestamp = Date.parse(new Date());
// generate message to sign
    let msg = Buffer.from("wellcom to beijing--from lauo.li", "utf8")
    msg = Buffer.from("202cb962ac59075b964b07152d234b70")//32字节,二进制 binnary
    msg = Buffer.from("202cb962ac59075b964b07152d234b70" + "202cb962ac59075b964b07152d234b70", "hex")
    msg = Buffer.from("202cb962ac59075b964b07152d234b70", "binary")//32字节,二进制 binnary

    var text = Buffer.from("wellcom to beijing--from lauo.li北京欢迎你，哈哈，是吗，这确实不错呢，你非常可以呢？3123423哈哈，翰的不错《}{}你是来自哪里呢，非常可以啊,11", "utf8")
    var md5 = crypto.createHash('md5').update(text).digest('hex');


    console.log("data:" + msg + ",md5:" + md5 + ",text=" + text + ",code-length=" + text.byteLength);
    msg = Buffer.from(md5);
// generate privKey
    let privKey
    do {
        privKey = msg;
        privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
        //privKey = randomBytes(32) //其实是一个buffer，二进制的buffer。
    } while (!secp256k1.privateKeyVerify(privKey))

// get the public key in a compressed format
//这里将一个hex十六进制的buffer转为字符串，又通过buffer转回来。
    var byteArray = new Buffer(privKey.toString('hex'), 'hex')
    console.log("privKey=" + privKey.toString('hex'));

    const pubKey = secp256k1.publicKeyCreate(byteArray)


// sign the message
    let sigObj;
    let flag;

    console.log('begin:'+new Date().getTime())

    console.time()
    for(i=0;i<10000;i++)
    {
        let sha_hash = crypto.createHash('sha256').update(text).digest('hex');
        //console.log('sha_hash:'+sha_hash)
        // sigObj = secp256k1.sign(Buffer.from(sha_hash), privKey)
// verify the signature
    }
    console.timeEnd()


    console.time()
for(i=0;i<10000;i++)
    {
        sigObj =  secp256k1.ecdsaSign(msg, privKey)
// verify the signature
    }
    console.timeEnd()
    console.log('end 0 :'+new Date().getTime())
    console.time()
    //console.log('time-end0:'+console.timeEnd())
for(i=0;i<10000;i++)
    {
        flag =  secp256k1.ecdsaVerify(sigObj.signature,msg,  pubKey);
    //    console.log('flag:'+flag)
    }
    console.timeEnd()




    console.log("data:" + msg);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + privKey.toString('hex') + ",length=" + privKey.length + " toString.length:" + privKey.toString('hex').length);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + privKey.toString('base64') + ",length=" + privKey.length + " toString.length:" + privKey.toString('base64').length);
    console.log("privKey:" + privKey + "|" + byteArray + "|" + bs58.encode(privKey) + ",length=" + privKey.length + " toString.length:" + bs58.encode(privKey).length + "===" + bs58.decode(bs58.encode(privKey)));
    console.log("pubKey:" + pubKey.toString('hex') + ",length=" + pubKey.length);
    console.log("sigObj:" + sigObj.signature.toString('hex') + ",length=" + sigObj.signature.length);
    console.log("flag:" + flag);


    console.log("used-time:" + (Date.parse(new Date()) - timestamp));

// => true


//buffer的一些编码测试：
    console.log("buffer-test:");
    const buf = Buffer.from('hello world', 'ascii');

    console.log(buf.toString('hex'));
// Prints: 68656c6c6f20776f726c64
    console.log(buf.toString('base64'));
// Prints: aGVsbG8gd29ybGQ=

    console.log(Buffer.from('fhqwhgads', 'ascii'));
// Prints: <Buffer 66 68 71 77 68 67 61 64 73>
    console.log(Buffer.from('fhqwhgads', 'utf16le'));
// Prints: <Buffer 66 00 68 00 71 00 77 00 68 00 67 00



   privKey = newPrivateKey();
   let pubKey0 = getPublicKey(privKey)
   msg = '8c296ad1e67e42d27267a871ee39b2c292282df027262ea2065ccc9948831a2e';
   console.time()
   for(i=0;i<10000;i++)
   {
       sigObj =  signMsg(msg,privKey)//secp256k1.ecdsaSign(msg, privKey)
   // verify the signature
   }
   console.timeEnd()
   console.log('end 0 :'+new Date().getTime())
   console.time()
   //console.log('time-end0:'+console.timeEnd())
   for(i=0;i<10000;i++)
   {
       flag =  verifySignMsg(msg,sigObj,pubKey0)//secp256k1.ecdsaVerify(sigObj.signature,msg,  pubKey);
   //    console.log('flag:'+flag)
   }
   console.timeEnd()
   
}
function testBrowser()
{

const a = bs58Decode('8Yxir41tmUEedK5nAoZqfH44bcnA89QngYodXi36wD4k').toString('hex')
console.log('a:'+a+' len:'+a.length)
const b = bs58Decode('puuWxs8GeTM28zHxRrr27bQ2pG5sUhJNiDKHb8RMwsfj').toString('hex')
console.log('b:'+b)

const hash = 'f7eef88671ce6da658c0fb838482e3d1aaef8e4dfc9a85d73517eb0485acb31d'
console.log('hash-len:'+hash.length)
const sign = signMsg(hash,'8Yxir41tmUEedK5nAoZqfH44bcnA89QngYodXi36wD4k')
const sign1 = Secp256k1.uint256( bs58Decode(sign),16).toString(16)//.toString('hex')
console.log('sign:'+sign+' len:'+sign.length+'\tsign2:'+sign1+' len:'+sign1.length)

let ret = 'E7E588F0FFCB82F5A2822A9523054E9127A91EC8A2008ADD32B6A7AA2A992EDB2AE6690423DF234E61C6D3060515D1557B9F08384636FD5F601D71CF60AA1775'
console.log('ret-len：'+ret.length)

//new Uint8Array((flagT+pubX.toString(16)).match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
//这里使用的是new Uint8Array方法来封装（而不是使用TextEncoder）
let priKey = bs58Encode( new Uint8Array(( '7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666').toString(16).match(/.{1,2}/g).map(byte => parseInt(byte, 16))))//Buffer.from('7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666','hex'))

const pubKey= getPublicKey(priKey)
console.log('priKey:'+priKey)
console.log('pubKey:'+pubKey)
console.log('pubKey-decode:'+bs58Decode(pubKey).toString('hex'))
const sign3= signMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',priKey)
console.log('sign3:'+bs58Decode(sign3).toString('hex'))

// const der = Secp256k1.signatureExport(bs58Decode(sign3))
// console.log('der:'+der.toString('hex'))
// //恢复public-key（是否也可用于较验）
// const rpubk = secp256k1.ecdsaRecover(bs58Decode(sign3),0,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk:'+Buffer.from(rpubk,'hex').toString('hex')+' array:'+rpubk)


// //成功还原了pubkey---证明函数是匹配的（前后端统一与匹配：https://github.com/lionello/secp256k1-js）
// let sign4 = 'ce09f8e34df7773df407183d9b84ae31cd8f680caf4ea237fa4af54cb750db5b3ff768e1c6af77b02217ba1ee3dbcab85edf81cc0921218355265e2e6561fd71'
// let sign5 = 'b73dcca7ade792a48d2e14548d8f53b6799e7f2dea2480af8051160e50da20032e8a932b2506e4c1c036c3aed2df19de222f6aaf74ee8eb2d00a3bd69702cf9e'
// sign5 = '90be2facb42bcdf7aa560062afdfa40cd38b04680668398e001d3810295238cf6622c11f354d1b4d24ef18db77e0bf52ccdb69b488b64451c8d8ac51c8205fd0'
// //sign5 = '91D7E304B178D3B161F55AEFFA47CBD00D4FDF4C90051B26CBC6AEC614E9000F1ACF9982A715434771401A5E7AB3D58F87128F8D289C192D14A95CD6122EBA52'.toLowerCase()
// //sign5 = 'A46958CA8418DCC323EBB500A6C6D52CC2F2CA36FE00285105E9923D4BC6389C8A8F77FAF89E7665DA41B4C91A5FDF49FEB6B26746B4BF433D1FEC237C2AC9CF'.toLowerCase()
// //这是browser的还原，recid=0
// const rpubk2 = secp256k1.ecdsaRecover(Buffer.from(sign5,'hex'),0,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk2:'+Buffer.from(rpubk2,'hex').toString('hex')+' array:'+rpubk2)
// //这是browser的还原，recid=1
// const rpubk3 = secp256k1.ecdsaRecover(Buffer.from(sign4,'hex'),1,Buffer.from('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8','hex'))
// console.log('rpubk3:'+Buffer.from(rpubk3,'hex').toString('hex')+' array:'+rpubk2)


// let sign4encode = bs58Encode(Buffer.from(sign4,'hex'))
// let sign5encode = bs58Encode(Buffer.from(sign5,'hex'))
// let checkFlag = verifySignMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
//                        sign5encode,pubKey)
// let checkFlag2 = verifySignMsg('483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8',
//                        sign3,pubKey)
// console.log('checkFlag:'+checkFlag)
// console.log('checkFlag2:'+checkFlag2)
// console.log('pubKey:'+  bs58Decode( pubKey).toString('hex'))
}
// console.log('--------------------testBrowser')
// testBrowser()
// test()
/*
//  pubx:d02e02c044bdea76439983b5d3a7de8cc3150ef3dc59d0bcff81ebdff37a4e2b 
//  puby:80e70b40b4051aa22069637f16bfb3f40fedabbacc8dbb307841a3d6038ff4f0
// index.html:62 Signature must be valid:true 
// prikey:e2bf59a30df9b0fba003cd304d059c4ae4690c9628d7c38cf4ffa0b603a6c2d3 len:64

pubx:acd29ab0ae01e53d239c6b53a082cdbe78b865fad28db51a37ba4ab65e0b9339 puby:a7506323481e0a2d8cf8b804b9da83ad8e20829e23b0d4b880e4c44a86d00f11
index.html:62 
signR:b73dcca7ade792a48d2e14548d8f53b6799e7f2dea2480af8051160e50da2003 
signS:2e8a932b2506e4c1c036c3aed2df19de222f6aaf74ee8eb2d00a3bd69702cf9e
index.html:63 Signature must be valid:true 
prikey:7ecd5cb78755d45deb5087d2327c70245cd6b8ed2e1116f18d9667de87514666


483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
*/